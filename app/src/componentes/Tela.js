import { View, ScrollView, KeyboardAvoidingView, Platform, Image, Text, useWindowDimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Faixas from './Faixas';
import { cor, fonte } from '../tema';

/**
 * Estrutura padrão das telas: topo verde com as faixas e a logo, e a "gaveta" escura com o conteúdo.
 * `compacto` mostra a logo menor ao lado do título (telas internas).
 */
export default function Tela({ children, titulo, subtitulo, compacto = false, rodape = null }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View style={estilos.raiz}>
      <StatusBar style="light" />
      <Faixas largura={width} deslocamentoY={compacto ? 70 : 0} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[compacto ? estilos.topoCompacto : estilos.topo, { paddingTop: insets.top + (compacto ? 16 : 28) }]}>
          <Image source={require('../../assets/simbolo.png')} style={compacto ? estilos.logoPequena : estilos.logo} accessibilityLabel="Logo AGROVINC" />
          <View style={compacto ? { flex: 1 } : { alignItems: 'center' }}>
            <Text style={[estilos.marca, compacto && { fontSize: 19 }]}>{titulo || 'AGROVINC'}</Text>
            {subtitulo !== null && <Text style={estilos.slogan}>{subtitulo ?? 'Conectando quem faz o Agro acontecer.'}</Text>}
          </View>
        </View>
        <ScrollView style={estilos.folha} contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {rodape}
      </KeyboardAvoidingView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: cor.fundo },
  topo: { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 24 },
  topoCompacto: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingBottom: 22 },
  // símbolo AGROVINC (690 x 420): sem caixa branca, direto sobre o verde
  logo: { width: 92, height: 56, marginBottom: 10 },
  logoPequena: { width: 62, height: 38 },
  marca: { fontFamily: fonte.titulo, fontSize: 20, color: cor.texto, letterSpacing: 0.5 },
  slogan: { fontFamily: fonte.normal, fontSize: 12, color: '#C9DDCD', marginTop: 3 },
  folha: { flex: 1, backgroundColor: cor.folha, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  conteudo: { padding: 24, gap: 16 },
});
