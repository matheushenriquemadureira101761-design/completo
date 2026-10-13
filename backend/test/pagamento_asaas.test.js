import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararAmbiente, subirApp, servidorFalso, CPF_VALIDO } from './apoio.js';

// Asaas falso: guarda clientes, cobranças e assinaturas como o de verdade.
const estado = { n: 0, clientes: {}, pagamentos: {}, assinaturas: {}, falharCancelamento: false };
const novoId = (p) => `${p}_${++estado.n}`;
const asaas = await servidorFalso((req, corpo) => {
  if (req.headers.access_token !== 'chave-asaas-teste') return { status: 401, json: { errors: [{ description: 'token inválido' }] } };
  const [caminho] = req.url.split('?');
  let m;
  if (req.method === 'POST' && caminho === '/customers') {
    if (!/^\d{11}$|^[0-9A-Z]{14}$/.test(corpo.cpfCnpj)) return { status: 400, json: { errors: [{ description: 'O CPF/CNPJ informado é inválido.' }] } };
    const id = novoId('cus'); estado.clientes[id] = corpo; return { json: { id } };
  }
  if (req.method === 'POST' && (m = caminho.match(/^\/customers\/(cus_\d+)$/))) { Object.assign(estado.clientes[m[1]], corpo); return { json: { id: m[1] } }; }
  if (req.method === 'POST' && caminho === '/payments') { const id = novoId('pay'); estado.pagamentos[id] = corpo; return { json: { id, status: 'PENDING' } }; }
  if (req.method === 'GET' && (m = caminho.match(/^\/payments\/(pay_\d+)\/pixQrCode$/))) return { json: { success: true, encodedImage: 'iVBORw0KGgo=', payload: `00020126PIX-${m[1]}`, expirationDate: '2099-01-01 23:59:59' } };
  if (req.method === 'POST' && caminho === '/subscriptions') { const id = novoId('sub'); estado.assinaturas[id] = { ...corpo, ativa: true, primeira: novoId('pay') }; return { json: { id } }; }
  if (req.method === 'GET' && (m = caminho.match(/^\/subscriptions\/(sub_\d+)\/payments$/))) { const s = estado.assinaturas[m[1]]; return { json: { data: [{ id: s.primeira, invoiceUrl: `https://www.asaas.com/i/${s.primeira}` }] } }; }
  if (req.method === 'DELETE' && (m = caminho.match(/^\/subscriptions\/(sub_\d+)$/))) {
    if (estado.falharCancelamento) return { status: 500, json: { errors: [{ description: 'instável' }] } };
    if (!estado.assinaturas[m[1]]) return null;
    estado.assinaturas[m[1]].ativa = false; return { json: { deleted: true, id: m[1] } };
  }
  return null;
});

prepararAmbiente({ PAGAMENTO_PROVEDOR: 'asaas', ASAAS_API_KEY: 'chave-asaas-teste', ASAAS_URL: asaas.url, ASAAS_WEBHOOK_TOKEN: 'token-webhook-asaas-teste' });
const { pool, consulta } = await import('../src/db.js');
const { criarLinkPagamento } = await import('../src/services/assinaturas.js');
let app; let joao; let ana;
const WEBHOOK = { 'asaas-access-token': 'token-webhook-asaas-teste' };
const aviso = (event, payment) => app.api('POST', '/pagamentos/asaas', { event, payment }, null, WEBHOOK);
const assinatura = async (id) => (await consulta('SELECT * FROM assinaturas WHERE usuario_id = $1', [id])).rows[0];

before(async () => {
  app = await subirApp();
  joao = await app.entrar('(66) 99999-3001', 'contratante', 'João Pereira');
  ana = await app.entrar('(66) 99999-3002', 'fornecedor', 'Ana Souza');
});
after(async () => { app.servidor.close(); await asaas.fechar(); await pool.end(); });

