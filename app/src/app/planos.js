import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { cor, fonte, raio } from '../tema';

const PLANOS = [
  { id: 'basico',  nome: 'Básico',  mensal: 29.90,  anual: 287.04,  subtitulo: 'Para começar',
    recursos: ['Até 3 anúncios ativos', 'Mensagens diretas', 'Receber avaliações'],
    naoTem: ['Destaque nas buscas', 'Banner na home'] },
  { id: 'pro',     nome: 'Pró',     mensal: 79.90,  anual: 767.04,  popular: true, subtitulo: 'Para crescer',
    recursos: ['Anúncios ilimitados', 'Destaque nas buscas', 'Selo de verificado', 'Estatísticas de visualizações', 'Suporte via chat'] },
  { id: 'premium', nome: 'Premium', mensal: 149.90, anual: 1439.04, destaque: true, subtitulo: 'Alcance máximo',
    recursos: ['Tudo do Pró', 'Banner rotativo na home', 'Suporte prioritário 24h', 'Até 5 lojas vinculadas', 'Relatórios avançados'] },
];

function IconeCheck({ cor: c }) {
  return <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 6L9 17l-5-5" /></Svg>;
}
function IconeX({ cor: c }) {
  return <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M6 6l12 12M18 6L6 18" /></Svg>;
}

function CartaoPlano({ p, ciclo, aoAssinar }) {
  const valor = ciclo === 'mensal' ? p.mensal : (p.anual / 12);
  const popular = p.popular;
  const destaque = p.destaque;

  const estiloFundo = popular ? { backgroundColor: cor.dourado } : { backgroundColor: cor.campo, borderWidth: 1, borderColor: destaque ? 'rgba(253,184,19,0.4)' : cor.borda };
  const corNome = popular ? cor.fundo : (destaque ? cor.dourado : cor.textoApagado);
  const corValor = popular ? cor.fundo : cor.texto;
  const corSuave = popular ? 'rgba(20,54,31,0.72)' : cor.textoApagado;
  const corItem = popular ? cor.fundo : cor.textoSuave;
  const corItemNao = popular ? 'rgba(20,54,31,0.42)' : 'rgba(255,255,255,0.3)';

  return (
    <View style={[estilos.cartao, estiloFundo, popular && { transform: [{ scale: 1.02 }] }]}>
      {popular && (
        <View style={estilos.selo}>
          <Text style={estilos.seloTexto}>MAIS POPULAR</Text>
        </View>
      )}
      <Text style={[estilos.nome, { color: corNome }]}>{p.nome.toUpperCase()}</Text>
      <Text style={[estilos.subtitulo, { color: corSuave }]}>{p.subtitulo}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 14 }}>
        <Text style={[estilos.cifrao, { color: corSuave }]}>R$</Text>
        <Text style={[estilos.valor, { color: corValor, fontSize: popular ? 32 : 28 }]}>{valor.toFixed(2).replace('.', ',')}</Text>
      </View>
      <Text style={[estilos.cicloTexto, { color: corSuave }]}>por mês{ciclo === 'anual' ? ' · plano anual' : ''}</Text>
      <View style={{ gap: 8, marginVertical: 16 }}>
        {p.recursos.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconeCheck cor={popular ? cor.fundo : cor.ok} />
            <Text style={[estilos.recurso, { color: corItem }]}>{r}</Text>
          </View>
        ))}
        {p.naoTem?.map((r, i) => (
          <View key={'n'+i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconeX cor={corItemNao} />
            <Text style={[estilos.recurso, { color: corItemNao }]}>{r}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => aoAssinar(p, ciclo)} style={({ pressed }) => [estilos.botao, { backgroundColor: popular ? cor.fundo : (destaque ? 'rgba(253,184,19,0.15)' : cor.borda) }, pressed && { opacity: 0.85 }]}>
        <Text style={[estilos.botaoTexto, { color: popular ? cor.dourado : (destaque ? cor.dourado : cor.texto) }]}>Assinar {p.nome}</Text>
      </Pressable>
    </View>
  );
}

export default function Planos() {
  const insets = useSafeAreaInsets();
  const [ciclo, setCiclo] = useState('mensal');

  function assinar(p, c) {
    router.push({ pathname: '/assinatura-ativa', params: { plano: p.nome, ciclo: c } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={estilos.topo}>
        <Pressable onPress={() => router.back()} style={estilos.btnVoltar}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={cor.textoSuave} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>
        </Pressable>
      </View>
      <View style={estilos.cabecalho}>
        <Text style={estilos.titulo}>Escolha seu plano</Text>
        <Text style={estilos.sublinha}>Deslize para comparar as opções</Text>
      </View>
      <View style={{ alignItems: 'center', marginBottom: 14 }}>
        <View style={estilos.toggle}>
          {[{ v: 'mensal', l: 'Mensal' }, { v: 'anual', l: 'Anual · 20% off' }].map((o) => (
            <Pressable key={o.v} onPress={() => setCiclo(o.v)} style={[estilos.toggleOpcao, ciclo === o.v && { backgroundColor: cor.dourado }]}>
              <Text style={[estilos.toggleTexto, { color: ciclo === o.v ? cor.fundo : cor.textoApagado }]}>{o.l}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 18, paddingBottom: 20, gap: 10 }}>
        {PLANOS.map((p) => <CartaoPlano key={p.id} p={p} ciclo={ciclo} aoAssinar={assinar} />)}
      </ScrollView>
      <View style={{ alignItems: 'center', paddingBottom: insets.bottom + 16, paddingTop: 4 }}>
        <Text style={estilos.rodape}>Cancele quando quiser · Sem fidelidade</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { paddingHorizontal: 12, paddingTop: 8 },
  btnVoltar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cabecalho: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  titulo: { fontSize: 24, color: cor.texto, fontFamily: fonte.titulo, marginBottom: 4 },
  sublinha: { fontSize: 12, color: cor.textoSuave, fontFamily: fonte.normal },
  toggle: { flexDirection: 'row', backgroundColor: cor.campo, borderRadius: 22, padding: 4, borderWidth: 1, borderColor: cor.borda },
  toggleOpcao: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18 },
  toggleTexto: { fontSize: 12, fontFamily: fonte.forte, letterSpacing: 0.3 },
  cartao: { width: 230, borderRadius: raio.cartao, padding: 20, position: 'relative' },
  selo: { position: 'absolute', top: -10, right: 16, backgroundColor: cor.fundo, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: cor.fundo },
  seloTexto: { color: cor.dourado, fontSize: 9, fontFamily: fonte.forte, letterSpacing: 0.8 },
  nome: { fontSize: 11, fontFamily: fonte.forte, letterSpacing: 1.2, marginBottom: 4, marginTop: 4 },
  subtitulo: { fontSize: 11, fontFamily: fonte.normal },
  cifrao: { fontSize: 11, fontFamily: fonte.normal },
  valor: { fontFamily: fonte.titulo },
  cicloTexto: { fontSize: 10, fontFamily: fonte.normal, marginTop: 2 },
  recurso: { fontSize: 11, fontFamily: fonte.normal, flex: 1, lineHeight: 16 },
  botao: { paddingVertical: 12, borderRadius: raio.botao, alignItems: 'center' },
  botaoTexto: { fontSize: 12, fontFamily: fonte.forte, letterSpacing: 0.3 },
  rodape: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: fonte.normal },
});
