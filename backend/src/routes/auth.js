import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validarEmail } from '../lib/validacao.js';
import { ErroApp } from '../lib/erros.js';
import { pedirCodigo, verificarCodigo } from '../services/codigos.js';
import { numeroValido, concluirEntrada, entrarComSenha } from '../services/usuarios.js';
import { encerrarSessao } from '../services/sessoes.js';
import { exigirLogin } from '../middleware/autenticacao.js';
import { config } from '../config.js';

export const rotasAuth = Router();
rotasAuth.use(rateLimit({ windowMs: 60_000, limit: config.codigo.limiteAuthPorMinutoIp, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitas tentativas em pouco tempo. Espere um minuto.', codigo: 'limite' } }));

// 1) Pede o código (WhatsApp, SMS ou e-mail)
rotasAuth.post('/codigo', async (req, res) => {
  const whatsapp = numeroValido(req.body.whatsapp);
  const canal = req.body.canal || 'whatsapp';
  if (!['whatsapp', 'sms', 'email'].includes(canal)) throw new ErroApp(400, 'Escolha WhatsApp, SMS ou e-mail.', 'canal');
  if (canal === 'email') { const e = validarEmail(req.body.email); if (e) throw new ErroApp(400, e, 'email'); }
  res.json(await pedirCodigo({ whatsapp, canal, email: req.body.email?.trim(), ip: req.ip }));
});

// 2) Confere o código e devolve um passe curto
rotasAuth.post('/verificar', async (req, res) => {
  const whatsapp = numeroValido(req.body.whatsapp);
  res.json({ passe: await verificarCodigo({ whatsapp, codigo: String(req.body.codigo ?? '').replace(/\D/g, '') }) });
});

// 3) Conclui: cria a conta (teste grátis) ou entra na conta que já existe
rotasAuth.post('/concluir', async (req, res) => {
  res.json(await concluirEntrada({ ...req.body, plataforma: req.body.plataforma }));
});

// Opcional: entrar com senha
rotasAuth.post('/senha', async (req, res) => {
  res.json(await entrarComSenha(req.body));
});

rotasAuth.post('/sair', exigirLogin, async (req, res) => {
  await encerrarSessao(req.token);
  res.json({ ok: true });
});
