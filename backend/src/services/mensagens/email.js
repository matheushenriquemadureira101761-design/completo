import nodemailer from 'nodemailer';
import { config } from '../../config.js';

let transporte = null;
export const emailConfigurado = () => Boolean(config.email.host);

export async function enviarEmail(para, { assunto, texto }) {
  if (!emailConfigurado()) {
    console.log(`[E-mail simulado] para ${para} | ${assunto}\n${texto}`);
    return { simulado: true, id: `email-simulado-${Date.now()}` };
  }
  transporte ??= nodemailer.createTransport({
    host: config.email.host, port: config.email.porta, secure: config.email.porta === 465,
    auth: config.email.usuario ? { user: config.email.usuario, pass: config.email.senha } : undefined,
  });
  const r = await transporte.sendMail({ from: config.email.remetente, to: para, subject: assunto, text: texto });
  return { simulado: false, id: r.messageId };
}
