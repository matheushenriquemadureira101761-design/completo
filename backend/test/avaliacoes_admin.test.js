import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararAmbiente, subirApp, ANUNCIO } from './apoio.js';

prepararAmbiente();
const { pool } = await import('../src/db.js');
let app; let forn; let cont; let outro; let anuncioId; let pedidoId;
const EQUIPE = { 'X-Admin-Token': process.env.ADMIN_TOKEN };

before(async () => {
  app = await subirApp();
  forn = await app.entrar('(66) 99999-2001', 'fornecedor', 'Carlos Fornecedor');
  cont = await app.entrar('(66) 99999-2002', 'contratante', 'Maria Contratante');
  outro = await app.entrar('(66) 99999-2003', 'contratante', 'Pedro Outro');
  const a = await app.api('POST', '/anuncios', ANUNCIO, forn.token);
  assert.equal(a.status, 201, JSON.stringify(a.dados));
  anuncioId = a.dados.id;
  const o = await app.api('POST', `/anuncios/${anuncioId}/orcamentos`, { mensagem: 'Preciso para dia 12' }, cont.token);
  assert.equal(o.status, 201, JSON.stringify(o.dados));
  pedidoId = o.dados.id;
});
after(async () => { app.servidor.close(); await pool.end(); });

test('avaliação: só depois do negócio fechado', async () => {
  const r = await app.api('POST', `/orcamentos/${pedidoId}/avaliacao`, { nota: 5 }, cont.token);
  assert.equal(r.status, 400);
  assert.equal(r.dados.codigo, 'nao_fechado');
  const l = await app.api('GET', '/orcamentos?papel=enviados', null, cont.token);
  assert.equal(l.dados[0].podeAvaliar, false);
});

test('avaliação: nota, comentário, uma vez só, e aparece no anúncio', async () => {
  assert.equal((await app.api('PATCH', `/orcamentos/${pedidoId}`, { status: 'respondido' }, forn.token)).status, 200);
  assert.equal((await app.api('PATCH', `/orcamentos/${pedidoId}`, { status: 'fechado' }, forn.token)).status, 200);
  let l = await app.api('GET', '/orcamentos?papel=enviados', null, cont.token);
  assert.equal(l.dados[0].podeAvaliar, true);
  assert.equal(l.dados[0].notaDada, null);

  assert.equal((await app.api('POST', `/orcamentos/${pedidoId}/avaliacao`, { nota: 0 }, cont.token)).status, 400);
  assert.equal((await app.api('POST', `/orcamentos/${pedidoId}/avaliacao`, { nota: 6 }, cont.token)).status, 400);
  assert.equal((await app.api('POST', `/orcamentos/${pedidoId}/avaliacao`, { nota: 5 }, outro.token)).status, 404, 'quem não pediu não avalia');
  assert.equal((await app.api('POST', `/orcamentos/${pedidoId}/avaliacao`, { nota: 5 }, forn.token)).status, 404, 'o fornecedor não se avalia');
  assert.equal((await app.api('POST', `/orcamentos/${pedidoId}/avaliacao`, { nota: 5, comentario: 'x'.repeat(501) }, cont.token)).status, 400);

  const ok = await app.api('POST', `/orcamentos/${pedidoId}/avaliacao`, { nota: 5, comentario: '  Serviço   caprichado, chegou no horário. ' }, cont.token);
  assert.equal(ok.status, 201, JSON.stringify(ok.dados));
  const de_novo = await app.api('POST', `/orcamentos/${pedidoId}/avaliacao`, { nota: 1 }, cont.token);
  assert.equal(de_novo.status, 409);

  l = await app.api('GET', '/orcamentos?papel=enviados', null, cont.token);
  assert.equal(l.dados[0].notaDada, 5);
  assert.equal(l.dados[0].podeAvaliar, false);

  const d = await app.api('GET', `/anuncios/${anuncioId}`, null, outro.token);
  assert.equal(d.status, 200);
  assert.equal(d.dados.nota, 5);
  assert.equal(d.dados.avaliacoes, 1);
  assert.equal(d.dados.comentarios.length, 1);
  assert.equal(d.dados.comentarios[0].comentario, 'Serviço caprichado, chegou no horário.');
  assert.equal(d.dados.comentarios[0].nome, 'Maria');
  assert.match(d.dados.comentarios[0].quando, /^[a-z]{3}\/\d{4}$/);
});

test('avaliação: comentário de quem a pessoa bloqueou não aparece para ela', async () => {
  assert.equal((await app.api('POST', `/usuarios/${cont.id}/bloqueio`, null, outro.token)).status, 200);
  const d = await app.api('GET', `/anuncios/${anuncioId}`, null, outro.token);
  assert.equal(d.dados.comentarios.length, 0);
  assert.equal((await app.api('DELETE', `/usuarios/${cont.id}/bloqueio`, null, outro.token)).status, 200);
});

