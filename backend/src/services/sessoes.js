import { consulta } from '../db.js';
import { gerarToken, resumo } from '../lib/seguranca.js';

/** Sessão que fica salva no celular: a pessoa entra uma vez e não precisa entrar de novo. */
export async function criarSessao(db, usuarioId, plataforma) {
  const token = gerarToken();
  await db.query('INSERT INTO sessoes (usuario_id, token_hash, plataforma) VALUES ($1, $2, $3)', [usuarioId, resumo(token), plataforma ?? null]);
  return token;
}

export async function usuarioDaSessao(token) {
  if (!token) return null;
  const r = await consulta(
    `UPDATE sessoes SET ultimo_uso_em = NOW() WHERE token_hash = $1 AND encerrada_em IS NULL
     RETURNING usuario_id`, [resumo(token)],
  );
  if (!r.rows[0]) return null;
  return (await consulta('SELECT * FROM usuarios WHERE id = $1', [r.rows[0].usuario_id])).rows[0] ?? null;
}

export async function encerrarSessao(token) {
  await consulta('UPDATE sessoes SET encerrada_em = NOW() WHERE token_hash = $1', [resumo(token)]);
}
