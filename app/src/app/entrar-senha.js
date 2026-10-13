import { useState } from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import Tela from '../componentes/Tela';
import { Botao, Campo, Mensagem, Texto } from '../componentes/ui';
import { api } from '../servicos/api';
import { salvarToken } from '../servicos/sessao';
import { validarCelular, formatarCelular, normalizarCelular } from '../lib/validacao';

export default function EntrarComSenha() {
  const [celular, setCelular] = useState('');
  const [senha, setSenha] = useState('');
  const [dica, setDica] = useState(null);
  const [erro, setErro] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const d = normalizarCelular(celular);
  const erroCel = d.length ? validarCelular(celular) : null;

  async function buscarDica() {
    if (d.length !== 11) return;
    try { const r = await api('/auth/dica', { metodo: 'POST', autenticado: false, corpo: { whatsapp: d } }); setDica(r.dica || null); } catch { setDica(null); }
  }

  async function entrar() {
    setErro(null); setEntrando(true);
    try {
      const r = await api('/auth/senha', { metodo: 'POST', autenticado: false, corpo: { whatsapp: d, senha, plataforma: Platform.OS } });
      await salvarToken(r.token);
      router.replace('/');
    } catch (e) { setErro(e.message); } finally { setEntrando(false); }
  }

  return (
    <Tela compacto titulo="Entrar com senha" subtitulo={null}>
      <Texto>Use o celular e a senha que você criou no cadastro.</Texto>
      <Campo rotulo="Celular (WhatsApp)" placeholder="(66) 99999-9999" keyboardType="phone-pad" autoComplete="tel" value={formatarCelular(celular)}
        onChangeText={(t) => setCelular(normalizarCelular(t).slice(0, 13))} onBlur={buscarDica} estado={erroCel ? 'erro' : null} erro={erroCel} />
      <Campo rotulo="Senha" secureTextEntry autoComplete="current-password" textContentType="password" value={senha} onChangeText={setSenha} />
      {dica && <Texto suave style={{ fontSize: 13, lineHeight: 19, marginTop: -8 }}>💡 Dica: {dica}</Texto>}
      {erro && <Mensagem>{erro}</Mensagem>}
      <Botao titulo="Entrar" aoTocar={entrar} desligado={!!erroCel || d.length !== 11 || senha.length < 6} carregando={entrando} />
      <Botao tipo="link" titulo="Esqueci minha senha" aoTocar={() => router.push('/recuperar-senha')} />
      <Botao tipo="link" titulo="Prefiro entrar com código" aoTocar={() => router.back()} />
    </Tela>
  );
}
