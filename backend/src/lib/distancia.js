import { COORDENADAS } from './coordenadas.js';

/** Distância em linha reta (km) entre duas cidades. Na estrada costuma ser um pouco maior. */
export function distanciaKm(cidadeA, ufA, cidadeB, ufB) {
  const a = COORDENADAS[`${cidadeA}|${ufA}`];
  const b = COORDENADAS[`${cidadeB}|${ufB}`];
  if (!a || !b) return null;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

export function coordenadas(cidade, uf) {
  return COORDENADAS[`${cidade}|${uf}`] ?? null;
}
