import { Router } from 'express';
import { exigirLogin } from '../middleware/autenticacao.js';
import { perfilPublico, excluirConta } from '../services/usuarios.js';
import { situacaoDo } from '../services/assinaturas.js';
import { consulta } from '../db.js';
import { ErroApp } from '../lib/erros.js';

export const rotasMe = Router();
rotasMe.use(exigirLogin);

// O app chama ao abrir: decide se mostra o app liberado, o teste, ou a tela de pausa.
rotasMe.get('/', async (req, res) => {
  res.json({ usuario: perfilPublico(req.usuario), situacao: await situacaoDo(req.usuario) });
});

rotasMe.post('/push', async (req, res) => {
  const token = String(req.body.token ?? '');
  if (!/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/.test(token)) throw new ErroApp(400, 'Token de notificação inválido.', 'push_token');
  await consulta(`INSERT INTO push_tokens (token, usuario_id, plataforma) VALUES ($1, $2, $3)
                  ON CONFLICT (token) DO UPDATE SET usuario_id = $2, plataforma = $3`, [token, req.usuario.id, req.body.plataforma ?? null]);
  res.json({ ok: true });
});

// Exigência da Apple e do Google: a pessoa precisa conseguir excluir a conta pelo app.
rotasMe.delete('/', async (req, res) => {
  await excluirConta(req.usuario.id);
  res.json({ ok: true });
});
