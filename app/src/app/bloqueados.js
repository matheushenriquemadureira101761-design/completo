import { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Tela from '../componentes/Tela';
import { Botao, Cartao, Mensagem, Texto } from '../componentes/ui';
import { api } from '../servicos/api';
import { tratarErroDeAcesso } from '../servicos/erros';
import { cor, fonte } from '../tema';

export default function Bloqueados() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const carregar = useCallback(async () => {
    try { setLista(await api('/usuarios/bloqueados')); } catch (e) { if (!(await tratarErroDeAcesso(e))) setErro(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));
  const desbloquear = async (u) => { try { await api(`/usuarios/${u.id}/bloqueio`, { metodo: 'DELETE' }); carregar(); } catch (e) { setErro(e.message); } };
  return (
    <Tela compacto titulo="Pessoas bloqueadas" subtitulo={null}>
      <Botao tipo="link" titulo="Voltar" aoTocar={() => router.back()} />
      {erro && <Mensagem>{erro}</Mensagem>}
      {lista === null && <ActivityIndicator color={cor.dourado} />}
      {lista?.length === 0 && <Texto centro>Você não bloqueou ninguém.</Texto>}
      {lista?.map((u) => (
        <Cartao key={u.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{u.nome}</Text>
            <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{u.cidade}</Text>
          </View>
          <View style={{ width: 140 }}><Botao tipo="contorno" titulo="Desbloquear" aoTocar={() => desbloquear(u)} /></View>
        </Cartao>
      ))}
    </Tela>
  );
}
