// Envio pela API oficial do WhatsApp (Meta Cloud API).
// Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api
import { config } from '../../config.js';

export const whatsappConfigurado = () => Boolean(config.whatsapp.token && config.whatsapp.numeroId);

async function postar(corpo) {
  const { versaoApi, numeroId, token } = config.whatsapp;
  if (!whatsappConfigurado()) {
    console.log('[WhatsApp simulado]', JSON.stringify(corpo));
    return { simulado: true, id: `simulado-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  }
  const r = await fetch(`https://graph.facebook.com/${versaoApi}/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(dados?.error?.message || `WhatsApp respondeu ${r.status}`);
    e.codigoMeta = dados?.error?.code; // ex.: 131026 = número sem WhatsApp
    throw e;
  }
  return { simulado: false, id: dados?.messages?.[0]?.id };
}

/** Mensagem de modelo aprovado (obrigatório quando a empresa escreve primeiro). */
export function enviarModelo(para, nomeModelo, componentes) {
  return postar({ to: para, type: 'template', template: { name: nomeModelo, language: { code: config.whatsapp.idioma }, components: componentes } });
}

/** Texto livre: só é permitido até 24h depois da última mensagem da pessoa (e é gratuito). */
export function enviarTexto(para, texto) {
  return postar({ to: para, type: 'text', text: { body: texto, preview_url: true } });
}