test('página: o navegador recebe a página; o script recebe os dados', async () => {
  const link = await criarLinkPagamento(joao.id);
  const html = await fetch(`${app.base}/ativar/${link}`, { headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' } });
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type'), /text\/html/);
  assert.match(await html.text(), /<script src="\/site\/ativar.js"><\/script>/);
  const js = await fetch(`${app.base}/site/ativar.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  const d = await app.api('GET', `/ativar/${link}`);
  assert.equal(d.status, 200);
  assert.equal(d.dados.nome, 'João Pereira');
  assert.deepEqual(d.dados.pagamento, { disponivel: true, simulado: false, assinaLoja: false });
  assert.equal((await app.api('GET', '/ativar/link-que-nao-existe')).status, 404);
});

test('Pix: CPF conferido, cobrança no Asaas, mesma cobrança se tocar de novo', async () => {
  const link = await criarLinkPagamento(joao.id);
  const ruim = await app.api('POST', `/ativar/${link}/pix`, { documento: '111.111.111-11' });
  assert.equal(ruim.status, 400);
  assert.equal(ruim.dados.codigo, 'documento');
  const p = await app.api('POST', `/ativar/${link}/pix`, { documento: CPF_VALIDO });
  assert.equal(p.status, 200, JSON.stringify(p.dados));
  assert.match(p.dados.copiaECola, /^00020126PIX-pay_\d+$/);
  assert.equal(p.dados.qrCodePng, 'iVBORw0KGgo=');
  const cliente = Object.values(estado.clientes)[0];
  assert.deepEqual({ cpf: cliente.cpfCnpj, celular: cliente.mobilePhone, aviso: cliente.notificationDisabled }, { cpf: '52998224725', celular: '66999993001', aviso: true });
  const cob = estado.pagamentos[p.dados.cobranca];
  assert.equal(cob.billingType, 'PIX');
  assert.equal(cob.value, 29.9);
  assert.match(cob.dueDate, /^\d{4}-\d{2}-\d{2}$/);
  const de_novo = await app.api('POST', `/ativar/${link}/pix`, { documento: CPF_VALIDO });
  assert.equal(de_novo.dados.cobranca, p.dados.cobranca, 'não cria outro Pix');
  assert.equal(Object.keys(estado.pagamentos).length, 1);
  assert.equal((await app.api('GET', `/ativar/${link}/cobranca/${p.dados.cobranca}`)).dados.status, 'pendente');

  assert.equal((await app.api('POST', '/pagamentos/asaas', { event: 'PAYMENT_RECEIVED', payment: { id: p.dados.cobranca } }, null, { 'asaas-access-token': 'errado' })).status, 401);
  const r = await aviso('PAYMENT_RECEIVED', { id: p.dados.cobranca, customer: Object.keys(estado.clientes)[0], billingType: 'PIX', value: 29.9 });
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  assert.match(r.dados.vencimento, /^\d{4}-\d{2}-\d{2}$/);
  const a = await assinatura(joao.id);
  assert.deepEqual([a.origem, a.metodo, a.id_externo], ['site', 'pix', null]);
  assert.equal((await app.api('GET', `/ativar/${link}/cobranca/${p.dados.cobranca}`)).dados.status, 'paga', 'a página vê o pagamento mesmo com o link já usado');
  assert.equal((await aviso('PAYMENT_CONFIRMED', { id: p.dados.cobranca, billingType: 'PIX', value: 29.9 })).dados.repetido, true, 'aviso repetido não conta duas vezes');
  assert.equal((await consulta(`SELECT COUNT(*)::int n FROM pagamentos WHERE usuario_id = $1`, [joao.id])).rows[0].n, 1);
  const recibo = (await consulta(`SELECT tipo FROM mensagens WHERE usuario_id = $1 AND tipo = 'recibo_pix'`, [joao.id])).rows;
  assert.equal(recibo.length, 1);
  assert.equal((await app.api('POST', `/ativar/${link}/pix`, { documento: CPF_VALIDO })).status, 404, 'link pago não gera outra cobrança');
});

test('cartão: assinatura no Asaas, página segura, renovação automática e troca para Pix cancela o cartão', async () => {
  let link = await criarLinkPagamento(ana.id);
  const c = await app.api('POST', `/ativar/${link}/cartao`, { documento: '11.222.333/0001-81' });
  assert.equal(c.status, 200, JSON.stringify(c.dados));
  const sub = c.dados.cobranca;
  assert.match(c.dados.url, /^https:\/\/www\.asaas\.com\/i\/pay_\d+$/);
  assert.deepEqual([estado.assinaturas[sub].billingType, estado.assinaturas[sub].cycle, estado.assinaturas[sub].value], ['CREDIT_CARD', 'MONTHLY', 29.9]);
  assert.equal((await app.api('POST', `/ativar/${link}/cartao`, { documento: '11222333000181' })).dados.cobranca, sub, 'mesma página, sem assinatura repetida');

  const primeira = estado.assinaturas[sub].primeira;
  assert.equal((await aviso('PAYMENT_CONFIRMED', { id: primeira, subscription: sub, billingType: 'CREDIT_CARD', value: 29.9, creditCard: { creditCardNumber: '4242' } })).status, 200);
  let a = await assinatura(ana.id);
  assert.deepEqual([a.metodo, a.id_externo], ['cartao', sub]);
  const venc1 = a.vencimento;
  const recibo = (await consulta(`SELECT COUNT(*)::int n FROM mensagens WHERE usuario_id = $1 AND tipo = 'recibo_cartao'`, [ana.id])).rows[0].n;
  assert.equal(recibo, 1);

  // mês seguinte: o Asaas cobra sozinho e avisa (cobrança nova da mesma assinatura)
  assert.equal((await aviso('PAYMENT_CONFIRMED', { id: 'pay_renova_1', subscription: sub, billingType: 'CREDIT_CARD', value: 29.9, creditCard: { creditCardNumber: '4242' } })).status, 200);
  a = await assinatura(ana.id);
  assert.ok(a.vencimento > venc1, 'vencimento andou um mês');
  assert.equal(estado.assinaturas[sub].ativa, true);

  // cartão recusado: aviso no WhatsApp com link novo
  assert.equal((await aviso('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', { id: 'pay_recusa_1', subscription: sub, billingType: 'CREDIT_CARD', creditCard: { creditCardNumber: '4242' } })).status, 200);
  assert.equal((await consulta(`SELECT COUNT(*)::int n FROM mensagens WHERE usuario_id = $1 AND tipo = 'cartao_recusado'`, [ana.id])).rows[0].n, 1);

  // a pessoa paga com Pix: a assinatura do cartão é cancelada (não paga duas vezes)
  link = await criarLinkPagamento(ana.id);
  const p = await app.api('POST', `/ativar/${link}/pix`, { documento: '11222333000181' });
  assert.equal((await aviso('PAYMENT_RECEIVED', { id: p.dados.cobranca, billingType: 'PIX', value: 29.9 })).status, 200);
  assert.equal(estado.assinaturas[sub].ativa, false);
  a = await assinatura(ana.id);
  assert.deepEqual([a.metodo, a.id_externo], ['pix', null]);
});

test('quem assina pela loja não paga pelo site', async () => {
  const lu = await app.entrar('(66) 99999-3003', 'contratante', 'Lúcia Loja');
  assert.equal((await app.api('POST', '/assinatura/loja', { plataforma: 'android', tokenCompra: 'teste_123' }, lu.token)).status, 200);
  const link = await criarLinkPagamento(lu.id);
  const d = await app.api('GET', `/ativar/${link}`);
  assert.equal(d.dados.pagamento.assinaLoja, true);
  const r = await app.api('POST', `/ativar/${link}/pix`, { documento: CPF_VALIDO });
  assert.equal(r.status, 409);
  assert.equal(r.dados.codigo, 'assina_loja');
});

test('excluir conta cancela o cartão; se o Asaas falhar, a conta fica (para não seguir cobrando)', async () => {
  const z = await app.entrar('(66) 99999-3004', 'contratante', 'Zé Cartão');
  const link = await criarLinkPagamento(z.id);
  const c = await app.api('POST', `/ativar/${link}/cartao`, { documento: CPF_VALIDO });
  const sub = c.dados.cobranca;
  await aviso('PAYMENT_CONFIRMED', { id: estado.assinaturas[sub].primeira, subscription: sub, billingType: 'CREDIT_CARD', value: 29.9, creditCard: { creditCardNumber: '1111' } });
  estado.falharCancelamento = true;
  const falhou = await app.api('DELETE', '/me', null, z.token);
  assert.equal(falhou.status, 502);
  assert.equal((await app.api('GET', '/me', null, z.token)).status, 200, 'conta continua');
  estado.falharCancelamento = false;
  assert.equal((await app.api('DELETE', '/me', null, z.token)).status, 200);
  assert.equal(estado.assinaturas[sub].ativa, false);
  assert.equal((await consulta('SELECT COUNT(*)::int n FROM usuarios WHERE id = $1', [z.id])).rows[0].n, 0);
});

test('Asaas fora do ar: mensagem clara, nada é registrado', async () => {
  const w = await app.entrar('(66) 99999-3005', 'contratante', 'Wagner Teste');
  const link = await criarLinkPagamento(w.id);
  const original = process.env.ASAAS_URL;
  const { config } = await import('../src/config.js');
  config.pagamento.asaas.url = 'http://127.0.0.1:1';
  const r = await app.api('POST', `/ativar/${link}/pix`, { documento: CPF_VALIDO });
  config.pagamento.asaas.url = original;
  assert.equal(r.status, 502);
  assert.equal(r.dados.codigo, 'pagamento_indisponivel');
  assert.equal((await consulta('SELECT COUNT(*)::int n FROM cobrancas WHERE usuario_id = $1', [w.id])).rows[0].n, 0);
});
