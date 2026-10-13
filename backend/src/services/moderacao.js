// Moderação (exigência da Apple para apps com conteúdo publicado pelos usuários):
// denunciar anúncio, bloquear usuário, filtro automático e decisão da equipe.
import { consulta, transacao } from '../db.js';
import { config } from '../config.js';
import { ErroApp } from '../lib/erros.js';
import { enviarEmail } from './mensagens/email.js';

export const MOTIVOS = {
  golpe: 'Golpe ou tentativa de fraude',
  proibido: 'Produto ou serviço proibido',
  ofensivo: 'Conteúdo ofensivo',
  falso: 'Anúncio falso ou enganoso',
  outro: 'Outro motivo',
};
export const DENUNCIAS_PARA_OCULTAR = 3;

/** Ids de quem a pessoa bloqueou OU de quem bloqueou a pessoa (o bloqueio vale nos dois sentidos). */
export async function idsBloqueados(usuarioId) {
  const r = await consulta(
    `SELECT bloqueado_id AS id FROM bloqueios WHERE bloqueador_id = $1 UNION SELECT bloqueador_id FROM bloqueios WHERE bloqueado_id = $1`, [usuarioId]);
  return r.rows.map((x) => String(x.id));
}

export async function haBloqueio(a, b) {
  return (await consulta('SELECT 1 FROM bloqueios WHERE (bloqueador_id = $1 AND bloqueado_id = $2) OR (bloqueador_id = $2 AND bloqueado_id = $1)', [a, b])).rowCount > 0;
}

export async function anunciosDenunciadosPor(usuarioId) {
  return (await consulta('SELECT anuncio_id FROM denuncias WHERE denunciante_id = $1', [usuarioId])).rows.map((x) => String(x.anuncio_id));
}

export async function denunciar(usuario, anuncioId, { motivo, detalhe = '' }) {
  if (!MOTIVOS[motivo]) throw new ErroApp(400, 'Escolha o motivo da denúncia.', 'motivo');
  const texto = String(detalhe ?? '').trim();
  if (texto.length > 500) throw new ErroApp(400, 'O detalhe pode ter no máximo 500 letras.', 'detalhe');
  const r = await transacao(async (db) => {
    const a = (await db.query(`SELECT id, titulo, fornecedor_id FROM anuncios WHERE id = $1 AND status <> 'removido' FOR UPDATE`, [anuncioId])).rows[0];
    if (!a) throw new ErroApp(404, 'Este anúncio não está mais disponível.', 'anuncio_inexistente');
    if (String(a.fornecedor_id) === String(usuario.id)) throw new ErroApp(400, 'Você não pode denunciar o seu próprio anúncio.', 'proprio_anuncio');
    const ins = await db.query(
      `INSERT INTO denuncias (anuncio_id, denunciado_id, denunciante_id, motivo, detalhe) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (denunciante_id, anuncio_id) DO NOTHING RETURNING id`, [a.id, a.fornecedor_id, usuario.id, motivo, texto]);
    if (!ins.rowCount) throw new ErroApp(409, 'Você já denunciou este anúncio. Nossa equipe vai analisar.', 'ja_denunciado');
    const abertas = Number((await db.query(`SELECT COUNT(DISTINCT denunciante_id) FROM denuncias WHERE anuncio_id = $1 AND status = 'aberta'`, [a.id])).rows[0].count);
    const ocultou = abertas >= DENUNCIAS_PARA_OCULTAR;
    if (ocultou) await db.query('UPDATE anuncios SET em_analise = TRUE WHERE id = $1', [a.id]);
    return { id: Number(ins.rows[0].id), ocultou, abertas, titulo: a.titulo };
  });
  // Avisa a equipe (e-mail de moderação, se configurado)
  if (process.env.EMAIL_MODERACAO) {
    await enviarEmail(process.env.EMAIL_MODERACAO, {
      assunto: `${r.ocultou ? '[OCULTO] ' : ''}Denúncia: ${r.titulo}`,
      texto: `Motivo: ${MOTIVOS[motivo]}\nDetalhe: ${texto || '-'}\nDenúncias abertas neste anúncio: ${r.abertas}${r.ocultou ? '\nO anúncio saiu do ar automaticamente até a análise.' : ''}`,
    }).catch(() => {});
  }
  return { id: r.id, ocultou: r.ocultou };
}

