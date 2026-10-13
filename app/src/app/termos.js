import { Text, View } from 'react-native';
import { router } from 'expo-router';
import Tela from '../componentes/Tela';
import { Botao } from '../componentes/ui';
import { TERMOS } from '../conteudo/termos';
import { cor, fonte } from '../tema';

// Termos de Uso e Política de Privacidade completos, dentro do app (exigência das lojas).
export default function Termos() {
  return (
    <Tela compacto titulo="Termos e Privacidade" subtitulo={null}>
      <Botao tipo="link" titulo="Voltar" aoTocar={() => router.back()} />
      {TERMOS.map((b, i) => {
        if (b.t === 'h1') return <Text key={i} accessibilityRole="header" style={{ fontFamily: fonte.titulo, fontSize: 20, color: cor.texto, marginTop: i ? 16 : 0 }}>{b.x}</Text>;
        if (b.t === 'h2') return <Text key={i} accessibilityRole="header" style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.dourado, marginTop: 6 }}>{b.x}</Text>;
        if (b.t === 'bullet') return (
          <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
            <Text style={{ color: cor.textoApagado, fontSize: 15 }}>•</Text>
            <Text style={{ flex: 1, fontFamily: fonte.normal, fontSize: 15, lineHeight: 23, color: cor.textoSuave }}>{b.x}</Text>
          </View>
        );
        return <Text key={i} style={{ fontFamily: fonte.normal, fontSize: 15, lineHeight: 23, color: cor.textoSuave }}>{b.x}</Text>;
      })}
      <Botao titulo="Voltar" aoTocar={() => router.back()} />
    </Tela>
  );
}
