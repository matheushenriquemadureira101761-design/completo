import { useCallback, useState } from 'react';
import { View, Text, FlatList, Linking, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao, Escolha, Mensagem } from '../../componentes/ui';
import { IconeWhatsApp } from '../../componentes/icones';
import { Estrelas } from '../../componentes/marketplace';
import { api } from '../../servicos/api';
import { tratarErroDeAcesso } from '../../servicos/erros';
import { cor, fonte } from '../../tema';

const COR_STATUS = { enviado: cor.dourado, respondido: cor.ok, fechado: cor.ok, recusado: cor.erro, cancelado: cor.textoApagado };

function Pedido({ o, papel, aoMudar }) {
  const [salvando, setSalvando] = useState(false);
  const mudar = async (status) => { setSalvando(true); try { await api(`/orcamentos/${o.id}`, { metodo: 'PATCH', corpo: { status } }); aoMudar(); } finally { setSalvando(false); } };
  return (
    <View style={estilos.cartao}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ flex: 1, fontFamily: fonte.forte, fontSize: 15, color: cor.texto }} onPress={() => router.push(`/anuncio/${o.anuncioId}`)}>{o.titulo}</Text>
        <Text style={{ fontFamily: fonte.forte, fontSize: 12, color: COR_STATUS[o.status] }}>{o.statusNome}</Text>
      </View>
      <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{papel === 'recebidos' ? `Pedido de ${o.outroNome}` : `Para ${o.outroNome}`} · {o.quando}</Text>
      {o.mensagem ? <Text style={{ fontFamily: fonte.normal, fontSize: 14, lineHeight: 20, color: cor.textoSuave }}>"{o.mensagem}"</Text> : null}
      {papel === 'recebidos' && o.status === 'enviado' && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Botao titulo="Chamar no WhatsApp" aoTocar={() => { Linking.openURL(o.whatsapp); mudar('respondido'); }} />
          <Botao tipo="link" titulo="Não posso atender" aoTocar={() => mudar('recusado')} carregando={salvando} />
        </View>
      )}
      {papel === 'recebidos' && o.status === 'respondido' && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <View style={{ flex: 1 }}><Botao tipo="contorno" titulo="WhatsApp" aoTocar={() => Linking.openURL(o.whatsapp)} /></View>
          <View style={{ flex: 1 }}><Botao titulo="Negócio fechado" aoTocar={() => mudar('fechado')} carregando={salvando} /></View>
        </View>
      )}
      {papel === 'enviados' && o.status === 'enviado' && <Botao tipo="link" titulo="Cancelar pedido" aoTocar={() => mudar('cancelado')} carregando={salvando} />}
      {papel === 'enviados' && o.status === 'respondido' && <Botao tipo="contorno" titulo="Fechei negócio" aoTocar={() => mudar('fechado')} carregando={salvando} />}
      {papel === 'enviados' && o.podeAvaliar && (
        <Botao titulo="Avaliar o fornecedor" aoTocar={() => router.push({ pathname: `/avaliar/${o.id}`, params: { titulo: o.titulo, nome: o.outroNome } })} />
      )}
      {papel === 'enviados' && o.notaDada != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>Sua avaliação:</Text>
          <Estrelas nota={o.notaDada} />
        </View>
      )}
      {papel === 'recebidos' && (
        <Botao tipo="link" titulo="Bloquear esta pessoa" aoTocar={() => router.push({ pathname: `/bloquear/${o.outroId}`, params: { nome: o.outroNome } })} />
      )}
    </View>
  );
}

export default function Pedidos() {
  const insets = useSafeAreaInsets();
  const [papel, setPapel] = useState('enviados');
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async (p = papel) => {
    setErro(null);
    try { setLista(await api(`/orcamentos?papel=${p}`)); } catch (e) { if (!(await tratarErroDeAcesso(e))) setErro(e.message); }
  }, [papel]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));
  const trocar = (p) => { setPapel(p); setLista(null); carregar(p); };

  return (
    <View style={{ flex: 1, backgroundColor: cor.folha, paddingTop: insets.top + 14 }}>
      <View style={{ paddingHorizontal: 18, gap: 12, marginBottom: 12 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 22, color: cor.texto }} accessibilityRole="header">Pedidos de orçamento</Text>
        <Escolha opcoes={[{ valor: 'enviados', rotulo: 'Que eu pedi' }, { valor: 'recebidos', rotulo: 'Que recebi' }]} valor={papel} aoMudar={trocar} />
        {erro && <Mensagem>{erro}</Mensagem>}
      </View>
      <FlatList
        data={lista ?? []}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => <View style={{ paddingHorizontal: 18 }}><Pedido o={item} papel={papel} aoMudar={() => carregar()} /></View>}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={async () => { setAtualizando(true); await carregar(); setAtualizando(false); }} tintColor={cor.dourado} colors={[cor.dourado]} />}
        ListEmptyComponent={lista === null ? <ActivityIndicator color={cor.dourado} style={{ marginTop: 24 }} /> : (
          <View style={{ padding: 24, gap: 8, alignItems: 'center' }}>
            <IconeWhatsApp t={28} />
            <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado, textAlign: 'center', lineHeight: 21 }}>
              {papel === 'enviados' ? 'Você ainda não pediu orçamento. Abra um anúncio e toque em "Pedir orçamento".' : 'Quando alguém pedir orçamento para um anúncio seu, ele aparece aqui e você é avisado no WhatsApp.'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { padding: 14, borderRadius: 16, backgroundColor: cor.campo, borderWidth: 1.5, borderColor: cor.borda, gap: 6 },
});