export async function bloquear(usuario, outroId) {
  if (String(outroId) === String(usuario.id)) throw new ErroApp(400, 'Você não pode bloquear a si mesmo.', 'bloqueio');
  const existe = (await consulta('SELECT 1 FROM usuarios WHERE id = $1', [outroId])).rowCount > 0;
  if (!existe) throw new ErroApp(404, 'Usuário não encontrado.', 'usuario_inexistente');
  await consulta('INSERT INTO bloqueios (bloqueador_id, bloqueado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [usuario.id, outroId]);
  return { ok: true };
}

export async function desbloquear(usuario, outroId) {
  await consulta('DELETE FROM bloqueios WHERE bloqueador_id = $1 AND bloqueado_id = $2', [usuario.id, outroId]);
  return { ok: true };
}

export async function listarBloqueados(usuario) {
  const r = await consulta(`SELECT u.id, u.nome, u.cidade, u.uf, b.criado_em FROM bloqueios b JOIN usuarios u ON u.id = b.bloqueado_id WHERE b.bloqueador_id = $1 ORDER BY b.criado_em DESC`, [usuario.id]);
  return r.rows.map((x) => ({ id: Number(x.id), nome: x.nome, cidade: `${x.cidade} - ${x.uf}` }));
}

// ---------------- Equipe (administração) ----------------
export async function denunciasDaEquipe(status = 'aberta') {
  const r = await consulta(
    `SELECT d.anuncio_id, a.titulo, a.status AS anuncio_status, a.em_analise, u.id AS denunciado_id, u.nome AS denunciado, u.suspenso_em,
            COUNT(*)::int AS total, MIN(d.criado_em) AS primeira, array_agg(DISTINCT d.motivo) AS motivos,
            array_agg(d.detalhe ORDER BY d.criado_em) FILTER (WHERE d.detalhe <> '') AS detalhes
     FROM denuncias d JOIN anuncios a ON a.id = d.anuncio_id JOIN usuarios u ON u.id = d.denunciado_id
     WHERE d.status = $1 GROUP BY d.anuncio_id, a.titulo, a.status, a.em_analise, u.id, u.nome, u.suspenso_em ORDER BY total DESC, primeira`, [status]);
  return r.rows.map((x) => ({ ...x, anuncio_id: Number(x.anuncio_id), denunciado_id: Number(x.denunciado_id), motivos: x.motivos.map((m) => MOTIVOS[m]) }));
}

/**
 * A equipe decide sobre as denúncias de um anúncio (todas as abertas de uma vez).
 * decisao: procedente | improcedente. acao (se procedente): remover_anuncio | suspender_usuario
 */
export async function resolverDenuncias(anuncioId, { decisao, acao }) {
  if (!['procedente', 'improcedente'].includes(decisao)) throw new ErroApp(400, 'Decisão inválida.', 'decisao');
  if (decisao === 'procedente' && !['remover_anuncio', 'suspender_usuario'].includes(acao)) throw new ErroApp(400, 'Escolha a ação: remover_anuncio ou suspender_usuario.', 'acao');
  return transacao(async (db) => {
    const a = (await db.query('SELECT id, fornecedor_id FROM anuncios WHERE id = $1 FOR UPDATE', [anuncioId])).rows[0];
    if (!a) throw new ErroApp(404, 'Anúncio não encontrado.', 'anuncio_inexistente');
    const n = (await db.query(`UPDATE denuncias SET status = $2, acao = $3, resolvido_em = NOW() WHERE anuncio_id = $1 AND status = 'aberta'`, [anuncioId, decisao, acao ?? null])).rowCount;
    if (!n) throw new ErroApp(404, 'Não há denúncias abertas para este anúncio.', 'sem_denuncias');
    if (decisao === 'improcedente') await db.query('UPDATE anuncios SET em_analise = FALSE WHERE id = $1', [anuncioId]);
    if (acao === 'remover_anuncio') await db.query(`UPDATE anuncios SET status = 'removido', em_analise = FALSE WHERE id = $1`, [anuncioId]);
    if (acao === 'suspender_usuario') {
      await suspenderNoBanco(db, a.fornecedor_id);
      await db.query(`UPDATE anuncios SET status = 'removido', em_analise = FALSE WHERE id = $1`, [anuncioId]);
    }
    return { resolvidas: n, decisao, acao: acao ?? null };
  });
}

/** Suspende a conta: derruba as sessões e tira os anúncios do ar. */
async function suspenderNoBanco(db, usuarioId) {
  await db.query('UPDATE usuarios SET suspenso_em = NOW() WHERE id = $1 AND suspenso_em IS NULL', [usuarioId]);
  await db.query(`UPDATE anuncios SET status = 'pausado' WHERE fornecedor_id = $1 AND status = 'ativo'`, [usuarioId]);
  await db.query('UPDATE sessoes SET encerrada_em = NOW() WHERE usuario_id = $1 AND encerrada_em IS NULL', [usuarioId]);
}

export async function suspenderUsuario(usuarioId) {
  return transacao(async (db) => {
    const u = (await db.query('SELECT id FROM usuarios WHERE id = $1 FOR UPDATE', [usuarioId])).rows[0];
    if (!u) throw new ErroApp(404, 'Usuário não encontrado.', 'usuario_inexistente');
    await suspenderNoBanco(db, usuarioId);
    return { ok: true };
  });
}

export async function reativarUsuario(usuarioId) {
  await consulta('UPDATE usuarios SET suspenso_em = NULL WHERE id = $1', [usuarioId]);
  return { ok: true };
}

export { config };
