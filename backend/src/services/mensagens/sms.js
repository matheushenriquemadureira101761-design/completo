// SMS: reserva do código de acesso quando a pessoa escolhe SMS ou o número não tem WhatsApp.
// SMS_PROVEDOR = zenvia | twilio. Vazio: modo simulação (a mensagem aparece no terminal).
const env = (k) => process.env[k] || '';
export const smsConfigurado = () => Boolean(env('SMS_PROVEDOR'));

async function postar(url, opcoes) {
  let r;
  try { r = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(15000) }); } catch (e) { throw new Error(`SMS sem conexão: ${e.message}`); }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`SMS recusado (${r.status}): ${dados.message || dados.detail || dados.error || JSON.stringify(dados).slice(0, 200)}`);
  return dados;
}

/** Zenvia (API v2): https://zenvia.github.io/zenvia-openapi-spec/v2/ */
async function zenvia(para, texto) {
  if (!env('ZENVIA_TOKEN') || !env('ZENVIA_REMETENTE')) throw new Error('Configure ZENVIA_TOKEN e ZENVIA_REMETENTE no .env');
  const d = await postar(`${env('ZENVIA_URL') || 'https://api.zenvia.com'}/v2/channels/sms/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-TOKEN': env('ZENVIA_TOKEN') },
    body: JSON.stringify({ from: env('ZENVIA_REMETENTE'), to: para.replace(/\D/g, ''), contents: [{ type: 'text', text: texto }] }),
  });
  return { id: d.id };
}

/** Twilio: https://www.twilio.com/docs/messaging/api/message-resource */
async function twilio(para, texto) {
  const sid = env('TWILIO_ACCOUNT_SID');
  if (!sid || !env('TWILIO_AUTH_TOKEN') || !(env('TWILIO_NUMERO') || env('TWILIO_MESSAGING_SERVICE_SID'))) {
    throw new Error('Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_NUMERO (ou TWILIO_MESSAGING_SERVICE_SID) no .env');
  }
  const corpo = new URLSearchParams({ To: `+${para.replace(/\D/g, '')}`, Body: texto });
  if (env('TWILIO_MESSAGING_SERVICE_SID')) corpo.set('MessagingServiceSid', env('TWILIO_MESSAGING_SERVICE_SID'));
  else corpo.set('From', env('TWILIO_NUMERO'));
  const d = await postar(`${env('TWILIO_URL') || 'https://api.twilio.com'}/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${sid}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64')}` },
    body: corpo.toString(),
  });
  return { id: d.sid };
}

const PROVEDORES = { zenvia, twilio };

export async function enviarSms(para, texto) {
  if (!smsConfigurado()) {
    console.log(`[SMS simulado] para ${para}: ${texto}`);
    return { simulado: true, id: `sms-simulado-${Date.now()}` };
  }
  const p = PROVEDORES[env('SMS_PROVEDOR').toLowerCase()];
  if (!p) throw new Error(`SMS_PROVEDOR "${env('SMS_PROVEDOR')}" não existe. Use zenvia ou twilio.`);
  return p(para, texto);
}
