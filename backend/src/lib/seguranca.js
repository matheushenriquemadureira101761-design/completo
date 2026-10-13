import crypto from 'node:crypto';
import { config } from '../config.js';

/** Código numérico aleatório (ex.: 6 dígitos), gerado com fonte criptográfica. */
export function gerarCodigo(digitos = config.codigo.digitos) {
  return String(crypto.randomInt(0, 10 ** digitos)).padStart(digitos, '0');
}

/** Token longo e aleatório para sessões e links (256 bits). */
export function gerarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/** Resumo para guardar tokens no banco (quem ler o banco não consegue usar o token). */
export function resumo(texto) {
  return crypto.createHmac('sha256', config.segredoServidor).update(String(texto)).digest('hex');
}

/** Senhas e códigos: scrypt com sal. Formato: scrypt$sal$hash */
export function embaralhar(segredo) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(segredo), sal, 32).toString('hex');
  return `scrypt$${sal}$${hash}`;
}

export function conferir(segredo, guardado) {
  if (!guardado || !guardado.startsWith('scrypt$')) return false;
  const [, sal, hash] = guardado.split('$');
  const teste = crypto.scryptSync(String(segredo), sal, 32);
  const certo = Buffer.from(hash, 'hex');
  return certo.length === teste.length && crypto.timingSafeEqual(certo, teste);
}

/** Confere a assinatura X-Hub-Signature-256 enviada pela Meta nos webhooks. */
export function assinaturaMetaValida(corpoBruto, cabecalho, segredoApp) {
  if (!segredoApp) return config.modoTeste; // sem segredo configurado, só aceita em modo de teste
  if (!cabecalho || !cabecalho.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', segredoApp).update(corpoBruto).digest('hex');
  const a = Buffer.from(cabecalho.slice(7), 'hex');
  const b = Buffer.from(esperado, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
