import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icone } from '../../componentes/icones';
import { CartaoAnuncio, ChipCategoria, CATEGORIAS } from '../../componentes/marketplace';
import { Mensagem } from '../../componentes/ui';
import BuscaRota from '../../componentes/BuscaRota';
import { api } from '../../servicos/api';
import { tratarErroDeAcesso } from '../../servicos/erros';
import { cor, fonte } from '../../tema';

export default function Buscar() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState(() => {
    const c = String(params?.categoria || '').toLowerCase();
    if (c === 'frete')   return 'frete';
    if (c === 'máquina' || c === 'maquina') return 'maquina';
    if (c === 'serviço' || c === 'servico') return 'servico';
    return '';
  });
  const [rota, setRota] = useState(null);
  const [res, setRes] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const pedido = useRef(0);

  useEffect(() => {
    const termo = texto.trim();
    const temRota = categoria === 'frete' && rota;
    if (termo.length < 2 && !categoria && !temRota) { setRes(null); return undefined; }
    const n = ++pedido.current;
    const t = setTimeout(async () => {
      setCarregando(true); setErro(null);
      try {
        const parametros = { raio: '600', ...(termo.length >= 2 ? { q: termo } : {}), ...(categoria ? { categoria } : {}) };
        if (temRota) {
          parametros.origemCidade = rota.origem.nome; parametros.origemUf = rota.origem.uf;
          parametros.destinoCidade = rota.destino.nome; parametros.destinoUf = rota.destino.uf;
          parametros.desvioKm = String(rota.raioKm);
        }
        const q = new URLSearchParams(parametros);
        const r = await api(`/anuncios?${q}`);
        if (n === pedido.current) setRes(r);
      } catch (e) { if (!(await tratarErroDeAcesso(e))) setErro(e.message); } finally { if (n === pedido.current) setCarregando(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [texto, categoria, rota]);

  return (
    <View style={{ flex: 1, backgroundColor: cor.folha, paddingTop: insets.top + 14 }}>
      <View style={{ paddingHorizontal: 18, gap: 12 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 22, color: cor.texto }} accessibilityRole="header">Buscar</Text>
        <View style={estilos.busca}>
          <Icone nome="buscar" cor="#5B6B5E" t={18} />
          <TextInput value={texto} onChangeText={setTexto} autoFocus placeholder="Trator, plantadeira, frete, drone..." placeholderTextColor="#7A867C"
            style={{ flex: 1, fontFamily: fonte.normal, fontSize: 16, color: '#16241B', minHeight: 48 }} returnKeyType="search" accessibilityLabel="O que você procura" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIAS.map((c) => <ChipCategoria key={c.valor} c={c} ativo={c.valor === categoria} aoTocar={() => { setCategoria(c.valor); setRota(null); }} />)}
        </ScrollView>
        {categoria === 'frete' && <BuscaRota aoBuscar={setRota} />}
        {erro && <Mensagem>{erro}</Mensagem>}
        {res && <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{res.total === 1 ? '1 anúncio encontrado' : `${res.total} anúncios encontrados`} até {res.raioKm} km</Text>}
      </View>
      <FlatList
        style={{ marginTop: 10 }}
        data={res?.itens ?? []}
        keyExtractor={(a) => String(a.id)}
        renderItem={({ item }) => <View style={{ paddingHorizontal: 18 }}><CartaoAnuncio a={item} /></View>}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={carregando ? <ActivityIndicator color={cor.dourado} style={{ marginTop: 24 }} /> : (
          <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado, textAlign: 'center', marginTop: 24, paddingHorizontal: 30, lineHeight: 21 }}>
            {res ? 'Nada encontrado. Tente outra palavra ou escolha outra categoria.' : 'Digite o que você procura ou escolha uma categoria.'}
          </Text>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  busca: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14 },
});
