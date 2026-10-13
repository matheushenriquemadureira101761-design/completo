import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import GridAcoes from '../../componentes/GridAcoes';
import BannerRotativo from '../../componentes/BannerRotativo';
import { api } from '../../servicos/api';
import { telaDaSituacao } from '../../servicos/rota';
import { tratarErroDeAcesso } from '../../servicos/erros';
import { dataCurta } from '../../servicos/ganchos';
import { exigirConta } from '../../servicos/gate';
import { cor, fonte } from '../../tema';

const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const primeiroNome = (nome) => { if (!nome) return ''; return String(nome).trim().split(/\s+/)[0]; };

function AvisoAssinatura({ s, aoTocar }) {
  if (!s) return null;
  let texto = null; let forte = false;
  if (s.estado === 'teste') texto = s.diasRestantes === 1 ? `Último dia do teste grátis` : `Teste grátis · ${s.diasRestantes} dias`;
  if (s.estado === 'vence_hoje') { texto = 'Sua assinatura vence hoje'; forte = true; }
  if (s.estado === 'atrasada') { texto = `Venceu · pausa em ${dataCurta(s.pausaEm)}`; forte = true; }
  if (!texto) return null;
  return (
    <View style={{ paddingHorizontal: 20, marginTop: -4, marginBottom: 10, alignItems: 'flex-start' }}>
      <Pressable onPress={aoTocar} style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: forte ? 'rgba(253,184,19,0.12)' : 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: forte ? 'rgba(253,184,19,0.4)' : cor.borda,
        paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
      }, pressed && { opacity: 0.85 }]}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: forte ? cor.dourado : cor.ok }} />
        <Text style={{ fontFamily: fonte.media, fontSize: 11, color: forte ? cor.dourado : cor.textoSuave, letterSpacing: 0.3 }}>{texto}</Text>
      </Pressable>
    </View>
  );
}

// Empresas de exemplo renderizadas enquanto o backend não responde (modo demonstração).
// Nenhuma chave, URL ou credencial exposta. Dados fictícios apenas para apresentação visual.
const EMPRESAS_EXEMPLO = [
  { id: 'a1', nome: 'Agro Center',       chamada: 'Linha completa de tratores com condições especiais', cidade: 'Nova Xavantina — MT', distanciaKm: 12, avaliacao: 4.8, totalAval: 120, patrocinado: true,  tom: '#1E4A2C', tomMedio: '#14361F' },
  { id: 'a2', nome: 'Transportes Vale',  chamada: 'Fretes agro para todo o Centro-Oeste',               cidade: 'Água Boa — MT',       distanciaKm: 24, avaliacao: 4.9, totalAval: 86,  patrocinado: false, tom: '#2A4A3A', tomMedio: '#1F3D2B' },
  { id: 'a3', nome: 'Oficina do Campo',  chamada: 'Manutenção especializada em implementos',             cidade: 'Canarana — MT',       distanciaKm: 38, avaliacao: 4.6, totalAval: 54,  patrocinado: false, tom: '#1F4530', tomMedio: '#14361F' },
];

export default function Inicio() {
  const insets = useSafeAreaInsets();
  const [usuario, setUsuario] = useState(null);
  const [situacao, setSituacao] = useState(null);
  const [empresas] = useState(EMPRESAS_EXEMPLO);
  const [erro, setErro] = useState(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await api('/me');
      setUsuario(r?.usuario || null);
      setSituacao(r?.situacao || null);
      const destino = telaDaSituacao(r?.situacao);
      if (destino) { router.replace(destino); return; }
    } catch (e) { if (!tratarErroDeAcesso(e)) setErro(e.message); }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function puxar() { setAtualizando(true); await carregar(); setAtualizando(false); }

  async function abrirAcao(a) {
    // "Preciso" leva pra Buscar (acesso livre).
    // "Ofereço" leva pra Anunciar (exige conta — mas o próprio formulário também valida).
    if (a.verbo === 'Preciso') {
      router.push({ pathname: '/(abas)/buscar', params: { categoria: a.titulo.toLowerCase() } });
      return;
    }
    // Deixa o usuário ver a tela de anunciar; o gate só dispara ao tentar publicar.
    router.push({ pathname: '/(abas)/anunciar', params: { categoria: a.titulo.toLowerCase() } });
  }

  function abrirEmpresa(e) {
    router.push({ pathname: '/empresa/[id]', params: { id: String(e.id) } });
  }

  const nome = primeiroNome(usuario?.nome);

  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <ScrollView refreshControl={<RefreshControl refreshing={atualizando} onRefresh={puxar} tintColor={cor.dourado} />} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={estilos.cabecalho}>
          <Text style={estilos.saudacao}>{saudacao()}{nome ? `, ${nome}` : ''}</Text>
          <Text style={estilos.sublinha}>O que você precisa resolver hoje?</Text>
        </View>
        <AvisoAssinatura s={situacao} aoTocar={() => router.push('/planos')} />
        <GridAcoes aoTocar={abrirAcao} />
        <BannerRotativo empresas={empresas} aoTocar={abrirEmpresa} />
        {erro ? <View style={{ padding: 16 }}><Text style={{ color: cor.erro, fontFamily: fonte.normal, fontSize: 13 }}>{erro}</Text></View> : null}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  saudacao: { fontSize: 24, color: cor.texto, fontFamily: fonte.titulo, marginBottom: 4 },
  sublinha: { fontSize: 13, color: cor.textoSuave, fontFamily: fonte.normal },
});
