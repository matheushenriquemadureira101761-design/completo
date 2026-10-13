import { router } from 'expo-router';
import { apagarToken } from './sessao';

/** Trata os erros que mudam de tela: sessão encerrada ou acesso pausado. Devolve true se tratou. */
export async function tratarErroDeAcesso(e) {
  if (e?.status === 401) { await apagarToken(); router.replace('/entrada'); return true; }
  if (e?.dados?.codigo === 'conta_suspensa') { await apagarToken(); router.replace('/conta-suspensa'); return true; }
  if (e?.dados?.codigo === 'acesso_pausado') { router.replace(e.dados.estado === 'pausada' ? '/acesso-pausado' : '/teste-terminou'); return true; }
  return false;
}

export { proximosDias } from '../lib/util';
