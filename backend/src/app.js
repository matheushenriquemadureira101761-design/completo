import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rotasAuth } from './routes/auth.js';
import { rotasMe } from './routes/me.js';
import { rotasAssinatura } from './routes/assinatura.js';
import { rotasPagamentos } from './routes/pagamentos.js';
import { rotasWebhooks } from './routes/webhooks.js';
import { tratarErros } from './middleware/erros.js';
import { buscarCidades } from './lib/validacao.js';
import { rotasAnuncios, rotasOrcamentos, rotasUsuarios } from './routes/anuncios.js';
import { rotasAdmin } from './routes/admin.js';
import { PASTA_FOTOS, CATEGORIAS, UNIDADES } from './services/anuncios.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_PUBLICA = path.join(RAIZ, 'public');
const PASTA_PAINEL = path.join(RAIZ, '..', 'painel', 'dist');

export function criarApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors());
  // Guarda o corpo original: a Meta assina os webhooks sobre ele.
  const guardarBruto = (req, _res, buf) => { req.corpoBruto = buf; };
  const jsonPequeno = express.json({ limit: '1mb', verify: guardarBruto });
  const jsonFotos = express.json({ limit: '5mb', verify: guardarBruto }); // só a rota de envio de foto aceita corpo maior
  app.use((req, res, next) => (req.method === 'POST' && /^\/anuncios\/\d+\/fotos$/.test(req.path) ? jsonFotos : jsonPequeno)(req, res, next));
  // Fotos dos anúncios podem ser exibidas por outros endereços (app, site, pré-visualização). O resto da API segue protegido.
  app.use('/fotos', (_req, res, next) => { res.set('Cross-Origin-Resource-Policy', 'cross-origin'); next(); }, express.static(PASTA_FOTOS, { maxAge: '30d', fallthrough: false }));

  // Página de pagamento (script e estilo próprios) e painel da equipe (se tiver sido gerado com "npm run build" na pasta painel).
  app.use('/site', express.static(PASTA_PUBLICA, { maxAge: '1h', index: false }));
  if (fs.existsSync(PASTA_PAINEL)) {
    app.use('/painel', express.static(PASTA_PAINEL, { maxAge: '1h' }));
    app.get(/^\/painel(\/.*)?$/, (_req, res) => res.sendFile(path.join(PASTA_PAINEL, 'index.html')));
  }

  app.get('/saude', (_req, res) => res.json({ ok: true }));
  app.get('/cidades', (req, res) => res.json(buscarCidades(String(req.query.q ?? ''), 8)));
  app.use('/auth', rotasAuth);
  app.use('/me', rotasMe);
  app.use('/assinatura', rotasAssinatura);
  app.get('/categorias', (_req, res) => res.json({ categorias: CATEGORIAS, unidades: UNIDADES }));
  app.use('/anuncios', rotasAnuncios);
  app.use('/orcamentos', rotasOrcamentos);
  app.use('/usuarios', rotasUsuarios);
  app.use('/admin', rotasAdmin);
  app.use('/webhooks', rotasWebhooks);
  app.use('/', rotasPagamentos);
  app.use((_req, res) => res.status(404).json({ erro: 'Endereço não encontrado.', codigo: 'nao_encontrado' }));
  app.use(tratarErros);
  return app;
}
