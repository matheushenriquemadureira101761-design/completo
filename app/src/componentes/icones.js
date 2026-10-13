import Svg, { Path, Circle, Rect } from 'react-native-svg';

const base = (cor, t, sw) => ({ width: t, height: t, viewBox: '0 0 24 24', fill: 'none', stroke: cor, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' });

export function Icone({ nome, cor = '#9DB6A4', t = 20, sw = 2 }) {
  const p = base(cor, t, sw);
  switch (nome) {
    case 'maquinas': return <Svg {...p}><Circle cx="7" cy="17" r="4" /><Circle cx="18" cy="18" r="2.5" /><Path d="M4 13V8h6l3 5h5v3M7 8V5h3" /></Svg>;
    case 'implementos': return <Svg {...p}><Path d="M3 8h18M5 8v6M9 8v6M13 8v6M17 8v6" /><Circle cx="5" cy="17" r="2" /><Circle cx="9" cy="17" r="2" /><Circle cx="13" cy="17" r="2" /><Circle cx="17" cy="17" r="2" /></Svg>;
    case 'fretes': return <Svg {...p}><Rect x="1" y="5" width="14" height="11" /><Path d="M15 9h4l3 3v4h-7z" /><Circle cx="5.5" cy="18" r="2" /><Circle cx="18" cy="18" r="2" /></Svg>;
    case 'servicos': return <Svg {...p}><Path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.6 2.6-2.5-.5-.5-2.5z" /></Svg>;
    case 'todos': return <Svg {...p}><Path d="M8 6h13M8 12h13M8 18h13" /><Circle cx="3.5" cy="6" r="1" /><Circle cx="3.5" cy="12" r="1" /><Circle cx="3.5" cy="18" r="1" /></Svg>;
    case 'inicio': return <Svg {...p}><Path d="M3 11l9-8 9 8M5 10v10h14V10" /></Svg>;
    case 'buscar': return <Svg {...p}><Circle cx="11" cy="11" r="7" /><Path d="M21 21l-4.3-4.3" /></Svg>;
    case 'pedidos': return <Svg {...p}><Path d="M9 5H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-4" /><Rect x="9" y="3" width="6" height="4" rx="1" /><Path d="M8 12h8M8 16h5" /></Svg>;
    case 'anunciar': return <Svg {...p}><Circle cx="12" cy="12" r="9" /><Path d="M12 8v8M8 12h8" /></Svg>;
    case 'conta': return <Svg {...p}><Circle cx="12" cy="8" r="4" /><Path d="M4 21v-1a8 8 0 0116 0v1" /></Svg>;
    case 'pin': return <Svg {...p}><Path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" /><Circle cx="12" cy="10" r="2.5" /></Svg>;
    case 'voltar': return <Svg {...p}><Path d="M15 18l-6-6 6-6" /></Svg>;
    case 'filtro': return <Svg {...p}><Path d="M4 6h16M7 12h10M10 18h4" /></Svg>;
    case 'escudo': return <Svg {...p}><Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><Path d="M8.5 12l2.5 2.5 4.5-4.5" /></Svg>;
    case 'rota': return <Svg {...p}><Circle cx="6" cy="19" r="2" /><Circle cx="18" cy="5" r="2" /><Path d="M8 19h7a3 3 0 000-6H9a3 3 0 010-6h7" /></Svg>;
    case 'camera': return <Svg {...p}><Path d="M3 8a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><Circle cx="12" cy="13" r="4" /></Svg>;
    case 'galeria': return <Svg {...p}><Rect x="3" y="4" width="18" height="16" rx="2" /><Circle cx="9" cy="10" r="2" /><Path d="M21 16l-5-5-8 8" /></Svg>;
    case 'x': return <Svg {...p}><Path d="M6 6l12 12M18 6L6 18" /></Svg>;
    case 'check': return <Svg {...p}><Path d="M20 6L9 17l-5-5" /></Svg>;
    default: return null;
  }
}

export function IconeWhatsApp({ t = 22, cor = '#6FCF97' }) {
  return (
    <Svg width={t} height={t} viewBox="0 0 24 24" fill={cor}>
      <Path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm5.6 14.2c-.2.7-1.4 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.6-.6-2.8-1.2-4.6-4-4.8-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-1.9.9-2.2.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .5.4.2.4.6 1.4.6 1.5.1.1.1.3 0 .4-.1.2-.1.3-.3.4-.1.2-.3.3-.4.5-.1.1-.3.3-.1.5.2.3.7 1.1 1.5 1.8.9.8 1.8 1.1 2.1 1.3.3.1.4.1.6-.1.2-.2.6-.7.8-1 .2-.3.4-.2.6-.1.2.1 1.3.6 1.5.7.3.1.4.2.5.3.1.2.1.6-.1 1.3z" />
    </Svg>
  );
}

export function Estrela({ t = 13 }) {
  return <Svg width={t} height={t} viewBox="0 0 24 24"><Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="#FDB813" /></Svg>;
}
