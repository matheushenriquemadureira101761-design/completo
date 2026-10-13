// Apoio dos testes novos: sobe o app, faz chamadas e cria contas pelo fluxo real (código de acesso).
import http from 'node:http';
import assert from 'node:assert/strict';

export function prepararAmbiente(extra = {}) {
  Object.assign(process.env, {
    MODO_TESTE: 'true', CODIGO_ESPERA_SEG: '0', CODIGO_MAX_HORA_NUMERO: '50', AUTH_LIMITE_MINUTO_IP: '1000', CODIGO_MAX_HORA_IP: '1000',
    WHATSAPP_TOKEN: '', WHATSAPP_APP_SECRET: 'segredo-teste', ADMIN_TOKEN: 'chave-da-equipe-com-mais-de-20-caracteres',
  }, extra);
}

export async function subirApp() {
  const { criarApp } = await import('../src/app.js');
  const { migrar } = await import('../src/migrar.js');
  const { consulta } = await import('../src/db.js');
  const log = console.log;
  console.log = () => {};
  await migrar();
  console.log = log;
  await consulta('TRUNCATE usuarios, codigos_acesso, verificacoes, testes_usados RESTART IDENTITY CASCADE');
  const servidor = criarApp().listen(0);
  const base = `http://127.0.0.1:${servidor.address().port}`;
  async function api(metodo, caminho, corpo, token, cabecalhos = {}) {
    const r = await fetch(base + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...cabecalhos },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await r.text();
    let dados; try { dados = JSON.parse(texto); } catch { dados = texto; }
    return { status: r.status, dados, cabecalhos: r.headers };
  }
  async function entrar(numero, perfil = 'contratante', nome = 'João Pereira') {
    const c = await api('POST', '/auth/codigo', { whatsapp: numero, canal: 'whatsapp' });
    assert.equal(c.status, 200, JSON.stringify(c.dados));
    const v = await api('POST', '/auth/verificar', { whatsapp: numero, codigo: c.dados._codigoTeste });
    assert.equal(v.status, 200, JSON.stringify(v.dados));
    const f = await api('POST', '/auth/concluir', { passe: v.dados.passe, perfil, nome, cidade: 'Nova Xavantina', uf: 'MT', aceiteTermos: true, plataforma: 'android' });
    assert.equal(f.status, 200, JSON.stringify(f.dados));
    const me = await api('GET', '/me', null, f.dados.token);
    assert.equal(me.status, 200, JSON.stringify(me.dados));
    return { token: f.dados.token, id: Number(me.dados.usuario.id) };
  }
  return { servidor, base, api, entrar };
}

/** Servidor falso de uma empresa externa. `rotas(req, corpo)` devolve { status, json } ou null (404). */
export async function servidorFalso(rotas) {
  const chamadas = [];
  const s = http.createServer(async (req, res) => {
    let bruto = '';
    for await (const parte of req) bruto += parte;
    const tipo = String(req.headers['content-type'] ?? '');
    let corpo = bruto;
    try { corpo = tipo.includes('json') ? JSON.parse(bruto || '{}') : tipo.includes('urlencoded') ? Object.fromEntries(new URLSearchParams(bruto)) : bruto; } catch { /* corpo bruto */ }
    chamadas.push({ metodo: req.method, url: req.url, cabecalhos: req.headers, corpo });
    const r = (await rotas(req, corpo)) ?? { status: 404, json: { errors: [{ description: 'não encontrado' }] } };
    res.writeHead(r.status ?? 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(r.json ?? {}));
  }).listen(0);
  await new Promise((ok) => s.once('listening', ok));
  return { url: `http://127.0.0.1:${s.address().port}`, chamadas, fechar: () => new Promise((ok) => { s.close(ok); s.closeAllConnections(); }) };
}

export const CPF_VALIDO = '529.982.247-25';
export const ANUNCIO = { categoria: 'maquinas', titulo: 'Trator 110 cv com operador', descricao: 'Revisado', precoCentavos: 25000, unidade: 'hora', caracteristicas: ['Com operador'], cidade: 'Nova Xavantina', uf: 'MT', raioKm: 100 };
