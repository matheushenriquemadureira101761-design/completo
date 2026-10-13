import { useState } from 'react';
import { dataBR, dataHoraBR, diaBR } from '../api.js';
import { Cabecalho, Estado, Paginas, useLista } from './comum.jsx';

export function Pedidos() {
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando, carregar } = useLista(`/pedidos?pagina=${pagina}`);
  return (
    <section>
      <Cabecalho titulo="Pedidos de orçamento" />
      <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !dados.itens.length ? 'Nenhum pedido de orçamento ainda.' : null} aoTentar={carregar} />
      {dados?.itens.length > 0 && (
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Anúncio</th><th>Quem pediu</th><th>Fornecedor</th><th>Para quando</th><th>Situação</th><th>Nota</th><th>Pedido em</th></tr></thead>
            <tbody>
              {dados.itens.map((o) => (
                <tr key={o.id}>
                  <td>{o.titulo}</td><td>{o.contratante}</td><td>{o.fornecedor}</td>
                  <td>{o.dataDesejada ? diaBR(o.dataDesejada) : 'Sem data'}</td><td>{o.status}</td>
                  <td className="num">{o.nota ?? ''}</td><td className="sem-quebra">{dataHoraBR(o.criadoEm)}</td>
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

export function Pagamentos({ aoAbrirUsuario }) {
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando, carregar } = useLista(`/pagamentos?pagina=${pagina}`);
  return (
    <section>
      <Cabecalho titulo="Pagamentos" />
      <Estado erro={erro} carregando={carregando && !dados} vazio={dados && !dados.itens.length ? 'Nenhum pagamento recebido ainda.' : null} aoTentar={carregar} />
      {dados?.itens.length > 0 && (
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Pessoa</th><th>Valor</th><th>Por onde</th><th>Forma</th><th>Pago em</th><th>Cobre até</th></tr></thead>
            <tbody>
              {dados.itens.map((p) => (
                <tr key={p.id}>
                  <td><button type="button" className="link" onClick={() => aoAbrirUsuario(p.usuarioId)}>{p.nome}</button></td>
                  <td className="num">{p.valor}</td><td>{p.origem}</td><td>{p.metodo}</td><td className="sem-quebra">{dataBR(p.pagoEm)}</td><td className="sem-quebra">{diaBR(p.venceEm)}</td>
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
