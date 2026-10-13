import { consulta, transacao } from '../db.js';
import { config } from '../config.js';
import { agoraLocal, situacaoAcesso, novoVencimento, formatarDataBR } from '../lib/datas.js';
import { gerarToken, resumo } from '../lib/seguranca.js';
import { ErroApp } from '../lib/erros.js';
import { enviarMensagem } from './mensagens/index.js';

export const valorBR = () => (config.assinatura.valorCentavos / 100).toFixed(2).replace('.', ',');
export const primeiroNome = (nome) => String(nome).trim().split(/\s+/)[0];

export async function assinaturaDe(usuarioId, db = { query: consulta }) {
  return (await db.query('SELECT * FROM assinaturas WHERE usuario_id = $1', [usuarioId])).rows[0] ?? null;
}

/** Situação atual (teste, ativa, atrasada, pausada...) no fuso da pessoa. */
export async function situacaoDo(usuario, instante = new Date()) {
  const a = await assinaturaDe(usuario.id);
  const hoje = agoraLocal(usuario.fuso, instante).data;
  const s = situacaoAcesso({ testeFim: usuario.teste_fim, vencimento: a?.vencimento ?? null }, hoje);
  return { ...s, hoje, origem: a?.origem ?? null, metodo: a?.metodo ?? null, valor: valorBR() };
}

/** Link pessoal de pagamento (vai pelo WhatsApp/e-mail; nunca aparece no app). */
export async function criarLinkPagamento(usuarioId) {
  const token = gerarToken();
  await consulta(
    `INSERT INTO links_pagamento (token_hash, usuario_id, expira_em) VALUES ($1, $2, NOW() + ($3 || ' days')::interval)`,
    [resumo(token), usuarioId, String(config.pagamento.validadeLinkDias)],
  );
  return token;
}

export async function usuarioDoLink(token) {
  const r = (await consulta(
    `SELECT u.* FROM links_pagamento l JOIN usuarios u ON u.id = l.usuario_id
     WHERE l.token_hash = $1 AND l.expira_em > NOW() AND l.usado_em IS NULL`, [resumo(token ?? '')],
  )).rows[0];
  if (!r) throw new ErroApp(404, 'Este link venceu ou já foi usado. Responda a mensagem no WhatsApp que mandamos um novo.', 'link_invalido');
  return r;
}

/** Para acompanhar uma cobrança já paga: aceita link usado, desde que não tenha vencido. */
export async function usuarioDoLinkParaConsulta(token) {
  const r = (await consulta(
    `SELECT u.* FROM links_pagamento l JOIN usuarios u ON u.id = l.usuario_id WHERE l.token_hash = $1 AND l.expira_em > NOW()`, [resumo(token ?? '')],
  )).rows[0];
  if (!r) throw new ErroApp(404, 'Este link venceu. Responda a mensagem no WhatsApp que mandamos um novo.', 'link_invalido');
  return r;
}

/**
 * Registra um pagamento confirmado (site ou loja) e move o vencimento.
 * `idExterno` evita contar o mesmo pagamento duas vezes (a empresa de pagamento pode avisar mais de uma vez).
 */
export async function registrarPagamento({ usuarioId, origem, metodo, idExterno, valorCentavos = config.assinatura.valorCentavos, finalCartao, instante = new Date(), venceEmLoja }) {
  const resultado = await transacao(async (db) => {
    const ja = (await db.query('SELECT id FROM pagamentos WHERE id_externo = $1', [idExterno])).rows[0];
    if (ja) return { repetido: true };
    const usuario = (await db.query('SELECT * FROM usuarios WHERE id = $1 FOR UPDATE', [usuarioId])).rows[0];
    if (!usuario) throw new ErroApp(404, 'Usuário não encontrado.', 'sem_usuario');
    const atual = await assinaturaDe(usuarioId, db);
    const hoje = agoraLocal(usuario.fuso, instante).data;
    let { vencimento, diaCobranca } = novoVencimento({ vencimentoAtual: atual?.vencimento, diaCobranca: atual?.dia_cobranca, dataPagamento: hoje });
    if (venceEmLoja) vencimento = venceEmLoja; // na loja, quem manda na data é a própria loja
    await db.query(
      `INSERT INTO assinaturas (usuario_id, origem, metodo, dia_cobranca, vencimento) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (usuario_id) DO UPDATE SET origem = $2, metodo = $3, dia_cobranca = $4, vencimento = $5, cancelada_em = NULL, atualizado_em = NOW()`,
      [usuarioId, origem, metodo, diaCobranca, vencimento],
    );
    await db.query('INSERT INTO pagamentos (usuario_id, origem, metodo, valor_centavos, id_externo, vence_em) VALUES ($1, $2, $3, $4, $5, $6)',
      [usuarioId, origem, metodo, valorCentavos, idExterno, vencimento]);
    await db.query('UPDATE links_pagamento SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL', [usuarioId]);
    return { repetido: false, usuario, hoje, vencimento };
  });
  if (resultado.repetido) return resultado;

  const { usuario, hoje, vencimento } = resultado;
  const valor = (valorCentavos / 100).toFixed(2).replace('.', ',');
  if (metodo === 'pix') await enviarMensagem({ usuario, tipo: 'recibo_pix', chave: `recibo:${idExterno}`, vars: { valor, data: formatarDataBR(hoje), ate: formatarDataBR(vencimento) } });
  if (metodo === 'cartao') await enviarMensagem({ usuario, tipo: 'recibo_cartao', chave: `recibo:${idExterno}`, vars: { final: finalCartao ?? '----', valor, ate: formatarDataBR(vencimento) } });
  return { repetido: false, vencimento };
}
