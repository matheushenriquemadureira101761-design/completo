import { Router } from 'express';
import { exigirLogin } from '../middleware/autenticacao.js';
import { situacaoDo } from '../services/assinaturas.js';
import { ErroApp } from '../lib/erros.js';
import * as A from '../services/anuncios.js';
import * as M from '../services/moderacao.js';

/** Usar o marketplace exige teste grátis ou assinatura em dia (quem está pausado só gerencia os próprios anúncios). */
export async function exigirAcesso(req, _res, next) {
  const s = await situacaoDo(req.usuario);
  if (!s.acesso) throw new ErroApp(403, 'Seu acesso está pausado.', 'acesso_pausado', { estado: s.estado });
  next();
}

export const rotasAnuncios = Router();
rotasAnuncios.use(exigirLogin);

rotasAnuncios.get('/meus', async (req, res) => res.json(await A.meusAnuncios(req.usuario)));
rotasAnuncios.patch('/:id/status', async (req, res) => res.json(await A.mudarStatusAnuncio(req.usuario, req.params.id, req.body.status)));
rotasAnuncios.delete('/:id/fotos/:fotoId', async (req, res) => res.json(await A.removerFoto(req.usuario, req.params.id, req.params.fotoId)));

rotasAnuncios.use(exigirAcesso);
rotasAnuncios.get('/', async (req, res) => res.json(await A.listarAnuncios(req.usuario, req.query)));
rotasAnuncios.get('/:id', async (req, res) => res.json(await A.obterAnuncio(req.usuario, req.params.id)));
rotasAnuncios.post('/', async (req, res) => res.status(201).json(await A.criarAnuncio(req.usuario, req.body)));
rotasAnuncios.put('/:id', async (req, res) => res.json(await A.editarAnuncio(req.usuario, req.params.id, req.body)));
rotasAnuncios.post('/:id/fotos', async (req, res) => res.status(201).json(await A.adicionarFoto(req.usuario, req.params.id, req.body)));
rotasAnuncios.post('/:id/orcamentos', async (req, res) => res.status(201).json(await A.pedirOrcamento(req.usuario, req.params.id, req.body)));
rotasAnuncios.post('/:id/contato', async (req, res) => res.json(await A.contatoWhatsApp(req.usuario, req.params.id)));
rotasAnuncios.post('/:id/denuncias', async (req, res) => res.status(201).json(await M.denunciar(req.usuario, req.params.id, req.body)));

export const rotasOrcamentos = Router();
rotasOrcamentos.use(exigirLogin);
rotasOrcamentos.get('/', async (req, res) => res.json(await A.listarOrcamentos(req.usuario, req.query.papel === 'recebidos' ? 'recebidos' : 'enviados')));
rotasOrcamentos.patch('/:id', async (req, res) => res.json(await A.mudarStatusOrcamento(req.usuario, req.params.id, req.body.status)));
rotasOrcamentos.post('/:id/avaliacao', async (req, res) => res.status(201).json(await A.avaliar(req.usuario, req.params.id, req.body)));

export const rotasUsuarios = Router();
rotasUsuarios.use(exigirLogin);
rotasUsuarios.get('/bloqueados', async (req, res) => res.json(await M.listarBloqueados(req.usuario)));
rotasUsuarios.post('/:id/bloqueio', async (req, res) => res.json(await M.bloquear(req.usuario, req.params.id)));
rotasUsuarios.delete('/:id/bloqueio', async (req, res) => res.json(await M.desbloquear(req.usuario, req.params.id)));
