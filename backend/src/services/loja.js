// Assinatura pela loja: o servidor confere cada compra direto com a Google e com a Apple antes de liberar.
// Google: Play Developer API (subscriptionsv2) com conta de serviço. Apple: App Store Server API com chave .p8.
// As notificações das lojas nunca são aceitas como verdade: o servidor sempre consulta a loja de novo.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { consulta } from '../db.js';
import { config } from '../config.js';
import { ErroApp } from '../lib/erros.js';
import { agoraLocal, somarDias, DIAS_DE_TOLERANCIA } from '../lib/datas.js';
import { registrarPagamento } from './assinaturas.js';
import { cancelarCobrancaAutomatica } from './pagamento/index.js';

const env = (k) => process.env[k] || '';
const PRODUTO = () => env('LOJA_PRODUTO_ID') || 'agrovinc_assinatura_mensal';
const PACOTE = () => env('GOOGLE_PLAY_PACOTE') || 'br.com.agrovinc.app';
const BUNDLE = () => env('APPLE_BUNDLE_ID') || 'br.com.agrovinc.app';
const b64url = (x) => Buffer.from(x).toString('base64url');
const lerArquivoOuTexto = (v) => (fs.existsSync(v) ? fs.readFileSync(v, 'utf8') : v);

export const googleConfigurado = () => Boolean(env('GOOGLE_CONTA_SERVICO'));
export const appleConfigurado = () => Boolean(env('APPLE_ISSUER_ID') && env('APPLE_KEY_ID') && env('APPLE_CHAVE_P8'));

const lojaFora = () => new ErroApp(502, 'Não conseguimos falar com a loja agora. Sua compra não se perde: tente de novo em alguns minutos.', 'loja_indisponivel');
const naoConfirmada = () => new ErroApp(400, 'A loja não confirmou esta assinatura. Se você foi cobrado, tente de novo em alguns minutos.', 'compra_nao_confirmada');

async function buscar(url, opcoes = {}) {
  try { return await fetch(url, { ...opcoes, signal: AbortSignal.timeout(20000) }); } catch (e) { console.error(`[Loja] sem conexão com ${url}: ${e.message}`); throw lojaFora(); }
}

// ---------------- Google Play ----------------
let tokenGoogleCache = null;

function contaServico() {
  const c = JSON.parse(lerArquivoOuTexto(env('GOOGLE_CONTA_SERVICO')));
  if (!c.client_email || !c.private_key) throw new Error('GOOGLE_CONTA_SERVICO sem client_email ou private_key');
  return { ...c, token_uri: c.token_uri || 'https://oauth2.googleapis.com/token' };
}

async function tokenGoogle() {
  if (tokenGoogleCache && tokenGoogleCache.expira > Date.now() + 60_000) return tokenGoogleCache.token;
  const c = contaServico();
  const agora = Math.floor(Date.now() / 1000);
  const dados = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: c.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: c.token_uri, iat: agora, exp: agora + 3600,
  }))}`;
  const assinatura = crypto.sign('RSA-SHA256', Buffer.from(dados), c.private_key).toString('base64url');
  const r = await buscar(c.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${dados}.${assinatura}` }).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { console.error(`[Google Play] token recusado: ${r.status} ${JSON.stringify(j).slice(0, 200)}`); throw lojaFora(); }
  tokenGoogleCache = { token: j.access_token, expira: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return j.access_token;
}

/** Situação da assinatura no Google Play. Devolve null se o token não existe. */
export async function consultarGoogle(tokenCompra) {
  const base = env('GOOGLE_PLAY_API_URL') || 'https://androidpublisher.googleapis.com';
  const r = await buscar(`${base}/androidpublisher/v3/applications/${encodeURIComponent(PACOTE())}/purchases/subscriptionsv2/tokens/${encodeURIComponent(tokenCompra)}`, {
    headers: { Authorization: `Bearer ${await tokenGoogle()}` },
  });
  if (r.status === 404 || r.status === 410) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(`[Google Play] consulta recusada: ${r.status} ${JSON.stringify(d).slice(0, 300)}`); if (r.status === 400) return null; throw lojaFora(); }
  const item = (d.lineItems ?? []).find((l) => l.productId === PRODUTO());
  const expira = item?.expiryTime ? new Date(item.expiryTime) : null;
  const estadoOk = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'].includes(d.subscriptionState);
  return {
    valida: Boolean(item && expira && estadoOk && expira > new Date()),
    expira, estado: d.subscriptionState, idTransacao: d.latestOrderId ?? null, idOriginal: tokenCompra, anterior: d.linkedPurchaseToken ?? null,
  };
}