test('painel: sem a chave da equipe, as rotas não existem', async () => {
  assert.equal((await app.api('GET', '/admin/resumo')).status, 404);
  assert.equal((await app.api('GET', '/admin/resumo', null, null, { 'X-Admin-Token': 'errada-mas-com-mais-de-20-letras-x' })).status, 404);
});

test('painel: resumo, usuários (busca), detalhe, anúncios, pedidos e pagamentos', async () => {
  const r = await app.api('GET', '/admin/resumo', null, null, EQUIPE);
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  assert.equal(r.dados.usuarios, 3);
  assert.equal(r.dados.emTeste, 3);
  assert.equal(r.dados.anunciosNoAr, 1);
  assert.equal(r.dados.fechados30d, 1);
  assert.match(r.dados.receitaMes, /R\$\s?0,00/);

  const u = await app.api('GET', '/admin/usuarios?q=maria', null, null, EQUIPE);
  assert.equal(u.dados.total, 1);
  assert.equal(u.dados.itens[0].nome, 'Maria Contratante');
  assert.match(u.dados.itens[0].situacao, /^Teste grátis até \d{2}\/\d{2}\/\d{4}$/);
  const porNumero = await app.api('GET', '/admin/usuarios?q=2001', null, null, EQUIPE);
  assert.equal(porNumero.dados.itens[0].nome, 'Carlos Fornecedor');
  const todos = await app.api('GET', '/admin/usuarios', null, null, EQUIPE);
  assert.equal(todos.dados.total, 3);

  const det = await app.api('GET', `/admin/usuarios/${forn.id}`, null, null, EQUIPE);
  assert.equal(det.status, 200);
  assert.equal(det.dados.anuncios.length, 1);
  assert.equal(det.dados.nota, 5);
  assert.equal(det.dados.pedidos.recebeu, 1);
  assert.equal((await app.api('GET', '/admin/usuarios/abc', null, null, EQUIPE)).status, 404, 'id inválido não vira erro interno');
  assert.equal((await app.api('GET', '/admin/usuarios/999999', null, null, EQUIPE)).status, 404);

  const an = await app.api('GET', '/admin/anuncios?q=trator', null, null, EQUIPE);
  assert.equal(an.dados.total, 1);
  assert.equal(an.dados.itens[0].pedidos, 1);
  assert.equal(an.dados.itens[0].preco, 'R$ 250/hora');

  const pe = await app.api('GET', '/admin/pedidos', null, null, EQUIPE);
  assert.equal(pe.dados.itens[0].status, 'Fechado');
  assert.equal(pe.dados.itens[0].nota, 5);

  const pg = await app.api('GET', '/admin/pagamentos', null, null, EQUIPE);
  assert.equal(pg.status, 200);
  assert.equal(pg.dados.total, 0);
});

test('painel: suspender derruba a sessão e tira os anúncios do ar; reativar devolve o acesso', async () => {
  const s = await app.api('POST', `/admin/usuarios/${forn.id}/suspender`, null, null, EQUIPE);
  assert.equal(s.status, 200);
  assert.equal((await app.api('GET', '/me', null, forn.token)).status, 401, 'sessão encerrada');
  const lista = await app.api('GET', '/anuncios', null, cont.token);
  assert.equal(lista.dados.total, 0);
  const u = await app.api('GET', '/admin/usuarios?q=carlos', null, null, EQUIPE);
  assert.equal(u.dados.itens[0].situacao, 'Suspenso');
  assert.equal((await app.api('POST', `/admin/usuarios/${forn.id}/reativar`, null, null, EQUIPE)).status, 200);
  const de_novo = await app.entrar('(66) 99999-2001', 'fornecedor', 'Carlos Fornecedor');
  assert.equal((await app.api('GET', '/me', null, de_novo.token)).status, 200);
  forn = de_novo;
});

test('painel: remover anúncio resolve as denúncias abertas dele', async () => {
  assert.equal((await app.api('PATCH', `/anuncios/${anuncioId}/status`, { status: 'ativo' }, forn.token)).status, 200);
  const d = await app.api('POST', `/anuncios/${anuncioId}/denuncias`, { motivo: 'falso' }, outro.token);
  assert.equal(d.status, 201, JSON.stringify(d.dados));
  const r = await app.api('POST', `/admin/anuncios/${anuncioId}/remover`, null, null, EQUIPE);
  assert.equal(r.status, 200);
  assert.equal((await app.api('POST', `/admin/anuncios/${anuncioId}/remover`, null, null, EQUIPE)).status, 404, 'já removido');
  const den = await app.api('GET', '/admin/denuncias', null, null, EQUIPE);
  assert.equal(den.dados.length, 0);
  const rem = await app.api('GET', '/admin/anuncios?status=removido', null, null, EQUIPE);
  assert.equal(rem.dados.total, 1);
});
