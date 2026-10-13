import { Router } from 'express';
import { exigirLogin } from '../middleware/autenticacao.js';
import { situacaoDo } from '../services/assinaturas.js';
import { confirmarCompra, registrarCompra } from '../services/loja.js';
import { ErroApp } from '../lib/erros.js';

export const rotasAssinatura = Router();
rotasAssinatura.use(exigirLogin);

/**
 * O app avisa que a pessoa assinou pela loja (Google Play / App Store).
 * O servidor confere a compra direto com a loja antes de liberar (ver services/loja.js e LOJA.md).
 * Android: tokenCompra = purchaseToken. iPhone: tokenCompra = transactionId.
 */
rotasAssinatura.post('/loja', async (req, res) => {
  const { plataforma, tokenCompra } = req.body;
  if (!['android', 'ios'].includes(plataforma)) throw new ErroApp(400, 'Plataforma inválida.', 'plataforma');
  if (!tokenCompra || String(tokenCompra).length > 4096) throw new ErroApp(400, 'Compra não informada.', 'compra');
  const c = await confirmarCompra({ plataforma, tokenCompra: String(tokenCompra) });
  await registrarCompra(req.usuario, plataforma, c);
  res.json({ situacao: await situacaoDo(req.usuario) });
});
