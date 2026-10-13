// Regras de datas da assinatura. Datas de calendário são sempre strings 'AAAA-MM-DD'
// (sem hora), calculadas no fuso horário da pessoa, para não errar a virada do dia.

/** Fuso horário de cada estado. MT, MS, RO, RR e AM têm 1h a menos que Brasília; AC tem 2h a menos. */
const FUSO_POR_UF = {
  AC: 'America/Rio_Branco', AM: 'America/Manaus', RR: 'America/Boa_Vista', RO: 'America/Porto_Velho',
  MT: 'America/Cuiaba', MS: 'America/Campo_Grande',
};

export function fusoDaCidade(nome, uf) {
  if (uf === 'PE' && nome === 'Fernando de Noronha') return 'America/Noronha';
  return FUSO_POR_UF[uf] || 'America/Sao_Paulo';
}

/** Data e hora locais (no fuso indicado) de um instante. */
export function agoraLocal(fuso, instante = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) };
}

const partes = (d) => d.split('-').map(Number);
const montar = (y, m, d) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const ultimoDiaDoMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

export function somarDias(data, n) {
  const [y, m, d] = partes(data);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return montar(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Quantos dias de `a` até `b` (b - a). */
export function diferencaDias(a, b) {
  const [y1, m1, d1] = partes(a);
  const [y2, m2, d2] = partes(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/**
 * Soma meses mantendo o dia de cobrança (diaAncora). Em mês que não tem esse dia
 * (ex.: 31 em abril), usa o último dia do mês — e volta ao dia 31 no mês seguinte.
 */
export function somarMeses(data, n, diaAncora) {
  const [y, m] = partes(data);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dia = diaAncora ?? partes(data)[2];
  return montar(ny, nm, Math.min(dia, ultimoDiaDoMes(ny, nm)));
}

// ---------------- Teste grátis ----------------
export const DIAS_DE_TESTE = 7;

/** O dia do cadastro conta como 1º dia: usa até o 7º, e o acesso pausa no 8º. */
export function fimDoTeste(dataCadastro) {
  return somarDias(dataCadastro, DIAS_DE_TESTE - 1);
}

// ---------------- Assinatura mensal ----------------
/**
 * Depois de um pagamento, calcula o novo vencimento.
 * - 1º pagamento (sem vencimento ainda): vence 1 mês depois da data do pagamento; o dia vira o dia de cobrança.
 * - Renovação: vence 1 mês depois do vencimento anterior, mantendo o dia de cobrança
 *   (quem paga atrasado não "ganha" dias nem muda o dia de cobrança).
 */
export function novoVencimento({ vencimentoAtual, diaCobranca, dataPagamento }) {
  if (!vencimentoAtual) {
    const dia = partes(dataPagamento)[2];
    return { vencimento: somarMeses(dataPagamento, 1, dia), diaCobranca: dia };
  }
  // Se pagou adiantado mais de um ciclo ou muito atrasado, avança até o vencimento ficar no futuro.
  let v = somarMeses(vencimentoAtual, 1, diaCobranca);
  while (diferencaDias(dataPagamento, v) <= 0) v = somarMeses(v, 1, diaCobranca);
  return { vencimento: v, diaCobranca };
}

export const DIAS_DE_TOLERANCIA = 3; // pausa no 3º dia depois do vencimento

/**
 * Situação de acesso da pessoa num dia (data local).
 * estados: teste | teste_terminou | ativa | vence_hoje | atrasada | pausada
 */
export function situacaoAcesso({ testeFim, vencimento }, hoje) {
  if (!vencimento) {
    const restam = diferencaDias(hoje, testeFim) + 1;
    if (restam >= 1) return { estado: 'teste', acesso: true, diasRestantes: restam, ate: testeFim };
    return { estado: 'teste_terminou', acesso: false, desde: somarDias(testeFim, 1) };
  }
  const atraso = diferencaDias(vencimento, hoje);
  if (atraso < 0) return { estado: 'ativa', acesso: true, vencimento };
  if (atraso === 0) return { estado: 'vence_hoje', acesso: true, vencimento };
  if (atraso < DIAS_DE_TOLERANCIA) return { estado: 'atrasada', acesso: true, vencimento, diasDeAtraso: atraso, pausaEm: somarDias(vencimento, DIAS_DE_TOLERANCIA) };
  return { estado: 'pausada', acesso: false, vencimento, diasDeAtraso: atraso };
}

/**
 * Qual lembrete (se algum) deve sair hoje, às 9h locais.
 * Quem assina pela loja não recebe lembrete de vencimento: a loja renova sozinha.
 */
export function lembreteDoDia({ testeFim, vencimento, origem }, hoje) {
  if (!vencimento) {
    const d = diferencaDias(hoje, testeFim);
    if (d === 2) return ['teste_faltam_2_dias'];
    if (d === 0) return ['teste_ultimo_dia'];
    if (d === -1) return ['teste_terminou', 'pesquisa_satisfacao'];
    return [];
  }
  if (origem !== 'site') return [];
  const atraso = diferencaDias(vencimento, hoje);
  return ({ '-1': ['lembrete_vencimento'], 0: ['vencimento_hoje'], 1: ['cobranca_atrasada'], 2: ['ultimo_aviso'], 3: ['acesso_pausado'] })[atraso] || [];
}

export function formatarDataBR(data, comAno = true) {
  const [y, m, d] = partes(data);
  return comAno ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` : `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
