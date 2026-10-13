// Protege o ecossistema: bloqueia tentativas de passar contato pra fora da plataforma.
// Função principal: analisar(texto) → { bloqueado: bool, motivo: string }

// Converte números por extenso ("nove", "noventa", "dois") em dígitos.
const EXTENSO = {
  'zero': '0', 'um': '1', 'uma': '1', 'dois': '2', 'duas': '2', 'três': '3', 'tres': '3',
  'quatro': '4', 'cinco': '5', 'seis': '6', 'sete': '7', 'oito': '8', 'nove': '9',
  'dez': '10', 'onze': '11', 'doze': '12', 'treze': '13', 'quatorze': '14', 'catorze': '14',
  'quinze': '15', 'dezesseis': '16', 'dezessete': '17', 'dezoito': '18', 'dezenove': '19',
  'vinte': '20', 'trinta': '30', 'quarenta': '40', 'cinquenta': '50',
  'sessenta': '60', 'setenta': '70', 'oitenta': '80', 'noventa': '90', 'cem': '100',
};

// Normaliza o texto: tira acentos, deixa minúsculo, converte emojis numéricos.
function normalizar(t) {
  if (!t) return '';
  let s = String(t).toLowerCase();
  // Remove acentos.
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Converte dígitos em emojis (1️⃣ 2️⃣ ...) para números normais.
  const emojiNums = { '0️⃣':'0','1️⃣':'1','2️⃣':'2','3️⃣':'3','4️⃣':'4','5️⃣':'5','6️⃣':'6','7️⃣':'7','8️⃣':'8','9️⃣':'9' };
  for (const [e, n] of Object.entries(emojiNums)) s = s.split(e).join(n);
  // Converte números por extenso (apenas isolados, com fronteira de palavra).
  s = s.replace(/\b(zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem)\b/g, (m) => EXTENSO[m] || m);
  return s;
}

// Lista de palavras-chave que indicam intenção de desviar o contato.
const PALAVRAS_SUSPEITAS = [
  // Apps externos
  'whatsapp', 'whats', 'zap', 'telegram', 'telegran', 'signal', 'messenger',
  // Redes sociais
  'instagram', 'insta', 'face', 'facebook', 'tiktok', 'twitter',
  // Pix e pagamentos fora
  'pix', 'chave pix', 'ted', 'doc', 'picpay',
  // Expressões de desvio
  'me chama fora', 'fora do app', 'fora da plataforma', 'me manda mensagem',
  'me adiciona', 'manda dm', 'manda direct', 'me procura no', 'me liga',
  'meu zap', 'meu whats', 'meu numero', 'meu número', 'meu telefone', 'meu cel',
  'manda ai', 'manda ae', 'manda seu', 'passa seu', 'passa o seu',
  'me envie seu', 'teu numero', 'teu zap', 'teu whats',
  // Sites
  'www.', 'http://', 'https://', '.com.br', '.com/', '.net', '.org',
];

// Padrões de telefone (números com 10 ou 11 dígitos, com ou sem separadores).
const PADRAO_TELEFONE_PT_BR = /(?:\+?55\s*)?(?:\(?[1-9][0-9]\)?\s*)?9?\s*\d\s*\d\s*\d\s*\d[\s-]*\d\s*\d\s*\d\s*\d/g;

// E-mail (clássico ou escrito "x arroba y ponto com").
const PADRAO_EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/;
const PADRAO_EMAIL_ESCRITO = /\b[a-z0-9._%+-]+\s*(?:arroba|@)\s*[a-z0-9.-]+\s*(?:ponto|\.)\s*(?:com|br|net|org)/;

// Links e usernames.
const PADRAO_LINK = /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|instagram\.com|facebook\.com|tiktok\.com|fb\.com)/;
const PADRAO_USERNAME = /@[a-z0-9._]{3,}/;

// Sequência de dígitos (com qualquer coisa no meio) — pega "6 6 9 9 9 9" ou "6-6-9-9".
function sequenciaDeDigitos(texto) {
  let apenasDigitos = ''; let contador = 0;
  for (const c of texto) {
    if (/[0-9]/.test(c)) { apenasDigitos += c; contador++; }
    else if (/\s|-|\.|_|\/|\(|\)/.test(c)) { continue; }
    else { apenasDigitos = ''; contador = 0; }
    if (contador >= 8) return true;
  }
  return false;
}

/**
 * Analisa um texto e decide se contém tentativa de desviar contato pra fora da plataforma.
 * @param {string} texto - o que o usuário quer enviar.
 * @returns {{ bloqueado: boolean, motivo: string|null }}
 */
export function analisar(texto) {
  if (!texto || !texto.trim()) return { bloqueado: false, motivo: null };
  const normal = normalizar(texto);

  // 1) Telefone (padrão BR com ou sem separadores)
  if (PADRAO_TELEFONE_PT_BR.test(normal)) return { bloqueado: true, motivo: 'telefone' };
  // 2) Sequência longa de dígitos com separadores
  if (sequenciaDeDigitos(normal)) return { bloqueado: true, motivo: 'telefone' };
  // 3) E-mail
  if (PADRAO_EMAIL.test(normal) || PADRAO_EMAIL_ESCRITO.test(normal)) return { bloqueado: true, motivo: 'email' };
  // 4) Links e usernames
  if (PADRAO_LINK.test(normal)) return { bloqueado: true, motivo: 'link' };
  if (PADRAO_USERNAME.test(normal)) return { bloqueado: true, motivo: 'usuario' };
  // 5) Palavras suspeitas
  for (const palavra of PALAVRAS_SUSPEITAS) {
    if (normal.includes(palavra)) return { bloqueado: true, motivo: 'palavra_suspeita' };
  }
  return { bloqueado: false, motivo: null };
}

export const MENSAGENS_BLOQUEIO = {
  telefone: 'Detectamos um número de telefone. Para a segurança de todos, as negociações acontecem aqui no AGROVINC.',
  email: 'Detectamos um e-mail. As conversas ficam na plataforma pra garantir seus direitos.',
  link: 'Links externos não são permitidos no chat para proteger você e os outros usuários.',
  usuario: 'Compartilhar perfis de redes sociais não é permitido no chat.',
  palavra_suspeita: 'Essa mensagem sugere contato fora da plataforma. As negociações acontecem aqui pra sua segurança.',
};

export function mensagemDeBloqueio(motivo) {
  return MENSAGENS_BLOQUEIO[motivo] || MENSAGENS_BLOQUEIO.palavra_suspeita;
}
