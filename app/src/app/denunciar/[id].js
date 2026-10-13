import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Tela from '../../componentes/Tela';
import { Botao, Campo, Rotulo, Mensagem, Texto, Titulo, Nota } from '../../componentes/ui';
import { Icone } from '../../componentes/icones';
import { api } from '../../servicos/api';
import { tratarErroDeAcesso } from '../../servicos/erros';
import { cor, fonte } from '../../tema';

const MOTIVOS = [
  { valor: 'golpe', titulo: 'Golpe ou tentativa de fraude', texto: 'Pediu pagamento adiantado, dados bancários ou algo suspeito' },
  { valor: 'proibido', titulo: 'Produto ou serviço proibido', texto: 'Algo ilegal ou que não pode ser oferecido' },
  { valor: 'ofensivo', titulo: 'Conteúdo ofensivo', texto: 'Fotos ou textos ofensivos, preconceituosos ou impróprios' },
  { valor: 'falso', titulo: 'Anúncio falso ou enganoso', texto: 'Fotos que não são do equipamento, preço ou informação falsa' },
  { valor: 'outro', titulo: 'Outro motivo', texto: 'Conte para nós no campo abaixo' },
];

export default function Denunciar() {
  const { id } = useLocalSearchParams();
  const [a, setA] = useState(null);
  const [motivo, setMotivo] = useState(null);
  const [detalhe, setDetalhe] = useState('');
  const [bloquearTambem, setBloquearTambem] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [feito, setFeito] = useState(false);

  useEffect(() => { api(`/anuncios/${id}`).then(setA).catch(async (e) => { if (!(await tratarErroDeAcesso(e))) setErro(e.message); }); }, [id]);

  async function enviar() {
    setErro(null); setEnviando(true);
    try {
      await api(`/anuncios/${id}/denuncias`, { metodo: 'POST', corpo: { motivo, detalhe: detalhe.trim() } });
      if (bloquearTambem && a) await api(`/usuarios/${a.fornecedor.id}/bloqueio`, { metodo: 'POST' });
      setFeito(true);
    } catch (e) { if (!(await tratarErroDeAcesso(e))) setErro(e.message); } finally { setEnviando(false); }
  }

  if (feito) {
    return (
      <Tela compacto titulo="Denúncia enviada" subtitulo={null}>
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 10 }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: cor.ok, backgroundColor: cor.aviso, alignItems: 'center', justifyContent: 'center' }}><Icone nome="check" cor={cor.ok} t={36} sw={3} /></View>
          <Titulo>Obrigado por avisar</Titulo>
          <Texto centro>Nossa equipe vai analisar em até 24 horas. Este anúncio não aparece mais para você{bloquearTambem ? ', e o fornecedor foi bloqueado' : ''}.</Texto>
        </View>
        <Botao titulo="Voltar para o início" aoTocar={() => router.replace('/inicio')} />
      </Tela>
    );
  }

  return (
    <Tela compacto titulo="Denunciar anúncio" subtitulo={null}>
      {a && <Texto suave>{a.titulo} · {a.fornecedor.nome}</Texto>}
      <Rotulo>O que está errado?</Rotulo>
      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        {MOTIVOS.map((m) => {
          const on = motivo === m.valor;
          return (
            <Pressable key={m.valor} onPress={() => setMotivo(m.valor)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[estilos.opcao, on && { borderColor: cor.dourado }]}>
              <View style={[estilos.bolinha, on && { borderColor: cor.dourado }]}>{on && <View style={estilos.miolo} />}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{m.titulo}</Text>
                <Text style={{ fontFamily: fonte.normal, fontSize: 13, lineHeight: 18, color: cor.textoApagado }}>{m.texto}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Campo rotulo={motivo === 'outro' ? 'Conte o que aconteceu' : 'Quer contar mais? (opcional)'} placeholder="Ex.: pediu Pix adiantado antes de mostrar o equipamento." multiline maxLength={500}
        value={detalhe} onChangeText={setDetalhe} style={{ minHeight: 100, textAlignVertical: 'top' }} />
      {a && (
        <Pressable onPress={() => setBloquearTambem(!bloquearTambem)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }} accessibilityRole="checkbox" accessibilityState={{ checked: bloquearTambem }}>
          <View style={[estilos.caixa, bloquearTambem && { backgroundColor: cor.dourado, borderColor: cor.dourado }]}>
            {bloquearTambem && <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#14361F" strokeWidth={3.5}><Path d="M20 6L9 17l-5-5" /></Svg>}
          </View>
          <Text style={{ flex: 1, fontFamily: fonte.normal, fontSize: 14, lineHeight: 21, color: cor.textoSuave }}>Bloquear também {a.fornecedor.nome}. Vocês não verão mais os anúncios um do outro.</Text>
        </Pressable>
      )}
      <Nota>A sua denúncia é anônima: o fornecedor não fica sabendo quem denunciou.</Nota>
      {erro && <Mensagem>{erro}</Mensagem>}
      <Botao titulo="Enviar denúncia" aoTocar={enviar} desligado={!motivo || (motivo === 'outro' && detalhe.trim().length < 5)} carregando={enviando} />
      <Botao tipo="link" titulo="Cancelar" aoTocar={() => router.back()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  opcao: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo, alignItems: 'center' },
  bolinha: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
  miolo: { width: 12, height: 12, borderRadius: 6, backgroundColor: cor.dourado },
  caixa: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: cor.borda, backgroundColor: cor.campo, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
