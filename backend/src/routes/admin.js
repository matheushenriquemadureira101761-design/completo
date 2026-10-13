import { Router } from 'express';
import crypto from 'node:crypto';
import { ErroApp } from '../lib/erros.js';
import * as M from '../services/moderacao.js';
import * as P from '../services/admin.js';

// Rotas da equipe (usadas pelo painel em /painel). Protegidas pelo cabeçalho X-Admin-Token = ADMIN_TOKEN do .env.
// Sem ADMIN_TOKEN configurado, as rotas ficam desligadas.
function exigirEquipe(req, _res, next) {
  const certo = process.env.ADMIN_TOKEN || '';
  const veio = String(req.headers['x-admin-token'] ?? '');
  const ok = certo.length >= 20 && veio.length === certo.length && crypto.timingSafeEqual(Buffer.from(veio), Buffer.from(certo));
  if (!ok) throw new ErroApp(404, 'Endereço não encontrado.', 'nao_encontrado');
  next();
}

export const rotasAdmin = Router();
rotasAdmin.use(exigirEquipe);
const soNumero = (_req, _res, next, valor) => next(/^\d{1,18}$/.test(String(valor)) ? undefined : new ErroApp(404, 'Não encontrado.', 'nao_encontrado'));
rotasAdmin.param('id', soNumero);
rotasAdmin.param('anuncioId', soNumero);
rotasAdmin.get('/resumo', async (_req, res) => res.json(await P.resumo()));
rotasAdmin.get('/denuncias', async (req, res) => res.json(await M.denunciasDaEquipe(req.query.status || 'aberta')));
rotasAdmin.post('/denuncias/:anuncioId/resolver', async (req, res) => res.json(await M.resolverDenuncias(req.params.anuncioId, req.body)));
rotasAdmin.get('/usuarios', async (req, res) => res.json(await P.listarUsuarios(req.query)));
rotasAdmin.get('/usuarios/:id', async (req, res) => res.json(await P.detalheUsuario(req.params.id)));
rotasAdmin.post('/usuarios/:id/suspender', async (req, res) => res.json(await M.suspenderUsuario(req.params.id)));
rotasAdmin.post('/usuarios/:id/reativar', async (req, res) => res.json(await M.reativarUsuario(req.params.id)));
rotasAdmin.get('/anuncios', async (req, res) => res.json(await P.listarAnunciosEquipe(req.query)));
rotasAdmin.post('/anuncios/:id/remover', async (req, res) => res.json(await P.removerAnuncioEquipe(req.params.id)));
rotasAdmin.get('/pedidos', async (req, res) => res.json(await P.listarPedidosEquipe(req.query)));
rotasAdmin.get('/pagamentos', async (req, res) => res.json(await P.listarPagamentosEquipe(req.query)));
