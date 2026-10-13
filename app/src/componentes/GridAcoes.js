import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icone } from './icones';
import { cor, fonte, raio } from '../tema';

// Grid 2x3: Preciso / Ofereço × Máquina / Frete / Serviço.
// Mistura: cada tipo tem sua cor característica + Preciso é sólido / Ofereço é contorno (hierarquia visual).
const TIPOS = {
  maquina: { cor: '#F2B544', corClara: 'rgba(242,181,68,0.14)', corBorda: 'rgba(242,181,68,0.45)' },
  frete:   { cor: '#5BA4F2', corClara: 'rgba(91,164,242,0.14)', corBorda: 'rgba(91,164,242,0.45)' },
  servico: { cor: '#F58A5B', corClara: 'rgba(245,138,91,0.14)', corBorda: 'rgba(245,138,91,0.45)' },
};

const ACOES = [
  { id: 'preciso-maquina', verbo: 'Preciso',  titulo: 'Máquina', icone: 'maquinas', tipo: 'maquina', solido: true },
  { id: 'ofereco-maquina', verbo: 'Ofereço',  titulo: 'Máquina', icone: 'maquinas', tipo: 'maquina', solido: false },
  { id: 'preciso-frete',   verbo: 'Preciso',  titulo: 'Frete',   icone: 'fretes',   tipo: 'frete',   solido: true },
  { id: 'ofereco-frete',   verbo: 'Ofereço',  titulo: 'Frete',   icone: 'fretes',   tipo: 'frete',   solido: false },
  { id: 'preciso-servico', verbo: 'Preciso',  titulo: 'Serviço', icone: 'servicos', tipo: 'servico', solido: true },
  { id: 'ofereco-servico', verbo: 'Ofereço',  titulo: 'Serviço', icone: 'servicos', tipo: 'servico', solido: false },
];

function CartaoAcao({ a, aoTocar }) {
  const t = TIPOS[a.tipo];
  const estilo = a.solido
    ? { backgroundColor: t.cor }
    : { backgroundColor: t.corClara, borderWidth: 1, borderColor: t.corBorda };
  const corIcone = a.solido ? cor.fundo : t.cor;
  const corVerbo = a.solido ? 'rgba(20,54,31,0.72)' : t.cor;
  const corTitulo = a.solido ? cor.fundo : cor.texto;

  return (
    <Pressable onPress={() => aoTocar(a)} style={({ pressed }) => [estilos.cartao, estilo, pressed && { opacity: 0.85 }]}>
      <View style={estilos.iconeBox}>
        <Icone nome={a.icone} cor={corIcone} t={22} sw={1.8} />
      </View>
      <Text style={[estilos.verbo, { color: corVerbo }]}>{a.verbo.toUpperCase()}</Text>
      <Text style={[estilos.titulo, { color: corTitulo, fontFamily: a.solido ? fonte.forte : fonte.media }]}>{a.titulo}</Text>
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
  iconeBox: { marginBottom: 8 },
  verbo: { fontSize: 10, letterSpacing: 1, fontFamily: fonte.media, marginBottom: 2 },
  titulo: { fontSize: 15 },
});
