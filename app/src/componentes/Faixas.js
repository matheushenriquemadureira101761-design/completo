import Svg, { Path, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

// As faixas de lavoura da opção 1 (mesmas curvas da logo), desenhadas em vetor.
const GL = '#3FA65A', GM = '#2E8B4A', GOLD = '#FDB813';
function faixa(k, espessura, dy = 15) {
  const pts = (o) => [[-20, 205 + o], [160, 205 + o], [370, 210 + o], [430, 30 + o * 1.1]];
  const a = pts(k * dy), b = pts(k * dy + espessura);
  const p = (P) => `${P[0].toFixed(1)},${P[1].toFixed(1)}`;
  return `M${p(a[0])} C${p(a[1])} ${p(a[2])} ${p(a[3])} L${p(b[3])} C${p(b[2])} ${p(b[1])} ${p(b[0])} Z`;
}
const FAIXAS = [[0, 10, GL, 0.55], [1, 6, GOLD, 0.85], [1.75, 10, GM, 0.5], [2.75, 5, GOLD, 0.5], [3.4, 14, GL, 0.3]];

export default function Faixas({ largura = 390, deslocamentoY = 0 }) {
  const escala = largura / 390;
  return (
    <Svg width={largura} height={230 * escala} viewBox={`0 ${deslocamentoY} 390 230`} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        <RadialGradient id="claro" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#14361F" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#14361F" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="195" cy="100" rx="150" ry="70" fill="url(#claro)" />
      {FAIXAS.map(([k, e, c, o]) => <Path key={k} d={faixa(k, e)} fill={c} fillOpacity={o} />)}
    </Svg>
  );
}
