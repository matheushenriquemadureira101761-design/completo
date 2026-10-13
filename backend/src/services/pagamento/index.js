// Pagamento pelo site (link pessoal enviado no WhatsApp): escolhe a empresa, cria Pix ou assinatura no cartão
// e processa os avisos de pagamento. Sem empresa configurada, só funciona em MODO_TESTE (simulação).
import { consulta } from '../../db.js';
import { config } from '../../config.js';
import { ErroApp } from '../../lib/erros.js';
import { agoraLocal } from '../../lib/datas.js';
import { registrarPagamento, criarLinkPagamento, primeiroNome } from '../assinaturas.js';
import { enviarMensagem } from '../mensagens/index.js';
import * as asaas from './asaas.js';
import * as simulado from './simulado.js';

const DESCRICAO = 'Assinatura AGROVINC (1 mês)';
const PIX_REAPROVEITA_MIN = 20;   // mesmo Pix se a pessoa tocar de novo em pouco tempo
const CARTAO_REAPROVEITA_H = 24;  // mesma página do cartão no mesmo dia (evita assinaturas repetidas)

/** Empresa em uso: asaas (com chave), simulado (só em modo de teste) ou null (pagamento pelo site desligado). */
export function empresa() {
  const p = config.pagamento;
  if (p.provedor === 'asaas' && p.asaas.chave) return asaas;
  if (config.modoTeste) return simulado;
  return null;
}

function exigirEmpresa() {
  const e = empresa();
  if (!e) throw new ErroApp(503, 'O pagamento pelo site está em manutenção. Tente de novo mais tarde ou assine pelo app.', 'pagamento_desligado');
  return e;
}

async function garantirCliente(e, usuario, documento) {
  const atual = (await consulta('SELECT * FROM pagamento_clientes WHERE usuario_id = $1', [usuario.id])).rows[0];
  if (atual && atual.provedor === e.nome) {
    if (atual.documento !== documento) {
      await e.atualizarDocumento(atual.cliente_id, documento);
      await consulta('UPDATE pagamento_clientes SET documento = $2 WHERE usuario_id = $1', [usuario.id, documento]);
    }
    return atual.cliente_id;
  }
  const clienteId = await e.criarCliente({ nome: usuario.nome, documento, celular: String(usuario.whatsapp).slice(2), referencia: `usuario:${usuario.id}` });
  await consulta(
    `INSERT INTO pagamento_clientes (usuario_id, provedor, cliente_id, documento) VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario_id) DO UPDATE SET provedor = $2, cliente_id = $3, documento = $4, criado_em = NOW()`,
    [usuario.id, e.nome, clienteId, documento]);
  return clienteId;
}

/** Cria (ou reaproveita) o Pix de um mês. */
export async function iniciarPix(usuario, documento, linkHash) {
  const e = exigirEmpresa();
  await consulta('UPDATE usuarios SET documento = $2 WHERE id = $1', [usuario.id, documento]);
  const recente = (await consulta(
    `SELECT id_externo, dados FROM cobrancas WHERE usuario_id = $1 AND provedor = $2 AND tipo = 'pix' AND status = 'pendente'
       AND dados->>'documento' = $3 AND criado_em > NOW() - ($4 || ' minutes')::interval
     ORDER BY criado_em DESC LIMIT 1`, [usuario.id, e.nome, documento, String(PIX_REAPROVEITA_MIN)])).rows[0];
  if (recente) return { cobranca: recente.id_externo, copiaECola: recente.dados.copiaECola, qrCodePng: recente.dados.qrCodePng ?? null };
  const clienteId = await garantirCliente(e, usuario, documento);
  const hoje = agoraLocal(usuario.fuso).data;
  const pix = await e.criarPix({ clienteId, valorCentavos: config.assinatura.valorCentavos, vencimento: hoje, descricao: DESCRICAO, referencia: `usuario:${usuario.id}` });
  await consulta(
    `INSERT INTO cobrancas (id_externo, provedor, usuario_id, tipo, link_hash, dados) VALUES ($1, $2, $3, 'pix', $4, $5)`,
    [pix.idExterno, e.nome, usuario.id, linkHash, { documento, copiaECola: pix.copiaECola, qrCodePng: pix.qrCodePng, expiraEm: pix.expiraEm }]);
  return { cobranca: pix.idExterno, copiaECola: pix.copiaECola, qrCodePng: pix.qrCodePng };
}

