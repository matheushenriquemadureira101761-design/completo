import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

/** Carrega uma lista paginada das rotas da equipe. */
export function useLista(caminho) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try { setDados(await api(caminho)); } catch (e) { setErro(e.message); } finally { setCarregando(false); }
  }, [caminho]);
  useEffect(() => { carregar(); }, [carregar]);
  return { dados, erro, carregando, carregar };
}

export function Paginas({ total, pagina, porPagina, aoMudar }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  return (
    <div className="paginas">
      <button type="button" className="botao leve" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>Anterior</button>
      <span>Página {pagina} de {paginas}</span>
      <button type="button" className="botao leve" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>Próxima</button>
    </div>
  );
}

export function Estado({ erro, carregando, vazio, aoTentar }) {
  if (erro) return <p className="aviso erro" role="alert">{erro} <button type="button" className="botao leve" onClick={aoTentar}>Tentar de novo</button></p>;
  if (carregando) return <p className="aviso" role="status">Carregando…</p>;
  if (vazio) return <p className="aviso">{vazio}</p>;
  return null;
}

export function Cabecalho({ titulo, children }) {
  return (
    <header className="cabecalho">
      <h1>{titulo}</h1>
      {children && <div className="cabecalho-acoes">{children}</div>}
    </header>
  );
}
