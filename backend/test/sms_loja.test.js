import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prepararAmbiente, subirApp, servidorFalso } from './apoio.js';

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const umDia = 86400000;

// ---------- chaves de teste (no lugar das reais da Google e da Apple) ----------
const google = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const apple = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });

function jwtValido(jwt, chavePublica, alg) {
  const [c, p, s] = String(jwt).split('.');
  const dados = Buffer.from(`${c}.${p}`);
  const ok = alg === 'RS256'
    ? crypto.verify('RSA-SHA256', dados, chavePublica, Buffer.from(s, 'base64url'))
    : crypto.verify('sha256', dados, { key: chavePublica, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  return ok ? { cabecalho: JSON.parse(Buffer.from(c, 'base64url')), conteudo: JSON.parse(Buffer.from(p, 'base64url')) } : null;
}

// ---------- Google falso: token OAuth + Play Developer API ----------
const assinaturasGoogle = {};
const gServ = await servidorFalso((req, corpo) => {
  if (req.url === '/token') {
    const j = jwtValido(corpo.assertion, google.publicKey, 'RS256');
    if (corpo.grant_type !== 'urn:ietf:params:oauth:grant-type:jwt-bearer' || !j || j.conteudo.scope !== 'https://www.googleapis.com/auth/androidpublisher') return { status: 401, json: { error: 'invalid_grant' } };
    return { json: { access_token: 'acesso-google', expires_in: 3600 } };
  }
  if (req.headers.authorization !== 'Bearer acesso-google') return { status: 401, json: {} };
  const m = req.url.match(/^\/androidpublisher\/v3\/applications\/br\.com\.agrovinc\.app\/purchases\/subscriptionsv2\/tokens\/(.+)$/);
  if (m && assinaturasGoogle[decodeURIComponent(m[1])]) return { json: assinaturasGoogle[decodeURIComponent(m[1])] };
  return null;
});
const subGoogle = (estado, pedido, dias, extra = {}) => ({ subscriptionState: estado, latestOrderId: pedido, lineItems: [{ productId: 'agrovinc_assinatura_mensal', expiryTime: new Date(Date.now() + dias * umDia).toISOString() }], ...extra });

// ---------- Apple falsa: App Store Server API (produção sem a compra, teste com a compra) ----------
const transacoesApple = {};
const jwsApple = (t) => `${b64url({ alg: 'ES256' })}.${b64url(t)}.assinatura`;
const aServ = await servidorFalso((req) => {
  const j = jwtValido(String(req.headers.authorization ?? '').replace('Bearer ', ''), apple.publicKey, 'ES256');
  if (!j || j.cabecalho.kid !== 'CHAVE123' || j.conteudo.iss !== 'emissor-apple' || j.conteudo.aud !== 'appstoreconnect-v1' || j.conteudo.bid !== 'br.com.agrovinc.app') return { status: 401, json: {} };
  const m = req.url.match(/^\/(producao|sandbox)\/inApps\/v1\/transactions\/(\d+)$/);
  if (m && m[1] === 'sandbox' && transacoesApple[m[2]]) return { json: { signedTransactionInfo: jwsApple(transacoesApple[m[2]]) } };
  return null;
});
const transApple = (id, original, dias, extra = {}) => ({ transactionId: id, originalTransactionId: original, productId: 'agrovinc_assinatura_mensal', bundleId: 'br.com.agrovinc.app', expiresDate: Date.now() + dias * umDia, ...extra });

// ---------- SMS falsos ----------
const smsServ = await servidorFalso((req, corpo) => {
  if (req.url === '/v2/channels/sms/messages') return req.headers['x-api-token'] === 'zen-token' && corpo.from === 'AGROVINC' && corpo.contents?.[0]?.type === 'text' ? { json: { id: 'zen-1' } } : { status: 401, json: { message: 'token inválido' } };
  if (req.url === '/2010-04-01/Accounts/AC123/Messages.json') {
    const certo = `Basic ${Buffer.from('AC123:tw-token').toString('base64')}`;
    return req.headers.authorization === certo ? { status: 201, json: { sid: 'SM1' } } : { status: 401, json: { message: 'Authenticate' } };
  }
  return null;
});

prepararAmbiente({
  GOOGLE_CONTA_SERVICO: JSON.stringify({ client_email: 'servidor@agrovinc.iam.gserviceaccount.com', private_key: google.privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: `${gServ.url}/token` }),
  GOOGLE_PLAY_API_URL: gServ.url, GOOGLE_PLAY_WEBHOOK_SEGREDO: 'segredo-pubsub',
  APPLE_ISSUER_ID: 'emissor-apple', APPLE_KEY_ID: 'CHAVE123', APPLE_CHAVE_P8: apple.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  APPLE_API_URL_PRODUCAO: `${aServ.url}/producao`, APPLE_API_URL_SANDBOX: `${aServ.url}/sandbox`,
});
const { pool, consulta } = await import('../src/db.js');
const { enviarSms } = await import('../src/services/mensagens/sms.js');
let app;
const assinatura = async (id) => (await consulta('SELECT * FROM assinaturas WHERE usuario_id = $1', [id])).rows[0];
const hojeMais = (dias) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(Date.now() + dias * umDia));

before(async () => { app = await subirApp(); });
after(async () => { app.servidor.close(); await Promise.all([gServ.fechar(), aServ.fechar(), smsServ.fechar()]); await pool.end(); });

test('SMS: Zenvia e Twilio recebem no formato certo; provedor errado avisa', async () => {
  Object.assign(process.env, { SMS_PROVEDOR: 'zenvia', ZENVIA_TOKEN: 'zen-token', ZENVIA_REMETENTE: 'AGROVINC', ZENVIA_URL: smsServ.url });
  assert.deepEqual(await enviarSms('+5566999990000', 'Seu código: 123456'), { id: 'zen-1' });
  const z = smsServ.chamadas.at(-1);
  assert.equal(z.corpo.to, '5566999990000');
  process.env.ZENVIA_TOKEN = 'errado';
  await assert.rejects(enviarSms('+5566999990000', 'x'), /SMS recusado \(401\): token inválido/);

  Object.assign(process.env, { SMS_PROVEDOR: 'twilio', TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'tw-token', TWILIO_NUMERO: '+15550001111', TWILIO_URL: smsServ.url });
  assert.deepEqual(await enviarSms('+5566999990000', 'Seu código: 654321'), { id: 'SM1' });
  const t = smsServ.chamadas.at(-1);
  assert.deepEqual([t.corpo.To, t.corpo.From, t.corpo.Body], ['+5566999990000', '+15550001111', 'Seu código: 654321']);

  process.env.SMS_PROVEDOR = 'outro';
  await assert.rejects(enviarSms('+5566999990000', 'x'), /Use zenvia ou twilio/);
  process.env.SMS_PROVEDOR = '';
  assert.equal((await enviarSms('+5566999990000', 'x')).simulado, true);
});

test('Google Play: compra conferida com a Google, vencimento da loja, uma conta por compra', async () => {
  const u = await app.entrar('(66) 99999-4001', 'contratante', 'Gabi Google');
  assinaturasGoogle['tok-1'] = subGoogle('SUBSCRIPTION_STATE_ACTIVE', 'GPA.1111-0', 30);
  const r = await app.api('POST', '/assinatura/loja', { plataforma: 'android', tokenCompra: 'tok-1' }, u.token);
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  assert.equal(r.dados.situacao.estado, 'ativa');
  let a = await assinatura(u.id);
  assert.deepEqual([a.origem, a.metodo, a.vencimento, a.id_externo], ['loja_google', 'loja', hojeMais(30), 'tok-1']);

  const outra = await app.entrar('(66) 99999-4002', 'contratante', 'Outra Pessoa');
  assert.equal((await app.api('POST', '/assinatura/loja', { plataforma: 'android', tokenCompra: 'tok-1' }, outra.token)).status, 409);

  assinaturasGoogle['tok-vencido'] = subGoogle('SUBSCRIPTION_STATE_EXPIRED', 'GPA.2222-0', -2);
  assert.equal((await app.api('POST', '/assinatura/loja', { plataforma: 'android', tokenCompra: 'tok-vencido' }, outra.token)).status, 400);
  assert.equal((await app.api('POST', '/assinatura/loja', { plataforma: 'android', tokenCompra: 'tok-que-nao-existe' }, outra.token)).status, 400);

  // avisos da Google (Pub/Sub): renovou, cancelou, revogou
  const pubsub = (tipo, token) => app.api('POST', '/webhooks/google-play?segredo=segredo-pubsub', { message: { data: Buffer.from(JSON.stringify({ packageName: 'br.com.agrovinc.app', subscriptionNotification: { notificationType: tipo, purchaseToken: token, subscriptionId: 'agrovinc_assinatura_mensal' } })).toString('base64') } });
  assert.equal((await app.api('POST', '/webhooks/google-play?segredo=errado', {})).status, 401);
  assinaturasGoogle['tok-1'] = subGoogle('SUBSCRIPTION_STATE_ACTIVE', 'GPA.1111-0..1', 60);
  assert.equal((await pubsub(2, 'tok-1')).dados.acao, 'renovou');
  a = await assinatura(u.id);
  assert.equal(a.vencimento, hojeMais(60));
  assert.equal((await consulta('SELECT COUNT(*)::int n FROM pagamentos WHERE usuario_id = $1', [u.id])).rows[0].n, 2);
  assert.equal((await pubsub(2, 'tok-1')).status, 200, 'aviso repetido');
  assert.equal((await consulta('SELECT COUNT(*)::int n FROM pagamentos WHERE usuario_id = $1', [u.id])).rows[0].n, 2, 'não conta duas vezes');

  assinaturasGoogle['tok-1'] = subGoogle('SUBSCRIPTION_STATE_CANCELED', 'GPA.1111-0..1', 60);
  assert.equal((await pubsub(3, 'tok-1')).dados.acao, 'cancelou');
  a = await assinatura(u.id);
  assert.ok(a.cancelada_em, 'marcada como cancelada');
  assert.equal((await app.api('GET', '/me', null, u.token)).dados.situacao.acesso, true, 'cancelou, mas usa até o fim do período pago');

  assert.equal((await pubsub(12, 'tok-1')).dados.acao, 'revogou');
  assert.equal((await app.api('GET', '/me', null, u.token)).dados.situacao.acesso, false, 'reembolso/revogação pausa o acesso');

  assert.equal((await app.api('POST', '/webhooks/google-play?segredo=segredo-pubsub', { message: { data: Buffer.from(JSON.stringify({ testNotification: { version: '1.0' } })).toString('base64') } })).dados.teste, true);
});

test('App Store: compra conferida com a Apple (cai no ambiente de teste), renovação, cancelamento e reembolso', async () => {
  const u = await app.entrar('(66) 99999-4003', 'contratante', 'Ivo iPhone');
  transacoesApple['2000000001'] = transApple('2000000001', '2000000001', 30);
  const r = await app.api('POST', '/assinatura/loja', { plataforma: 'ios', tokenCompra: '2000000001' }, u.token);
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  let a = await assinatura(u.id);
  assert.deepEqual([a.origem, a.vencimento, a.id_externo], ['loja_apple', hojeMais(30), '2000000001']);
  assert.ok(aServ.chamadas.some((c) => c.url.startsWith('/producao/')), 'tentou produção primeiro');

  transacoesApple['2000000009'] = transApple('2000000009', '2000000009', 30, { productId: 'outro_produto' });
  assert.equal((await app.api('POST', '/assinatura/loja', { plataforma: 'ios', tokenCompra: '2000000009' }, u.token)).status, 400, 'produto errado não libera');
  assert.equal((await app.api('POST', '/assinatura/loja', { plataforma: 'ios', tokenCompra: 'nao-numerico' }, u.token)).status, 400);

  const aviso = (tipo, transacao, subtype) => app.api('POST', '/webhooks/apple', { signedPayload: jwsApple({ notificationType: tipo, subtype, data: { signedTransactionInfo: jwsApple(transacao) } }) });
  transacoesApple['2000000002'] = transApple('2000000002', '2000000001', 60);
  assert.equal((await aviso('DID_RENEW', transacoesApple['2000000002'])).dados.acao, 'renovou');
  a = await assinatura(u.id);
  assert.equal(a.vencimento, hojeMais(60));

  // aviso falso: transação que a Apple não conhece é ignorada
  assert.equal((await aviso('DID_RENEW', transApple('2999999999', '2000000001', 400))).dados.ignorado, 'transacao_desconhecida');
  assert.equal((await assinatura(u.id)).vencimento, hojeMais(60));

  assert.equal((await aviso('DID_CHANGE_RENEWAL_STATUS', transacoesApple['2000000002'], 'AUTO_RENEW_DISABLED')).dados.acao, 'cancelou');
  assert.ok((await assinatura(u.id)).cancelada_em);
  assert.equal((await aviso('DID_CHANGE_RENEWAL_STATUS', transacoesApple['2000000002'], 'AUTO_RENEW_ENABLED')).dados.acao, 'reativou');
  assert.equal((await assinatura(u.id)).cancelada_em, null);

  transacoesApple['2000000002'].revocationDate = Date.now();
  assert.equal((await aviso('REFUND', transacoesApple['2000000002'])).dados.acao, 'revogou');
  assert.equal((await app.api('GET', '/me', null, u.token)).dados.situacao.acesso, false);
  assert.equal((await aviso('TEST', {})).dados.teste, true);
});

test('loja sem credenciais: resposta clara (e a compra de teste segue funcionando em modo de teste)', async () => {
  const guardado = process.env.APPLE_KEY_ID;
  process.env.APPLE_KEY_ID = '';
  const u = await app.entrar('(66) 99999-4004', 'contratante', 'Sem Chave');
  const r = await app.api('POST', '/assinatura/loja', { plataforma: 'ios', tokenCompra: '2000000001' }, u.token);
  assert.equal(r.status, 501);
  assert.equal(r.dados.codigo, 'loja_nao_configurada');
  assert.equal((await app.api('POST', '/assinatura/loja', { plataforma: 'ios', tokenCompra: 'teste_1' }, u.token)).status, 200);
  process.env.APPLE_KEY_ID = guardado;
});
