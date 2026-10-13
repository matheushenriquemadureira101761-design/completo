// Envio de mensagens com: modelo aprovado no WhatsApp, reserva por e-mail, notificação no app,
// respeito ao "SAIR" e garantia de nunca mandar a mesma mensagem duas vezes (coluna `chave`).
import { consulta } from '../../db.js';
import { config } from '../../config.js';
import { MODELOS } from './modelos.js';
import { enviarModelo } from './whatsapp.js';
import { enviarEmail } from './email.js';
import { enviarSms } from './sms.js';
import { enviarPush } from './push.js';

async function registrar({ usuarioId, tipo, canal, destino, chave }) {
  const r = await consulta(
    `INSERT INTO mensagens (usuario_id, tipo, canal, destino, chave) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (chave) DO NOTHING RETURNING id`,
    [usuarioId ?? null, tipo, canal, destino, chave],
  );
  return r.rows[0]?.id ?? null;
}

async function atualizar(id, { status, provedorId = null, erro = null }) {
  await consulta('UPDATE mensagens SET status = $2, provedor_id = COALESCE($3, provedor_id), erro = $4, atualizado_em = NOW() WHERE id = $1', [id, status, provedorId, erro]);
}

async function tentar(id, fn) {
  try {
    const r = await fn();
    await atualizar(id, { status: r.simulado ? 'simulada' : 'enviada', provedorId: r.id });
    return { ok: true, ...r };
  } catch (e) {
    await atualizar(id, { status: 'falhou', erro: `${e.codigoMeta ?? ''} ${e.message}`.trim() });
    return { ok: false, erro: e.message, codigoMeta: e.codigoMeta };
  }
}

/**
 * Envia uma mensagem de modelo para um usuário.
 * @param {object} p
 * @param {object} p.usuario  linha da tabela usuarios
 * @param {string} p.tipo     chave de MODELOS
 * @param {object} p.vars     variáveis do modelo
 * @param {string} p.chave    identificador único (ex.: "teste_terminou:12:2026-10-08")
 */
export async function enviarMensagem({ usuario, tipo, vars = {}, chave }) {
  const modelo = MODELOS[tipo];
  if (!modelo) throw new Error(`Modelo de mensagem desconhecido: ${tipo}`);
  if (!modelo.essencial && usuario.aceita_mensagens === false) return { pulada: 'pediu_para_sair' };

  const id = await registrar({ usuarioId: usuario.id, tipo, canal: 'whatsapp', destino: usuario.whatsapp, chave });
  if (!id) return { pulada: 'ja_enviada' };

  const url = vars.link ? `${config.urlSite}/ativar/${vars.link}` : undefined;
  const v = { ...vars, url };
  const resultado = await tentar(id, () => enviarModelo(usuario.whatsapp, tipo, modelo.whatsapp(v)));

  // Reserva: se o WhatsApp falhar e a pessoa tiver e-mail, manda por e-mail.
  if (!resultado.ok && modelo.email && usuario.email) {
    const idEmail = await registrar({ usuarioId: usuario.id, tipo, canal: 'email', destino: usuario.email, chave: `${chave}:email` });
    if (idEmail) await tentar(idEmail, () => enviarEmail(usuario.email, modelo.email(v)));
  }
  // Aviso no app (neutro, sem link)
  if (modelo.push) await enviarPush(usuario.id, { ...modelo.push(v), dados: { tipo } });
  return resultado;
}

/** Código de acesso pelo canal escolhido, com reserva por SMS quando o número não tem WhatsApp. */
export async function enviarCodigoAcesso({ canal, whatsapp, email, codigo, chave }) {
  const modelo = MODELOS.codigo_acesso;
  const v = { codigo, validade: config.codigo.validadeMin };
  if (canal === 'email') {
    const id = await registrar({ tipo: 'codigo_acesso', canal: 'email', destino: email, chave });
    return tentar(id, () => enviarEmail(email, modelo.email(v)));
  }
  if (canal === 'sms') {
    const id = await registrar({ tipo: 'codigo_acesso', canal: 'sms', destino: whatsapp, chave });
    return tentar(id, () => enviarSms(`+${whatsapp}`, modelo.sms(v)));
  }
  const id = await registrar({ tipo: 'codigo_acesso', canal: 'whatsapp', destino: whatsapp, chave });
  const r = await tentar(id, () => enviarModelo(whatsapp, 'codigo_acesso', modelo.whatsapp(v)));
  if (!r.ok) {
    const idSms = await registrar({ tipo: 'codigo_acesso', canal: 'sms', destino: whatsapp, chave: `${chave}:sms` });
    const rs = await tentar(idSms, () => enviarSms(`+${whatsapp}`, modelo.sms(v)));
    return { ...rs, reserva: 'sms' };
  }
  return r;
}
