import { useEffect, useState } from 'react';
import { View, Text, TextInput, Platform, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Tela from '../componentes/Tela';
import { Botao, Mensagem, Titulo, Texto, Cartao } from '../componentes/ui';
import { api } from '../servicos/api';
import { lerRascunho, limparRascunho, limparRecuperacao, salvarToken } from '../servicos/sessao';
import { registrarNotificacoes } from '../servicos/notificacoes';
import { extrairCodigo } from '../servicos/ganchos';
import { cor, fonte } from '../tema';

const POR_CANAL = { whatsapp: 'pelo WhatsApp', sms: 'por SMS', email: 'por e-mail' };
const ONDE = {
  whatsapp: 'Abra o seu WhatsApp e veja a mensagem da AGROVINC.',
  sms: 'Abra as mensagens de texto (SMS) do seu celular.',
  email: 'Abra o seu e-mail (olhe também no spam).',
};

export default function ConfirmarCodigo() {
  const p = useLocalSearchParams();
  const digitos = Number(p.digitos) || 6;
  const [canal, setCanal] = useState(String(p.canal || 'whatsapp'));
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(null);
  const [pedirNovo, setPedirNovo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  // Atenção: 0 é um valor válido ("pode pedir já"), por isso não dá para usar `|| 60` aqui.
  const [espera, setEspera] = useState(p.espera !== undefined && p.espera !== '' ? Number(p.espera) : 60);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function colar() {
    const texto = await Clipboard.getStringAsync();
    const c = extrairCodigo(texto, digitos);
    if (c.length === digitos) { setCodigo(c); setErro(null); } else setErro(`Não achamos um código de ${digitos} números no que foi copiado.`);
  }

  async function reenviar() {
    setErro(null); setPedirNovo(false); setReenviando(true);
    try {
      const r = await api('/auth/codigo', { metodo: 'POST', autenticado: false, corpo: { whatsapp: p.whatsapp, canal, email: p.email || undefined } });
      setCanal(r.canal); setCodigo(''); setEspera(r.esperaSeg);
    } catch (e) {
      setErro(e.message);
      if (e.dados?.segundos) setEspera(e.dados.segundos);
    } finally { setReenviando(false); }
  }

  async function confirmar() {
    setErro(null); setConfirmando(true);
    try {
      const { passe } = await api('/auth/verificar', { metodo: 'POST', autenticado: false, corpo: { whatsapp: p.whatsapp, codigo } });
      const ehRecuperacao = p.modo === 'recuperar';
      const corpo = ehRecuperacao
        ? { whatsapp: p.whatsapp, passe, plataforma: Platform.OS }
        : { ...lerRascunho(), passe, plataforma: Platform.OS };
      const r = await api('/auth/concluir', { metodo: 'POST', autenticado: false, corpo });
      await salvarToken(r.token);
      limparRascunho();
      limparRecuperacao();
      registrarNotificacoes();
      router.replace(r.novo && !ehRecuperacao ? '/cadastro-feito' : '/');
    } catch (e) {
      setErro(e.message);
      setPedirNovo(['codigo_vencido', 'muitas_tentativas', 'passe_invalido'].includes(e.dados?.codigo));
      if (e.dados?.codigo !== 'codigo_errado') setCodigo('');
    } finally { setConfirmando(false); }
  }

  const completo = codigo.length === digitos;
  return (
    <Tela compacto titulo="Confirme seu número" subtitulo={null}>
      <Cartao>
        <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto }}>Código enviado {POR_CANAL[canal]}</Text>
        <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoSuave }}>para {p.destino}</Text>
      </Cartao>

      <View style={{ gap: 8 }}>
        <Titulo centro={false}>Digite o código de {digitos} números</Titulo>
        <TextInput
          value={codigo}
          onChangeText={(t) => { setCodigo(extrairCodigo(t, digitos)); setErro(null); }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          autoFocus
          placeholder={'•'.repeat(digitos)}
          placeholderTextColor={cor.borda}
          accessibilityLabel={`Código de ${digitos} números`}
          style={[estilos.codigo, { borderColor: completo ? cor.ok : cor.borda }]}
        />
        <Texto suave style={{ fontSize: 14 }}>{ONDE[canal]} Se o celular sugerir o código em cima do teclado, é só tocar nele.</Texto>
      </View>

      <Botao tipo="contorno" titulo="Colar código" aoTocar={colar} />
      {erro && <Mensagem>{erro}</Mensagem>}
      <Botao titulo="Confirmar e entrar" aoTocar={confirmar} desligado={!completo} carregando={confirmando} />

      {espera > 0
        ? <Texto suave centro style={{ fontSize: 14 }}>Pedir outro código em {espera}s</Texto>
        : <Botao tipo="link" titulo={pedirNovo ? 'Pedir novo código' : 'Não chegou? Reenviar código'} aoTocar={reenviar} carregando={reenviando} />}
      <Botao tipo="link" titulo="Trocar número ou forma de receber" aoTocar={() => router.back()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  codigo: {
    minHeight: 64, borderRadius: 14, borderWidth: 1.5, backgroundColor: cor.campo, color: cor.texto,
    fontFamily: fonte.forte, fontSize: 28, letterSpacing: 10, textAlign: 'center',
  },
});
