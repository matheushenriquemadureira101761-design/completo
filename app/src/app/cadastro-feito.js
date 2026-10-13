import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Tela from '../componentes/Tela';
import { Botao, Nota, Titulo, Texto } from '../componentes/ui';
import { api } from '../servicos/api';
import { cor, fonte } from '../tema';

export default function CadastroFeito() {
  const [ate, setAte] = useState('');
  useEffect(() => { api('/me').then((me) => setAte(me.usuario.testeFimBR)).catch(() => {}); }, []);
  return (
    <Tela>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: cor.ok, backgroundColor: cor.aviso, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={cor.ok} strokeWidth={3}><Path d="M20 6L9 17l-5-5" /></Svg>
        </View>
        <Titulo>Cadastro feito!</Titulo>
      </View>
      <View style={{ alignItems: 'center', gap: 4, padding: 16, borderRadius: 16, borderWidth: 2, borderColor: cor.dourado, backgroundColor: cor.campo }}>
        <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.dourado }}>Teste grátis de 7 dias</Text>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 22, color: cor.texto }}>{ate ? `Vale até ${ate}` : ' '}</Text>
        <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>Sem cartão e sem cobrança automática.</Text>
      </View>
      <Texto centro>Use à vontade: procure máquinas, fretes e serviços, fale com fornecedores e anuncie o que você oferece.</Texto>
      <Nota>Vamos te avisar antes do teste acabar.</Nota>
      <Botao titulo="Começar a usar" aoTocar={() => router.replace('/inicio')} />
    </Tela>
  );
}