/** Cria (ou reaproveita) a assinatura no cartão e devolve a página segura da empresa. */
export async function iniciarCartao(usuario, documento, linkHash) {
  const e = exigirEmpresa();
  await consulta('UPDATE usuarios SET documento = $2 WHERE id = $1', [usuario.id, documento]);
  const recente = (await consulta(
    `SELECT id_externo, dados FROM cobrancas WHERE usuario_id = $1 AND provedor = $2 AND tipo = 'assinatura_cartao' AND status = 'pendente'
       AND dados->>'documento' = $3 AND criado_em > NOW() - ($4 || ' hours')::interval
     ORDER BY criado_em DESC LIMIT 1`, [usuario.id, e.nome, documento, String(CARTAO_REAPROVEITA_H)])).rows[0];
  if (recente) return { cobranca: recente.id_externo, url: recente.dados.url ?? null, simulado: e.nome === 'simulado' };
  const clienteId = await garantirCliente(e, usuario, documento);
  const hoje = agoraLocal(usuario.fuso).data;
  const s = await e.criarAssinaturaCartao({ clienteId, valorCentavos: config.assinatura.valorCentavos, primeiroVencimento: hoje, descricao: DESCRICAO, referencia: `usuario:${usuario.id}` });
  await consulta(
    `INSERT INTO cobrancas (id_externo, provedor, usuario_id, tipo, link_hash, dados) VALUES ($1, $2, $3, 'assinatura_cartao', $4, $5)`,
    [s.idExterno, e.nome, usuario.id, linkHash, { documento, url: s.url }]);
  return { cobranca: s.idExterno, url: s.url, simulado: e.nome === 'simulado' };
}

export async function situacaoCobranca(usuarioId, idExterno) {
  const c = (await consulta('SELECT status FROM cobrancas WHERE id_externo = $1 AND usuario_id = $2', [idExterno, usuarioId])).rows[0];
  if (!c) throw new ErroApp(404, 'Cobrança não encontrada.', 'cobranca_inexistente');
  return { status: c.status };
}

async function usuarioDoEvento(ev, provedor) {
  for (const id of [ev.idPagamento, ev.assinaturaId].filter(Boolean)) {
    const r = (await consulta('SELECT usuario_id FROM cobrancas WHERE id_externo = $1', [id])).rows[0];
    if (r) return r.usuario_id;
  }
  if (ev.clienteId) {
    const r = (await consulta('SELECT usuario_id FROM pagamento_clientes WHERE provedor = $1 AND cliente_id = $2', [provedor, ev.clienteId])).rows[0];
    if (r) return r.usuario_id;
  }
  return null;
}

/**
 * Aviso da empresa já traduzido: { tipo: 'pago' | 'recusado', idPagamento, assinaturaId, clienteId, metodo, finalCartao, valorCentavos }.
 * Pagou com Pix tendo assinatura no cartão? A do cartão é cancelada (a pessoa nunca paga duas vezes).
 * Assinou um cartão novo? O antigo é cancelado.
 */
