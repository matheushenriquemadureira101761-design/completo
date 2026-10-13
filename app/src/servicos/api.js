// Comunicação com o servidor. Para testar no celular, defina EXPO_PUBLIC_API_URL com o IP do computador
// (ex.: EXPO_PUBLIC_API_URL=http://192.168.0.10:3333 no arquivo .env do app).
import { obterToken } from './sessao';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333').replace(/\/$/, '');

// MODO DEMO: liberado para testar o layout sem precisar de backend real.
// Qualquer pessoa consegue cadastrar/entrar. Trocar para false quando o servidor estiver no ar.
const MODO_DEMO = true;

export class ErroApi extends Error {
  constructor(mensagem, status, dados) { super(mensagem); this.status = status; this.dados = dados; }
}

// Traduz mensagens técnicas comuns (em inglês) para algo que o usuário entenda.
function traduzirErro(msg, status) {
  if (!msg) return 'Algo deu errado. Tente de novo em alguns instantes.';
  const t = String(msg).toLowerCase();
  if (t.includes('network request failed') || t.includes('failed to fetch') || t.includes('load failed')) return 'Sem conexão com o servidor. Verifique sua internet.';
  if (t.includes('timeout') || t.includes('aborted')) return 'A conexão demorou demais. Tente de novo.';
  if (t.includes('unauthorized') || status === 401) return 'Sua sessão expirou. Entre de novo.';
  if (t.includes('forbidden') || status === 403) return 'Você não tem permissão para isso.';
  if (t.includes('not found') || status === 404) return 'O que você procurou não foi encontrado.';
  if (t.includes('too many') || status === 429) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  if (status >= 500) return 'Nosso servidor está com problemas. Tente de novo em alguns instantes.';
  // Já é uma mensagem em português do próprio backend: usa como veio.
  return msg;
}

// Simula respostas do servidor no próprio navegador (só para teste de layout).
function respostaDemo(caminho, corpo) {
  if (caminho === '/auth/codigo') return { canal: corpo?.canal || 'whatsapp', digitos: 6, esperaSeg: 0 };
  if (caminho === '/auth/verificar') return { passe: 'demo-passe' };
  if (caminho === '/auth/concluir') return { token: 'demo-token', novo: true };
  if (caminho === '/auth/senha') return { token: 'demo-token' };
  if (caminho === '/auth/dica') return { dica: null };
  if (caminho === '/auth/sair') return { ok: true };
  if (caminho === '/me/senha') return { ok: true };
  if (caminho === '/me') return { usuario: { nome: 'Visitante', whatsapp: '5566999999999', cidade: 'Nova Xavantina', uf: 'MT', temSenha: false }, situacao: { estado: 'teste', diasRestantes: 7 } };
  if (caminho.startsWith('/empresas/')) return { empresa: null };
  if (caminho.startsWith('/anuncios')) return { itens: [], total: 0 };
  if (caminho.startsWith('/assinatura')) return { status: 'teste', diasRestantes: 7 };
  return { ok: true };
}

export async function api(caminho, { metodo = 'GET', corpo, autenticado = true } = {}) {
  if (MODO_DEMO) {
    await new Promise((r) => setTimeout(r, 200));
    return respostaDemo(caminho, corpo);
  }
  const token = autenticado ? await obterToken() : null;
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), 20000);
  let r;
  try {
    r = await fetch(API_URL + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
  } catch (err) {
    throw new ErroApi(traduzirErro(err?.message, 0), 0);
  } finally {
    clearTimeout(tempo);
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroApi(traduzirErro(dados.erro, r.status), r.status, dados);
  return dados;
}
