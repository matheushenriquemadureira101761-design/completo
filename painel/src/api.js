// Chamadas às rotas da equipe. A chave fica só nesta aba do navegador (sessionStorage) e some ao fechar.
const CHAVE = 'agrovinc-chave-equipe';
export const chaveSalva = () => sessionStorage.getItem(CHAVE) || '';
export const guardarChave = (c) => sessionStorage.setItem(CHAVE, c);
export const esquecerChave = () => sessionStorage.removeItem(CHAVE);

export class ErroPainel extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

export async function api(caminho, { metodo = 'GET', corpo, chave = chaveSalva() } = {}) {
  let r;
  try {
    r = await fetch(`/admin${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': chave },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroPainel('Sem conexão com o servidor. Confira a internet e tente de novo.', 0);
  }
  const dados = await r.json().catch(() => ({}));
  if (r.status === 404 && dados.codigo === 'nao_encontrado' && caminho === '/resumo') throw new ErroPainel('Chave da equipe incorreta.', 401);
  if (!r.ok) throw new ErroPainel(dados.erro || 'Algo deu errado. Tente de novo.', r.status);
  return dados;
}

export const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
export const dataHoraBR = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
export const diaBR = (d) => (d ? d.split('-').reverse().join('/') : '');
