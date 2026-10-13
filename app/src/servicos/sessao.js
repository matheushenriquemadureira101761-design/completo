import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// A sessão fica guardada de forma segura no celular: a pessoa entra uma vez e o app abre direto.
// Só pede para entrar de novo se desinstalar o app, trocar de celular ou tocar em "Sair".
const CHAVE = 'agrovinc_sessao';

// No celular usa o cofre seguro do sistema. No navegador (só para pré-visualizar), usa o armazenamento do navegador.
const web = Platform.OS === 'web';
export const obterToken = () => (web ? Promise.resolve(globalThis.localStorage?.getItem(CHAVE) ?? null) : SecureStore.getItemAsync(CHAVE));
export const salvarToken = (t) => (web ? Promise.resolve(globalThis.localStorage?.setItem(CHAVE, t)) : SecureStore.setItemAsync(CHAVE, t));
export const apagarToken = () => (web ? Promise.resolve(globalThis.localStorage?.removeItem(CHAVE)) : SecureStore.deleteItemAsync(CHAVE));

// Dados do formulário de entrada, guardados enquanto a pessoa confirma o código (só na memória).
let rascunho = {};
export const guardarRascunho = (d) => { rascunho = { ...d }; };
export const lerRascunho = () => rascunho;
export const limparRascunho = () => { rascunho = {}; };

// Marca que o fluxo de código em andamento é recuperação de senha, não cadastro.
let recuperacao = null;
export const guardarRecuperacao = (d) => { recuperacao = { ...d }; };
export const lerRecuperacao = () => recuperacao;
export const limparRecuperacao = () => { recuperacao = null; };

// Modo visitante: pessoa pode navegar sem ter conta. Só pede login quando for interagir.
const CHAVE_VISITANTE = 'agrovinc_visitante';
export const ehVisitante = () => (web ? Promise.resolve(globalThis.localStorage?.getItem(CHAVE_VISITANTE) === '1') : SecureStore.getItemAsync(CHAVE_VISITANTE).then((v) => v === '1'));
export const entrarComoVisitante = () => (web ? Promise.resolve(globalThis.localStorage?.setItem(CHAVE_VISITANTE, '1')) : SecureStore.setItemAsync(CHAVE_VISITANTE, '1'));
export const sairDoModoVisitante = () => (web ? Promise.resolve(globalThis.localStorage?.removeItem(CHAVE_VISITANTE)) : SecureStore.deleteItemAsync(CHAVE_VISITANTE));
