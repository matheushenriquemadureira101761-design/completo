// Funções puras (sem React), testadas em test/logica.test.mjs
/** 'AAAA-MM-DD' → 'DD/MM' */
export const dataCurta = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

/** Acha o código dentro do que foi colado: "Seu código é 482193. Vale 10 min" → "482193". */
export function extrairCodigo(texto, digitos) {
  const t = String(texto ?? '').trim();
  if (/^\d*$/.test(t)) return t.slice(0, digitos);
  const m = t.match(new RegExp(`(^|\\D)(\\d{${digitos}})(?!\\d)`));
  return m ? m[2] : t.replace(/\D/g, '').slice(0, digitos);
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** Próximos dias (para escolher data): [{ data: 'AAAA-MM-DD', dia: 'qui', numero: '08', rotulo: 'qui, 08/10' }] */
export function proximosDias(n = 14, inicio = new Date()) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const numero = String(d.getDate()).padStart(2, '0');
    out.push({ data, dia: i === 0 ? 'hoje' : DIAS[d.getDay()], numero, rotulo: `${DIAS[d.getDay()]}, ${numero}/${String(d.getMonth() + 1).padStart(2, '0')}` });
  }
  return out;
}
