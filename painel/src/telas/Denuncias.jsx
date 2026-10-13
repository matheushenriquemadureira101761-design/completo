import { useEffect, useState } from 'react';
import { api, dataHoraBR } from '../api.js';
import { Cabecalho, Estado, useLista } from './comum.jsx';

const PRAZO_H = 24;

/** Tempo que falta para responder (o app promete análise em até 24 horas da primeira denúncia). */
function prazo(primeira, agora) {
  const passou = (agora - new Date(primeira).getTime()) / 3600000;
  const resta = PRAZO_H - passou;
  const fracao = Math.min(1, Math.max(0, passou / PRAZO_H));
  if (resta <= 0) return { texto: `Prazo estourado há ${Math.floor(-resta)} h`, nivel: 'estourado', fracao: 1 };
  const h = Math.floor(resta);
  const m = Math.floor((resta - h) * 60);
  return { texto: `Faltam ${h} h ${String(m).padStart(2, '0')} min`, nivel: resta <= 6 ? 'apertado' : 'ok', fracao };
}

function Denuncia({ d, agora, aoResolver, aoAbrirUsuario }) {
  const [salvando, setSalvando] = useState(null);
  const [erro, setErro] = useState(null);
  const p = prazo(d.primeira, agora);

  async function resolver(corpo, pergunta, rotulo) {
    if (pergunta && !window.confirm(pergunta)) return;
    setSalvando(rotulo); setErro(null);
    try { await api(`/denuncias/${d.anuncio_id}/resolver`, { metodo: 'POST', corpo }); aoResolver(); } catch (e) { setErro(e.message); setSalvando(null); }
  }

  return (
    <article className={`denuncia ${p.nivel}`} aria-labelledby={`d${d.anuncio_id}`}>
      <div className="prazo" role="img" aria-label={p.texto}>
        <div className="prazo-barra" style={{ width: `${p.fracao * 100}%` }} />
      </div>
      <div className="denuncia-topo">
        <h2 id={`d${d.anuncio_id}`}>{d.titulo}</h2>
        <span className="prazo-texto">{p.texto}</span>
      </div>
      <p className="denuncia-quem">
        Anúncio de <button type="button" className="link" onClick={() => aoAbrirUsuario(d.denunciado_id)}>{d.denunciado}</button>
        {d.suspenso_em ? ' (conta já suspensa)' : ''}. {d.total === 1 ? '1 denúncia' : `${d.total} denúncias`}, a primeira em {dataHoraBR(d.primeira)}.
        {d.em_analise ? ' Fora do ar automaticamente até a decisão.' : ' Continua no ar.'}
      </p>
      <p className="denuncia-motivos">{d.motivos.join('; ')}</p>
      {d.detalhes?.length > 0 && (
        <ul className="denuncia-detalhes">{d.detalhes.map((t, i) => <li key={i}>“{t}”</li>)}</ul>
      )}
      {erro && <p className="aviso erro" role="alert">{erro}</p>}
      <div className="acoes">
        <button type="button" className="botao leve" disabled={!!salvando} onClick={() => resolver({ decisao: 'improcedente' }, null, 'manter')}>
          {salvando === 'manter' ? 'Salvando…' : 'Manter anúncio'}
        </button>
        <button type="button" className="botao perigo" disabled={!!salvando} onClick={() => resolver({ decisao: 'procedente', acao: 'remover_anuncio' }, `Remover "${d.titulo}"? O anúncio sai do app de vez.`, 'remover')}>
          {salvando === 'remover' ? 'Removendo…' : 'Remover anúncio'}
        </button>
        <button type="button" className="botao perigo forte" disabled={!!salvando} onClick={() => resolver({ decisao: 'procedente', acao: 'suspender_usuario' }, `Remover o anúncio e suspender a conta de ${d.denunciado}? A pessoa sai do app e todos os anúncios dela saem do ar.`, 'suspender')}>
          {salvando === 'suspender' ? 'Suspendendo…' : 'Remover e suspender conta'}
        </button>
      </div>
    </article>
  );
}

export default function Denuncias({ aoMudar, aoAbrirUsuario }) {
  const { dados, erro, carregando, carregar } = useLista('/denuncias');
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 60000); return () => clearInterval(t); }, []);
  const lista = [...(dados ?? [])].sort((a, b) => new Date(a.primeira) - new Date(b.primeira));

  return (
    <section>
      <Cabecalho titulo="Denúncias">
        <button type="button" className="botao leve" onClick={() => { carregar(); aoMudar(); }}>Atualizar</button>
      </Cabecalho>
      <p className="explica">O app promete analisar cada denúncia em até {PRAZO_H} horas. As mais antigas aparecem primeiro. Três denúncias de pessoas diferentes tiram o anúncio do ar sozinhas até a decisão.</p>
      <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !lista.length ? 'Nenhuma denúncia esperando análise.' : null} aoTentar={carregar} />
      <div className="fila">
        {lista.map((d) => <Denuncia key={d.anuncio_id} d={d} agora={agora} aoResolver={() => { carregar(); aoMudar(); }} aoAbrirUsuario={aoAbrirUsuario} />)}
      </div>
    </section>
  );
}
