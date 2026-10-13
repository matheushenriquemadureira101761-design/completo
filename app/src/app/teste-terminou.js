import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import Tela from '../componentes/Tela';
import { Botao, Titulo, Texto } from '../componentes/ui';
import { BlocoAssinar, PorQuePaga, ResumoRegras, abrirSuporte } from '../componentes/Assinar';
import { api } from '../servicos/api';
import { telaDaSituacao } from '../servicos/rota';
import { useAoVoltarProApp, dataCurta } from '../servicos/ganchos';
import { cor } from '../tema';

export default function TesteTerminou() {
  const [situacao, setSituacao] = useState(null);
  // Se a pessoa pagou (no app ou pelo link do WhatsApp) e voltou, libera na hora.
  const conferir = useCallback(async () => {
    try {
      const me = await api('/me');
      setSituacao(me.situacao);
      if (me.situacao.acesso) router.replace(telaDaSituacao(me.situacao));
    } catch { /* sem internet: mantém a tela */ }
  }, []);
  useEffect(() => { conferir(); }, [conferir]);
  useAoVoltarProApp(conferir);

  const fim = situacao?.desde ? dataCurta(new Date(Date.parse(situacao.desde) - 86400000).toISOString().slice(0, 10)) : '';
  return (
    <Tela>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: cor.dourado, backgroundColor: '#2A1A12', alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={cor.dourado} strokeWidth={2.2}><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5l3 2" /></Svg>
        </View>
        <Titulo>Seu teste grátis terminou</Titulo>
        <Texto centro>{fim ? `Os 7 dias de teste acabaram em ${fim}. ` : ''}Para continuar usando a AGROVINC, é só assinar. O acesso volta na hora.</Texto>
      </View>
      <BlocoAssinar valor={situacao?.valor} />
      <PorQuePaga />
      <ResumoRegras valor={situacao?.valor} />
      <Botao tipo="contorno" titulo="Ler os Termos de Uso completos" aoTocar={() => router.push('/termos')} />
      <Botao tipo="link" titulo="Precisa de ajuda? Falar com o suporte" aoTocar={abrirSuporte} />
    </Tela>
  );
}
