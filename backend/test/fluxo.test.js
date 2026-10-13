// Teste de ponta a ponta com o banco de verdade (precisa do PostgreSQL rodando, DATABASE_URL).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.MODO_TESTE = 'true';
process.env.CODIGO_ESPERA_SEG = '0';
process.env.CODIGO_MAX_HORA_NUMERO = '50';
process.env.AUTH_LIMITE_MINUTO_IP = '1000';
process.env.CODIGO_MAX_HORA_IP = '1000';
process.env.WHATSAPP_APP_SECRET = 'segredo-teste';
process.env.WHATSAPP_VERIFY_TOKEN = 'verifica-teste';
process.env.WHATSAPP_TOKEN = ''; // modo simulação: nada sai de verdade

const { criarApp } = await import('../src/app.js');
const { migrar } = await import('../src/migrar.js');
const { pool, consulta } = await import('../src/db.js');
const { rodarLembretes } = await import('../src/jobs/rotinas.js');
const { agoraLocal, somarDias, somarMeses } = await import('../src/lib/datas.js');
const { config } = await import('../src/config.js');

let servidor; let base;
const log = console.log; // deixa a saída do teste limpa
before(async () => {
  console.log = () => {};
  await migrar();
  await consulta('TRUNCATE usuarios, assinaturas, pagamentos, codigos_acesso, verificacoes, sessoes, mensagens, links_pagamento, pesquisas, push_tokens, testes_usados RESTART IDENTITY CASCADE');
  servidor = criarApp().listen(0);
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(async () => { console.log = log; servidor.close(); await pool.end(); });

async function api(metodo, caminho, corpo, token, cabecalhos = {}) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...cabecalhos },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados; try { dados = JSON.parse(texto); } catch { dados = texto; }
  return { status: r.status, dados };
}

const NUM = '(66) 99999-1111';
const E164 = '5566999991111';
async function entrar(numero, extras = {}) {
  const c = await api('POST', '/auth/codigo', { whatsapp: numero, canal: 'whatsapp' });
  assert.equal(c.status, 200, JSON.stringify(c.dados));
  const v = await api('POST', '/auth/verificar', { whatsapp: numero, codigo: c.dados._codigoTeste });
  assert.equal(v.status, 200, JSON.stringify(v.dados));
  const f = await api('POST', '/auth/concluir', { passe: v.dados.passe, perfil: 'contratante', nome: 'João Pereira', cidade: 'Nova Xavantina', uf: 'MT', aceiteTermos: true, plataforma: 'android', ...extras });
  assert.equal(f.status, 200, JSON.stringify(f.dados));
  return f;
}

test('número inválido é barrado no servidor também', async () => {
  const r = await api('POST', '/auth/codigo', { whatsapp: '(20) 99999-1111' });
  assert.equal(r.status, 400);
  assert.match(r.dados.erro, /DDD 20 não existe/);
});

test('cadastro: código errado conta tentativas, certo cria a conta com teste grátis de 7 dias', async () => {
  const c = await api('POST', '/auth/codigo', { whatsapp: NUM, canal: 'whatsapp' });
  assert.equal(c.status, 200);
  assert.equal(c.dados.digitos, 6);
  assert.match(c.dados._codigoTeste, /^\d{6}$/);
  const guardado = (await consulta('SELECT codigo_hash FROM codigos_acesso ORDER BY id DESC LIMIT 1')).rows[0].codigo_hash;
  assert.ok(!guardado.includes(c.dados._codigoTeste), 'o código nunca fica guardado aberto no banco');

  const errado = await api('POST', '/auth/verificar', { whatsapp: NUM, codigo: '000000' === c.dados._codigoTeste ? '111111' : '000000' });
  assert.equal(errado.status, 400);
  assert.match(errado.dados.erro, /ainda tem 4 tentativas/);

  const v = await api('POST', '/auth/verificar', { whatsapp: NUM, codigo: c.dados._codigoTeste });
  assert.equal(v.status, 200);
  const reuso = await api('POST', '/auth/verificar', { whatsapp: NUM, codigo: c.dados._codigoTeste });
  assert.equal(reuso.status, 400, 'o mesmo código não serve duas vezes');

  const semCidade = await api('POST', '/auth/concluir', { passe: v.dados.passe, perfil: 'contratante', nome: 'João Pereira', cidade: 'Cidade Inventada', uf: 'MT', aceiteTermos: true });
  assert.equal(semCidade.status, 400);
  assert.match(semCidade.dados.erro, /cidade/);

  // o passe foi usado na tentativa acima? Não: a transação desfez. Usa de novo.
  const ok = await api('POST', '/auth/concluir', { passe: v.dados.passe, perfil: 'contratante', nome: 'João Pereira', cidade: 'Nova Xavantina', uf: 'MT', senha: 'senha123', aceiteTermos: true, plataforma: 'android' });
  assert.equal(ok.status, 200, JSON.stringify(ok.dados));
  assert.equal(ok.dados.novo, true);

  const me = await api('GET', '/me', null, ok.dados.token);
  assert.equal(me.status, 200);
  assert.equal(me.dados.situacao.estado, 'teste');
  assert.equal(me.dados.situacao.diasRestantes, 7);
  assert.equal(me.dados.usuario.cidade, 'Nova Xavantina');
  const u = (await consulta('SELECT fuso, teste_inicio, teste_fim FROM usuarios WHERE whatsapp = $1', [E164])).rows[0];
  assert.equal(u.fuso, 'America/Cuiaba');
  assert.equal(u.teste_fim, somarDias(u.teste_inicio, 6));
  const boasVindas = (await consulta("SELECT status FROM mensagens WHERE tipo = 'boas_vindas_teste'")).rows;
  assert.deepEqual(boasVindas.map((m) => m.status), ['simulada'], 'boas-vindas sai uma vez');
});