export async function processarEvento(ev, e = empresa()) {
  if (!e || !ev || ev.tipo === 'ignorar') return { ignorado: ev?.evento ?? true };
  const usuarioId = await usuarioDoEvento(ev, e.nome);
  if (!usuarioId) { console.error(`[Pagamento] aviso sem usuário conhecido: ${ev.idPagamento}`); return { ignorado: 'usuario_desconhecido' }; }

  if (ev.tipo === 'pago') {
    const antes = (await consulta('SELECT origem, id_externo FROM assinaturas WHERE usuario_id = $1', [usuarioId])).rows[0];
    const r = await registrarPagamento({
      usuarioId, origem: 'site', metodo: ev.metodo, idExterno: `${e.nome}:${ev.idPagamento}`, finalCartao: ev.finalCartao,
      ...(ev.valorCentavos ? { valorCentavos: ev.valorCentavos } : {}),
    });
    await consulta(`UPDATE cobrancas SET status = 'paga', atualizado_em = NOW() WHERE id_externo = ANY($1) AND status <> 'cancelada'`, [[ev.idPagamento, ev.assinaturaId].filter(Boolean)]);
    if (r.repetido) return { ok: true, repetido: true };
    const cartaoAntigo = antes?.origem === 'site' && antes.id_externo ? antes.id_externo : null;
    const novoId = ev.metodo === 'cartao' ? ev.assinaturaId : null;
    if (cartaoAntigo && cartaoAntigo !== novoId) {
      await e.cancelarAssinatura(cartaoAntigo).catch((err) => console.error(`[Pagamento] não cancelou a assinatura ${cartaoAntigo}: ${err.message}`));
      await consulta(`UPDATE cobrancas SET status = 'cancelada', atualizado_em = NOW() WHERE id_externo = $1`, [cartaoAntigo]);
    }
    await consulta('UPDATE assinaturas SET id_externo = $2 WHERE usuario_id = $1', [usuarioId, novoId]);
    return { ok: true, vencimento: r.vencimento };
  }

  if (ev.tipo === 'recusado') {
    await consulta(`UPDATE cobrancas SET status = 'recusada', atualizado_em = NOW() WHERE id_externo = $1 AND status = 'pendente'`, [ev.idPagamento]);
    const u = (await consulta('SELECT * FROM usuarios WHERE id = $1', [usuarioId])).rows[0];
    if (u) await enviarMensagem({ usuario: u, tipo: 'cartao_recusado', chave: `recusado:${e.nome}:${ev.idPagamento}`, vars: { nome: primeiroNome(u.nome), final: ev.finalCartao ?? '----', link: await criarLinkPagamento(u.id) } });
    return { ok: true };
  }
  return { ignorado: ev.tipo };
}

/** Na exclusão da conta: para a cobrança automática no cartão. */
export async function cancelarCobrancaAutomatica(usuarioId) {
  const a = (await consulta('SELECT origem, id_externo FROM assinaturas WHERE usuario_id = $1', [usuarioId])).rows[0];
  if (a?.origem !== 'site' || !a.id_externo) return;
  const prov = (await consulta('SELECT provedor FROM cobrancas WHERE id_externo = $1', [a.id_externo])).rows[0]?.provedor;
  const e = prov === 'asaas' ? asaas : prov === 'simulado' ? simulado : empresa();
  if (e) await e.cancelarAssinatura(a.id_externo);
}

/** Só em MODO_TESTE: simula a aprovação de uma cobrança (para testar a página sem empresa de pagamento). */
export async function simularPagamento(usuarioId, idExterno) {
  if (!config.modoTeste) throw new ErroApp(404, 'Endereço não encontrado.', 'nao_encontrado');
  const c = (await consulta('SELECT * FROM cobrancas WHERE id_externo = $1 AND usuario_id = $2', [idExterno, usuarioId])).rows[0];
  if (!c) throw new ErroApp(404, 'Cobrança não encontrada.', 'cobranca_inexistente');
  const tipo = c.tipo === 'pix' ? 'pix' : 'cartao';
  return processarEvento({ tipo: 'pago', idPagamento: tipo === 'pix' ? c.id_externo : `${c.id_externo}_1`, assinaturaId: tipo === 'cartao' ? c.id_externo : null, metodo: tipo, finalCartao: tipo === 'cartao' ? '4242' : null }, c.provedor === 'asaas' ? asaas : simulado);
}
