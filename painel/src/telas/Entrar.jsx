import { useState } from 'react';
import { api } from '../api.js';

export default function Entrar({ aoEntrar }) {
  const [chave, setChave] = useState('');
  const [erro, setErro] = useState(null);
  const [conferindo, setConferindo] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro(null); setConferindo(true);
    try {
      await api('/resumo', { chave: chave.trim() });
      aoEntrar(chave.trim());
    } catch (err) {
      setErro(err.status === 401 ? 'Chave incorreta. Use a mesma ADMIN_TOKEN do arquivo .env do servidor.' : err.message);
    } finally { setConferindo(false); }
  }

  return (
    <div className="entrar">
      <form className="entrar-caixa" onSubmit={enviar}>
        <span className="marca-nome escuro">AGROVINC</span>
        <h1>Painel da equipe</h1>
        <label htmlFor="chave">Chave da equipe</label>
        <input id="chave" type="password" autoComplete="current-password" value={chave} onChange={(e) => setChave(e.target.value)} required minLength={20} />
        {erro && <p className="aviso erro" role="alert">{erro}</p>}
        <button className="botao principal" type="submit" disabled={conferindo || chave.trim().length < 20}>{conferindo ? 'Conferindo…' : 'Entrar'}</button>
        <p className="nota">A chave fica guardada só nesta aba e some quando você fecha o navegador.</p>
      </form>
    </div>
  );
}
