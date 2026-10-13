import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Tela from '../../componentes/Tela';
import { Botao, Campo, Rotulo, Mensagem, Texto, Titulo } from '../../componentes/ui';
import { FotoAnuncio } from '../../componentes/marketplace';
import { Icone } from '../../componentes/icones';
import { api } from '../../servicos/api';
import { tratarErroDeAcesso, proximosDias } from '../../servicos/erros';
import { cor, fonte } from '../../tema';

export default function PedirOrcamento() {
  const { id } = useLocalSearchParams();
  const [a, setA] = useState(null);
  const [data, setData] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviado, setEnviado] = useState(false);
  const dias = useMemo(() => proximosDias(14), []);

  useEffect(() => { api(`/anuncios/${id}`).then(setA).catch(async (e) => { if (!(await tratarErroDeAcesso(e))) setErro(e.message); }); }, [id]);

  async function enviar() {
    setErro(null); setEnviando(true);
    try { await api(`/anuncios/${id}/orcamentos`, { metodo: 'POST', corpo: { mensagem: mensagem.trim(), dataDesejada: data } }); setEnviado(true); }
    catch (e) { if (!(await tratarErroDeAcesso(e))) setErro(e.message); } finally { setEnviando(false); }
  }

  if (enviado) {
    return (
      <Tela compacto titulo="Pedido enviado" subtitulo={null}>
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 10 }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: cor.ok, backgroundColor: cor.aviso, alignItems: 'center', justifyContent: 'center' }}><Icone nome="check" cor={cor.ok} t={36} sw={3} /></View>
          <Titulo>Pedido enviado!</Titulo>
          <Texto centro>O fornecedor foi avisado no WhatsApp e no app. Ele vai te chamar para combinar o valor e os detalhes.</Texto>
        </View>
        <Botao titulo="Ver meus pedidos" aoTocar={() => router.replace('/pedidos')} />
        <Botao tipo="link" titulo="Voltar para o anúncio" aoTocar={() => router.back()} />
      </Tela>
    );
  }

  return (
    <Tela compacto titulo="Pedir orçamento" subtitulo={null}>
      {a && (
        <View style={estilos.resumo}>
          <FotoAnuncio url={a.foto} categoria={a.categoria} largura={64} altura={64} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }} numberOfLines={2}>{a.titulo}</Text>
            <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{a.fornecedor.nome}</Text>
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.texto }}>{a.preco}<Text style={{ fontFamily: fonte.normal, color: cor.textoApagado }}>{a.unidade}</Text></Text>
          </View>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <Rotulo>Quando você precisa?</Rotulo>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable onPress={() => setData(null)} style={[estilos.dia, { width: 90 }, data === null && estilos.on]} accessibilityRole="radio" accessibilityState={{ checked: data === null }}>
            <Text style={[estilos.diaTexto, { textAlign: 'center' }, data === null && { color: '#14361F' }]}>Ainda não sei</Text>
          </Pressable>
          {dias.map((d) => (
            <Pressable key={d.data} onPress={() => setData(d.data)} style={[estilos.dia, data === d.data && estilos.on]} accessibilityRole="radio" accessibilityLabel={d.rotulo} accessibilityState={{ checked: data === d.data }}>
              <Text style={{ fontFamily: fonte.media, fontSize: 12, color: data === d.data ? '#14361F' : cor.textoApagado }}>{d.dia}</Text>
              <Text style={{ fontFamily: fonte.titulo, fontSize: 18, color: data === d.data ? '#14361F' : cor.texto }}>{d.numero}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Campo rotulo="Mensagem para o fornecedor (opcional)" placeholder="Ex.: preciso para o plantio de 200 hectares, perto da BR-158." multiline maxLength={800}
        value={mensagem} onChangeText={setMensagem} style={{ minHeight: 120, textAlignVertical: 'top' }} />
      <Texto suave style={{ fontSize: 13, lineHeight: 19 }}>O fornecedor recebe o seu nome e o seu WhatsApp para te responder.</Texto>
      {erro && <Mensagem>{erro}</Mensagem>}
      <Botao titulo={data ? `Pedir orçamento para ${dias.find((d) => d.data === data).rotulo}` : 'Pedir orçamento'} aoTocar={enviar} carregando={enviando} desligado={!a} />
      <Botao tipo="link" titulo="Voltar" aoTocar={() => router.back()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  resumo: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo, alignItems: 'center' },
  dia: { width: 56, minHeight: 64, borderRadius: 12, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo, alignItems: 'center', justifyContent: 'center' },
  diaTexto: { fontFamily: fonte.forte, fontSize: 14, color: cor.textoSuave },
  on: { backgroundColor: cor.dourado, borderColor: cor.dourado },
});
