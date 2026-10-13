// Empresa de pagamento simulada: usada só em MODO_TESTE, sem chave de empresa configurada.
import crypto from 'node:crypto';

export const nome = 'simulado';
const id = (p) => `${p}_${crypto.randomBytes(8).toString('hex')}`;

export async function criarCliente() { return id('cli'); }
export async function atualizarDocumento() {}
export async function criarPix() {
  return { idExterno: id('pix'), copiaECola: `00020126580014BR.GOV.BCB.PIX0136simulacao-agrovinc-${Date.now()}5204000053039865406029.905802BR`, qrCodePng: null, expiraEm: null };
}
export async function criarAssinaturaCartao() { return { idExterno: id('sub'), url: null }; }
export async function cancelarAssinatura() {}
export function lerWebhook() { return null; }
