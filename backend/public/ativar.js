(function () {
  'use strict';
  var token = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  var base = '/ativar/' + encodeURIComponent(token);
  var $ = function (id) { return document.getElementById(id); };
  var metodo = 'pix';
  var cobranca = null;
  var espera = null;
  var dados = null;

  function mostrar(id) {
    ['carregando', 'erro', 'formulario', 'pix', 'cartaoTeste', 'sucesso'].forEach(function (s) { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  function falha(texto) { $('erroTexto').textContent = texto; mostrar('erro'); }

  function pedir(caminho, corpo) {
    return fetch(base + caminho, {
      method: corpo ? 'POST' : 'GET',
      headers: corpo ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.erro || 'Algo deu errado. Tente de novo.'); e.status = r.status; throw e; }
        return j;
      });
    }, function () { throw new Error('Sem conexão. Confira a internet e tente de novo.'); });
  }

  // ---------- CPF / CNPJ (mesmas regras do servidor, inclui CNPJ com letras) ----------
  function normalizar(v) { return String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14); }
  function validaCPF(c) {
    if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
    var s = 0, i, d1, d2;
    for (i = 0; i < 9; i++) s += Number(c[i]) * (10 - i);
    d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
    if (d1 !== Number(c[9])) return false;
    s = 0;
    for (i = 0; i < 10; i++) s += Number(c[i]) * (11 - i);
    d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
    return d2 === Number(c[10]);
  }
  function validaCNPJ(c) {
    if (!/^[0-9A-Z]{12}\d{2}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
    function dv(len) {
      var w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var s = 0;
      for (var i = 0; i < len; i++) s += (c.charCodeAt(i) - 48) * w[i];
      var r = s % 11;
      return r < 2 ? 0 : 11 - r;
    }
    return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
  }
  function checar(r) {
    if (!r.length) return { ok: false, erro: '' };
    var soNumeros = /^\d+$/.test(r);
    if (soNumeros && r.length < 11) { var f = 11 - r.length; return { ok: false, erro: 'Faltam ' + f + ' número' + (f > 1 ? 's' : '') + '. O CPF tem 11 números e o CNPJ tem 14.' }; }
    if (soNumeros && r.length === 11) return validaCPF(r) ? { ok: true, tipo: 'CPF' } : { ok: false, erro: 'CPF inválido. Confira os números. Se for CNPJ, continue digitando.' };
    if (r.length < 14) { var g = 14 - r.length; return { ok: false, erro: 'Faltam ' + g + ' caractere' + (g > 1 ? 's' : '') + ' do CNPJ.' }; }
    return validaCNPJ(r) ? { ok: true, tipo: 'CNPJ' } : { ok: false, erro: 'CNPJ inválido. Confira o que foi digitado.' };
  }
  function formatar(r) {
    if (r.length <= 11 && /^\d*$/.test(r)) {
      return r.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
    }
    return r.replace(/^(\w{2})(\w)/, '$1.$2').replace(/^(\w{2})\.(\w{3})(\w)/, '$1.$2.$3').replace(/\.(\w{3})(\w)/, '.$1/$2').replace(/\/(\w{4})(\d)/, '/$1-$2');
  }

  var docValido = false;
  function atualizarDoc() {
    var campo = $('documento');
    var r = normalizar(campo.value);
    campo.value = formatar(r);
    var c = checar(r);
    docValido = c.ok;
    campo.className = c.ok ? 'ok' : (c.erro && r.length >= 11 ? 'erro' : '');
    $('docAviso').className = 'aviso ' + (c.ok ? 'ok' : 'erro');
    $('docAviso').textContent = c.ok ? c.tipo + ' válido' : (r.length >= 11 ? c.erro : '');
    $('continuar').disabled = !docValido;
  }

  function escolher(m) {
    metodo = m;
    Array.prototype.forEach.call(document.querySelectorAll('[data-metodo]'), function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-metodo') === m)); });
    $('explica').textContent = m === 'pix'
      ? 'Você paga este mês com Pix. Antes do próximo vencimento, mandamos um novo link no WhatsApp.'
      : 'Cobrança automática todo mês no cartão. Você digita o cartão na página segura da empresa de pagamento: a AGROVINC não vê nem guarda o número.';
    $('continuar').textContent = m === 'pix' ? 'Gerar Pix' : 'Continuar para o cartão';
  }

  function acompanhar() {
    clearInterval(espera);
    var inicio = Date.now();
    espera = setInterval(function () {
      if (Date.now() - inicio > 60 * 60 * 1000) { clearInterval(espera); $('esperandoTexto').textContent = 'Ainda não recebemos o pagamento. Se já pagou, aguarde alguns minutos: o recibo chega no WhatsApp.'; return; }
      pedir('/cobranca/' + encodeURIComponent(cobranca)).then(function (r) {
        if (r.status === 'paga') { clearInterval(espera); mostrar('sucesso'); }
      }, function () {});
    }, 5000);
  }

  function continuar() {
    if (!docValido) return;
    var botao = $('continuar');
    botao.disabled = true;
    botao.textContent = 'Aguarde…';
    $('falhaEnvio').hidden = true;
    pedir('/' + metodo, { documento: normalizar($('documento').value) }).then(function (r) {
      cobranca = r.cobranca;
      if (metodo === 'pix') {
        $('copiaCola').value = r.copiaECola;
        $('qrCaixa').hidden = !r.qrCodePng;
        if (r.qrCodePng) $('qr').src = 'data:image/png;base64,' + r.qrCodePng;
        $('simularPix').hidden = !dados.pagamento.simulado;
        mostrar('pix');
        acompanhar();
      } else if (r.url) {
        location.href = r.url;
      } else {
        mostrar('cartaoTeste');
        acompanhar();
      }
    }, function (e) {
      $('falhaEnvio').textContent = e.message;
      $('falhaEnvio').hidden = false;
    }).then(function () { botao.disabled = !docValido; escolher(metodo); });
  }

  function copiar() {
    var texto = $('copiaCola').value;
    var ok = function () { $('copiado').textContent = 'Código copiado! Agora cole no app do banco.'; };
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(texto).then(ok, manual); } else { manual(); }
    function manual() {
      var t = $('copiaCola'); t.focus(); t.select();
      try { document.execCommand('copy') ? ok() : ($('copiado').textContent = 'Toque e segure no código para copiar.'); } catch (e) { $('copiado').textContent = 'Toque e segure no código para copiar.'; }
    }
  }

  function simular() {
    pedir('/simular', { cobranca: cobranca }).then(function () { clearInterval(espera); mostrar('sucesso'); }, function (e) { alert(e.message); });
  }

  document.addEventListener('click', function (ev) {
    var alvo = ev.target.closest('button');
    if (!alvo) return;
    if (alvo.hasAttribute('data-metodo')) escolher(alvo.getAttribute('data-metodo'));
    else if (alvo.id === 'continuar') continuar();
    else if (alvo.id === 'copiar') copiar();
    else if (alvo.hasAttribute('data-simular')) simular();
    else if (alvo.hasAttribute('data-voltar')) { clearInterval(espera); $('copiado').textContent = ''; mostrar('formulario'); }
  });
  $('documento').addEventListener('input', atualizarDoc);

  if (!token) { falha('Link incompleto. Abra de novo pelo botão da mensagem no WhatsApp.'); return; }
  pedir('').then(function (d) {
    dados = d;
    $('ola').textContent = 'Olá, ' + d.nome + '!';
    $('dWhats').textContent = d.whatsapp;
    $('dPerfil').textContent = d.perfil;
    $('dCidade').textContent = d.cidade;
    $('valor').textContent = d.valor;
    Array.prototype.forEach.call(document.querySelectorAll('.vValor'), function (el) { el.textContent = d.valor; });
    var bloqueado = d.pagamento.assinaLoja || !d.pagamento.disponivel;
    $('bloqueioLoja').hidden = !d.pagamento.assinaLoja;
    $('desligado').hidden = d.pagamento.assinaLoja || d.pagamento.disponivel;
    $('campos').hidden = bloqueado;
    escolher('pix');
    mostrar('formulario');
  }, function (e) { falha(e.message); });
})();
