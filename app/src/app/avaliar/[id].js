import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Tela from '../../componentes/Tela';
import { Botao, Campo, Mensagem, Texto } from '../../componentes/ui';
import { api } from '../../servicos/api';
import { tratarErroDeAcesso } from '../../servicos/erros';
import { cor, fonte } from '../../tema';

const SIGNIFICADO = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];

export default function Avaliar() {
  const { id, titulo, nome } = useLocalSearchParams();
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [feito, setFeito] = useState(false);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      await api(`/orcamentos/${id}/avaliacao`, { metodo: 'POST', corpo: { nota, comentario: comentario.trim() } });
      setFeito(true);
    } catch (e) {
      if (!(await tratarErroDeAcesso(e))) setErro(e.message);
    } finally { setEnviando(false); }
  }

  if (feito) {
    return (
      <Tela compacto titulo="Obrigado!" subtitulo={null}>
        <Texto centro>Sua avaliação ajuda outros produtores a escolher bem.</Texto>
        <Botao titulo="Voltar aos pedidos" aoTocar={() => router.back()} />
      </Tela>
    );
  }

  return (
    <Tela compacto titulo="Avaliar o fornecedor" subtitulo={nome ? `${nome} · ${titulo ?? ''}` : null}>
      <Botao tipo="link" titulo="Voltar" aoTocar={() => router.back()} />
      <Text style={{ fontFamily: fonte.forte, fontSize: 17, color: cor.texto, textAlign: 'center' }}>Como foi o serviço?</Text>
      <View style={estilos.estrelas} accessibilityRole="radiogroup" accessibilityLabel="Nota de 1 a 5 estrelas">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setNota(n)} hitSlop={6} style={estilos.estrela}
            accessibilityRole="radio" accessibilityState={{ checked: nota === n }} accessibilityLabel={`${n} ${n === 1 ? 'estrela' : 'estrelas'}: ${SIGNIFICADO[n]}`}>
            <Text style={{ fontSize: 44, lineHeight: 52, color: n <= nota ? cor.dourado : cor.borda }}>★</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: nota ? cor.dourado : cor.textoApagado, textAlign: 'center', minHeight: 22 }}>
        {nota ? SIGNIFICADO[nota] : 'Toque nas estrelas'}
      </Text>
      <Campo rotulo="Conte como foi (opcional)" placeholder="Ex.: chegou no horário, serviço bem feito..." value={comentario} onChangeText={setComentario}
        multiline maxLength={500} style={{ minHeight: 110, textAlignVertical: 'top' }} />
      <Texto suave style={{ fontSize: 13 }}>O comentário aparece no anúncio com o seu primeiro nome.</Texto>
      {erro && <Mensagem>{erro}</Mensagem>}
      <Botao titulo={enviando ? 'Enviando...' : 'Enviar avaliação'} aoTocar={enviar} desligado={!nota || enviando} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  estrelas: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  estrela: { minWidth: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
});
