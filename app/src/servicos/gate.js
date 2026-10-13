import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { obterToken, sairDoModoVisitante } from './sessao';

/**
 * Garante que a pessoa está logada antes de executar uma ação (publicar, mandar mensagem, etc).
 * Se estiver como visitante, pede confirmação e leva pra tela de cadastro.
 * Retorna true se pode seguir, false se foi redirecionada.
 */
export async function exigirConta(acao = 'continuar') {
  const token = await obterToken();
  if (token) return true;

  const titulo = 'Para ' + acao + ' é preciso ter conta';
  const mensagem = 'Crie uma conta rápida pelo WhatsApp — leva menos de 1 minuto.';

  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && window.confirm(`${titulo}\n\n${mensagem}`);
    if (ok) { await sairDoModoVisitante(); router.push('/entrada'); }
    return false;
  }
  return new Promise((resolve) => {
    Alert.alert(titulo, mensagem, [
      { text: 'Agora não', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Criar conta', onPress: async () => { await sairDoModoVisitante(); router.push('/entrada'); resolve(false); } },
    ]);
  });
}
