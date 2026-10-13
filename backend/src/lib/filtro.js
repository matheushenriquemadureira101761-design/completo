// Filtro de palavras ofensivas para título e descrição dos anúncios.
// A lista é curta de propósito (palavrões e ofensas comuns); a equipe pode ampliar aqui.
import { normalizarTexto } from './validacao.js';

const PROIBIDAS = [
  'porra', 'caralho', 'merda', 'puta', 'putaria', 'puto', 'foda', 'fodase', 'foder', 'fdp', 'arrombado', 'arrombada',
  'cuzao', 'buceta', 'viado', 'vagabundo', 'vagabunda', 'desgracado', 'desgracada', 'otario', 'otaria', 'babaca', 'piranha',
];

/** Devolve true se o texto tem alguma palavra proibida (inteira, sem acento, sem diferença de maiúscula). */
export function temPalavraProibida(texto) {
  const palavras = new Set(normalizarTexto(texto).split(' '));
  return PROIBIDAS.some((p) => palavras.has(p));
}
