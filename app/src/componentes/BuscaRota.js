import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { cor, fonte, raio } from '../tema';
import { buscarCidades } from '../lib/validacao';

// Busca de frete por rota: Origem → Destino + raio opcional.
// Transportadores anunciam com "faço frete até X km do meu trecho". Esta busca cruza as rotas.

function IconeTroca() {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={cor.textoApagado} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 10l5-5 5 5" /><Path d="M12 5v14" /><Path d="M7 14l5 5 5-5" />
  </Svg>;
}

function CampoCidade({ rotulo, cidade, aoDefinir, texto, aoDigitar }) {
  const sugestoes = useMemo(() => (cidade ? [] : buscarCidades(texto, 5)), [texto, cidade]);
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      {cidade ? (
        <View style={estilos.chip}>
          <Text style={estilos.chipTexto}>{cidade.nome} — {cidade.uf}</Text>
          <Pressable onPress={() => aoDefinir(null)} hitSlop={8}>
            <Text style={estilos.chipFechar}>×</Text>
          </Pressable>
        </View>
      ) : (
        <TextInput
          value={texto}
          onChangeText={aoDigitar}
          placeholder="Digite a cidade"
          placeholderTextColor={cor.textoApagado}
          style={estilos.campo}
        />
      )}
      {sugestoes.length > 0 && (
        <View style={estilos.lista}>
          {sugestoes.map((s) => (
            <Pressable key={`${s.nome}-${s.uf}`} onPress={() => aoDefinir(s)} style={({ pressed }) => [estilos.itemLista, pressed && { backgroundColor: cor.folha }]}>
              <Text style={estilos.itemListaTexto}>{s.nome} — {s.uf}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function BuscaRota({ aoBuscar }) {
  const [origem, setOrigem] = useState(null);
  const [destino, setDestino] = useState(null);
  const [buscaOrigem, setBuscaOrigem] = useState('');
  const [buscaDestino, setBuscaDestino] = useState('');
  const [raioKm, setRaioKm] = useState(100);

  function trocarOrigemDestino() {
    const o = origem, d = destino;
    const bo = buscaOrigem, bd = buscaDestino;
    setOrigem(d); setDestino(o);
    setBuscaOrigem(bd); setBuscaDestino(bo);
  }

  function buscar() {
    if (!origem || !destino) return;
    aoBuscar?.({ origem, destino, raioKm });
  }

  const RAIOS = [50, 100, 200, 500];
  const podeBuscar = origem && destino;

  return (
    <View style={estilos.wrap}>
      <Text style={estilos.titulo}>Buscar frete por rota</Text>
      <Text style={estilos.sublinha}>Informe de onde até onde você precisa transportar.</Text>

      <CampoCidade rotulo="DE" cidade={origem} aoDefinir={(c) => { setOrigem(c); if (c) setBuscaOrigem(''); }}
        texto={buscaOrigem} aoDigitar={setBuscaOrigem} />

      <Pressable onPress={trocarOrigemDestino} style={estilos.botaoTroca} hitSlop={8}>
        <IconeTroca />
      </Pressable>

      <CampoCidade rotulo="PARA" cidade={destino} aoDefinir={(c) => { setDestino(c); if (c) setBuscaDestino(''); }}
        texto={buscaDestino} aoDigitar={setBuscaDestino} />

      <View style={{ gap: 6, marginTop: 6 }}>
        <Text style={estilos.rotulo}>DESVIO MÁXIMO DA ROTA</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {RAIOS.map((r) => (
            <Pressable key={r} onPress={() => setRaioKm(r)}
              style={[estilos.pilula, raioKm === r && estilos.pilulaAtiva]}>
              <Text style={[estilos.pilulaTexto, raioKm === r && { color: cor.fundo, fontFamily: fonte.forte }]}>{r} km</Text>
            </Pressable>
          ))}
        </View>
        <Text style={estilos.dica}>Mostramos transportadores cuja rota passa a até {raioKm} km de cada ponta.</Text>
      </View>

      <Pressable onPress={buscar} disabled={!podeBuscar}
        style={({ pressed }) => [estilos.botaoBuscar, !podeBuscar && { opacity: 0.4 }, pressed && podeBuscar && { opacity: 0.85 }]}>
        <Text style={estilos.botaoBuscarTexto}>Buscar fretes</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  wrap: { gap: 12, padding: 16, backgroundColor: cor.folha, borderRadius: raio.cartao, borderWidth: 1, borderColor: cor.borda },
  titulo: { fontFamily: fonte.titulo, fontSize: 18, color: cor.texto, marginBottom: 2 },
  sublinha: { fontFamily: fonte.normal, fontSize: 12, color: cor.textoApagado, marginBottom: 4 },
  rotulo: { fontFamily: fonte.forte, fontSize: 10, color: cor.textoApagado, letterSpacing: 1.2 },
  campo: { backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda, borderRadius: raio.campo, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonte.normal, fontSize: 14, color: cor.texto },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.ok, borderRadius: raio.campo, paddingHorizontal: 14, paddingVertical: 11, gap: 10 },
  chipTexto: { flex: 1, fontFamily: fonte.media, fontSize: 14, color: cor.texto },
  chipFechar: { fontFamily: fonte.forte, fontSize: 20, color: cor.textoApagado },
  lista: { backgroundColor: cor.campo, borderRadius: raio.campo, borderWidth: 1, borderColor: cor.borda, overflow: 'hidden' },
  itemLista: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: cor.borda },
  itemListaTexto: { fontFamily: fonte.normal, fontSize: 14, color: cor.texto },
  botaoTroca: { alignSelf: 'center', width: 36, height: 36, borderRadius: 18, backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
  pilula: { flex: 1, backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  pilulaAtiva: { backgroundColor: cor.dourado, borderColor: cor.dourado },
  pilulaTexto: { fontFamily: fonte.media, fontSize: 12, color: cor.textoSuave },
  dica: { fontFamily: fonte.normal, fontSize: 11, color: cor.textoApagado, lineHeight: 15, marginTop: 2 },
  botaoBuscar: { backgroundColor: cor.dourado, paddingVertical: 14, borderRadius: raio.botao, alignItems: 'center', marginTop: 6 },
  botaoBuscarTexto: { color: cor.fundo, fontFamily: fonte.forte, fontSize: 14, letterSpacing: 0.3 },
});
