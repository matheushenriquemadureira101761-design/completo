import { useCallback, useState } from 'react';
import { View, Text, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Tela from '../componentes/Tela';
import { Botao, Mensagem, Texto } from '../componentes/ui';
import { FotoAnuncio } from '../componentes/marketplace';
import { api } from '../servicos/api';
import { tratarErroDeAcesso } from '../servicos/erros';
import { cor, fonte } from '../tema';

export default function MeusAnuncios() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const carregar = useCallback(async () => {
    try { setLista(await api('/anuncios/meus')); } catch (e) { if (!(await tratarErroDeAcesso(e))) setErro(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function mudar(a, status) {
    try { await api(`/anuncios/${a.id}/status`, { metodo: 'PATCH', corpo: { status } }); carregar(); } catch (e) { setErro(e.message); }
  }
  const remover = (a) => Alert.alert('Remover anúncio?', `"${a.titulo}" sai do app e não pode ser recuperado.`, [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => mudar(a, 'removido') },
  ]);

  return (
    <Tela compacto titulo="Meus anúncios" subtitulo={null}>
      <Botao tipo="link" titulo="Voltar" aoTocar={() => router.back()} />
      {erro && <Mensagem>{erro}</Mensagem>}
      {lista === null && <ActivityIndicator color={cor.dourado} />}
      {lista?.length === 0 && (
        <View style={{ gap: 12 }}>
          <Texto centro>Você ainda não tem anúncios.</Texto>
          <Botao titulo="Anunciar agora" aoTocar={() => router.replace('/anunciar')} />
        </View>
      )}
      {lista?.map((a) => (
        <View key={a.id} style={estilos.cartao}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <FotoAnuncio url={a.foto} categoria={a.categoria} largura={72} altura={72} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }} onPress={() => router.push(`/anuncio/${a.id}`)}>{a.titulo}</Text>
              <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{a.preco}{a.unidade} · {a.cidade}</Text>
              <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: a.status === 'ativo' ? cor.ok : cor.dourado }}>
                {a.emAnalise ? 'Em análise pela equipe (ninguém vê)' : a.status === 'ativo' ? 'No ar' : 'Pausado (ninguém vê)'} · {a.pedidos === 1 ? '1 pedido' : `${a.pedidos} pedidos`}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Botao tipo="contorno" titulo="Editar" aoTocar={() => router.push(`/editar-anuncio/${a.id}`)} /></View>
            <View style={{ flex: 1 }}><Botao tipo="contorno" titulo={a.status === 'ativo' ? 'Pausar' : 'Colocar no ar'} aoTocar={() => mudar(a, a.status === 'ativo' ? 'pausado' : 'ativo')} /></View>
          </View>
          <Botao tipo="link" titulo="Remover" aoTocar={() => remover(a)} />
        </View>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: { padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo, gap: 10 },
});
