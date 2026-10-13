import { ErroApp } from '../lib/erros.js';

export function tratarErros(err, _req, res, _next) {
  if (err instanceof ErroApp) return res.status(err.status).json({ erro: err.message, codigo: err.codigo, ...err.extra });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Dados inválidos.', codigo: 'json_invalido' });
  console.error(err);
  res.status(500).json({ erro: 'Algo deu errado do nosso lado. Tente de novo em instantes.', codigo: 'erro_interno' });
}
