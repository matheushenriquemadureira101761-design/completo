// Marketplace com o banco de verdade: anúncios, distância, busca, fotos, orçamentos e acesso.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MODO_TESTE = 'true';
process.env.CODIGO_ESPERA_SEG = '0';
process.env.CODIGO_MAX_HORA_NUMERO = '50';
process.env.AUTH_LIMITE_MINUTO_IP = '1000';
process.env.CODIGO_MAX_HORA_IP = '1000';
process.env.WHATSAPP_TOKEN = '';

const { criarApp } = await import('../src/app.js');
const { migrar } = await import('../src/migrar.js');
const { pool, consulta } = await import('../src/db.js');
const { agoraLocal, somarDias } = await import('../src/lib/datas.js');
const { distanciaKm } = await import('../src/lib/distancia.js');

let servidor, base;
const log = console.log;
before(async () => {
  console.log = () => {};
  await migrar();
  await consulta('TRUNCATE usuarios, assinaturas, pagamentos, codigos_acesso, verificacoes, sessoes, mensagens, links_pagamento, pesquisas, push_tokens, testes_usados, anuncios, anuncio_fotos, orcamentos, contatos, avaliacoes RESTART IDENTITY CASCADE');
  servidor = criarApp().listen(0);
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(async () => { console.log = log; servidor.close(); await pool.end(); });

async function api(metodo, caminho, corpo, token) {
  const r = await fetch(base + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text(); let dados; try { dados = JSON.parse(t); } catch { dados = t; }
  return { status: r.status, dados };
}
async function conta(numero, perfil, nome, cidade = 'Nova Xavantina', uf = 'MT') {
  const c = await api('POST', '/auth/codigo', { whatsapp: numero });
  const v = await api('POST', '/auth/verificar', { whatsapp: numero, codigo: c.dados._codigoTeste });
  const f = await api('POST', '/auth/concluir', { passe: v.dados.passe, perfil, nome, cidade, uf, aceiteTermos: true });
  assert.equal(f.status, 200, JSON.stringify(f.dados));
  return f.dados.token;
}
const anuncio = (extra) => ({ categoria: 'maquinas', titulo: 'Trator 110 cv 4x4 com operador', descricao: 'Revisado, pneus novos.', precoCentavos: 18000, unidade: 'hora', caracteristicas: ['110 cv', '4x4', 'Com operador'], cidade: 'Água Boa', uf: 'MT', raioKm: 100, ...extra });
let tForn, tCont, idTrator;

test('distâncias reais entre cidades da região', () => {
  const ab = distanciaKm('Nova Xavantina', 'MT', 'Água Boa', 'MT');
  const can = distanciaKm('Nova Xavantina', 'MT', 'Canarana', 'MT');
  const que = distanciaKm('Nova Xavantina', 'MT', 'Querência', 'MT');
  assert.ok(ab > 60 && ab < 80, `Água Boa: ${ab} km`);
  assert.ok(can > 110 && can < 150, `Canarana: ${can} km`);
  assert.ok(que > 200 && que < 260, `Querência: ${que} km`);
});

test('fornecedor publica; validações barram dados errados', async () => {
  tForn = await conta('(66) 98888-1111', 'fornecedor', 'José Locações Agrícolas');
  tCont = await conta('(66) 98888-2222', 'contratante', 'João Pereira');
  assert.match((await api('POST', '/anuncios', anuncio({ titulo: 'Tr' }), tForn)).dados.erro, /pelo menos 5 letras/);
  assert.match((await api('POST', '/anuncios', anuncio({ unidade: null }), tForn)).dados.erro, /por hora, hectare/);
  assert.match((await api('POST', '/anuncios', anuncio({ cidade: 'Cidade Inventada' }), tForn)).dados.erro, /cidade/);
  assert.equal((await api('POST', '/anuncios', anuncio({ titulo: 'Trator bom pra caralho' }), tForn)).dados.codigo, 'palavra_proibida', 'palavrão no título');
  assert.equal((await api('POST', '/anuncios', anuncio({ descricao: 'Não seja OTÁRIO, contrate já' }), tForn)).dados.codigo, 'palavra_proibida', 'ofensa na descrição, com acento e maiúscula');
  assert.equal((await api('POST', '/anuncios', anuncio({ caracteristicas: ['merda nenhuma'] }), tForn)).dados.codigo, 'palavra_proibida', 'palavrão nas características');
  assert.equal((await api('POST', '/anuncios', anuncio({ titulo: 'Computador para escritório', cidade: 'São Paulo', uf: 'SP' }), tForn)).status, 201, 'palavra que só contém outra dentro (computador/puta) passa');
  const r = await api('POST', '/anuncios', anuncio(), tForn);
  assert.equal(r.status, 201);
  idTrator = r.dados.id;
  const hoje = agoraLocal('America/Cuiaba').data;
  await api('POST', '/anuncios', anuncio({ categoria: 'implementos', titulo: 'Plantadeira 13 linhas', precoCentavos: 9500, unidade: 'hectare', cidade: 'Nova Xavantina', disponivelEm: somarDias(hoje, 1) }), tForn);
  await api('POST', '/anuncios', anuncio({ categoria: 'fretes', titulo: 'Frete graneleiro bitrem', precoCentavos: 650, unidade: 'km', cidade: 'Canarana', disponivelEm: somarDias(hoje, 4) }), tForn);
  await api('POST', '/anuncios', anuncio({ categoria: 'servicos', titulo: 'Aplicação com drone', precoCentavos: null, unidade: null, cidade: 'Querência' }), tForn);
  await api('POST', '/anuncios', anuncio({ titulo: 'Colheitadeira em São Paulo', cidade: 'São Paulo', uf: 'SP' }), tForn);
});

test('lista perto de você, ordenada por distância, com raio', async () => {
  const r = await api('GET', '/anuncios', null, tCont);
  assert.equal(r.status, 200);
  const titulos = r.dados.itens.map((a) => a.titulo);
  assert.deepEqual(titulos, ['Plantadeira 13 linhas', 'Trator 110 cv 4x4 com operador', 'Frete graneleiro bitrem'], 'até 150 km, do mais perto ao mais longe');
  assert.equal(r.dados.itens[0].distanciaKm, 0);
  const maior = await api('GET', '/anuncios?raio=300', null, tCont);
  assert.ok(maior.dados.itens.some((a) => a.titulo === 'Aplicação com drone'));
  assert.ok(!maior.dados.itens.some((a) => a.cidade === 'São Paulo'));
});

test('textos de preço e disponibilidade', async () => {
  const itens = (await api('GET', '/anuncios?raio=300', null, tCont)).dados.itens;
  const por = Object.fromEntries(itens.map((a) => [a.titulo, a]));
  assert.equal(por['Trator 110 cv 4x4 com operador'].preco + por['Trator 110 cv 4x4 com operador'].unidade, 'R$ 180/hora');
  assert.equal(por['Frete graneleiro bitrem'].preco, 'R$ 6,50');
  assert.equal(por['Aplicação com drone'].preco, 'Sob consulta');
  assert.equal(por['Trator 110 cv 4x4 com operador'].disponibilidade, 'Disponível hoje');
  assert.equal(por['Plantadeira 13 linhas'].disponibilidade, 'Disponível amanhã');
  assert.match(por['Frete graneleiro bitrem'].disponibilidade, /^A partir de (dom|seg|ter|qua|qui|sex|sáb), \d{2}\/\d{2}$/);
});

test('busca sem precisar de acento e filtro por categoria', async () => {
  const t = async (q) => (await api('GET', `/anuncios?raio=300&q=${encodeURIComponent(q)}`, null, tCont)).dados.itens.map((a) => a.titulo);
  assert.deepEqual(await t('PLANTADEIRA'), ['Plantadeira 13 linhas']);
  assert.deepEqual(await t('aplicacao'), ['Aplicação com drone']);
  assert.deepEqual(await t('agua boa trator'), ['Trator 110 cv 4x4 com operador']);
  assert.deepEqual(await t('nada disso'), []);
  const fretes = (await api('GET', '/anuncios?raio=300&categoria=fretes', null, tCont)).dados.itens.map((a) => a.titulo);
  assert.deepEqual(fretes, ['Frete graneleiro bitrem']);
});

test('detalhe do anúncio e quem pode mexer', async () => {
  const d = await api('GET', `/anuncios/${idTrator}`, null, tCont);
  assert.equal(d.status, 200);
  assert.equal(d.dados.fornecedor.iniciais, 'JL');
  assert.equal(d.dados.fornecedor.whatsappConfirmado, true);
  assert.deepEqual(d.dados.caracteristicas, ['110 cv', '4x4', 'Com operador']);
  assert.equal(d.dados.fornecedor.whatsapp, undefined, 'o número não vem no detalhe');
  assert.equal((await api('PUT', `/anuncios/${idTrator}`, { titulo: 'Outro título qualquer' }, tCont)).status, 403);
  assert.equal((await api('PATCH', `/anuncios/${idTrator}/status`, { status: 'pausado' }, tForn)).status, 200);
  assert.ok(!(await api('GET', '/anuncios', null, tCont)).dados.itens.some((a) => a.id === idTrator), 'pausado some da lista');
  assert.equal((await api('GET', `/anuncios/${idTrator}`, null, tCont)).status, 404);
  assert.equal((await api('GET', `/anuncios/${idTrator}`, null, tForn)).status, 200, 'o dono ainda vê');
  await api('PATCH', `/anuncios/${idTrator}/status`, { status: 'ativo' }, tForn);
  assert.equal((await api('PUT', `/anuncios/${idTrator}`, { precoCentavos: 20000, unidade: 'hora' }, tForn)).status, 200);
  assert.equal((await api('GET', `/anuncios/${idTrator}`, null, tCont)).dados.preco, 'R$ 200');
});

test('fotos: aceita imagem de verdade, recusa arquivo falso e limita a 6', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const bigPng = Buffer.concat([Buffer.from(png, 'base64'), Buffer.alloc(200)]).toString('base64');
  const r = await api('POST', `/anuncios/${idTrator}/fotos`, { base64: `data:image/png;base64,${bigPng}` }, tForn);
  assert.equal(r.status, 201, JSON.stringify(r.dados));
  const img = await fetch(base + r.dados.url);
  assert.equal(img.status, 200);
  assert.match(img.headers.get('content-type'), /image\/png/);
  assert.equal(img.headers.get('cross-origin-resource-policy'), 'cross-origin', 'a foto pode ser exibida pelo app e pelo site');
  assert.equal((await fetch(base + '/saude')).headers.get('cross-origin-resource-policy'), 'same-origin', 'o resto da API continua protegido');
  const falso = Buffer.from('<html>isto não é foto</html>'.padEnd(300, ' ')).toString('base64');
  assert.match((await api('POST', `/anuncios/${idTrator}/fotos`, { base64: falso }, tForn)).dados.erro, /JPG, PNG ou WEBP/);
  assert.equal((await api('POST', `/anuncios/${idTrator}/fotos`, { base64: bigPng }, tCont)).status, 403, 'só o dono põe foto');
  for (let i = 0; i < 5; i++) await api('POST', `/anuncios/${idTrator}/fotos`, { base64: bigPng }, tForn);
  assert.match((await api('POST', `/anuncios/${idTrator}/fotos`, { base64: bigPng }, tForn)).dados.erro, /até 6 fotos/);
  assert.equal((await api('GET', `/anuncios/${idTrator}`, null, tCont)).dados.fotos.length, 6);
  assert.ok((await api('GET', '/anuncios', null, tCont)).dados.itens.find((a) => a.id === idTrator).foto.startsWith('/fotos/'));
});

test('pedido de orçamento: avisa o fornecedor no WhatsApp, sem repetir no mesmo dia', async () => {
  const hoje = agoraLocal('America/Cuiaba').data;
  assert.match((await api('POST', `/anuncios/${idTrator}/orcamentos`, { dataDesejada: somarDias(hoje, -2) }, tCont)).dados.erro, /hoje em diante/);
  const r = await api('POST', `/anuncios/${idTrator}/orcamentos`, { mensagem: 'Preciso para plantio, 2 dias.', dataDesejada: somarDias(hoje, 4) }, tCont);
  assert.equal(r.status, 201, JSON.stringify(r.dados));
  const m = (await consulta(`SELECT tipo, status FROM mensagens WHERE tipo = 'novo_orcamento'`)).rows;
  assert.deepEqual(m, [{ tipo: 'novo_orcamento', status: 'simulada' }]);
  assert.equal((await api('POST', `/anuncios/${idTrator}/orcamentos`, {}, tCont)).status, 409);
  assert.equal((await api('POST', `/anuncios/${idTrator}/orcamentos`, {}, tForn)).status, 400, 'não pede orçamento do próprio anúncio');
  const rec = (await api('GET', '/orcamentos?papel=recebidos', null, tForn)).dados;
  assert.equal(rec.length, 1);
  assert.equal(rec[0].outroNome, 'João Pereira');
  const idJoao = Number((await consulta("SELECT id FROM usuarios WHERE whatsapp = '5566988882222'")).rows[0].id);
  assert.equal(rec[0].outroId, idJoao, 'o pedido traz quem pediu, para poder bloquear');
  assert.match(rec[0].whatsapp, /^https:\/\/wa\.me\/5566988882222\?text=/);
  const env = (await api('GET', '/orcamentos?papel=enviados', null, tCont)).dados;
  assert.equal(env[0].statusNome, 'Enviado');
  assert.equal(env[0].whatsapp, null);
  assert.equal((await api('PATCH', `/orcamentos/${env[0].id}`, { status: 'respondido' }, tCont)).status, 403, 'quem pediu não marca como respondido');
  assert.equal((await api('PATCH', `/orcamentos/${env[0].id}`, { status: 'respondido' }, tForn)).status, 200);
});

test('contato pelo WhatsApp: o número só sai quando a pessoa pede, e fica registrado', async () => {
  const r = await api('POST', `/anuncios/${idTrator}/contato`, null, tCont);
  assert.match(r.dados.link, /^https:\/\/wa\.me\/5566988881111\?text=Ol%C3%A1/);
  assert.equal((await consulta('SELECT COUNT(*)::int AS n FROM contatos')).rows[0].n, 1);
});

test('contratante que anuncia ganha o perfil de fornecedor; meus anúncios', async () => {
  const r = await api('POST', '/anuncios', anuncio({ titulo: 'Caminhão boiadeiro', categoria: 'fretes', precoCentavos: 500, unidade: 'km', cidade: 'Nova Xavantina' }), tCont);
  assert.equal(r.status, 201);
  const me = (await api('GET', '/me', null, tCont)).dados.usuario;
  assert.deepEqual([me.contratante, me.fornecedor], [true, true]);
  const meus = (await api('GET', '/anuncios/meus', null, tForn)).dados;
  assert.equal(meus.find((a) => a.id === idTrator).pedidos, 1);
});

test('acesso pausado: não vê anúncios, mas ainda gerencia os seus', async () => {
  await consulta("UPDATE usuarios SET teste_fim = CURRENT_DATE - 10 WHERE whatsapp = '5566988881111'");
  const r = await api('GET', '/anuncios', null, tForn);
  assert.equal(r.status, 403);
  assert.equal(r.dados.codigo, 'acesso_pausado');
  assert.equal((await api('GET', '/anuncios/meus', null, tForn)).status, 200);
  assert.equal((await api('PATCH', `/anuncios/${idTrator}/status`, { status: 'pausado' }, tForn)).status, 200);
});
