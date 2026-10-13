import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Tela from '../componentes/Tela';
import { Botao, Campo, Escolha, Rotulo, Mensagem, Texto } from '../componentes/ui';
import { validarCelular, formatarCelular, normalizarCelular, validarEmail } from '../lib/validacao';
import { api } from '../servicos/api';
import { guardarRecuperacao } from '../servicos/sessao';

const CANAIS = [{ valor: 'whatsapp', rotulo: 'WhatsApp' }, { valor: 'sms', rotulo: 'SMS' }, { valor: 'email', rotulo: 'E-mail' }];
const POR_CANAL = { whatsapp: 'pelo WhatsApp', sms: 'por SMS', email: 'por e-mail' };

export default function RecuperarSenha() {
  const [celular, setCelular] = useState('');
  const [canal, setCanal] = useState('whatsapp');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const digitos = normalizarCelular(celular);
  const erroCel = digitos.length ? validarCelular(celular) : null;
  const celOk = digitos.length > 0 && !erroCel;
  const erroEmail = canal === 'email' && email.trim() ? validarEmail(email) : null;
  const emailOk = canal !== 'email' || (email.trim() && !erroEmail);
  const podeEnviar = celOk && emailOk;

  async function enviarCodigo() {
    setErro(null); setEnviando(true);
    try {
      const resp = await api('/auth/codigo', { metodo: 'POST', autenticado: false, corpo: { whatsapp: digitos, canal, email: canal === 'email' ? email.trim() : undefined } });
      guardarRecuperacao({ whatsapp: digitos });
      router.push({ pathname: '/codigo', params: {
        whatsapp: digitos, canal: resp.canal, digitos: String(resp.digitos), espera: String(resp.esperaSeg),
        destino: resp.canal === 'email' ? email.trim() : formatarCelular(digitos),
        email: canal === 'email' ? email.trim() : '', modo: 'recuperar',
      } });
    } catch (e) { setErro(e.message); } finally { setEnviando(false); }
  }

  return (
    <Tela compacto titulo="Esqueci minha senha" subtitulo={null}>
      <Texto>Vamos enviar um código para você entrar sem a senha. Depois, lá dentro do app, você troca sua senha quando quiser.</Texto>

      <Campo rotulo="Celular (WhatsApp)" placeholder="(66) 99999-9999" keyboardType="phone-pad" autoComplete="tel"
        value={formatarCelular(celular)} onChangeText={(t) => setCelular(normalizarCelular(t).slice(0, 13))}
        estado={erroCel ? 'erro' : celOk ? 'ok' : null} erro={erroCel} />

      <View style={{ gap: 8 }}>
        <Rotulo>Por onde você quer receber o código?</Rotulo>
        <Escolha opcoes={CANAIS} valor={canal} aoMudar={setCanal} />
      </View>

      {canal === 'email' && (
        <Campo rotulo="Seu e-mail" placeholder="nome@exemplo.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
          value={email} onChangeText={(t) => setEmail(t.replace(/\s/g, ''))} estado={erroEmail ? 'erro' : email && !erroEmail ? 'ok' : null} erro={erroEmail} />
      )}

      {erro && <Mensagem>{erro}</Mensagem>}
      <Botao titulo={`Enviar código ${POR_CANAL[canal]}`} aoTocar={enviarCodigo} desligado={!podeEnviar} carregando={enviando} />
      <Botao tipo="link" titulo="Voltar para entrar com senha" aoTocar={() => router.back()} />
    </Tela>
  );
}
