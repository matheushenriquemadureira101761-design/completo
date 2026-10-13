import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Tela from '../../componentes/Tela';
import { Botao, Mensagem, Texto, Titulo, Cartao } from '../../componentes/ui';
import { api } from '../../servicos/api';
import { tratarErroDeAcesso } from '../../servicos/erros';

export default function Bloquear() {
  const { id, nome } = useLocalSearchParams();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  async function bloquear() {
    setEnviando(true); setErro(null);
    try { await api(`/usuarios/${id}/bloqueio`, { metodo: 'POST' }); router.replace('/inicio'); }
    catch (e) { if (!(await tratarErroDeAcesso(e))) setErro(e.message); } finally { setEnviando(false); }
  }
  return (
    <Tela compacto titulo="Bloquear" subtitulo={null}>
      <Titulo centro={false}>Bloquear {nome}?</Titulo>
      <Cartao>
        <Texto>• Você não vai mais ver os anúncios de {nome}.</Texto>
        <Texto>• {nome} não vai ver os seus anúncios nem poderá pedir orçamento ou falar com você pelo app.</Texto>
        <Texto>• {nome} não é avisado do bloqueio.</Texto>
      </Cartao>
      <Texto suave style={{ fontSize: 14 }}>Dá para desbloquear quando quiser, em Conta → Pessoas bloqueadas. Se for golpe ou algo errado, denuncie o anúncio também: assim a nossa equipe pode agir.</Texto>
      {erro && <Mensagem>{erro}</Mensagem>}
      <View style={{ gap: 6 }}>
        <Botao titulo={`Bloquear ${nome}`} aoTocar={bloquear} carregando={enviando} />
        <Botao tipo="link" titulo="Cancelar" aoTocar={() => router.back()} />
      </View>
    </Tela>
  );
}
