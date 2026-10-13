// Regras de validação compartilhadas entre o servidor e o app.
// Este arquivo é copiado igual para app/src/lib/validacao.js — mantenha os dois iguais.
import { ESTADOS, DDDS_VALIDOS, CIDADES_RAW } from './dadosBrasil.js';

// ---------------- Celular / WhatsApp ----------------
export function soDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

/** Aceita "(66) 99999-9999", "66999999999" ou "+55 66 99999-9999" e devolve só DDD + número. */
export function normalizarCelular(v) {
  let d = soDigitos(v);
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
  return d;
}

/** Devolve null quando está certo, ou a mensagem de erro para mostrar à pessoa. */
export function validarCelular(v) {
  const d = normalizarCelular(v);
  if (d.length === 0) return 'Digite o número do seu celular (WhatsApp).';
  if (d.length < 11) {
    const f = 11 - d.length;
    return `Faltam ${f} dígito${f > 1 ? 's' : ''}. O número precisa ter DDD + 9 dígitos (11 no total).`;
  }
  if (d.length > 11) {
    const s = d.length - 11;
    return `Esse número tem ${s} dígito${s > 1 ? 's' : ''} a mais. Confira e tente de novo.`;
  }
  const ddd = Number(d.slice(0, 2));
  if (!DDDS_VALIDOS.includes(ddd)) return `O DDD ${d.slice(0, 2)} não existe no Brasil. Confira o DDD da sua cidade.`;
  if (d[2] !== '9') return 'Depois do DDD, o número de celular/WhatsApp precisa começar com 9.';
  return null;
}

/** Formato internacional usado pela API do WhatsApp: 5566999999999 (sem +). */
export function celularE164(v) {
  return '55' + normalizarCelular(v);
}

export function formatarCelular(v) {
  const d = normalizarCelular(v);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const base = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  return d.length > 11 ? `${base} ${d.slice(11)}` : base;
}

// ---------------- E-mail ----------------
export function validarEmail(v) {
  const e = String(v ?? '').trim();
  if (!e) return 'Digite o seu e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'E-mail incompleto. Confira se tem o @ e o final (ex: .com ou .com.br).';
  return null;
}

// ---------------- CPF / CNPJ (inclui CNPJ alfanumérico) ----------------
export function validaCPF(c) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(c[i]) * (10 - i);
  let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += Number(c[i]) * (11 - i);
  let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

export function validaCNPJ(c) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const v = (ch) => ch.charCodeAt(0) - 48;
  const dv = (len) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < len; i++) s += v(c[i]) * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

export function normalizarDocumento(v) {
  return String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
}

export function validarDocumento(v) {
  const r = normalizarDocumento(v);
  if (r.length === 0) return { ok: false, erro: 'Digite o CPF ou CNPJ.' };
  const soNumeros = /^\d+$/.test(r);
  if (soNumeros && r.length < 11) { const f = 11 - r.length; return { ok: false, erro: `Faltam ${f} número${f > 1 ? 's' : ''}. O CPF tem 11 números e o CNPJ tem 14.` }; }
  if (soNumeros && r.length === 11) return validaCPF(r) ? { ok: true, tipo: 'CPF', valor: r } : { ok: false, erro: 'CPF inválido. Confira os números. Se for CNPJ, continue digitando.' };
  if (r.length < 14) { const f = 14 - r.length; return { ok: false, erro: `Faltam ${f} caractere${f > 1 ? 's' : ''} do CNPJ.` }; }
  return validaCNPJ(r) ? { ok: true, tipo: 'CNPJ', valor: r } : { ok: false, erro: 'CNPJ inválido. Confira o que foi digitado.' };
}

// ---------------- Cidades (5.571 do IBGE) ----------------
export function normalizarTexto(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

let _cidades = null;
export function listaCidades() {
  if (_cidades) return _cidades;
  _cidades = CIDADES_RAW.split(';').map((s) => {
    const [nome, uf, cap] = s.split('|');
    const estado = ESTADOS[uf];
    const nomeNorm = normalizarTexto(nome);
    const nomeTokens = nomeNorm.split(' ');
    return {
      nome, uf, estado, estadoUf: `${estado} - ${uf}`, capital: cap === '1',
      nomeNorm, estadoNorm: normalizarTexto(estado), ufNorm: uf.toLowerCase(),
      nomeTokens, estadoTokens: normalizarTexto(estado).split(' '), nomeCompacto: nomeTokens.join(''),
    };
  });
  return _cidades;
}

function casaEstado(c, st) {
  if (st.length === 0) return true;
  if (st.length === 1 && st[0] === c.ufNorm) return true;
  if (st.length > c.estadoTokens.length) return false;
  for (let i = 0; i < st.length; i++) {
    const ultimo = i === st.length - 1;
    if (ultimo ? !c.estadoTokens[i].startsWith(st[i]) : c.estadoTokens[i] !== st[i]) return false;
  }
  return true;
}

function casaNomeEEstado(c, qt) {
  for (let i = qt.length; i >= 1; i--) {
    const nomeOk = qt.slice(0, i).every((t) => c.nomeTokens.some((w) => w.startsWith(t)));
    if (nomeOk && casaEstado(c, qt.slice(i))) return true;
  }
  return false;
}

export function buscarCidades(q, limite = 6) {
  const qn = normalizarTexto(q);
  if (qn.length < 2) return [];
  const qc = qn.replace(/ /g, '');
  const qt = qn.split(' ');
  const achados = [];
  for (const c of listaCidades()) {
    let rank = -1;
    const exatos = [c.nomeNorm, `${c.nomeNorm} ${c.ufNorm}`, `${c.nomeNorm} ${c.estadoNorm}`, `${c.nomeNorm} ${c.estadoNorm} ${c.ufNorm}`];
    if (exatos.includes(qn)) rank = 0;
    else if (c.nomeNorm.startsWith(qn)) rank = 1;
    else if (casaNomeEEstado(c, qt)) rank = c.nomeTokens[0].startsWith(qt[0]) ? 2 : 3;
    else if (c.nomeCompacto.includes(qc)) rank = 4;
    if (rank >= 0) achados.push({ c, rank });
  }
  achados.sort((a, b) => (a.rank - b.rank) || ((b.c.capital ? 1 : 0) - (a.c.capital ? 1 : 0))
    || (a.c.nome.length - b.c.nome.length) || (a.c.nome + a.c.estado).localeCompare(b.c.nome + b.c.estado, 'pt-BR'));
  return achados.slice(0, limite).map(({ c }) => ({ nome: c.nome, uf: c.uf, estado: c.estado, estadoUf: c.estadoUf }));
}

/** Confere se a combinação cidade + UF existe de verdade. */
export function cidadeExiste(nome, uf) {
  return listaCidades().some((c) => c.nome === nome && c.uf === uf);
}

export { ESTADOS, DDDS_VALIDOS };