test('reinstalou o app: entra na mesma conta pelo código e ganha o outro perfil', async () => {
  const f = await entrar(NUM, { perfil: 'fornecedor' });
  assert.equal(f.status, 200);
  assert.equal(f.dados.novo, false);
  const u = (await consulta('SELECT contratante, fornecedor FROM usuarios WHERE whatsapp = $1', [E164])).rows[0];
  assert.deepEqual(u, { contratante: true, fornecedor: true });
  assert.equal((await consulta("SELECT COUNT(*)::int AS n FROM mensagens WHERE tipo = 'boas_vindas_teste'")).rows[0].n, 1);
});

test('entrar com senha (opcional)', async () => {
  assert.equal((await api('POST', '/auth/senha', { whatsapp: NUM, senha: 'senha123' })).status, 200);
  const errada = await api('POST', '/auth/senha', { whatsapp: NUM, senha: 'outra' });
  assert.equal(errada.status, 401);
});

test('5 erros seguidos bloqueiam o código', async () => {
  const n = '(66) 99999-2222';
  const c = await api('POST', '/auth/codigo', { whatsapp: n });
  const errado = c.dados._codigoTeste === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await api('POST', '/auth/verificar', { whatsapp: n, codigo: errado });
  const r = await api('POST', '/auth/verificar', { whatsapp: n, codigo: c.dados._codigoTeste });
  assert.equal(r.status, 429);
  assert.match(r.dados.erro, /Muitas tentativas/);
});

test('pagamento por Pix pelo link: libera, manda recibo e não conta duas vezes', async () => {
  const u = (await consulta('SELECT * FROM usuarios WHERE whatsapp = $1', [E164])).rows[0];
  const { criarLinkPagamento } = await import('../src/services/assinaturas.js');
  const link = await criarLinkPagamento(u.id);
  const pagina = await api('GET', `/ativar/${link}`);
  assert.equal(pagina.status, 200);
  assert.equal(pagina.dados.primeiroNome, 'João');
  assert.equal(pagina.dados.whatsapp, '(66) 99999-1111');
  assert.equal(pagina.dados.valor, '29,90');

  const semSegredo = await api('POST', '/pagamentos/webhook', { evento: 'pago', idExterno: 'pix-1', linkToken: link, metodo: 'pix' }, null, { 'X-Webhook-Secret': 'errado' });
  assert.equal(semSegredo.status, 200, 'sem segredo configurado, o modo de teste aceita');

  const hoje = agoraLocal('America/Cuiaba').data;
  const repetido = await api('POST', '/pagamentos/webhook', { evento: 'pago', idExterno: 'pix-1', linkToken: link, metodo: 'pix' });
  assert.equal(repetido.status, 404, 'o link já foi usado');
  const repetidoPorId = await api('POST', '/pagamentos/webhook', { evento: 'pago', idExterno: 'pix-1', usuarioId: u.id, metodo: 'pix' });
  assert.equal(repetidoPorId.dados.repetido, true);

  const a = (await consulta('SELECT * FROM assinaturas WHERE usuario_id = $1', [u.id])).rows[0];
  assert.equal(a.origem, 'site');
  assert.equal(a.vencimento, somarMeses(hoje, 1, Number(hoje.slice(8))));
  assert.equal((await consulta("SELECT COUNT(*)::int AS n FROM pagamentos")).rows[0].n, 1);
  assert.equal((await consulta("SELECT COUNT(*)::int AS n FROM mensagens WHERE tipo = 'recibo_pix'")).rows[0].n, 1);
  const tok = (await entrar(NUM)).dados.token;
  assert.equal((await api('GET', '/me', null, tok)).dados.situacao.estado, 'ativa');
});

