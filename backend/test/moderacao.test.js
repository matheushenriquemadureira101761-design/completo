// Moderação com o banco de verdade: denúncias, filtro automático, equipe, bloqueios e suspensão.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MODO_TESTE = 'true';
process.env.CODIGO_ESPERA_SEG = '0';
process.env.CODIGO_MAX_HORA_NUMERO = '50';
process.env.AUTH_LIMITE_MINUTO_IP = '1000';
process.env.CODIGO_MAX_HORA_IP = '1000';
process.env.WHATSAPP_TOKEN = '';
delete process.env.ADMIN_TOKEN;

const { criarApp } = await import('../src/app.js');
const { migrar } = await import('../src/migrar.js');
const { pool, consulta } = await import('../src/db.js');

let servidor, base;
const log = console.log;
before(async () => {
  console.log = () => {};
  await migrar();
  await consulta('TRUNCATE usuarios, assinaturas, pagamentos, codigos_acesso, verificacoes, sessoes, mensagens, links_pagamento, pesquisas, push_tokens, testes_usados, anuncios, anuncio_fotos, orcamentos, contatos, avaliacoes, denuncias, bloqueios RESTART IDENTITY CASCADE');
  servidor = criarApp().listen(0);
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(async () => { console.log = log; servidor.close(); await pool.end(); });

async function api(metodo, caminho, corpo, token, extra = {}) {
  const r = await fetch(base + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text(); let dados; try { dados = JSON.parse(t); } catch { dados = t; }
  return { status: r.status, dados };
}
async function entrar(numero, perfil, nome) {
  const c = await api('POST', '/auth/codigo', { whatsapp: numero });
  const v = await api('POST', '/auth/verificar', { whatsapp: numero, codigo: c.dados._codigoTeste });
  return api('POST', '/auth/concluir', { passe: v.dados.passe, perfil, nome, cidade: 'Nova Xavantina', uf: 'MT', aceiteTermos: true });
}
const tok = async (n, p, nome) => { const r = await entrar(n, p, nome); assert.equal(r.status, 200, JSON.stringify(r.dados)); return r.dados.token; };
const novoAnuncio = (titulo) => ({ categoria: 'maquinas', titulo, precoCentavos: 18000, unidade: 'hora', cidade: 'Nova Xavantina', uf: 'MT' });
const ids = async (t) => (await api('GET', '/anuncios', null, t)).dados.itens.map((a) => a.id);
const ADMIN = 'chave-da-equipe-bem-longa-123';
let jose, c1, c2, c3, c4, idA, idJose;

test('denunciar: motivo obrigatório, não denuncia o próprio, não repete', async () => {
  jose = await tok('(66) 97777-0001', 'fornecedor', 'José Locações');
  [c1, c2, c3, c4] = [await tok('(66) 97777-0002', 'contratante', 'Ana'), await tok('(66) 97777-0003', 'contratante', 'Bruno'), await tok('(66) 97777-0004', 'contratante', 'Carla'), await tok('(66) 97777-0005', 'contratante', 'Davi')];
  idA = (await api('POST', '/anuncios', novoAnuncio('Trator 110 cv com operador'), jose)).dados.id;
  idJose = (await api('GET', '/me', null, jose)).dados.usuario.id;
  assert.equal((await api('POST', `/anuncios/${idA}/denuncias`, {}, c1)).status, 400);
  assert.equal((await api('POST', `/anuncios/${idA}/denuncias`, { motivo: 'golpe' }, jose)).status, 400);
  const r = await api('POST', `/anuncios/${idA}/denuncias`, { motivo: 'golpe', detalhe: 'Pediu Pix adiantado e sumiu.' }, c1);
  assert.equal(r.status, 201);
  assert.equal(r.dados.ocultou, false);
  assert.equal((await api('POST', `/anuncios/${idA}/denuncias`, { motivo: 'golpe' }, c1)).status, 409);
});

test('quem denunciou para de ver o anúncio na hora; os outros ainda veem', async () => {
  assert.ok(!(await ids(c1)).includes(idA));
  assert.equal((await api('GET', `/anuncios/${idA}`, null, c1)).dados.codigo, 'anuncio_denunciado');
  assert.ok((await ids(c4)).includes(idA));
});

test('3 denúncias de pessoas diferentes tiram o anúncio do ar até a análise', async () => {
  await api('POST', `/anuncios/${idA}/denuncias`, { motivo: 'falso' }, c2);
  const r = await api('POST', `/anuncios/${idA}/denuncias`, { motivo: 'golpe' }, c3);
  assert.equal(r.dados.ocultou, true);
  assert.ok(!(await ids(c4)).includes(idA), 'em análise: ninguém vê');
  assert.equal((await api('GET', `/anuncios/${idA}`, null, c4)).status, 404);
  const meu = (await api('GET', '/anuncios/meus', null, jose)).dados.find((a) => a.id === idA);
  assert.equal(meu.emAnalise, true, 'o dono vê que está em análise');
  assert.equal((await api('GET', `/anuncios/${idA}`, null, jose)).dados.emAnalise, true);
});

test('rotas da equipe: escondidas sem a chave; com a chave, lista e arquiva', async () => {
  assert.equal((await api('GET', '/admin/denuncias')).status, 404, 'sem ADMIN_TOKEN configurado, nada aparece');
  process.env.ADMIN_TOKEN = ADMIN;
  assert.equal((await api('GET', '/admin/denuncias', null, null, { 'X-Admin-Token': 'errada' })).status, 404);
  const lista = (await api('GET', '/admin/denuncias', null, null, { 'X-Admin-Token': ADMIN })).dados;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].total, 3);
  assert.deepEqual(lista[0].motivos.sort(), ['Anúncio falso ou enganoso', 'Golpe ou tentativa de fraude']);
  assert.deepEqual(lista[0].detalhes, ['Pediu Pix adiantado e sumiu.']);
  assert.equal((await api('POST', `/admin/denuncias/${idA}/resolver`, { decisao: 'procedente' }, null, { 'X-Admin-Token': ADMIN })).status, 400, 'procedente exige a ação');
  const r = await api('POST', `/admin/denuncias/${idA}/resolver`, { decisao: 'improcedente' }, null, { 'X-Admin-Token': ADMIN });
  assert.equal(r.dados.resolvidas, 3);
  assert.ok((await ids(c4)).includes(idA), 'arquivada: o anúncio volta a aparecer');
  assert.ok(!(await ids(c1)).includes(idA), 'para quem denunciou, continua escondido');
});

test('bloqueio vale nos dois sentidos: anúncios, orçamento, contato e pedidos', async () => {
  const idDavi = (await api('GET', '/me', null, c4)).dados.usuario.id;
  const idAnuncioDavi = (await api('POST', '/anuncios', novoAnuncio('Plantadeira do Davi'), c4)).dados.id;
  assert.equal((await api('POST', `/anuncios/${idA}/orcamentos`, { mensagem: 'Oi' }, c4)).status, 201);
  assert.equal((await api('GET', '/orcamentos?papel=recebidos', null, jose)).dados.length, 1);
  assert.equal((await api('POST', `/usuarios/${idDavi}/bloqueio`, null, c4)).status, 400, 'não bloqueia a si mesmo');
  assert.equal((await api('POST', `/usuarios/${idJose}/bloqueio`, null, c4)).status, 200);
  assert.ok(!(await ids(c4)).includes(idA), 'Davi não vê mais o José');
  assert.ok(!(await ids(jose)).includes(idAnuncioDavi), 'e o José não vê mais o Davi');
  assert.equal((await api('POST', `/anuncios/${idA}/contato`, null, c4)).status, 403);
  assert.equal((await api('GET', '/orcamentos?papel=recebidos', null, jose)).dados.length, 0, 'o pedido do Davi some para o José');
  assert.deepEqual((await api('GET', '/usuarios/bloqueados', null, c4)).dados.map((b) => b.nome), ['José Locações']);
  await api('DELETE', `/usuarios/${idJose}/bloqueio`, null, c4);
  assert.ok((await ids(c4)).includes(idA), 'desbloqueou: volta a ver');
});

test('suspensão pela equipe: derruba a sessão, tira os anúncios e impede de entrar', async () => {
  const idB = (await api('POST', '/anuncios', novoAnuncio('Colheitadeira suspeita'), jose)).dados.id;
  await api('POST', `/anuncios/${idB}/denuncias`, { motivo: 'proibido' }, c2);
  const r = await api('POST', `/admin/denuncias/${idB}/resolver`, { decisao: 'procedente', acao: 'suspender_usuario' }, null, { 'X-Admin-Token': ADMIN });
  assert.equal(r.status, 200);
  assert.equal((await api('GET', '/me', null, jose)).status, 401, 'a sessão foi encerrada');
  const volta = await entrar('(66) 97777-0001', 'fornecedor', 'José Locações');
  assert.equal(volta.status, 403);
  assert.equal(volta.dados.codigo, 'conta_suspensa');
  assert.ok(!(await ids(c4)).includes(idA), 'os anúncios dele saem do ar');
  await api('POST', `/admin/usuarios/${idJose}/reativar`, null, null, { 'X-Admin-Token': ADMIN });
  assert.equal((await entrar('(66) 97777-0001', 'fornecedor', 'José Locações')).status, 200, 'reativado: entra de novo');
  delete process.env.ADMIN_TOKEN;
});
