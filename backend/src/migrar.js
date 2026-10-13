import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const pasta = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function migrar() {
  await pool.query('CREATE TABLE IF NOT EXISTS migracoes (nome TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const feitas = new Set((await pool.query('SELECT nome FROM migracoes')).rows.map((r) => r.nome));
  for (const arquivo of fs.readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort()) {
    if (feitas.has(arquivo)) continue;
    await pool.query(fs.readFileSync(path.join(pasta, arquivo), 'utf8'));
    await pool.query('INSERT INTO migracoes (nome) VALUES ($1)', [arquivo]);
    console.log('Migração aplicada:', arquivo);
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrar.js')) {
  migrar().then(() => { console.log('Banco atualizado.'); return pool.end(); }).catch((e) => { console.error(e); process.exit(1); });
}
