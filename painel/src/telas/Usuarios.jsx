import { useEffect, useState } from 'react';
import { api, dataBR, diaBR } from '../api.js';
import { Cabecalho, Estado, Paginas, useLista } from './comum.jsx';

const STATUS_ANUNCIO = { ativo: 'No ar', pausado: 'Pausado', removido: 'Removido', 'Em análise': 'Fora do ar por denúncia' };

function Detalhe({ id, aoFechar, aoMudar }) {
  const [u, setU] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const carregar = () => { setErro(null); api(`/usuarios/${id}`).then(setU).catch((e) => setErro(e.message)); };
  useEffect(carregar, [id]);

  async function mudar(acao) {
    const pergunta = acao === 'suspender'
      ? `Suspender a conta de ${u.nome}? A pessoa sai do app e todos os anúncios dela saem do ar.`
      : `Reativar a conta de ${u.nome}? Os anúncios continuam pausados até a própria pessoa colocar no ar.`;
    if (!window.confirm(pergunta)) return;
    setSalvando(true);
    try { await api(`/usuarios/${id}/${acao}`, { metodo: 'POST' }); carregar(); aoMudar(); } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <aside className="detalhe" aria-label="Detalhe do usuário">
      <button type="button" className="botao leve fechar" onClick={aoFechar}>Fechar</button>
      {erro && <p className="aviso erro" role="alert">{erro}</p>}
      {!u ? !erro && <p className="aviso">Carregando…</p> : (
        <>
          <h2>{u.nome}</h2>
          <p className={u.suspenso ? 'situacao suspenso' : 'situacao'}>{u.situacao}</p>
          <dl className="ficha">
            <dt>WhatsApp</dt><dd><a href={`https://wa.me/55${u.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{u.whatsapp}</a></dd>
            <dt>Cidade</dt><dd>{u.cidade}</dd>
            <dt>Perfis</dt><dd>{u.perfis}</dd>
            {u.email && <><dt>E-mail</dt><dd>{u.email}</dd></>}
            <dt>Cadastro</dt><dd>{dataBR(u.criadoEm)}</dd>
            <dt>Assinatura</dt><dd>{u.assinatura ? `${u.assinatura.origem}, ${u.assinatura.metodo}, até ${diaBR(u.assinatura.vencimento)}${u.assinatura.cancelada ? ' (renovação cancelada)' : ''}` : 'Nunca assinou'}</dd>
            <dt>Pedidos</dt><dd>Pediu {u.pedidos.pediu}, recebeu {u.pedidos.recebeu}</dd>
            <dt>Nota</dt><dd>{u.nota == null ? 'Sem avaliações' : `${String(u.nota).replace('.', ',')} de 5 (${u.avaliacoes})`}</dd>
          </dl>
          <div className="acoes">
            {u.suspenso
              ? <button type="button" className="botao principal" disabled={salvando} onClick={() => mudar('reativar')}>Reativar conta</button>
              : <button type="button" className="botao perigo forte" disabled={salvando} onClick={() => mudar('suspender')}>Suspender conta</button>}
          </div>
          <h3>Anúncios ({u.anuncios.length})</h3>
          {u.anuncios.length ? <ul className="lista-simples">{u.anuncios.map((a) => <li key={a.id}>{a.titulo} <span>{a.categoria}, {STATUS_ANUNCIO[a.status] ?? a.status}</span></li>)}</ul> : <p className="nota">Nenhum anúncio.</p>}
          <h3>Pagamentos ({u.pagamentos.length})</h3>
          {u.pagamentos.length ? <ul className="lista-simples">{u.pagamentos.map((p, i) => <li key={i}>{p.valor} em {dataBR(p.pagoEm)} <span>{p.origem}, {p.metodo}, cobre até {diaBR(p.venceEm)}</span></li>)}</ul> : <p className="nota">Nenhum pagamento.</p>}
          <h3>Denúncias recebidas ({u.denuncias.length})</h3>
          {u.denuncias.length ? <ul className="lista-simples">{u.denuncias.map((d, i) => <li key={i}>{d.motivo} <span>{d.titulo}, {dataBR(d.criadoEm)}, {d.status}{d.detalhe ? `: “${d.detalhe}”` : ''}</span></li>)}</ul> : <p className="nota">Nenhuma denúncia.</p>}
        </>
      )}
    </aside>
  );
}

export default function Usuarios({ aberto, aoAbrir, aoMudar }) {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [pagina, setPagina] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setTermo(busca.trim()); setPagina(1); }, 350); return () => clearTimeout(t); }, [busca]);
  const { dados, erro, carregando, carregar } = useLista(`/usuarios?q=${encodeURIComponent(termo)}&pagina=${pagina}`);

  return (
    <section className={aberto ? 'com-detalhe' : ''}>
      <div>
        <Cabecalho titulo="Usuários">
          <input type="search" className="busca" placeholder="Nome, cidade ou número" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar usuário" />
        </Cabecalho>
        {dados && <p className="explica">{dados.total === 1 ? '1 pessoa' : `${dados.total} pessoas`}{termo ? ` para “${termo}”` : ''}.</p>}
        <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !dados.itens.length ? 'Ninguém encontrado. Tente outra parte do nome ou do número.' : null} aoTentar={carregar} />
        {dados?.itens.length > 0 && (
          <div className="tabela-rolagem">
            <table>
              <thead><tr><th>Nome</th><th>WhatsApp</th><th>Cidade</th><th>Perfis</th><th>Situação</th><th>Anúncios</th><th>Cadastro</th></tr></thead>
              <tbody>
                {dados.itens.map((u) => (
                  <tr key={u.id} className={aberto === u.id ? 'linha-aberta' : ''}>
                    <td><button type="button" className="link" onClick={() => aoAbrir(u.id)}>{u.nome}</button></td>
                    <td className="sem-quebra">{u.whatsapp}</td><td className="sem-quebra">{u.cidade}</td><td className="sem-quebra">{u.perfis}</td>
                    <td className={u.suspenso ? 'texto-perigo' : ''}>{u.situacao}</td>
                    <td className="num">{u.anuncios}</td><td className="sem-quebra">{dataBR(u.criadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dados && <Paginas {...dados} aoMudar={setPagina} />}
      </div>
      {aberto && <Detalhe key={aberto} id={aberto} aoFechar={() => aoAbrir(null)} aoMudar={() => { carregar(); aoMudar(); }} />}
    </section>
  );
}
