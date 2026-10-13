// Notificações do app (Expo Push). Textos neutros: só avisos, sem link de pagamento.
import { consulta } from '../../db.js';

export async function enviarPush(usuarioId, { titulo, corpo, dados = {} }) {
  const tokens = (await consulta('SELECT token FROM push_tokens WHERE usuario_id = $1', [usuarioId])).rows.map((r) => r.token);
  if (tokens.length === 0) return { enviados: 0 };
  const mensagens = tokens.map((to) => ({ to, title: titulo, body: corpo, data: dados, sound: 'default' }));
  try {
    const r = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(mensagens),
    });
    const resp = await r.json().catch(() => ({}));
    // Remove aparelhos que desinstalaram o app
    const invalidos = (resp.data || []).map((d, i) => (d?.details?.error === 'DeviceNotRegistered' ? tokens[i] : null)).filter(Boolean);
    if (invalidos.length) await consulta('DELETE FROM push_tokens WHERE token = ANY($1)', [invalidos]);
    return { enviados: tokens.length - invalidos.length };
  } catch (e) {
    console.warn('[Push] falhou:', e.message);
    return { enviados: 0, erro: e.message };
  }
}
