import { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import Tela from '../../componentes/Tela';
import { Botao, Cartao, Mensagem } from '../../componentes/ui';
import { abrirSuporte } from '../../componentes/Assinar';
import { api } from '../../servicos/api';
import { apagarToken } from '../../servicos/sessao';
import { formatarCelular } from '../../lib/validacao';
import { cor, fonte } from '../../tema';

function Linha({ rotulo, valor }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{rotulo}</Text>
      <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto }}>{valor}</Text>
    </View>
  );
}

export default function Conta() {
  const [me, setMe] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => { api('/me').then(setMe).catch((e) => setErro(e.message)); }, []);

  async function sair() {
    try { await api('/auth/sair', { metodo: 'POST' }); } catch { /* mesmo sem internet, sai deste celular */ }
    await apagarToken();
    router.replace('/entrada');
  }

  function excluir() {
    Alert.alert('Excluir sua conta?', 'Seus dados, anúncios e histórico serão apagados. Isso não pode ser desfeito.\n\nSe você assina pela loja, cancele também a assinatura nas configurações da Google Play ou da App Store.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir conta', style: 'destructive', onPress: async () => {
        try { await api('/me', { metodo: 'DELETE' }); await apagarToken(); router.replace('/entrada'); } catch (e) { setErro(e.message); }
      } },
    ]);
  }

  const u = me?.usuario;
  return (
    <Tela compacto titulo="Minha conta" subtitulo={null}>
      {u && (
        <Cartao>
          <Linha rotulo="Nome" valor={u.nome} />
          <Linha rotulo="WhatsApp" valor={formatarCelular(u.whatsapp.slice(2))} />
          <Linha rotulo="Cidade" valor={`${u.cidade} - ${u.uf}`} />
        </Cartao>
      )}
      {u && !u.temSenha && (
        <Mensagem tipo="aviso">Dica: cadastre uma senha em "Trocar senha" para entrar sem precisar de código toda vez.</Mensagem>
      )}
      {erro && <Mensagem>{erro}</Mensagem>}
      <Botao tipo="contorno" titulo="Ver planos" aoTocar={() => router.push('/planos')} />
      <Botao tipo="contorno" titulo="Trocar senha" aoTocar={() => router.push('/trocar-senha')} />
      <Botao tipo="contorno" titulo="Meus anúncios" aoTocar={() => router.push('/meus-anuncios')} />
      <Botao tipo="contorno" titulo="Pessoas bloqueadas" aoTocar={() => router.push('/bloqueados')} />
      <Botao tipo="contorno" titulo="Termos de Uso e Privacidade" aoTocar={() => router.push('/termos')} />
      <Botao tipo="contorno" titulo="Falar com o suporte" aoTocar={abrirSuporte} />
      <Botao titulo="Sair deste celular" aoTocar={sair} />
      <Botao tipo="link" titulo="Excluir minha conta" aoTocar={excluir} />
      <Text style={{ fontFamily: fonte.normal, fontSize: 12, color: cor.textoApagado, textAlign: 'center' }}>Versão {Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </Tela>
  );
}
