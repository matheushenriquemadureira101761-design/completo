import { useCallback, useEffect, useState } from 'react';
import { api, chaveSalva, guardarChave, esquecerChave } from './api.js';
import Entrar from './telas/Entrar.jsx';
import Denuncias from './telas/Denuncias.jsx';
import VisaoGeral from './telas/VisaoGeral.jsx';
import Usuarios from './telas/Usuarios.jsx';
import Anuncios from './telas/Anuncios.jsx';
import { Pedidos, Pagamentos } from './telas/Listas.jsx';

const TELAS = [
  { id: 'denuncias', nome: 'Denúncias' },
  { id: 'geral', nome: 'Visão geral' },
  { id: 'usuarios', nome: 'Usuários' },
  { id: 'anuncios', nome: 'Anúncios' },
  { id: 'pedidos', nome: 'Pedidos de orçamento' },
  { id: 'pagamentos', nome: 'Pagamentos' },
];

const telaDoEndereco = () => {
  const id = window.location.hash.replace('#', '');
  return TELAS.some((t) => t.id === id) ? id : 'denuncias';
};

export default function App() {
  const [chave, setChave] = useState(chaveSalva());
  const [tela, setTela] = useState(telaDoEndereco());
  const [resumo, setResumo] = useState(null);
  const [usuarioAberto, setUsuarioAberto] = useState(null);

  const atualizarResumo = useCallback(async () => {
    try { setResumo(await api('/resumo')); } catch (e) { if (e.status === 401) sair(); }
  }, []);

  useEffect(() => { if (chave) atualizarResumo(); }, [chave, atualizarResumo]);
  useEffect(() => {
    const aoMudar = () => setTela(telaDoEndereco());
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  function entrar(c) { guardarChave(c); setChave(c); }
  function sair() { esquecerChave(); setChave(''); setResumo(null); }
  function irPara(id) { window.location.hash = id; setTela(id); }
  function abrirUsuario(id) { setUsuarioAberto(id); irPara('usuarios'); }

  if (!chave) return <Entrar aoEntrar={entrar} />;

  return (
    <div className="moldura">
      <nav className="lateral" aria-label="Seções do painel">
        <div className="marca">
          <span className="marca-nome">AGROVINC</span>
          <span className="marca-sub">Painel da equipe</span>
        </div>
        <ul>
          {TELAS.map((t) => (
            <li key={t.id}>
              <button type="button" className={tela === t.id ? 'nav ativo' : 'nav'} aria-current={tela === t.id ? 'page' : undefined} onClick={() => irPara(t.id)}>
                {t.nome}
                {t.id === 'denuncias' && resumo?.denunciasAbertas > 0 && <span className="contador" aria-label={`${resumo.denunciasAbertas} anúncios com denúncia`}>{resumo.denunciasAbertas}</span>}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="sair" onClick={sair}>Sair do painel</button>
      </nav>
      <main className="conteudo">
        {tela === 'denuncias' && <Denuncias aoMudar={atualizarResumo} aoAbrirUsuario={abrirUsuario} />}
        {tela === 'geral' && <VisaoGeral resumo={resumo} aoAtualizar={atualizarResumo} />}
        {tela === 'usuarios' && <Usuarios aberto={usuarioAberto} aoAbrir={setUsuarioAberto} aoMudar={atualizarResumo} />}
        {tela === 'anuncios' && <Anuncios aoMudar={atualizarResumo} aoAbrirUsuario={abrirUsuario} />}
        {tela === 'pedidos' && <Pedidos />}
        {tela === 'pagamentos' && <Pagamentos aoAbrirUsuario={abrirUsuario} />}
      </main>
    </div>
  );
}