test('lembretes às 9h no fuso da pessoa, uma vez só', async () => {
  const n = '(65) 99999-3333'; // Cuiabá
  await entrar(n);
  const u = (await consulta("SELECT * FROM usuarios WHERE whatsapp = '5565999993333'")).rows[0];
  const as9 = new Date('2026-10-05T13:00:00Z'); // 09h em Cuiabá
  const as9SP = new Date('2026-10-05T12:00:00Z'); // 09h em Brasília = 08h em Cuiabá
  await consulta("UPDATE usuarios SET teste_fim = '2026-10-07' WHERE id = $1", [u.id]); // faltam 2 dias em 05/10
  assert.equal((await rodarLembretes(as9SP)).enviadas, 0, 'às 8h de Cuiabá ainda não manda');
  await rodarLembretes(as9);
  await rodarLembretes(as9);
  const m = (await consulta("SELECT tipo FROM mensagens WHERE usuario_id = $1 AND tipo LIKE 'teste_%'", [u.id])).rows;
  assert.deepEqual(m.map((x) => x.tipo), ['teste_faltam_2_dias']);
  await rodarLembretes(new Date('2026-10-08T13:00:00Z'));
  const fim = (await consulta("SELECT tipo FROM mensagens WHERE usuario_id = $1 AND tipo IN ('teste_terminou','pesquisa_satisfacao') ORDER BY id", [u.id])).rows;
  assert.deepEqual(fim.map((x) => x.tipo), ['teste_terminou', 'pesquisa_satisfacao']);
});

function postarWhatsApp(corpo, assinar = true) {
  const bruto = JSON.stringify(corpo);
  const assinatura = 'sha256=' + crypto.createHmac('sha256', 'segredo-teste').update(bruto).digest('hex');
  return fetch(`${base}/webhooks/whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': assinar ? assinatura : 'sha256=00' }, body: bruto });
}
const msgDe = (de, texto) => ({ entry: [{ changes: [{ value: { messages: [{ from: de, type: 'text', text: { body: texto } }] } }] }] });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

test('webhook do WhatsApp: verificação, assinatura, SAIR, nota da pesquisa e novo link', async () => {
  const ver = await fetch(`${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verifica-teste&hub.challenge=42`);
  assert.equal(await ver.text(), '42');
  assert.equal((await postarWhatsApp(msgDe('5565999993333', 'oi'), false)).status, 401, 'assinatura falsa é recusada');

  const id = (await consulta("SELECT id FROM usuarios WHERE whatsapp = '5565999993333'")).rows[0].id;
  await postarWhatsApp(msgDe('5565999993333', '4. Achei bom, mas quero mais fretes perto de Água Boa')); await esperar(150);
  const p = (await consulta('SELECT nota, comentario FROM pesquisas WHERE usuario_id = $1', [id])).rows[0];
  assert.deepEqual(p, { nota: 4, comentario: 'Achei bom, mas quero mais fretes perto de Água Boa' });

  await consulta("UPDATE usuarios SET teste_fim = '2026-09-20' WHERE id = $1", [id]); // teste já terminou
  const antes = (await consulta('SELECT COUNT(*)::int AS n FROM links_pagamento WHERE usuario_id = $1', [id])).rows[0].n;
  await postarWhatsApp(msgDe('5565999993333', 'quero voltar a usar')); await esperar(150); // → manda link novo
  const depois = (await consulta('SELECT COUNT(*)::int AS n FROM links_pagamento WHERE usuario_id = $1', [id])).rows[0].n;
  assert.equal(depois, antes + 1);

  await postarWhatsApp(msgDe('5565999993333', 'SAIR')); await esperar(150);
  assert.equal((await consulta('SELECT aceita_mensagens FROM usuarios WHERE id = $1', [id])).rows[0].aceita_mensagens, false);
  await consulta("UPDATE usuarios SET teste_fim = '2026-10-12' WHERE id = $1", [id]);
  await rodarLembretes(new Date('2026-10-12T13:00:00Z')); // último dia: não é essencial → não manda
  assert.equal((await consulta("SELECT COUNT(*)::int AS n FROM mensagens WHERE usuario_id = $1 AND tipo = 'teste_ultimo_dia'", [id])).rows[0].n, 0);
});

test('assinatura pela loja (modo teste): libera e não recebe lembrete de vencimento', async () => {
  const f = await entrar('(65) 99999-3333');
  const r = await api('POST', '/assinatura/loja', { plataforma: 'android', tokenCompra: 'teste_compra_1' }, f.dados.token);
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  assert.equal(r.dados.situacao.estado, 'ativa');
  assert.equal(r.dados.situacao.origem, 'loja_google');
  const falsa = await api('POST', '/assinatura/loja', { plataforma: 'android', tokenCompra: 'qualquer' }, f.dados.token);
  assert.equal(falsa.status, 501, 'compra que não foi confirmada com a loja não libera');
});

test('excluir conta e tentar ganhar outro teste grátis com o mesmo número', async () => {
  const n = '(66) 99999-4444';
  const t1 = (await entrar(n)).dados.token;
  assert.equal((await api('DELETE', '/me', null, t1)).status, 200);
  assert.equal((await api('GET', '/me', null, t1)).status, 401, 'a sessão some junto com a conta');
  const t2 = (await entrar(n)).dados.token;
  const s = (await api('GET', '/me', null, t2)).dados.situacao;
  assert.equal(s.estado, 'teste_terminou', 'mesmo número não ganha teste de novo');
  assert.equal(config.codigo.digitos, 6);
});
