import { useState } from 'react';
import { View, Text, Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Botao, Cartao, Mensagem } from './ui';
import { assinarPelaLoja, restaurarCompra } from '../servicos/loja';
import { cor, fonte } from '../tema';

const SUPORTE = process.env.EXPO_PUBLIC_WHATSAPP_SUPORTE || '';
export const abrirSuporte = () => SUPORTE && Linking.openURL(`https://wa.me/${SUPORTE}`);

/** Botão de assinar pela loja + informações que a Apple exige junto da compra (preço, renovação, cancelamento, termos). */
export function BlocoAssinar({ valor = '29,90' }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [restaurando, setRestaurando] = useState(false);
  async function restaurar() {
    setErro(null); setAviso(null); setRestaurando(true);
    try {
      const s = await restaurarCompra();
      if (s) router.replace('/assinatura-ativa');
      else setAviso(`Não encontramos assinatura ativa nesta conta da ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'}.`);
    } catch (e) { setErro(e.message); } finally { setRestaurando(false); }
  }
  async function assinar() {
    setErro(null); setCarregando(true);
    try {
      const s = await assinarPelaLoja();
      if (s) router.replace('/assinatura-ativa');
    } catch (e) { setErro(e.message); } finally { setCarregando(false); }
  }
  return (
    <View style={{ gap: 10 }}>
      <Botao titulo={`Assinar por R$ ${valor}/mês`} aoTocar={assinar} carregando={carregando} />
      {erro && <Mensagem>{erro}</Mensagem>}
      {aviso && <Text style={{ fontFamily: fonte.media, fontSize: 13, lineHeight: 19, color: cor.textoSuave, textAlign: 'center' }}>{aviso}</Text>}
      <Botao tipo="link" titulo="Já assinei: restaurar compra" aoTocar={restaurar} carregando={restaurando} />
      <Text style={{ fontFamily: fonte.normal, fontSize: 12, lineHeight: 18, color: cor.textoApagado, textAlign: 'center' }}>
        Assinatura mensal de R$ {valor}, paga pela sua conta da {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}. Renova sozinha todo mês até você cancelar, o que pode ser feito a qualquer momento nas configurações da loja. Ao assinar, você concorda com os{' '}
        <Text style={{ fontFamily: fonte.forte, color: cor.dourado }} onPress={() => router.push('/termos')}>Termos de Uso</Text> e a{' '}
        <Text style={{ fontFamily: fonte.forte, color: cor.dourado }} onPress={() => router.push('/termos')}>Política de Privacidade</Text>.
      </Text>
    </View>
  );
}

function Item({ children }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={cor.ok} strokeWidth={3} style={{ marginTop: 3 }}><Path d="M20 6L9 17l-5-5" /></Svg>
      <Text style={{ flex: 1, fontFamily: fonte.normal, fontSize: 15, lineHeight: 22, color: cor.textoSuave }}>{children}</Text>
    </View>
  );
}

export function PorQuePaga() {
  return (
    <Cartao destaque>
      <Text style={{ fontFamily: fonte.titulo, fontSize: 18, color: cor.texto }} accessibilityRole="header">Por que a AGROVINC é paga?</Text>
      <Item>A assinatura mantém a plataforma no ar e sempre atualizada, para você achar máquinas, implementos, fretes e serviços perto de você.</Item>
      <Item>Todo cadastro tem o WhatsApp confirmado por código. Isso dá mais segurança na hora de negociar.</Item>
      <Item>Você fala direto com quem contrata ou com quem oferece, sem ninguém no meio do seu negócio.</Item>
      <Item>Você tem suporte pelo WhatsApp sempre que precisar.</Item>
    </Cartao>
  );
}

export function ResumoRegras({ valor = '29,90' }) {
  return (
    <Cartao>
      <Text style={{ fontFamily: fonte.titulo, fontSize: 18, color: cor.texto }} accessibilityRole="header">Resumo das regras</Text>
      <Item>Assinatura de R$ {valor} por mês, o mesmo valor para quem contrata e para quem oferece serviços.</Item>
      <Item>Renova todo mês, no mesmo dia em que você assinou.</Item>
      <Item>Você cancela quando quiser, sem multa.</Item>
      <Item>Nos 7 primeiros dias depois do primeiro pagamento, você pode pedir o valor de volta.</Item>
      <Item>Enquanto o acesso estiver pausado, seus anúncios, contatos e histórico ficam guardados. Nada é apagado.</Item>
    </Cartao>
  );
}
