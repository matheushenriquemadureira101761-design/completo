import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import { analisar, mensagemDeBloqueio } from '../../servicos/filtroContato';
import { cor, fonte, raio } from '../../tema';

function IconeVoltar() { return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={cor.texto} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>; }
function IconeEnviar() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={cor.fundo} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M22 2L11 13" /><Path d="M22 2l-7 20-4-9-9-4 20-7z" /></Svg>; }

export default function Chat() {
  const insets = useSafeAreaInsets();
  const { id, nome } = useLocalSearchParams();
  const [texto, setTexto] = useState('');
  const [mensagens, setMensagens] = useState([
    { id: 's1', autor: 'sistema', corpo: 'As conversas acontecem aqui dentro do AGROVINC para a segurança de todos. Combine detalhes do negócio neste chat.', em: new Date() },
  ]);
  const [erroBloqueio, setErroBloqueio] = useState(null);
  const lista = useRef(null);

  function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;
    const resultado = analisar(limpo);
    if (resultado.bloqueado) {
      setErroBloqueio(mensagemDeBloqueio(resultado.motivo));
      return;
    }
    setErroBloqueio(null);
    setMensagens((m) => [...m, { id: `u${Date.now()}`, autor: 'eu', corpo: limpo, em: new Date() }]);
    setTexto('');
    setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 50);
  }

  function trocarTexto(t) {
    setTexto(t);
    if (erroBloqueio) setErroBloqueio(null);
  }

  function renderMensagem({ item }) {
    if (item.autor === 'sistema') {
      return (
        <View style={estilos.sistema}>
          <Text style={estilos.sistemaTexto}>{item.corpo}</Text>
        </View>
      );
    }
    const meu = item.autor === 'eu';
    return (
      <View style={[estilos.bolhaWrap, meu ? estilos.bolhaMeuWrap : estilos.bolhaOutroWrap]}>
        <View style={[estilos.bolha, meu ? estilos.bolhaMeu : estilos.bolhaOutro]}>
          <Text style={[estilos.bolhaTexto, meu && { color: cor.fundo }]}>{item.corpo}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={estilos.topo}>
        <Pressable onPress={() => router.back()} style={estilos.btnVoltar} hitSlop={8}><IconeVoltar /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={estilos.topoNome} numberOfLines={1}>{nome || 'Conversa'}</Text>
          <Text style={estilos.topoSub}>Chat seguro · AGROVINC</Text>
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          ref={lista}
          data={mensagens}
          keyExtractor={(m) => m.id}
          renderItem={renderMensagem}
          contentContainerStyle={{ padding: 14, paddingBottom: 20, gap: 8 }}
        />
        {erroBloqueio && (
          <View style={estilos.alertaBloqueio}>
            <Text style={estilos.alertaTitulo}>Mensagem bloqueada</Text>
            <Text style={estilos.alertaCorpo}>{erroBloqueio}</Text>
            <Pressable onPress={() => router.push('/planos')} style={({ pressed }) => [estilos.alertaBotao, pressed && { opacity: 0.85 }]}>
              <Text style={estilos.alertaBotaoTexto}>Conhecer o plano Premium</Text>
            </Pressable>
          </View>
        )}
        <View style={[estilos.barra, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={texto}
            onChangeText={trocarTexto}
            placeholder="Escreva uma mensagem..."
            placeholderTextColor={cor.textoApagado}
            style={estilos.campo}
            multiline
            onSubmitEditing={enviar}
            blurOnSubmit={false}
          />
          <Pressable onPress={enviar} disabled={!texto.trim()} style={({ pressed }) => [estilos.btnEnviar, !texto.trim() && { opacity: 0.4 }, pressed && texto.trim() && { opacity: 0.85 }]}>
            <IconeEnviar />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: cor.borda },
  btnVoltar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  topoNome: { fontFamily: fonte.forte, fontSize: 15, color: cor.texto },
  topoSub: { fontFamily: fonte.normal, fontSize: 11, color: cor.textoApagado, marginTop: 1 },
  sistema: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: cor.borda, maxWidth: '90%' },
  sistemaTexto: { fontFamily: fonte.normal, fontSize: 11, color: cor.textoApagado, textAlign: 'center', lineHeight: 15 },
  bolhaWrap: { flexDirection: 'row' },
  bolhaMeuWrap: { justifyContent: 'flex-end' },
  bolhaOutroWrap: { justifyContent: 'flex-start' },
  bolha: { maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16 },
  bolhaMeu: { backgroundColor: cor.dourado, borderBottomRightRadius: 4 },
  bolhaOutro: { backgroundColor: cor.campo, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: cor.borda },
  bolhaTexto: { fontFamily: fonte.normal, fontSize: 14, color: cor.texto, lineHeight: 20 },
  alertaBloqueio: { marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: raio.cartao, backgroundColor: 'rgba(255,138,91,0.08)', borderWidth: 1, borderColor: 'rgba(255,138,91,0.4)' },
  alertaTitulo: { fontFamily: fonte.forte, fontSize: 13, color: '#FFB08C', marginBottom: 4 },
  alertaCorpo: { fontFamily: fonte.normal, fontSize: 13, color: cor.textoSuave, lineHeight: 18, marginBottom: 10 },
  alertaBotao: { backgroundColor: cor.dourado, paddingVertical: 10, borderRadius: raio.botao, alignItems: 'center' },
  alertaBotaoTexto: { fontFamily: fonte.forte, fontSize: 12, color: cor.fundo, letterSpacing: 0.3 },
  barra: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: cor.borda, backgroundColor: cor.folha },
  campo: { flex: 1, backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonte.normal, fontSize: 14, color: cor.texto, maxHeight: 100 },
  btnEnviar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cor.dourado, alignItems: 'center', justifyContent: 'center' },
});
