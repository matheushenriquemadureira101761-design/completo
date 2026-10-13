import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCelular, celularE164, formatarCelular, validarEmail, validarDocumento, validaCNPJ, buscarCidades, cidadeExiste, DDDS_VALIDOS } from '../src/lib/validacao.js';
import { fusoDaCidade, agoraLocal, somarDias, diferencaDias, somarMeses, fimDoTeste, novoVencimento, situacaoAcesso, lembreteDoDia } from '../src/lib/datas.js';

test('celular: formato, tamanho, DDDs reais e o 9', () => {
  assert.equal(validarCelular('(66) 99999-9999'), null);
  assert.equal(validarCelular('+55 66 99999-9999'), null);
  assert.match(validarCelular('6699999'), /Faltam 4 dígitos/);
  assert.match(validarCelular('669999999999'), /1 dígito a mais/);
  assert.match(validarCelular('66899999999'), /começar com 9/);
  for (const ddd of [20, 23, 25, 30, 40, 50, 60, 70, 80, 90]) assert.match(validarCelular(`${ddd}999999999`), /não existe/);
  assert.equal(DDDS_VALIDOS.length, 67);
  for (const ddd of DDDS_VALIDOS) assert.equal(validarCelular(`${ddd}999999999`), null);
  assert.equal(celularE164('(66) 99999-9999'), '5566999999999');
  assert.equal(formatarCelular('66999999999'), '(66) 99999-9999');
});

test('e-mail', () => {
  assert.equal(validarEmail('joao@gmail.com.br'), null);
  for (const e of ['joao', 'joao@', 'joao@gmail', '@gmail.com', 'joao@gmail.c']) assert.ok(validarEmail(e));
});

test('CPF e CNPJ (inclui CNPJ com letras)', () => {
  assert.equal(validarDocumento('529.982.247-25').tipo, 'CPF');
  assert.match(validarDocumento('529.982.247-24').erro, /CPF inválido/);
  assert.equal(validarDocumento('11.222.333/0001-81').tipo, 'CNPJ');
  assert.ok(validaCNPJ('12ABC34501DE35'));
  assert.equal(validarDocumento('12.abc.345/01de-35').valor, '12ABC34501DE35');
  assert.ok(!validarDocumento('111.111.111-11').ok);
});

test('cidades: todas, sem acento, com estado, sem misturar nome do estado', () => {
  assert.equal(buscarCidades('nova xav')[0].nome, 'Nova Xavantina');
  assert.equal(buscarCidades('agua boa mt')[0].estadoUf, 'Mato Grosso - MT');
  assert.ok(buscarCidades('agua boa minas').every((c) => c.uf === 'MG'));
  const cg = buscarCidades('campo grande').map((c) => c.nome);
  assert.ok(!cg.includes('Campo Bom') && !cg.includes('Campo Novo'));
  assert.ok(cidadeExiste('Nova Xavantina', 'MT') && !cidadeExiste('Nova Xavantina', 'SP'));
});

test('fuso: Mato Grosso tem 1h a menos que Brasília', () => {
  assert.equal(fusoDaCidade('Nova Xavantina', 'MT'), 'America/Cuiaba');
  assert.equal(fusoDaCidade('São Paulo', 'SP'), 'America/Sao_Paulo');
  assert.equal(fusoDaCidade('Fernando de Noronha', 'PE'), 'America/Noronha');
  const instante = new Date('2026-10-08T03:30:00Z'); // 00:30 em Brasília, 23:30 do dia 07 em Cuiabá
  assert.deepEqual(agoraLocal('America/Sao_Paulo', instante), { data: '2026-10-08', hora: 0 });
  assert.deepEqual(agoraLocal('America/Cuiaba', instante), { data: '2026-10-07', hora: 23 });
});

test('teste grátis: 7 dias contando o do cadastro, pausa no 8º', () => {
  assert.equal(fimDoTeste('2026-10-01'), '2026-10-07');
  assert.equal(fimDoTeste('2026-12-28'), '2027-01-03');
  const s = (d) => situacaoAcesso({ testeFim: '2026-10-07', vencimento: null }, d);
  assert.deepEqual([s('2026-10-01').diasRestantes, s('2026-10-07').diasRestantes], [7, 1]);
  assert.equal(s('2026-10-07').acesso, true);
  assert.equal(s('2026-10-08').estado, 'teste_terminou');
  assert.equal(s('2026-10-08').acesso, false);
});

test('mensal: mesmo dia do pagamento; mês curto usa o último dia e volta ao dia certo', () => {
  assert.deepEqual(novoVencimento({ dataPagamento: '2026-10-08' }), { vencimento: '2026-11-08', diaCobranca: 8 });
  assert.deepEqual(novoVencimento({ dataPagamento: '2026-01-31' }), { vencimento: '2026-02-28', diaCobranca: 31 });
  assert.equal(novoVencimento({ vencimentoAtual: '2026-02-28', diaCobranca: 31, dataPagamento: '2026-02-28' }).vencimento, '2026-03-31');
  assert.equal(somarMeses('2028-01-29', 1, 29), '2028-02-29');
  let v = '2026-01-31'; for (let i = 0; i < 24; i++) { v = somarMeses(v, 1, 31); const [y, m, d] = v.split('-').map(Number); assert.equal(d, Math.min(31, new Date(Date.UTC(y, m, 0)).getUTCDate())); }
  // pagou atrasado: mantém o dia de cobrança
  assert.equal(novoVencimento({ vencimentoAtual: '2026-11-08', diaCobranca: 8, dataPagamento: '2026-11-10' }).vencimento, '2026-12-08');
  // virada de ano
  assert.equal(novoVencimento({ dataPagamento: '2026-12-15' }).vencimento, '2027-01-15');
});

test('situação do assinante: vence, atrasa 2 dias e pausa no 3º', () => {
  const s = (d) => situacaoAcesso({ testeFim: '2026-10-07', vencimento: '2026-11-08' }, d);
  assert.equal(s('2026-11-07').estado, 'ativa');
  assert.equal(s('2026-11-08').estado, 'vence_hoje');
  assert.deepEqual([s('2026-11-09').estado, s('2026-11-10').estado], ['atrasada', 'atrasada']);
  assert.equal(s('2026-11-10').acesso, true);
  assert.deepEqual([s('2026-11-11').estado, s('2026-11-11').acesso], ['pausada', false]);
});

test('lembretes do dia: teste, assinante do site; loja não recebe lembrete de vencimento', () => {
  const t = (d) => lembreteDoDia({ testeFim: '2026-10-07', vencimento: null }, d);
  assert.deepEqual(t('2026-10-05'), ['teste_faltam_2_dias']);
  assert.deepEqual(t('2026-10-07'), ['teste_ultimo_dia']);
  assert.deepEqual(t('2026-10-08'), ['teste_terminou', 'pesquisa_satisfacao']);
  assert.deepEqual(t('2026-10-06'), []);
  const site = (d) => lembreteDoDia({ testeFim: '2026-10-07', vencimento: '2026-11-08', origem: 'site' }, d);
  assert.deepEqual(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].map(site),
    [['lembrete_vencimento'], ['vencimento_hoje'], ['cobranca_atrasada'], ['ultimo_aviso'], ['acesso_pausado'], []]);
  assert.deepEqual(lembreteDoDia({ testeFim: '2026-10-07', vencimento: '2026-11-08', origem: 'loja_google' }, '2026-11-08'), []);
  assert.equal(diferencaDias('2026-10-01', '2026-10-08'), 7);
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
});
