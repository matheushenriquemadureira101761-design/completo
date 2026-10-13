import { useCallback, useEffect, useState } from 'react';
import { View, Text, Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import Svg, { Rect, Path } from 'react-native-svg';
import Tela from '../componentes/Tela';
import { Botao, Cartao, Nota, Titulo, Texto } from '../componentes/ui';
import { BlocoAssinar, abrirSuporte } from '../componentes/Assinar';
import { api } from '../servicos/api';
import { telaDaSituacao } from '../servicos/rota';
import { useAoVoltarProApp, dataCurta } from '../servicos/ganchos';
import { PRODUTO_ID } from '../servicos/loja';
import { cor, fonte } from '../tema';

const LOJA_ASSINATURAS = Platform.OS === 'ios'
  ? 'https://apps.apple.com/account/subscriptions'
  : `https://play.google.com/store/account/subscriptions?package=br.com.agrovinc.app&sku=${PRODUTO_ID}`;

export default function AcessoPausado() {
  const [s, setS] = useState(null);
  const conferir = useCallback(async () => {
    try {
      const me = await api('/me');
      setS(me.situacao);
      if (me.situacao.acesso) router.replace(telaDaSituacao(me.situacao));
    } catch { /* mantém a tela */ }
  }, []);
  useEffect(() => { conferir(); }, [conferir]);
  useAoVoltarProApp(conferir);

  return (
    <Tela>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: cor.dourado, backgroundColor: '#2A1A12', alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={cor.dourado} strokeWidth={2.2}><Rect x="4" y="11" width="16" height="10" rx="2" /><Path d="M8 11V7a4 4 0 018 0v4" /></Svg>
        </View>
        <Titulo>Seu acesso está pausado</Titulo>
        <Texto centro>A sua assinatura venceu{s?.diasDeAtraso ? ` há ${s.diasDeAtraso} dias` : ''}. Assine para voltar a usar na hora.</Texto>
      </View>
      {s && (
        <Cartao>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}>Assinatura</Text>
            <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>R$ {s.valor} por mês</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}>Venceu em</Text>
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.erro }}>{dataCurta(s.vencimento)}</Text>
          </View>
        </Cartao>
      )}
      <BlocoAssinar valor={s?.valor} />
      {s?.origem?.startsWith('loja') && (
        <Botao tipo="link" titulo="O cartão da loja falhou? Atualizar a forma de pagamento" aoTocar={() => Linking.openURL(LOJA_ASSINATURAS)} />
      )}
      <Nota>Seus anúncios, contatos e histórico continuam guardados. Nada é apagado.</Nota>
      <Botao tipo="link" titulo="Precisa de ajuda? Falar com o suporte" aoTocar={abrirSuporte} />
    </Tela>
  );
}
