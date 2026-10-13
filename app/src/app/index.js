import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Image, Text, Animated, Easing, AccessibilityInfo, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { obterToken, apagarToken, ehVisitante } from '../servicos/sessao';
import { api } from '../servicos/api';
import { telaDaSituacao } from '../servicos/rota';
import { Botao } from '../componentes/ui';
import { fonte } from '../tema';

const TEMPO_MINIMO = 1800;            // a abertura aparece pelo menos esse tempo (ms)
const PROPORCAO_LOGO = 658 / 906;     // altura / largura da imagem logo-abertura.png

/**
 * Abertura do app: a foto da lavoura com a logo e a barra de carregamento embaixo.
 * Enquanto a barra enche, o app confere se a pessoa já entrou antes (sessão salva) e decide a próxima tela.
 */
export default function Abertura() {
  const { width, height } = useWindowDimensions();
  const progresso = useRef(new Animated.Value(0)).current;
  const inicio = useRef(Date.now());
  const semAnimacao = useRef(false);
  const [destino, setDestino] = useState(null);
  const [erro, setErro] = useState(null);

  const decidir = useCallback(async () => {
    setErro(null);
    setDestino(null);
    inicio.current = Date.now();
    progresso.setValue(0);
    Animated.timing(progresso, { toValue: 0.85, duration: semAnimacao.current ? 0 : TEMPO_MINIMO, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const token = await obterToken();
    if (!token) {
      // Sem conta: visitante tem acesso livre à Home; senão, pedimos cadastro.
      const visitante = await ehVisitante();
      setDestino(visitante ? '/(abas)/inicio' : '/boas-vindas');
      return;
    }
    try {
      const me = await api('/me');
      setDestino(telaDaSituacao(me.situacao) || '/(abas)/inicio');
    } catch (e) {
      if (e.status === 401) { await apagarToken(); setDestino('/boas-vindas'); return; }
      progresso.stopAnimation();
      setErro(e.message);
    }
  }, [progresso]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { semAnimacao.current = v; })
      .catch(() => {})
      .finally(decidir);
  }, [decidir]);

  // Já sabe para onde ir: espera o tempo mínimo, completa a barra e segue.
  useEffect(() => {
    if (!destino) return undefined;
    const falta = semAnimacao.current ? 0 : Math.max(0, TEMPO_MINIMO - (Date.now() - inicio.current));
    const t = setTimeout(() => {
      Animated.timing(progresso, { toValue: 1, duration: semAnimacao.current ? 0 : 250, easing: Easing.out(Easing.quad), useNativeDriver: false })
        .start(() => router.replace(destino));
    }, falta);
    return () => clearTimeout(t);
  }, [destino, progresso]);

  const larguraLogo = Math.min(width * 0.84, 520);
  const larguraBarra = Math.min(width * 0.4, 240);

  return (
    <View style={estilos.raiz}>
      <StatusBar style="light" />
      {/* foto com o tamanho exato da tela (cobre tudo, sem distorcer) */}
      <Image
        source={require('../../assets/abertura.jpg')}
        resizeMode="cover"
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
        onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
        accessible={false}
      />
      <Image
        source={require('../../assets/logo-abertura.png')}
        style={{ position: 'absolute', top: height * 0.28, alignSelf: 'center', width: larguraLogo, height: larguraLogo * PROPORCAO_LOGO }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="AGROVINC. Conectando quem faz o Agro acontecer."
      />
      {erro ? (
        <View style={[estilos.erro, { bottom: height * 0.07 }]}>
          <Text style={estilos.erroTexto}>{erro}</Text>
          <Botao titulo="Tentar de novo" aoTocar={decidir} />
        </View>
      ) : (
        <View
          style={[estilos.trilho, { bottom: height * 0.086, width: larguraBarra, left: (width - larguraBarra) / 2 }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Carregando"
        >
          <Animated.View style={[estilos.enchimento, { width: progresso.interpolate({ inputRange: [0, 1], outputRange: [0, larguraBarra] }) }]}>
            <Svg width={larguraBarra} height={5}>
              <Defs>
                <LinearGradient id="barra" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#2E9A46" />
                  <Stop offset="0.55" stopColor="#7CCB3F" />
                  <Stop offset="1" stopColor="#FDB813" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={larguraBarra} height={5} rx={2.5} fill="url(#barra)" />
            </Svg>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#0B1406' },
  trilho: { position: 'absolute', height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  enchimento: { height: 5, borderRadius: 999, overflow: 'hidden' },
  erro: { position: 'absolute', left: 28, right: 28, gap: 12 },
  erroTexto: { fontFamily: fonte.normal, fontSize: 15, color: '#FFFFFF', textAlign: 'center', lineHeight: 22, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
});
