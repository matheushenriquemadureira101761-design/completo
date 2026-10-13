import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extrairCodigo, dataCurta, proximosDias } from '../src/lib/util.js';
import { telaDaSituacao } from '../src/servicos/rota.js';

test('acha o código no que a pessoa colou', () => {
  assert.equal(extrairCodigo('482193', 6), '482193');
  assert.equal(extrairCodigo('4821931234', 6), '482193');
  assert.equal(extrairCodigo('482193 é o seu código de acesso da AGROVINC. Por segurança, não compartilhe.', 6), '482193');
  assert.equal(extrairCodigo('AGROVINC: seu código de acesso é 073051. Vale 10 min.', 6), '073051');
  assert.equal(extrairCodigo('4 8 2 1 9 3', 6), '482193');
  assert.equal(extrairCodigo('48a', 6), '48');
  assert.equal(extrairCodigo('', 6), '');
});

test('cada situação abre a tela certa', () => {
  assert.equal(telaDaSituacao({ estado: 'teste' }), '/inicio');
  assert.equal(telaDaSituacao({ estado: 'ativa' }), '/inicio');
  assert.equal(telaDaSituacao({ estado: 'vence_hoje' }), '/inicio');
  assert.equal(telaDaSituacao({ estado: 'atrasada' }), '/inicio');
  assert.equal(telaDaSituacao({ estado: 'teste_terminou' }), '/teste-terminou');
  assert.equal(telaDaSituacao({ estado: 'pausada' }), '/acesso-pausado');
  assert.equal(telaDaSituacao(undefined), '/entrada');
  assert.equal(dataCurta('2026-11-08'), '08/11');
});

test('regras do app são idênticas às do servidor', () => {
  for (const f of ['validacao.js', 'dadosBrasil.js']) {
    assert.equal(fs.readFileSync(`src/lib/${f}`, 'utf8'), fs.readFileSync(`../backend/src/lib/${f}`, 'utf8'), `${f} diferente do servidor`);
  }
});

test('próximos dias para escolher a data (domingo, 04/10/2026)', () => {
  const d = proximosDias(5, new Date(2026, 9, 4));
  assert.deepEqual(d.map((x) => x.dia), ['hoje', 'seg', 'ter', 'qua', 'qui']);
  assert.equal(d[4].data, '2026-10-08');
  assert.equal(d[4].rotulo, 'qui, 08/10');
  const virada = proximosDias(3, new Date(2026, 11, 31));
  assert.deepEqual(virada.map((x) => x.data), ['2026-12-31', '2027-01-01', '2027-01-02']);
});