// ---------------- App Store ----------------
function jwtApple() {
  const agora = Math.floor(Date.now() / 1000);
  const dados = `${b64url(JSON.stringify({ alg: 'ES256', kid: env('APPLE_KEY_ID'), typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: env('APPLE_ISSUER_ID'), iat: agora, exp: agora + 1800, aud: 'appstoreconnect-v1', bid: BUNDLE(),
  }))}`;
  const chave = lerArquivoOuTexto(env('APPLE_CHAVE_P8')).replace(/\\n/g, '\n');
  const assinatura = crypto.sign('sha256', Buffer.from(dados), { key: chave, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${dados}.${assinatura}`;
}

/** Lê o conteúdo de um JWS da Apple (a confiança vem de ter sido baixado da própria Apple, com nossa chave). */
export function conteudoJws(jws) {
  const partes = String(jws ?? '').split('.');
  if (partes.length !== 3) return null;
  try { return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')); } catch { return null; }
}

const HOSTS_APPLE = () => ({
  producao: env('APPLE_API_URL_PRODUCAO') || 'https://api.storekit.itunes.apple.com',
  sandbox: env('APPLE_API_URL_SANDBOX') || 'https://api.storekit-sandbox.itunes.apple.com',
});

/** Transação na Apple (tenta produção e teste: compras da revisão da Apple e do TestFlight são de teste). */
export async function consultarApple(transactionId) {
  if (!/^\d{1,30}$/.test(String(transactionId))) return null;
  const ordem = env('APPLE_AMBIENTE') === 'sandbox' ? ['sandbox', 'producao'] : ['producao', 'sandbox'];
  const hosts = HOSTS_APPLE();
  for (const amb of ordem) {
    const r = await buscar(`${hosts[amb]}/inApps/v1/transactions/${transactionId}`, { headers: { Authorization: `Bearer ${jwtApple()}` } });
    if (r.status === 404) continue;
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { console.error(`[App Store] consulta recusada: ${r.status} ${JSON.stringify(d).slice(0, 300)}`); throw lojaFora(); }
    const t = conteudoJws(d.signedTransactionInfo);
    if (!t) return null;
    const expira = t.expiresDate ? new Date(Number(t.expiresDate)) : null;
    return {
      valida: t.productId === PRODUTO() && t.bundleId === BUNDLE() && !t.revocationDate && Boolean(expira) && expira > new Date(),
      expira, revogada: Boolean(t.revocationDate), idTransacao: String(t.transactionId), idOriginal: String(t.originalTransactionId),
    };
  }
  return null;
}

// ---------------- Confirmação e registro ----------------
/** Confere a compra feita no app. Devolve { idExterno, idOriginal, expira }. */
export async function confirmarCompra({ plataforma, tokenCompra }) {
  if (config.modoTeste && String(tokenCompra).startsWith('teste_')) return { idExterno: `${plataforma}:${tokenCompra}`, idOriginal: `${plataforma}:${tokenCompra}`, expira: null };
  if (plataforma === 'android') {
    if (!googleConfigurado()) throw new ErroApp(501, 'A confirmação de compras do Google Play ainda não foi configurada no servidor.', 'loja_nao_configurada');
    const g = await consultarGoogle(tokenCompra);
    if (!g?.valida || !g.idTransacao) throw naoConfirmada();
    return { idExterno: `google:${g.idTransacao}`, idOriginal: g.idOriginal, expira: g.expira, anterior: g.anterior };
  }
  if (!appleConfigurado()) throw new ErroApp(501, 'A confirmação de compras da App Store ainda não foi configurada no servidor.', 'loja_nao_configurada');
  const a = await consultarApple(tokenCompra);
  if (!a?.valida) throw naoConfirmada();
  return { idExterno: `apple:${a.idTransacao}`, idOriginal: a.idOriginal, expira: a.expira };
}

/** Liga a compra à conta, para de cobrar no cartão do site (se houver) e libera o acesso até a data da loja. */
export async function registrarCompra(usuario, plataforma, c) {
  const dono = (await consulta('SELECT usuario_id FROM compras_loja WHERE id_original = $1', [c.idOriginal])).rows[0];
  if (dono && String(dono.usuario_id) !== String(usuario.id)) throw new ErroApp(409, 'Esta assinatura da loja já está ligada a outra conta da AGROVINC.', 'compra_de_outra_conta');
  const venceEm = c.expira ? agoraLocal(usuario.fuso, c.expira).data : undefined;
  await consulta(
    `INSERT INTO compras_loja (id_original, plataforma, usuario_id, produto, vence_em) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id_original) DO UPDATE SET vence_em = COALESCE($5, compras_loja.vence_em), status = 'ativa', atualizado_em = NOW()`,
    [c.idOriginal, plataforma, usuario.id, PRODUTO(), venceEm ?? null]);
  await cancelarCobrancaAutomatica(usuario.id).catch((e) => console.error(`[Loja] não cancelou o cartão do site do usuário ${usuario.id}: ${e.message}`));
  const r = await registrarPagamento({ usuarioId: usuario.id, origem: plataforma === 'ios' ? 'loja_apple' : 'loja_google', metodo: 'loja', idExterno: c.idExterno, venceEmLoja: venceEm });
  await consulta('UPDATE assinaturas SET id_externo = $2 WHERE usuario_id = $1', [usuario.id, c.idOriginal]);
  return r;
}

async function usuarioDaCompra(...ids) {
  for (const id of ids.filter(Boolean)) {
    const u = (await consulta('SELECT u.* FROM compras_loja c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id_original = $1', [id])).rows[0];
    if (u) return u;
  }
  return null;
}

async function marcarCancelada(usuarioId, origem, cancelada) {
  await consulta(`UPDATE assinaturas SET cancelada_em = ${cancelada ? 'NOW()' : 'NULL'}, atualizado_em = NOW() WHERE usuario_id = $1 AND origem = $2`, [usuarioId, origem]);
}

/** Reembolso ou revogação: o acesso pausa já. */
async function cortarAcesso(usuario, origem) {
  const hoje = agoraLocal(usuario.fuso).data;
  await consulta(`UPDATE assinaturas SET vencimento = $3, cancelada_em = NOW(), atualizado_em = NOW() WHERE usuario_id = $1 AND origem = $2`,
    [usuario.id, origem, somarDias(hoje, -DIAS_DE_TOLERANCIA)]);
}

/** Google Play: Real-time developer notifications (Pub/Sub, entrega por push). */
export async function notificacaoGoogle(corpo) {
  let d;
  try { d = JSON.parse(Buffer.from(String(corpo?.message?.data ?? ''), 'base64').toString('utf8')); } catch { return { ignorado: 'formato' }; }
  if (d.testNotification) return { ok: true, teste: true };
  const sn = d.subscriptionNotification;
  if (!sn?.purchaseToken || !googleConfigurado()) return { ignorado: 'sem_assinatura' };
  const g = await consultarGoogle(sn.purchaseToken);
  if (!g) return { ignorado: 'token_desconhecido' };
  const u = await usuarioDaCompra(sn.purchaseToken, g.anterior);
  if (!u) return { ignorado: 'compra_ainda_nao_ligada' };
  const tipo = Number(sn.notificationType);
  // 1 recuperada, 2 renovada, 4 comprada, 7 reiniciada: registra o novo período
  if ([1, 2, 4, 7].includes(tipo) && g.valida && g.idTransacao) {
    await registrarCompra(u, 'android', { idExterno: `google:${g.idTransacao}`, idOriginal: sn.purchaseToken, expira: g.expira });
    return { ok: true, acao: 'renovou' };
  }
  if (tipo === 3) { await marcarCancelada(u.id, 'loja_google', true); return { ok: true, acao: 'cancelou' }; }
  if (tipo === 12) { await cortarAcesso(u, 'loja_google'); return { ok: true, acao: 'revogou' }; }
  return { ok: true, acao: 'nenhuma', tipo };
}

/** App Store: Server Notifications V2. */
export async function notificacaoApple(corpo) {
  const n = conteudoJws(corpo?.signedPayload);
  if (!n) return { ignorado: 'formato' };
  if (n.notificationType === 'TEST') return { ok: true, teste: true };
  const t = conteudoJws(n.data?.signedTransactionInfo);
  if (!t?.transactionId || !appleConfigurado()) return { ignorado: 'sem_transacao' };
  const a = await consultarApple(t.transactionId);
  if (!a) return { ignorado: 'transacao_desconhecida' };
  const u = await usuarioDaCompra(a.idOriginal);
  if (!u) return { ignorado: 'compra_ainda_nao_ligada' };
  const tipo = n.notificationType;
  if (['SUBSCRIBED', 'DID_RENEW'].includes(tipo) && a.valida) {
    await registrarCompra(u, 'ios', { idExterno: `apple:${a.idTransacao}`, idOriginal: a.idOriginal, expira: a.expira });
    return { ok: true, acao: 'renovou' };
  }
  if (tipo === 'DID_CHANGE_RENEWAL_STATUS') {
    await marcarCancelada(u.id, 'loja_apple', n.subtype === 'AUTO_RENEW_DISABLED');
    return { ok: true, acao: n.subtype === 'AUTO_RENEW_DISABLED' ? 'cancelou' : 'reativou' };
  }
  if (['REFUND', 'REVOKE'].includes(tipo) || a.revogada) { await cortarAcesso(u, 'loja_apple'); return { ok: true, acao: 'revogou' }; }
  return { ok: true, acao: 'nenhuma', tipo };
}
