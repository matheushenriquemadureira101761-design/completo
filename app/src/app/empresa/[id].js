import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import { api } from '../../servicos/api';
import { exigirConta } from '../../servicos/gate';
import { cor, fonte, raio } from '../../tema';

// Empresas de exemplo (serão substituídas por dados reais do backend).
const EXEMPLOS = {
  a1: { id: 'a1', nome: 'Agro Center', slogan: 'Linha completa de tratores com condições especiais', cidade: 'Nova Xavantina — MT', distanciaKm: 12, avaliacao: 4.8, totalAval: 120, membroDesde: 'março de 2024', categorias: ['Máquinas', 'Implementos', 'Peças'], sobre: 'Revendedora autorizada de tratores novos e seminovos. Atendemos todo o Vale do Araguaia com manutenção especializada e peças originais.', tomCapa: '#1E4A2C' },
  a2: { id: 'a2', nome: 'Transportes Vale', slogan: 'Fretes agro para todo o Centro-Oeste', cidade: 'Água Boa — MT', distanciaKm: 24, avaliacao: 4.9, totalAval: 86,  membroDesde: 'janeiro de 2024', categorias: ['Frete', 'Transporte'], sobre: 'Transportamos grãos, insumos e maquinário com segurança e pontualidade. Frota própria e motoristas experientes.', tomCapa: '#2A4A3A' },
  a3: { id: 'a3', nome: 'Oficina do Campo', slogan: 'Manutenção especializada em implementos agrícolas', cidade: 'Canarana — MT', distanciaKm: 38, avaliacao: 4.6, totalAval: 54,  membroDesde: 'maio de 2024', categorias: ['Serviços', 'Manutenção'], sobre: 'Equipe técnica certificada em manutenção preventiva e corretiva de implementos de todas as marcas.', tomCapa: '#1F4530' },
};

