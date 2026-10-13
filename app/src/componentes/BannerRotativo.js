import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Icone } from './icones';
import { cor, fonte, raio } from '../tema';

// Banner rotativo de empresas em destaque (geolocalização).
// Troca a cada 8 segundos com transição suave. Padrão visual do app.
export default function BannerRotativo({ empresas = [], aoTocar }) {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (empresas.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
        setIdx((i) => (i + 1) % empresas.length);
        Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [empresas.length]);

  if (!empresas.length) return null;
  const e = empresas[idx];
  const tomClaro = e.tom || cor.borda;
  const tomMedio = e.tomMedio || cor.campo;

  return (
    <View style={estilos.wrap}>
      <View style={estilos.cabecalho}>
        <View style={estilos.rotulo}>
          <Icone nome="pin" cor={cor.textoApagado} t={14} sw={1.8} />
          <Text style={estilos.rotuloTexto}>PERTO DE VOCÊ</Text>
        </View>
        {e.distanciaKm != null && (
          <Text style={estilos.distancia}>{e.distanciaKm} km</Text>
        )}
      </View>
      <Pressable onPress={() => aoTocar && aoTocar(e)}>
        <Animated.View style={[estilos.banner, { opacity: fade, backgroundColor: tomClaro }]}>
          <View style={[estilos.bannerInterno, { backgroundColor: tomMedio }]}>
            <View style={estilos.linhaTopo}>
              {e.avaliacao != null && (
                <View style={estilos.chipAval}>
                  <Text style={estilos.chipAvalTexto}>★ {e.avaliacao.toFixed(1)}{e.totalAval ? ` · ${e.totalAval}` : ''}</Text>
                </View>
              )}
              {e.patrocinado && (
                <View style={estilos.chipPatro}>
                  <Text style={estilos.chipPatroTexto}>PATROCINADO</Text>
                </View>
              )}
            </View>
            <View>
              <Text style={estilos.nomeEmpresa}>{e.nome?.toUpperCase()}</Text>
              <Text style={estilos.chamada} numberOfLines={2}>{e.chamada}</Text>
              {e.cidade && <Text style={estilos.cidade}>{e.cidade}</Text>}
            </View>
          </View>
        </Animated.View>
      </Pressable>
      {empresas.length > 1 && (
        <View style={estilos.pontos}>
          {empresas.map((_, i) => (
            <View key={i} style={[estilos.ponto, i === idx && estilos.pontoAtivo]} />
          ))}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 20 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rotuloTexto: { fontSize: 10, color: cor.textoApagado, letterSpacing: 1, fontFamily: fonte.media },
  distancia: { fontSize: 11, color: cor.textoApagado, fontFamily: fonte.normal },
  banner: { height: 170, borderRadius: raio.cartao, overflow: 'hidden' },
  bannerInterno: { flex: 1, padding: 18, justifyContent: 'space-between' },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chipAval: { backgroundColor: 'rgba(14,39,23,0.80)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: cor.borda },
  chipAvalTexto: { color: cor.texto, fontSize: 10, fontFamily: fonte.media },
  chipPatro: { backgroundColor: cor.dourado, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipPatroTexto: { color: cor.fundo, fontSize: 9, fontFamily: fonte.forte, letterSpacing: 0.6 },
  nomeEmpresa: { fontSize: 11, color: cor.textoSuave, fontFamily: fonte.media, marginBottom: 4, letterSpacing: 0.6 },
  chamada: { fontSize: 19, color: cor.texto, fontFamily: fonte.titulo, lineHeight: 23, marginBottom: 6 },
  cidade: { fontSize: 11, color: cor.textoSuave, fontFamily: fonte.normal },
  pontos: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  ponto: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  pontoAtivo: { width: 20, backgroundColor: cor.dourado },
});
