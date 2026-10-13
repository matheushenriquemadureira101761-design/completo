import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icone } from './icones';
import { cor, fonte, raio } from '../tema';

// Grid 2x3: Preciso / Ofereço × Máquina / Frete / Serviço.
// Usa os ícones SVG do projeto (mesmo padrão visual do dev original).
const ACOES = [
  { id: 'preciso-maquina', verbo: 'Preciso',  titulo: 'Máquina', icone: 'maquinas', destaque: true },
  { id: 'ofereco-maquina', verbo: 'Ofereço',  titulo: 'Máquina', icone: 'maquinas' },
  { id: 'preciso-frete',   verbo: 'Preciso',  titulo: 'Frete',   icone: 'fretes' },
  { id: 'ofereco-frete',   verbo: 'Ofereço',  titulo: 'Frete',   icone: 'fretes' },
  { id: 'preciso-servico', verbo: 'Preciso',  titulo: 'Serviço', icone: 'servicos' },
  { id: 'ofereco-servico', verbo: 'Ofereço',  titulo: 'Serviço', icone: 'servicos' },
];

function CartaoAcao({ a, aoTocar }) {
  const dest = a.destaque;
  const corIcone = dest ? cor.fundo : cor.textoSuave;
  return (
    <Pressable onPress={() => aoTocar(a)} style={({ pressed }) => [estilos.cartao, dest ? estilos.cartaoDest : estilos.cartaoNormal, pressed && { opacity: 0.85 }]}>
      <View style={estilos.iconeBox}>
        <Icone nome={a.icone} cor={corIcone} t={22} sw={1.7} />
      </View>
      <Text style={[estilos.verbo, { color: dest ? 'rgba(20,54,31,0.72)' : cor.textoApagado }]}>{a.verbo.toUpperCase()}</Text>
      <Text style={[estilos.titulo, { color: dest ? cor.fundo : cor.texto, fontFamily: dest ? fonte.forte : fonte.media }]}>{a.titulo}</Text>
    </Pressable>
  );
}

export default function GridAcoes({ aoTocar }) {
  const linhas = [[ACOES[0], ACOES[1]], [ACOES[2], ACOES[3]], [ACOES[4], ACOES[5]]];
  return (
    <View style={estilos.grid}>
      {linhas.map((linha, i) => (
        <View key={i} style={estilos.linha}>
          {linha.map((a) => <CartaoAcao key={a.id} a={a} aoTocar={aoTocar} />)}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  grid: { paddingHorizontal: 16, gap: 10 },
  linha: { flexDirection: 'row', gap: 10 },
  cartao: { flex: 1, borderRadius: raio.cartao, padding: 14, minHeight: 92 },
  cartaoDest: { backgroundColor: cor.dourado },
  cartaoNormal: { backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda },
  iconeBox: { marginBottom: 8 },
  verbo: { fontSize: 10, letterSpacing: 1, fontFamily: fonte.media, marginBottom: 2 },
  titulo: { fontSize: 15 },
});
