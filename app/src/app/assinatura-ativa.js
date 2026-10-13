import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Tela from '../componentes/Tela';
import { Botao, Cartao, Nota, Titulo, Texto } from '../componentes/ui';
import { api } from '../servicos/api';
import { cor, fonte } from '../tema';

const dataBR = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

export default function AssinaturaAtiva() {
  const [me, setMe] = useState(null);
  useEffect(() => { api('/me').then(setMe).catch(() => {}); }, []);
  const s = me?.situacao;
  return (
    <Tela>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: cor.ok, backgroundColor: cor.aviso, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={cor.ok} strokeWidth={3}><Path d="M20 6L9 17l-5-5" /></Svg>
        </View>
        <Titulo>Assinatura ativa!</Titulo>
        <Texto centro>{me ? `Obrigado, ${me.usuario.primeiroNome}. ` : ''}Sua assinatura de R$ {s?.valor ?? '29,90'} por mês está ativa e o app já está liberado.</Texto>
      </View>
      {s?.vencimento && (
        <Cartao>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}>Próxima renovação</Text>
            <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{dataBR(s.vencimento)}</Text>
          </View>
        </Cartao>
      )}
      {s?.origem?.startsWith('loja') && <Nota>Para cancelar ou trocar o cartão, use a área de Assinaturas da Google Play ou da App Store.</Nota>}
      <Botao titulo="Continuar usando" aoTocar={() => router.replace('/inicio')} />
    </Tela>
  );
}
