import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Archivo_800ExtraBold } from '@expo-google-fonts/archivo';
import { WorkSans_400Regular, WorkSans_600SemiBold, WorkSans_700Bold } from '@expo-google-fonts/work-sans';
import { cor } from '../tema';
import '../servicos/notificacoes';

// A abertura nativa (símbolo sobre fundo escuro) fica até a foto da abertura carregar (ver app/index.js).
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 350, fade: true });

export default function Layout() {
  const [fontesProntas, erroFontes] = useFonts({ Archivo_800ExtraBold, WorkSans_400Regular, WorkSans_600SemiBold, WorkSans_700Bold });
  const pronto = fontesProntas || Boolean(erroFontes);

  // Segurança: se o app abrir direto em outra tela (link), a abertura nativa some mesmo assim.
  useEffect(() => {
    if (!pronto) return undefined;
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 2500);
    return () => clearTimeout(t);
  }, [pronto]);

  if (!pronto) return null;
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cor.fundo }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
