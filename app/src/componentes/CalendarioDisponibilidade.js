import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { cor, fonte, raio } from '../tema';

// Calendário próprio de disponibilidade. Três modos:
//   - 'sempre':    Sempre disponível
//   - 'consulta':  Sob consulta
//   - 'datas':     Datas específicas (seleção múltipla de dias no calendário)
// Valor devolvido ao pai: { modo, datas: ['YYYY-MM-DD', ...] }

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEM = ['D','S','T','Q','Q','S','S'];

const pad = (n) => String(n).padStart(2, '0');
const chaveDia = (ano, mes, dia) => `${ano}-${pad(mes + 1)}-${pad(dia)}`;

function Seta({ virada }) {
  return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={cor.texto} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: virada ? '180deg' : '0deg' }] }}><Path d="M15 18l-6-6 6-6" /></Svg>;
}

function Grade({ ano, mes, selecionadas, aoAlternar, hoje }) {
  const primeiroDiaSem = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas = [];
  for (let i = 0; i < primeiroDiaSem; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);

  const linhas = [];
  for (let i = 0; i < celulas.length; i += 7) linhas.push(celulas.slice(i, i + 7));

  return (
    <View style={{ marginTop: 8 }}>
      <View style={estilos.semanaCab}>
        {DIAS_SEM.map((d, i) => <Text key={i} style={estilos.semanaCabTexto}>{d}</Text>)}
      </View>
      {linhas.map((linha, li) => (
        <View key={li} style={{ flexDirection: 'row' }}>
          {linha.map((d, ci) => {
            if (d == null) return <View key={ci} style={estilos.celulaVazia} />;
            const chave = chaveDia(ano, mes, d);
            const sel = selecionadas.has(chave);
            const ehHoje = hoje.ano === ano && hoje.mes === mes && hoje.dia === d;
            const passado = new Date(ano, mes, d) < new Date(hoje.ano, hoje.mes, hoje.dia);
            return (
              <Pressable key={ci} onPress={() => !passado && aoAlternar(chave)} disabled={passado}
                style={({ pressed }) => [estilos.celula, sel && estilos.celulaSel, ehHoje && !sel && estilos.celulaHoje, pressed && !passado && { opacity: 0.75 }]}>
                <Text style={[estilos.celulaTexto, sel && { color: cor.fundo, fontFamily: fonte.forte }, passado && { color: 'rgba(255,255,255,0.2)' }]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function CalendarioDisponibilidade({ valor, aoMudar }) {
  const hojeDate = new Date();
  const hoje = { ano: hojeDate.getFullYear(), mes: hojeDate.getMonth(), dia: hojeDate.getDate() };

  const [modo, setModo] = useState(valor?.modo || 'consulta');
  const [datas, setDatas] = useState(new Set(valor?.datas || []));
  const [cursorAno, setCursorAno] = useState(hoje.ano);
  const [cursorMes, setCursorMes] = useState(hoje.mes);

  function trocarModo(novoModo) {
    setModo(novoModo);
    const novasDatas = novoModo === 'datas' ? datas : new Set();
    if (novoModo !== 'datas') setDatas(new Set());
    aoMudar?.({ modo: novoModo, datas: Array.from(novasDatas) });
  }

  function alternarDia(chave) {
    const nova = new Set(datas);
    if (nova.has(chave)) nova.delete(chave); else nova.add(chave);
    setDatas(nova);
    aoMudar?.({ modo: 'datas', datas: Array.from(nova) });
  }

  function navegarMes(delta) {
    let m = cursorMes + delta; let a = cursorAno;
    if (m < 0) { m = 11; a--; } else if (m > 11) { m = 0; a++; }
    // Não deixa voltar antes do mês atual.
    if (a < hoje.ano || (a === hoje.ano && m < hoje.mes)) return;
    // Limita 24 meses à frente.
    const limite = new Date(hoje.ano, hoje.mes + 24, 1);
    if (new Date(a, m, 1) > limite) return;
    setCursorAno(a); setCursorMes(m);
  }

  const resumoDatas = useMemo(() => {
    if (modo !== 'datas') return null;
    if (datas.size === 0) return 'Nenhum dia selecionado ainda.';
    if (datas.size === 1) return '1 dia selecionado.';
    return `${datas.size} dias selecionados.`;
  }, [modo, datas]);

  return (
    <View style={estilos.wrap}>
      <Text style={estilos.rotulo}>DISPONIBILIDADE</Text>
      <View style={estilos.modos}>
        {[
          { v: 'sempre',   t: 'Sempre disponível' },
          { v: 'consulta', t: 'Sob consulta' },
          { v: 'datas',    t: 'Datas específicas' },
        ].map((m) => {
          const ativo = modo === m.v;
          return (
            <Pressable key={m.v} onPress={() => trocarModo(m.v)}
              style={({ pressed }) => [estilos.modo, ativo && estilos.modoAtivo, pressed && { opacity: 0.85 }]}>
              <Text style={[estilos.modoTexto, ativo && { color: cor.fundo, fontFamily: fonte.forte }]}>{m.t}</Text>
            </Pressable>
          );
        })}
      </View>
      {modo === 'sempre' && (
        <Text style={estilos.dica}>Seu anúncio aparece como disponível todos os dias.</Text>
      )}
      {modo === 'consulta' && (
        <Text style={estilos.dica}>Interessados entram em contato para combinar a data.</Text>
      )}
      {modo === 'datas' && (
        <View style={estilos.calendario}>
          <View style={estilos.navMes}>
            <Pressable onPress={() => navegarMes(-1)} style={estilos.btnNav}><Seta /></Pressable>
            <Text style={estilos.nomeMes}>{MESES[cursorMes]} {cursorAno}</Text>
            <Pressable onPress={() => navegarMes(1)} style={estilos.btnNav}><Seta virada /></Pressable>
          </View>
          <Grade ano={cursorAno} mes={cursorMes} selecionadas={datas} aoAlternar={alternarDia} hoje={hoje} />
          <Text style={estilos.dica}>{resumoDatas}</Text>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  wrap: { gap: 8 },
  rotulo: { fontFamily: fonte.forte, fontSize: 11, color: cor.textoApagado, letterSpacing: 1.2 },
  modos: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  modo: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda },
  modoAtivo: { backgroundColor: cor.dourado, borderColor: cor.dourado },
  modoTexto: { fontFamily: fonte.media, fontSize: 12, color: cor.textoSuave },
  dica: { fontFamily: fonte.normal, fontSize: 12, color: cor.textoApagado, lineHeight: 17, marginTop: 2 },
  calendario: { backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda, borderRadius: raio.cartao, padding: 12, marginTop: 4 },
  navMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  btnNav: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: cor.folha },
  nomeMes: { fontFamily: fonte.forte, fontSize: 15, color: cor.texto },
  semanaCab: { flexDirection: 'row', paddingVertical: 6 },
  semanaCabTexto: { flex: 1, textAlign: 'center', fontFamily: fonte.media, fontSize: 11, color: cor.textoApagado, letterSpacing: 0.5 },
  celula: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', margin: 2, borderRadius: 10, backgroundColor: cor.folha },
  celulaVazia: { flex: 1, aspectRatio: 1, margin: 2 },
  celulaSel: { backgroundColor: cor.dourado },
  celulaHoje: { borderWidth: 1.5, borderColor: cor.dourado },
  celulaTexto: { fontFamily: fonte.media, fontSize: 13, color: cor.texto },
});
