import { View, Text, Pressable, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { entrarComoVisitante } from '../servicos/sessao';
import { cor, fonte, raio } from '../tema';

export default function BoasVindas() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  async function explorar() {
    await entrarComoVisitante();
    router.replace('/(abas)/inicio');
  }

  function criarConta() { router.push('/entrada'); }
  function jaTenhoConta() { router.push('/entrar-senha'); }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1406' }}>
      <StatusBar style="light" />
      <Image source={require('../../assets/abertura.jpg')} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width, height, opacity: 0.55 }} accessible={false} />
      <View style={[estilos.cobertura, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
          <Image source={require('../../assets/logo-abertura.png')} resizeMode="contain" style={{ width: Math.min(width * 0.7, 420), height: Math.min(width * 0.7, 420) * (658 / 906) }} />
          <Text style={estilos.subtitulo}>Conectando quem faz o Agro acontecer</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <Pressable onPress={explorar} style={({ pressed }) => [estilos.botaoPrincipal, pressed && { opacity: 0.9 }]}>
            <Text style={estilos.botaoPrincipalTexto}>Explorar sem cadastro</Text>
          </Pressable>
          <Pressable onPress={criarConta} style={({ pressed }) => [estilos.botaoSecundario, pressed && { opacity: 0.85 }]}>
            <Text style={estilos.botaoSecundarioTexto}>Criar minha conta</Text>
          </Pressable>
          <Pressable onPress={jaTenhoConta} style={estilos.link}>
            <Text style={estilos.linkTexto}>Já tenho conta · Entrar</Text>
          </Pressable>
          <Text style={estilos.rodape}>Você pode usar sem conta. Entre apenas quando quiser publicar ou falar com alguém.</Text>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cobertura: { flex: 1, backgroundColor: 'rgba(11,20,6,0.55)' },
  subtitulo: { fontFamily: fonte.normal, fontSize: 15, color: cor.textoSuave, textAlign: 'center', marginTop: 16, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  botaoPrincipal: { backgroundColor: cor.dourado, paddingVertical: 15, borderRadius: raio.botao, alignItems: 'center' },
  botaoPrincipalTexto: { color: cor.fundo, fontFamily: fonte.forte, fontSize: 15, letterSpacing: 0.3 },
  botaoSecundario: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: cor.borda, paddingVertical: 15, borderRadius: raio.botao, alignItems: 'center' },
  botaoSecundarioTexto: { color: cor.texto, fontFamily: fonte.forte, fontSize: 15, letterSpacing: 0.3 },
  link: { paddingVertical: 10, alignItems: 'center' },
  linkTexto: { color: cor.dourado, fontFamily: fonte.media, fontSize: 14 },
  rodape: { color: cor.textoSuave, fontFamily: fonte.normal, fontSize: 11, textAlign: 'center', lineHeight: 15, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
});
