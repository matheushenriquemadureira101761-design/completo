import { Router } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usuarioDoLink, usuarioDoLinkParaConsulta, registrarPagamento, situacaoDo, primeiroNome, valorBR, criarLinkPagamento, assinaturaDe } from '../services/assinaturas.js';
import { formatarCelular, validarDocumento } from '../lib/validacao.js';
import { formatarDataBR } from '../lib/datas.js';
import { resumo } from '../lib/seguranca.js';
import { consulta } from '../db.js';
import { config } from '../config.js';
import { ErroApp } from '../lib/erros.js';
import { enviarMensagem } from '../services/mensagens/index.js';
import * as Pag from '../services/pagamento/index.js';
import * as asaas from '../services/pagamento/asaas.js';

export const rotasPagamentos = Router();
const PAGINA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'ativar.html');

/** Quem assina pela loja precisa cancelar lá antes de pagar pelo site (senão pagaria duas vezes). */
async function assinaturaDaLojaEmDia(usuario) {
  const a = await assinaturaDe(usuario.id);
  const s = await situacaoDo(usuario);
  return Boolean(a && a.origem !== 'site' && !a.cancelada_em && s.acesso && a.vencimento >= s.hoje);
}

function documentoValido(valor) {
  const r = validarDocumento(valor);
  if (!r.ok) throw new ErroApp(400, r.erro, 'documento');
  return r.valor;
}

// Página de pagamento (o navegador abre o link pessoal enviado no WhatsApp) ou os dados dela em JSON.
rotasPagamentos.get('/ativar/:token', async (req, res) => {
  if (req.accepts(['json', 'html']) === 'html') return res.sendFile(PAGINA);
  const u = await usuarioDoLink(req.params.token);
  const s = await situacaoDo(u);
  const e = Pag.empresa();
  res.json({
    nome: u.nome, primeiroNome: primeiroNome(u.nome), whatsapp: formatarCelular(u.whatsapp.slice(2)),
    perfil: u.contratante && u.fornecedor ? 'Contratante e fornecedor' : (u.fornecedor ? 'Fornecedor' : 'Contratante'),
    cidade: `${u.cidade} - ${u.uf}`, testeFim: formatarDataBR(u.teste_fim, false), valor: valorBR(), situacao: s,
    pagamento: { disponivel: Boolean(e), simulado: e?.nome === 'simulado', assinaLoja: await assinaturaDaLojaEmDia(u) },
  });
});

async function preparar(req) {
  const u = await usuarioDoLink(req.params.token);
  if (await assinaturaDaLojaEmDia(u)) throw new ErroApp(409, 'Você já assina pelo Google Play ou pela App Store. Para pagar por aqui, cancele primeiro a assinatura na loja.', 'assina_loja');
  return { u, documento: documentoValido(req.body?.documento), linkHash: resumo(req.params.token) };
}

rotasPagamentos.post('/ativar/:token/pix', async (req, res) => {
  const { u, documento, linkHash } = await preparar(req);
  res.json(await Pag.iniciarPix(u, documento, linkHash));
});

rotasPagamentos.post('/ativar/:token/cartao', async (req, res) => {
  const { u, documento, linkHash } = await preparar(req);
  res.json(await Pag.iniciarCartao(u, documento, linkHash));
});

rotasPagamentos.get('/ativar/:token/cobranca/:id', async (req, res) => {
  const u = await usuarioDoLinkParaConsulta(req.params.token);
  res.json(await Pag.situacaoCobranca(u.id, req.params.id));
});

// Só em MODO_TESTE: aprova a cobrança simulada (testar a página sem empresa de pagamento).
rotasPagamentos.post('/ativar/:token/simular', async (req, res) => {
  if (!config.modoTeste) throw new ErroApp(404, 'Endereço não encontrado.', 'nao_encontrado');
  const u = await usuarioDoLinkParaConsulta(req.params.token);
  res.json(await Pag.simularPagamento(u.id, String(req.body?.cobranca ?? '')));
});

// Aviso do Asaas (configure no painel do Asaas: Integrações → Webhooks, com o mesmo token de ASAAS_WEBHOOK_TOKEN).
rotasPagamentos.post('/pagamentos/asaas', async (req, res) => {
  const ev = asaas.lerWebhook(req.headers, req.body);
  if (!ev) throw new ErroApp(401, 'Não autorizado.', 'webhook');
  const r = await Pag.processarEvento(ev, asaas);
  res.json({ ok: true, ...r });
});

/**
 * Aviso de pagamento em formato neutro (para outra empresa ou integração própria). Proteção: cabeçalho X-Webhook-Secret.
 * Corpo: { evento: 'pago' | 'recusado', idExterno, linkToken | usuarioId, metodo: 'pix' | 'cartao', finalCartao? }
 */
rotasPagamentos.post('/pagamentos/webhook', async (req, res) => {
  const segredo = config.pagamento.segredoWebhook;
  const recebido = String(req.headers['x-webhook-secret'] ?? '');
  const valido = segredo ? (recebido.length === segredo.length && crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(segredo))) : config.modoTeste;
  if (!valido) throw new ErroApp(401, 'Não autorizado.', 'webhook');
  const { evento, idExterno, linkToken, metodo, finalCartao } = req.body;
  let { usuarioId } = req.body;
  if (!usuarioId && linkToken) usuarioId = (await usuarioDoLink(linkToken)).id;
  if (!usuarioId || !idExterno) throw new ErroApp(400, 'Pagamento sem usuário ou sem id.', 'dados');
  if (evento === 'pago') {
    const r = await registrarPagamento({ usuarioId, origem: 'site', metodo: metodo === 'cartao' ? 'cartao' : 'pix', idExterno, finalCartao });
    return res.json({ ok: true, ...r });
  }
  if (evento === 'recusado') {
    const u = (await consulta('SELECT * FROM usuarios WHERE id = $1', [usuarioId])).rows[0];
    if (u) await enviarMensagem({ usuario: u, tipo: 'cartao_recusado', chave: `recusado:${idExterno}`, vars: { nome: primeiroNome(u.nome), final: finalCartao ?? '----', link: await criarLinkPagamento(u.id) } });
    return res.json({ ok: true });
  }
  res.json({ ok: true, ignorado: evento });
});