function IconeVoltar() { return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={cor.texto} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>; }
function IconeEstrela() { return <Svg width={14} height={14} viewBox="0 0 24 24" fill={cor.dourado} stroke={cor.dourado} strokeWidth={1}><Path d="M12 2l3.1 6.3L22 9.2l-5 4.9 1.2 6.9L12 17.7l-6.2 3.3L7 14.1 2 9.2l6.9-.9z" /></Svg>; }
function IconePin() { return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={cor.textoSuave} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" /></Svg>; }

export default function PaginaEmpresa() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [e, setE] = useState(() => EXEMPLOS[String(id)] || null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    // Tenta buscar do backend; se falhar, mantém o exemplo (ou mostra erro se nem exemplo tem).
    let ativo = true;
    (async () => {
      setCarregando(true);
      try {
        const r = await api(`/empresas/${id}`);
        if (ativo && r?.empresa) setE(r.empresa);
      } catch {
        if (ativo && !EXEMPLOS[String(id)]) setErro('Empresa não encontrada.');
      } finally { if (ativo) setCarregando(false); }
    })();
    return () => { ativo = false; };
  }, [id]);

  async function falar() {
    if (!(await exigirConta('falar com a empresa'))) return;
    // Se a empresa for Premium, abre WhatsApp direto. Senão, chat interno.
    if (e?.premium && e?.whatsapp) { /* TODO: abrir Linking WhatsApp */ return; }
    router.push({ pathname: '/chat/[id]', params: { id: String(id), nome: e?.nome || 'Conversa' } });
  }
  async function pedirOrcamento() { if (await exigirConta('pedir orçamento')) router.push({ pathname: '/orcamento/[id]', params: { id: String(id) } }); }

  if (erro) return (
    <View style={{ flex: 1, backgroundColor: cor.fundo, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={estilos.topo}><Pressable onPress={() => router.back()} style={estilos.btnTopo}><IconeVoltar /></Pressable></View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: cor.erro, fontFamily: fonte.media, fontSize: 15, textAlign: 'center' }}>{erro}</Text>
      </View>
    </View>
  );
  if (!e) return null;

  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Capa */}
        <View style={[estilos.capa, { backgroundColor: e.tomCapa || cor.borda, paddingTop: insets.top + 12 }]}>
          <View style={estilos.topo}>
            <Pressable onPress={() => router.back()} style={estilos.btnTopo}><IconeVoltar /></Pressable>
          </View>
          <View style={{ padding: 20, paddingTop: 8 }}>
            <Text style={estilos.nome}>{e.nome?.toUpperCase()}</Text>
            <Text style={estilos.slogan}>{e.slogan}</Text>
          </View>
        </View>
        {/* Chips de informação */}
        <View style={estilos.chipsLinha}>
          <View style={estilos.chip}><IconeEstrela /><Text style={estilos.chipTexto}>{Number(e.avaliacao).toFixed(1)} · {e.totalAval} avaliações</Text></View>
          <View style={estilos.chip}><IconePin /><Text style={estilos.chipTexto}>{e.cidade}{e.distanciaKm != null ? ` · ${e.distanciaKm} km` : ''}</Text></View>
        </View>
        {/* Sobre */}
        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>SOBRE</Text>
          <Text style={estilos.corpo}>{e.sobre}</Text>
        </View>
        {/* Categorias */}
        {e.categorias?.length > 0 && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>CATEGORIAS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {e.categorias.map((c) => (
                <View key={c} style={estilos.categoria}><Text style={estilos.categoriaTexto}>{c}</Text></View>
              ))}
            </View>
          </View>
        )}
        {e.membroDesde && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>NA AGROVINC</Text>
            <Text style={estilos.corpo}>Membro desde {e.membroDesde}</Text>
          </View>
        )}
      </ScrollView>
      {/* Barra fixa de ações */}
      <View style={[estilos.barraFixa, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={pedirOrcamento} style={({ pressed }) => [estilos.btnSecundario, pressed && { opacity: 0.85 }]}>
          <Text style={estilos.btnSecundarioTexto}>Pedir orçamento</Text>
        </Pressable>
        <Pressable onPress={falar} style={({ pressed }) => [estilos.btnPrincipal, pressed && { opacity: 0.9 }]}>
          <Text style={estilos.btnPrincipalTexto}>Falar com a empresa</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { paddingHorizontal: 12 },
  btnTopo: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  capa: { minHeight: 180 },
  nome: { fontFamily: fonte.media, fontSize: 12, color: cor.textoSuave, letterSpacing: 1, marginBottom: 6 },
  slogan: { fontFamily: fonte.titulo, fontSize: 22, color: cor.texto, lineHeight: 28 },
  chipsLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingTop: 14, borderBottomWidth: 1, borderBottomColor: cor.borda },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: cor.campo, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: cor.borda },
  chipTexto: { fontFamily: fonte.media, fontSize: 12, color: cor.textoSuave },
  secao: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: cor.borda },
  secaoTitulo: { fontFamily: fonte.forte, fontSize: 11, color: cor.textoApagado, letterSpacing: 1.2, marginBottom: 10 },
  corpo: { fontFamily: fonte.normal, fontSize: 14, color: cor.textoSuave, lineHeight: 21 },
  categoria: { backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  categoriaTexto: { fontFamily: fonte.media, fontSize: 12, color: cor.texto },
  barraFixa: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: cor.folha, borderTopWidth: 1, borderTopColor: cor.borda, paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 10 },
  btnSecundario: { flex: 1, backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda, paddingVertical: 13, borderRadius: raio.botao, alignItems: 'center' },
  btnSecundarioTexto: { color: cor.texto, fontFamily: fonte.forte, fontSize: 13 },
  btnPrincipal: { flex: 1.4, backgroundColor: cor.dourado, paddingVertical: 13, borderRadius: raio.botao, alignItems: 'center' },
  btnPrincipalTexto: { color: cor.fundo, fontFamily: fonte.forte, fontSize: 13 },
});
