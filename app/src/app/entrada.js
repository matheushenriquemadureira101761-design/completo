import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Tela from '../componentes/Tela';
import { Botao, Campo, Escolha, Rotulo, Mensagem, Titulo, Texto } from '../componentes/ui';
import { validarCelular, formatarCelular, normalizarCelular, validarEmail, buscarCidades } from '../lib/validacao';
import { api } from '../servicos/api';
import { guardarRascunho } from '../servicos/sessao';
import { cor, fonte } from '../tema';

const CANAIS = [{ valor: 'whatsapp', rotulo: 'WhatsApp' }, { valor: 'sms', rotulo: 'SMS' }, { valor: 'email', rotulo: 'E-mail' }];
const POR_CANAL = { whatsapp: 'pelo WhatsApp', sms: 'por SMS', email: 'por e-mail' };

export default function Entrada() {
  const [nome, setNome] = useState('');
  const [celular, setCelular] = useState('');
  const [cidadeBusca, setCidadeBusca] = useState('');
  const [cidade, setCidade] = useState(null);
  const [canal, setCanal] = useState('whatsapp');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState(null);

  const digitosCel = normalizarCelular(celular);
  const erroCel = digitosCel.length ? validarCelular(celular) : null;
  const celOk = digitosCel.length > 0 && !erroCel;
  const erroEmail = canal === 'email' && email.trim() ? validarEmail(email) : null;
  const emailOk = canal !== 'email' || (email.trim() && !erroEmail);
  const erroSenha = senha && senha.length < 6 ? 'A senha precisa ter pelo menos 6 caracteres.' : null;
  const nomeOk = nome.trim().length >= 3;
  const sugestoes = useMemo(() => (cidade ? [] : buscarCidades(cidadeBusca, 6)), [cidadeBusca, cidade]);
  const buscando = !cidade && cidadeBusca.trim().length >= 2;

  const falta = [];
  if (!nomeOk) falta.push('nome');
  if (!celOk) falta.push('celular');
  if (!cidade) falta.push('cidade');
  if (!emailOk) falta.push('e-mail');
  if (erroSenha) falta.push('senha');
  if (!aceite) falta.push('aceite dos termos');
  const podeEnviar = falta.length === 0;

  async function enviarCodigo() {
    setErroGeral(null);
    setEnviando(true);
    try {
      const resp = await api('/auth/codigo', { metodo: 'POST', autenticado: false, corpo: { whatsapp: digitosCel, canal, email: canal === 'email' ? email.trim() : undefined } });
      guardarRascunho({ nome: nome.trim(), cidade: cidade.nome, uf: cidade.uf, email: email.trim() || undefined, senha: senha || undefined, aceiteTermos: true });
      router.push({ pathname: '/codigo', params: {
        whatsapp: digitosCel, canal: resp.canal, digitos: String(resp.digitos), espera: String(resp.esperaSeg),
        destino: resp.canal === 'email' ? email.trim() : formatarCelular(digitosCel), email: canal === 'email' ? email.trim() : '',
      } });
    } catch (e) {
      setErroGeral(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Titulo>Vamos criar sua conta</Titulo>
        <Texto suave centro>Depois você escolhe o que quer fazer na plataforma</Texto>
      </View>

      <Campo rotulo="Nome completo" placeholder="Seu nome" value={nome} onChangeText={setNome} autoComplete="name" textContentType="name" autoCapitalize="words" />

      <Campo rotulo="Celular (WhatsApp)" placeholder="(66) 99999-9999" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber"
        value={formatarCelular(celular)} onChangeText={(t) => setCelular(normalizarCelular(t).slice(0, 13))}
        estado={erroCel ? 'erro' : celOk ? 'ok' : null} erro={erroCel} ok={celOk ? 'Número de WhatsApp válido' : null} />

      <View style={{ gap: 6 }}>
        <Rotulo>Cidade</Rotulo>
        {cidade ? (
          <View style={estilos.cidadeEscolhida}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={cor.ok} strokeWidth={3}><Path d="M20 6L9 17l-5-5" /></Svg>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto }}>{cidade.nome}</Text>
              <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoSuave, marginTop: 2 }}>{cidade.estadoUf}</Text>
            </View>
            <Pressable onPress={() => { setCidade(null); setCidadeBusca(''); }} style={estilos.trocar} accessibilityRole="button" accessibilityLabel="Trocar cidade">
              <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.dourado }}>Trocar</Text>
            </Pressable>
          </View>
        ) : (
          <Campo placeholder="Digite o nome da sua cidade" value={cidadeBusca} onChangeText={setCidadeBusca} autoCorrect={false} accessibilityLabel="Cidade" />
        )}
        {buscando && sugestoes.length > 0 && (
          <View style={estilos.lista}>
            {sugestoes.map((c) => (
              <Pressable key={c.nome + c.uf} onPress={() => setCidade(c)} style={({ pressed }) => [estilos.itemLista, pressed && { backgroundColor: cor.borda }]} accessibilityRole="button" accessibilityLabel={`${c.nome}, ${c.estadoUf}`}>
                <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{c.nome}</Text>
                <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado, marginTop: 2 }}>{c.estadoUf}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {buscando && sugestoes.length === 0 && <Mensagem>Nenhuma cidade encontrada. Confira como está escrito.</Mensagem>}
      </View>

      <View style={{ gap: 8 }}>
        <Rotulo>Por onde você quer receber o código de acesso?</Rotulo>
        <Escolha opcoes={CANAIS} valor={canal} aoMudar={setCanal} />
      </View>
      {canal === 'email' && (
        <Campo rotulo="Seu e-mail" placeholder="nome@exemplo.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
          value={email} onChangeText={(t) => setEmail(t.replace(/\s/g, ''))} estado={erroEmail ? 'erro' : email && !erroEmail ? 'ok' : null} erro={erroEmail} />
      )}
      <Texto suave style={{ fontSize: 13, lineHeight: 19 }}>Por segurança, o código chega só para você. Ele nunca aparece aqui no aplicativo.</Texto>

      <Campo rotulo="Criar senha (opcional)" placeholder="Pelo menos 6 caracteres" secureTextEntry autoComplete="new-password" textContentType="newPassword"
        value={senha} onChangeText={setSenha} estado={erroSenha ? 'erro' : null} erro={erroSenha} />
      <Texto suave style={{ fontSize: 13, lineHeight: 19, marginTop: -8 }}>Com senha, dá para entrar sem código se você trocar de celular.</Texto>

      <Pressable onPress={() => setAceite(!aceite)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }} accessibilityRole="checkbox" accessibilityState={{ checked: aceite }}>
        <View style={[estilos.caixa, aceite && { backgroundColor: cor.dourado, borderColor: cor.dourado }]}>
          {aceite && <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#14361F" strokeWidth={3.5}><Path d="M20 6L9 17l-5-5" /></Svg>}
        </View>
        <Text style={{ flex: 1, fontFamily: fonte.normal, fontSize: 14, lineHeight: 21, color: cor.textoSuave }}>
          Li e aceito os <Text style={estilos.link} onPress={() => router.push('/termos')}>Termos de Uso</Text> e a <Text style={estilos.link} onPress={() => router.push('/termos')}>Política de Privacidade</Text>, incluindo o uso dos meus dados conforme a LGPD.
        </Text>
      </Pressable>

      {erroGeral && <Mensagem>{erroGeral}</Mensagem>}
      <Botao titulo={`Enviar código ${POR_CANAL[canal]}`} aoTocar={enviarCodigo} desligado={!podeEnviar} carregando={enviando} />
      {!podeEnviar && <Texto suave centro style={{ fontSize: 13, marginTop: -6 }}>Para continuar, falta: {falta.join(', ')}.</Texto>}

      <Botao tipo="link" titulo="Já tenho senha? Entrar com senha" aoTocar={() => router.push('/entrar-senha')} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cidadeEscolhida: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: cor.ok, backgroundColor: cor.campo },
  trocar: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: cor.borda, backgroundColor: cor.folha },
  lista: { borderRadius: 14, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo, overflow: 'hidden' },
  itemLista: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: cor.borda },
  caixa: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: cor.borda, backgroundColor: cor.campo, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  link: { fontFamily: fonte.forte, color: cor.dourado },
});
