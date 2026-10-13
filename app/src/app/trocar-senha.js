import { useState } from 'react';
import { router } from 'expo-router';
import Tela from '../componentes/Tela';
import { Botao, Campo, Mensagem, Texto } from '../componentes/ui';
import { api } from '../servicos/api';

export default function TrocarSenha() {
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [dica, setDica] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(false);

  const erroSenha = senha && senha.length < 6 ? 'A senha precisa ter pelo menos 6 caracteres.' : null;
  const erroConfirmar = confirmar && confirmar !== senha ? 'As senhas não são iguais.' : null;
  const podeSalvar = senha.length >= 6 && confirmar === senha && !erroSenha;

  async function salvar() {
    setErro(null); setSalvando(true);
    try {
      await api('/me/senha', { metodo: 'POST', corpo: { senha, dica: dica.trim() || undefined } });
      setOk(true);
      setTimeout(() => router.back(), 1500);
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <Tela compacto titulo="Trocar senha" subtitulo={null}>
      <Texto>Escolha uma nova senha. Você não precisa saber a antiga.</Texto>

      <Campo rotulo="Nova senha" placeholder="Pelo menos 6 caracteres" secureTextEntry autoComplete="new-password" textContentType="newPassword"
        value={senha} onChangeText={setSenha} estado={erroSenha ? 'erro' : null} erro={erroSenha} />

      <Campo rotulo="Confirmar nova senha" placeholder="Digite a senha de novo" secureTextEntry autoComplete="new-password"
        value={confirmar} onChangeText={setConfirmar} estado={erroConfirmar ? 'erro' : confirmar && !erroConfirmar ? 'ok' : null} erro={erroConfirmar} />

      <Campo rotulo="Dica da senha (opcional)" placeholder="Ex.: 2020 e o resto" value={dica} onChangeText={setDica} />
      <Texto suave style={{ fontSize: 13, lineHeight: 19, marginTop: -8 }}>Essa dica aparece pra você na tela de entrar. Escreva algo que só você entende.</Texto>

      {erro && <Mensagem>{erro}</Mensagem>}
      {ok && <Mensagem tipo="ok">Senha salva!</Mensagem>}
      <Botao titulo="Salvar nova senha" aoTocar={salvar} desligado={!podeSalvar} carregando={salvando} />
      <Botao tipo="link" titulo="Cancelar" aoTocar={() => router.back()} />
    </Tela>
  );
}
