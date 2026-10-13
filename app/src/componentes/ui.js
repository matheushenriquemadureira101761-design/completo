import { Pressable, Text, TextInput, View, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { cor, fonte, raio } from '../tema';

export function Botao({ titulo, aoTocar, desligado = false, carregando = false, tipo = 'principal', acessibilidade }) {
  const principal = tipo === 'principal';
  const contorno = tipo === 'contorno';
  const inativo = desligado || carregando;
  return (
    <Pressable
      onPress={inativo ? undefined : aoTocar}
      accessibilityRole="button" accessibilityState={{ disabled: inativo }} accessibilityLabel={acessibilidade || titulo}
      style={({ pressed }) => [
        estilos.botao,
        principal && { backgroundColor: inativo ? cor.desligado : cor.dourado },
        contorno && { borderWidth: 1.5, borderColor: cor.dourado },
        tipo === 'link' && { minHeight: 44, paddingVertical: 10 },
        pressed && !inativo && { opacity: 0.85 },
      ]}>
      {carregando ? <ActivityIndicator color={principal ? '#14361F' : cor.dourado} /> : (
        <Text style={[estilos.textoBotao, { color: principal ? (inativo ? cor.desligadoTexto : '#14361F') : cor.dourado }, tipo === 'link' && { fontSize: 14 }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Rotulo({ children }) {
  return <Text style={estilos.rotulo}>{children}</Text>;
}

export function Mensagem({ tipo = 'erro', children }) {
  if (!children) return null;
  const c = tipo === 'erro' ? cor.erro : cor.ok;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }} accessibilityLiveRegion="polite">
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={tipo === 'erro' ? 2.4 : 3} style={{ marginTop: 2 }}>
        {tipo === 'erro' ? <Path d="M12 3L2 21h20L12 3zM12 10v4M12 17.5v.5" /> : <Path d="M20 6L9 17l-5-5" />}
      </Svg>
      <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 13, color: c, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function Campo({ rotulo, erro, ok, estado, style, ...props }) {
  const borda = estado === 'erro' ? cor.erro : estado === 'ok' ? cor.ok : cor.borda;
  return (
    <View style={{ gap: 6 }}>
      {rotulo ? <Rotulo>{rotulo}</Rotulo> : null}
      <TextInput placeholderTextColor={cor.textoApagado} style={[estilos.campo, { borderColor: borda }, style]} accessibilityLabel={rotulo} {...props} />
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      {!erro && ok ? <Mensagem tipo="ok">{ok}</Mensagem> : null}
    </View>
  );
}

/** Botões lado a lado onde só um fica marcado (ex.: WhatsApp / SMS / E-mail). */
export function Escolha({ opcoes, valor, aoMudar }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }} accessibilityRole="radiogroup">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable key={o.valor} onPress={() => aoMudar(o.valor)} accessibilityRole="radio" accessibilityState={{ checked: ativo }}
            style={[estilos.opcao, ativo ? { backgroundColor: cor.dourado, borderColor: cor.dourado } : { backgroundColor: cor.campo, borderColor: cor.borda }]}>
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: ativo ? '#14361F' : cor.textoApagado, textAlign: 'center' }}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Cartao({ children, destaque = false, style }) {
  return <View style={[estilos.cartao, destaque && { borderColor: cor.dourado, borderWidth: 2 }, style]}>{children}</View>;
}

export function Nota({ children, tipo = 'ok' }) {
  return (
    <View style={[estilos.nota, tipo === 'destaque' && { borderColor: cor.ok }]}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={cor.ok} strokeWidth={3} style={{ marginTop: 2 }}><Path d="M20 6L9 17l-5-5" /></Svg>
      <Text style={{ flex: 1, fontFamily: fonte.normal, fontSize: 13, color: cor.textoSuave, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function Titulo({ children, centro = true }) {
  return <Text style={[estilos.titulo, centro && { textAlign: 'center' }]} accessibilityRole="header">{children}</Text>;
}

export function Texto({ children, suave = false, centro = false, style }) {
  return <Text style={[{ fontFamily: fonte.normal, fontSize: 15, lineHeight: 23, color: suave ? cor.textoApagado : cor.textoSuave }, centro && { textAlign: 'center' }, style]}>{children}</Text>;
}

const estilos = StyleSheet.create({
  botao: { minHeight: 56, borderRadius: raio.botao, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  textoBotao: { fontFamily: fonte.forte, fontSize: 16, textAlign: 'center' },
  rotulo: { fontFamily: fonte.media, fontSize: 14, color: cor.textoSuave },
  campo: { minHeight: 54, paddingHorizontal: 16, paddingVertical: 14, borderRadius: raio.campo, borderWidth: 1.5, backgroundColor: cor.campo, color: cor.texto, fontFamily: fonte.normal, fontSize: 16 },
  opcao: { flex: 1, minHeight: 50, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cartao: { padding: 16, borderRadius: raio.cartao, backgroundColor: cor.campo, borderWidth: 1.5, borderColor: cor.borda, gap: 12 },
  nota: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: cor.aviso, borderWidth: 1, borderColor: cor.borda },
  titulo: { fontFamily: fonte.titulo, fontSize: 22, color: cor.texto },
});
