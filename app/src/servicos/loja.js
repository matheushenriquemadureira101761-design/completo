// Assinatura pela loja (Google Play / App Store) — R$ 29,90 por mês, mesmo valor do site.
//
// Compra de verdade: biblioteca expo-iap (precisa de versão de desenvolvimento ou da loja; não funciona no Expo Go).
// Ordem segura: a loja cobra → o servidor confere direto com a loja → só então a compra é finalizada no celular.
// Se algo falhar no meio, a compra fica pendente na loja e "Restaurar compra" termina o processo.
//
// Simulação: EXPO_PUBLIC_LOJA_SIMULADA=1, ou no Expo Go durante o desenvolvimento (servidor em MODO_TESTE).
import { Alert, Platform } from 'react-native';
import { api } from './api';

export const PRODUTO_ID = 'agrovinc_assinatura_mensal';
const FORCAR_SIMULACAO = process.env.EXPO_PUBLIC_LOJA_SIMULADA === '1';

function bibliotecaDaLoja() {
  if (FORCAR_SIMULACAO) return null;
  try {
    // eslint-disable-next-line global-require
    return require('expo-iap');
  } catch {
    return null; // Expo Go: o módulo nativo não existe
  }
}

function janelaSimulada() {
  return new Promise((resolve) => {
    Alert.alert(
      'Janela da loja (simulação)',
      'AGROVINC · Assinatura mensal\nR$ 29,90/mês\n\nRenova todo mês. Cancele quando quiser nas configurações da loja.',
      [{ text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) }, { text: 'Assinar', onPress: () => resolve(true) }],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

const plataforma = () => (Platform.OS === 'ios' ? 'ios' : 'android');
// Android: purchaseToken. iPhone: transactionId (o servidor consulta a Apple com ele).
const tokenDaCompra = (c) => (Platform.OS === 'ios' ? (c.transactionId ?? c.id) : (c.purchaseToken ?? c.purchaseTokenAndroid));

async function confirmarEFinalizar(iap, compra) {
  const token = tokenDaCompra(compra);
  if (!token) throw new Error('A loja não devolveu os dados da compra. Toque em "Restaurar compra".');
  const r = await api('/assinatura/loja', { metodo: 'POST', corpo: { plataforma: plataforma(), tokenCompra: token } });
  await iap.finishTransaction({ purchase: compra, isConsumable: false });
  return r.situacao;
}

function esperarCompra(iap, request) {
  return new Promise((resolve, reject) => {
    let terminou = false;
    let ok = null;
    let falha = null;
    const fim = (fn, valor) => { if (terminou) return; terminou = true; ok?.remove(); falha?.remove(); fn(valor); };
    ok = iap.purchaseUpdatedListener((compra) => { if (compra.productId === PRODUTO_ID) fim(resolve, compra); });
    falha = iap.purchaseErrorListener((e) => {
      if (iap.isUserCancelledError(e)) fim(resolve, null);
      else fim(reject, new Error('A loja não concluiu a compra. Confira a forma de pagamento da sua conta e tente de novo.'));
    });
    iap.requestPurchase({ request, type: 'subs' }).catch((e) => {
      if (iap.isUserCancelledError(e)) fim(resolve, null);
      else fim(reject, new Error('Não conseguimos abrir a loja agora. Tente de novo em instantes.'));
    });
  });
}

/** Abre a compra. Devolve a nova situação, ou null se a pessoa cancelou. */
export async function assinarPelaLoja() {
  const iap = bibliotecaDaLoja();
  if (!iap) {
    if (!__DEV__ && !FORCAR_SIMULACAO) throw new Error('A assinatura pela loja não está disponível nesta versão do app.');
    if (!(await janelaSimulada())) return null;
    const r = await api('/assinatura/loja', { metodo: 'POST', corpo: { plataforma: plataforma(), tokenCompra: `teste_${Date.now()}` } });
    return r.situacao;
  }
  await iap.initConnection();
  try {
    const produtos = await iap.fetchProducts({ skus: [PRODUTO_ID], type: 'subs' });
    const produto = (produtos ?? []).find((p) => p.id === PRODUTO_ID);
    if (!produto) throw new Error('A assinatura não está disponível na loja agora. Tente de novo mais tarde.');
    const request = Platform.OS === 'ios'
      ? { apple: { sku: PRODUTO_ID } }
      : { google: { skus: [PRODUTO_ID], subscriptionOffers: (produto.subscriptionOffers ?? []).filter((o) => o.offerTokenAndroid).slice(0, 1).map((o) => ({ sku: PRODUTO_ID, offerToken: o.offerTokenAndroid })) } };
    const compra = await esperarCompra(iap, request);
    if (!compra) return null;
    if (compra.purchaseState === 'pending') throw new Error('O pagamento ficou pendente na loja. Assim que for aprovado, toque em "Restaurar compra".');
    return await confirmarEFinalizar(iap, compra);
  } finally {
    iap.endConnection().catch(() => {});
  }
}

/** Exigência da Apple: recuperar a assinatura (celular novo, app reinstalado ou compra que ficou pela metade). */
export async function restaurarCompra() {
  const iap = bibliotecaDaLoja();
  if (!iap) throw new Error('Restaurar compra funciona só no app instalado pela loja.');
  await iap.initConnection();
  try {
    await iap.restorePurchases().catch(() => {});
    const compras = (await iap.getAvailablePurchases()) ?? [];
    const daAssinatura = compras.filter((c) => c.productId === PRODUTO_ID && c.purchaseState !== 'pending')
      .sort((a, b) => (b.transactionDate ?? 0) - (a.transactionDate ?? 0));
    if (!daAssinatura.length) return null;
    return await confirmarEFinalizar(iap, daAssinatura[0]);
  } finally {
    iap.endConnection().catch(() => {});
  }
}
