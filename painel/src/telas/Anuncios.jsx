import { useEffect, useState } from 'react';
import { api, dataBR } from '../api.js';
import { Cabecalho, Estado, Paginas, useLista } from './comum.jsx';

const FILTROS = [['', 'Todos (menos removidos)'], ['ativo', 'No ar'], ['em_analise', 'Fora do ar por denúncia'], ['pausado', 'Pausados'], ['removido', 'Removidos']];
const NOME_STATUS = { ativo: 'No ar', em_analise: 'Fora do ar por denúncia', pausado: 'Pausado', removido: 'Removido' };

export default function Anuncios({ aoMudar, aoAbrirUsuario }) {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const [erroAcao, setErroAcao] = useState(null);
  useEffect(() => { const t = setTimeout(() => { setTermo(busca.trim()); setPagina(1); }, 350); return () => clearTimeout(t); }, [busca]);
  const { dados, erro, carregando, carregar } = useLista(`/anuncios?q=${encodeURIComponent(termo)}&status=${status}&pagina=${pagina}`);

  async function remover(a) {
    if (!window.confirm(`Remover "${a.titulo}"? O anúncio sai do app de vez e as denúncias abertas dele são encerradas.`)) return;
    setErroAcao(null);
    try { await api(`/anuncios/${a.id}/remover`, { metodo: 'POST' }); carregar(); aoMudar(); } catch (e) { setErroAcao(e.message); }
  }

  return (
    <section>
      <Cabecalho titulo="Anúncios">
        <input type="search" className="busca" placeholder="Título, fornecedor ou cidade" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar anúncio" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPagina(1); }} aria-label="Situação do anúncio">
          {FILTROS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      </Cabecalho>
      {erroAcao && <p className="aviso erro" role="alert">{erroAcao}</p>}
      <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !dados.itens.length ? 'Nenhum anúncio com esse filtro.' : null} aoTentar={carregar} />
      {dados?.itens.length > 0 && (
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Anúncio</th><th>Fornecedor</th><th>Cidade</th><th>Preço</th><th>Situação</th><th>Pedidos</th><th>Denúncias</th><th>Criado</th><th><span className="oculto">Ações</span></th></tr></thead>
            <tbody>
              {dados.itens.map((a) => (
                <tr key={a.id}>
                  <td>{a.titulo}<span className="sub">{a.categoria}</span></td>
                  <td><button type="button" className="link" onClick={() => aoAbrirUsuario(a.fornecedorId)}>{a.fornecedor}</button></td>
                  <td className="sem-quebra">{a.cidade}</td><td className="sem-quebra">{a.preco}</td>
                  <td className={a.status === 'em_analise' ? 'texto-alerta' : ''}>{NOME_STATUS[a.status]}</td>
                  <td className="num">{a.pedidos}</td>
                  <td className={a.denuncias ? 'num texto-alerta' : 'num'}>{a.denuncias}</td>
                  <td className="sem-quebra">{dataBR(a.criadoEm)}</td>
                  <td>{a.status !== 'removido' && <button type="button" className="botao perigo pequeno" onClick={() => remover(a)}>Remover</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dados && <Paginas {...dados} aoMudar={setPagina} />}
    </section>
  );
}
