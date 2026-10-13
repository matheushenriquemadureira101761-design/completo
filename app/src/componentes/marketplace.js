import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { Icone, Estrela } from './icones';
import { API_URL } from '../servicos/api';
import { cor, fonte } from '../tema';

export const CATEGORIAS = [
  { valor: '', nome: 'Todos', icone: 'todos' },
  { valor: 'maquinas', nome: 'Máquinas', icone: 'maquinas' },
  { valor: 'implementos', nome: 'Implementos', icone: 'implementos' },
  { valor: 'fretes', nome: 'Fretes', icone: 'fretes' },
  { valor: 'servicos', nome: 'Serviços', icone: 'servicos' },
];
const TONS = { maquinas: ['#2E6B48', '#1A4A31'], implementos: ['#5A6F3A', '#2C4422'], fretes: ['#386C5E', '#1C3F36'], servicos: ['#6B5A2E', '#3B3218'] };

/** Foto do anúncio; sem foto, mostra uma ilustração da categoria com as faixas da marca. */
/** Fotos no servidor vêm como "/fotos/..."; em armazenamento na nuvem já vêm com o endereço completo. */
export const urlCompleta = (url) => (/^https?:\/\//.test(url) ? url : API_URL + url);

export function FotoAnuncio({ url, categoria, largura, altura, raio = 12 }) {
  if (url) return <Image source={{ uri: urlCompleta(url) }} style={{ width: largura, height: altura, borderRadius: raio, backgroundColor: cor.campo }} resizeMode="cover" accessibilityIgnoresInvertColors />;
  const [c1, c2] = TONS[categoria] || TONS.maquinas;
  return (
    <View style={{ width: largura, height: altura, borderRadius: raio, overflow: 'hidden' }} accessibilityLabel="Anúncio sem foto">
      <Svg width={largura} height={altura} viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs><LinearGradient id={`g${categoria}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c1} /><Stop offset="1" stopColor={c2} /></LinearGradient></Defs>
        <Rect width="100" height="100" fill={`url(#g${categoria})`} />
        <Path d="M-5 72 Q50 58 105 66 L105 105 L-5 105Z" fill="#14361F" opacity={0.85} />
        <Path d="M-5 80 Q55 66 105 74" stroke="#FDB813" strokeWidth={1.6} fill="none" opacity={0.75} />
        <Path d="M-5 88 Q55 74 105 82" stroke="#3FA65A" strokeWidth={2.2} fill="none" opacity={0.6} />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: altura * 0.14, alignItems: 'center' }}>
        <Icone nome={categoria} cor="#F4F1E8" t={Math.round(Math.min(largura, altura) * 0.42)} sw={1.6} />
      </View>
    </View>
  );
}

export function Nota({ nota, avaliacoes, curta = false }) {
  if (!avaliacoes) return <Text style={{ fontFamily: fonte.media, fontSize: 12, color: cor.textoApagado }} numberOfLines={1}>{curta ? 'Novo' : 'Novo na AGROVINC'}</Text>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Estrela />
      <Text style={{ fontFamily: fonte.forte, fontSize: 12, color: cor.texto }}>{String(nota).replace('.', ',')}</Text>
      <Text style={{ fontFamily: fonte.normal, fontSize: 12, color: cor.textoApagado }}>({avaliacoes})</Text>
    </View>
  );
}

/** Nota em estrelas cheias e vazias (ex.: 4 de 5). */
export function Estrelas({ nota, t = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${nota} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => <Text key={n} style={{ fontSize: t, lineHeight: t + 3, color: n <= nota ? cor.dourado : cor.borda }}>★</Text>)}
    </View>
  );
}

export function Selo({ texto, tipo = 'ok' }) {
  const c = tipo === 'ok' ? cor.ok : tipo === 'dourado' ? cor.dourado : cor.textoApagado;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: cor.aviso, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonte.forte, fontSize: 11, color: c }}>{texto}</Text>
    </View>
  );
}

export const distanciaTexto = (km) => (km == null ? '' : km < 1 ? 'na sua cidade' : `${km} km`);

/** Cartão da lista (forma A): foto ao lado, título, cidade e distância, nota, preço e disponibilidade. */
export function CartaoAnuncio({ a }) {
  return (
    <Pressable onPress={() => router.push(`/anuncio/${a.id}`)} accessibilityRole="button"
      accessibilityLabel={`${a.titulo}, ${a.cidade}, ${distanciaTexto(a.distanciaKm)}, ${a.preco}${a.unidade}`}
      style={({ pressed }) => [estilos.cartao, pressed && { opacity: 0.85 }]}>
      <FotoAnuncio url={a.foto} categoria={a.categoria} largura={96} altura={96} />
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={estilos.titulo} numberOfLines={2}>{a.titulo}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icone nome="pin" cor={cor.textoApagado} t={13} />
          <Text style={estilos.local} numberOfLines={1}>{a.cidade} · {distanciaTexto(a.distanciaKm)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexShrink: 1 }}><Nota nota={a.nota} avaliacoes={a.avaliacoes} curta /></View>
          <Text style={estilos.preco} numberOfLines={1}>{a.preco}<Text style={estilos.unidade}>{a.unidade}</Text></Text>
        </View>
        <Selo texto={a.meu ? 'Seu anúncio' : a.disponibilidade} tipo={a.meu ? 'dourado' : 'ok'} />
      </View>
    </Pressable>
  );
}

export function ChipCategoria({ c, ativo, aoTocar }) {
  return (
    <Pressable onPress={aoTocar} accessibilityRole="button" accessibilityState={{ selected: ativo }}
      style={[estilos.chip, ativo && { backgroundColor: cor.dourado, borderColor: cor.dourado }]}>
      <Icone nome={c.icone} cor={ativo ? '#14361F' : cor.textoApagado} t={16} />
      <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: ativo ? '#14361F' : cor.textoSuave }}>{c.nome}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: 16, backgroundColor: cor.campo, borderWidth: 1.5, borderColor: cor.borda },
  titulo: { fontFamily: fonte.forte, fontSize: 15, lineHeight: 19, color: cor.texto },
  local: { flex: 1, fontFamily: fonte.normal, fontSize: 12, color: cor.textoApagado },
  preco: { fontFamily: fonte.forte, fontSize: 15, color: cor.texto, flexShrink: 0 },
  unidade: { fontFamily: fonte.normal, fontSize: 12, color: cor.textoApagado },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo },
});
