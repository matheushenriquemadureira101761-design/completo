import { usuarioDaSessao } from '../services/sessoes.js';
import { ErroApp } from '../lib/erros.js';

export async function exigirLogin(req, _res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const usuario = await usuarioDaSessao(token);
  if (!usuario) throw new ErroApp(401, 'Sua sessão terminou. Entre de novo.', 'sem_sessao');
  if (usuario.suspenso_em) throw new ErroApp(403, 'Sua conta está suspensa por descumprir os Termos de Uso. Fale com o suporte.', 'conta_suspensa');
  req.usuario = usuario;
  req.token = token;
  next();
}
