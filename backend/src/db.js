import pg from 'pg';
import { config } from './config.js';

// DATE volta como texto 'AAAA-MM-DD' (sem virar Date com fuso), igual às regras em lib/datas.js
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ connectionString: config.bancoUrl, max: 10 });

export const consulta = (texto, valores) => pool.query(texto, valores);

/** Executa várias consultas numa transação (tudo ou nada). */
export async function transacao(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const r = await fn(cliente);
    await cliente.query('COMMIT');
    return r;
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}
