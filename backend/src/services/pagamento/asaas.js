// Asaas (https://docs.asaas.com): Pix avulso para quem paga mês a mês e assinatura no cartão.
// O cartão é digitado na página segura do próprio Asaas: o número nunca passa pelo nosso servidor.
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { ErroApp } from '../../lib/erros.js';

const cfg = () => config.pagamento.asaas;
const indisponivel = () => new ErroApp(502, 'Não conseguimos falar com a empresa de pagamento agora. Tente de novo em alguns minutos.', 'pagamento_indisponivel');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamar(metodo, caminho, corpo) {
  let r;
  try {
    r = await fetch(cfg().url + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'agrovinc', access_token: cfg().chave },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    console.error(`[Asaas] ${metodo} ${caminho}: sem conexão (${e.message})`);
    throw indisponivel();
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const desc = (dados?.errors ?? []).map((e) => e.description).filter(Boolean).join(' | ') || `HTTP ${r.status}`;
    console.error(`[Asaas] ${metodo} ${caminho}: ${desc}`);
    if (r.status === 404) { const e = new ErroApp(404, 'Cobrança não encontrada na empresa de pagamento.', 'cobranca_inexistente'); e.naoEncontrado = true; throw e; }
    if (r.status === 400 && /cpf|cnpj/i.test(desc)) throw new ErroApp(400, 'A empresa de pagamento não aceitou este CPF ou CNPJ. Confira os números.', 'documento');
    throw indisponivel();
  }
  return dados;
}

export const nome = 'asaas';

export async function criarCliente({ nome: nomePessoa, documento, celular, referencia }) {
  const c = await chamar('POST', '/customers', { name: nomePessoa, cpfCnpj: documento, mobilePhone: celular, externalReference: referencia, notificationDisabled: true });
  return c.id;
}

export async function atualizarDocumento(clienteId, documento) {
  await chamar('POST', `/customers/${encodeURIComponent(clienteId)}`, { cpfCnpj: documento });
}

/** Pix de um mês. Devolve o código copia e cola e o QR Code (PNG em base64). */
export async function criarPix({ clienteId, valorCentavos, vencimento, descricao, referencia }) {
  const p = await chamar('POST', '/payments', { customer: clienteId, billingType: 'PIX', value: valorCentavos / 100, dueDate: vencimento, description: descricao, externalReference: referencia });
  const qr = await chamar('GET', `/payments/${encodeURIComponent(p.id)}/pixQrCode`);
  return { idExterno: p.id, copiaECola: qr.payload, qrCodePng: qr.encodedImage ?? null, expiraEm: qr.expirationDate ?? null };
}

/** Assinatura mensal no cartão. Devolve o endereço da página segura onde a pessoa digita o cartão. */
export async function criarAssinaturaCartao({ clienteId, valorCentavos, primeiroVencimento, descricao, referencia }) {
  const s = await chamar('POST', '/subscriptions', { customer: clienteId, billingType: 'CREDIT_CARD', value: valorCentavos / 100, nextDueDate: primeiroVencimento, cycle: 'MONTHLY', description: descricao, externalReference: referencia });
  for (let i = 0; i < 4; i++) {
    const lista = await chamar('GET', `/subscriptions/${encodeURIComponent(s.id)}/payments`);
    const primeira = (lista.data ?? []).find((x) => x.invoiceUrl);
    if (primeira) return { idExterno: s.id, url: primeira.invoiceUrl };
    await espera(1500);
  }
  console.error(`[Asaas] assinatura ${s.id} criada sem fatura disponível`);
  throw indisponivel();
}

export async function cancelarAssinatura(idExterno) {
  try { await chamar('DELETE', `/subscriptions/${encodeURIComponent(idExterno)}`); } catch (e) { if (!e.naoEncontrado) throw e; }
}

/** Confere o token do webhook (cabeçalho asaas-access-token) e traduz o evento. Devolve null se o token não bater. */
export function lerWebhook(cabecalhos, corpo) {
  const certo = cfg().tokenWebhook;
  const veio = String(cabecalhos['asaas-access-token'] ?? '');
  if (!certo || veio.length !== certo.length || !crypto.timingSafeEqual(Buffer.from(veio), Buffer.from(certo))) return null;
  const p = corpo?.payment;
  if (!p?.id) return { tipo: 'ignorar', evento: corpo?.event };
  const base = {
    idPagamento: p.id, clienteId: p.customer ?? null, assinaturaId: p.subscription ?? null,
    metodo: p.billingType === 'PIX' ? 'pix' : 'cartao', finalCartao: p.creditCard?.creditCardNumber ?? null,
    valorCentavos: typeof p.value === 'number' ? Math.round(p.value * 100) : null,
  };
  if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(corpo.event)) return { tipo: 'pago', ...base };
  if (['PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS'].includes(corpo.event)) return { tipo: 'recusado', ...base };
  return { tipo: 'ignorar', evento: corpo.event };
}
