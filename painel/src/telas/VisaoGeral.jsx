import { Cabecalho } from './comum.jsx';

const GRUPOS = [
  { titulo: 'Pessoas', itens: [['usuarios', 'cadastros no total'], ['novos7d', 'novos nos últimos 7 dias'], ['emTeste', 'no teste grátis'], ['assinantes', 'com assinatura em dia'], ['suspensos', 'contas suspensas']] },
  { titulo: 'Marketplace', itens: [['anunciosNoAr', 'anúncios no ar'], ['anunciosEmAnalise', 'anúncios fora do ar por denúncia'], ['pedidos7d', 'pedidos de orçamento em 7 dias'], ['fechados30d', 'negócios fechados em 30 dias']] },
  { titulo: 'Dinheiro', itens: [['receitaMes', 'recebidos neste mês']] },
];

export default function VisaoGeral({ resumo, aoAtualizar }) {
  return (
    <section>
      <Cabecalho titulo="Visão geral">
        <button type="button" className="botao leve" onClick={aoAtualizar}>Atualizar</button>
      </Cabecalho>
      {!resumo ? <p className="aviso" role="status">Carregando…</p> : GRUPOS.map((g) => (
        <div key={g.titulo} className="grupo">
          <h2>{g.titulo}</h2>
          <dl className="numeros">
            {g.itens.map(([chave, rotulo]) => (
              <div key={chave} className="numero"><dt>{rotulo}</dt><dd>{resumo[chave]}</dd></div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
