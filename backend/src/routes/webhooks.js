import { Router } from 'express';
import crypto from 'node:crypto';
import { notificacaoGoogle, notificacaoApple } from '../services/loja.js';
import { config } from '../config.js';
import { consulta } from '../db.js';
import { assinaturaMetaValida } from '../lib/seguranca.js';
import { enviarTexto } from '../services/mensagens/whatsapp.js';
import { situacaoDo, criarLinkPagamento } from '../services/assinaturas.js';

export const rotasWebhooks = Router();

// Verificação feita pela Meta ao cadastrar o webhook no painel do WhatsApp.
rotasWebhooks.get('/whatsapp', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && config.whatsapp.tokenVerificacao && req.query['hub.verify_token'] === config.whatsapp.tokenVerificacao) {
    return res.status(200).send(String(req.query['hub.challenge']));
  }
  res.sendStatus(403);
});

const STATUS = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou' };

/** Entende a resposta da pessoa: SAIR, nota da pesquisa (1 a 5) ou pedido de novo link. */
export async function tratarMensagemRecebida({ de, texto }) {
  const u = (await consulta('SELECT * FROM usuarios WHERE whatsapp = $1', [de])).rows[0];
  if (!u) return { acao: 'desconhecido' };
  const t = String(texto ?? '').trim();

  if (/^(sair|parar|pare|stop)$/i.test(t)) {
    await consulta('UPDATE usuarios SET aceita_mensagens = FALSE WHERE id = $1', [u.id]);
    await enviarTexto(de, 'Pronto, você não vai mais receber avisos por aqui. O código de acesso e os recibos continuam chegando. Para voltar a receber, responda VOLTAR.');
    return { acao: 'saiu' };
  }
  if (/^voltar$/i.test(t) && u.aceita_mensagens === false) {
    await consulta('UPDATE usuarios SET aceita_mensagens = TRUE WHERE id = $1', [u.id]);
    await enviarTexto(de, 'Combinado! Você voltou a receber os avisos da AGROVINC por aqui.');
    return { acao: 'voltou' };
  }
  const nota = t.match(/^([1-5])(?:\D|$)(.*)$/s);
  if (nota) {
    const pediu = (await consulta(`SELECT 1 FROM mensagens WHERE usuario_id = $1 AND tipo = 'pesquisa_satisfacao' AND criado_em > NOW() - INTERVAL '7 days'`, [u.id])).rowCount > 0;
    const respondeu = (await consulta(`SELECT 1 FROM pesquisas WHERE usuario_id = $1 AND criado_em > NOW() - INTERVAL '7 days'`, [u.id])).rowCount > 0;
    if (pediu && !respondeu) {
      await consulta('INSERT INTO pesquisas (usuario_id, nota, comentario) VALUES ($1, $2, $3)', [u.id, Number(nota[1]), nota[2].replace(/^[\s.,;:-]+/, '').trim() || null]);
      await enviarTexto(de, `Obrigado pela nota, ${u.nome.split(' ')[0]}! Sua opinião vai direto para a nossa equipe.`);
      return { acao: 'pesquisa', nota: Number(nota[1]) };
    }
  }
  const s = await situacaoDo(u);
  if (!s.acesso || ['vence_hoje', 'atrasada'].includes(s.estado)) {
    const link = await criarLinkPagamento(u.id);
    await enviarTexto(de, `Aqui está o seu link para ativar a assinatura da AGROVINC (R$ ${s.valor} por mês), com Pix ou cartão:\n${config.urlSite}/ativar/${link}\n\nVocê também pode assinar direto no app.`);
    return { acao: 'novo_link' };
  }
  return { acao: 'nenhuma' }; // conversa normal: fica para o atendimento humano
}

rotasWebhooks.post('/whatsapp', async (req, res) => {
  if (!assinaturaMetaValida(req.corpoBruto, req.headers['x-hub-signature-256'], config.whatsapp.segredoApp)) return res.sendStatus(401);
  res.sendStatus(200); // a Meta espera resposta rápida; o processamento segue abaixo
  for (const entrada of req.body?.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      const v = mudanca.value ?? {};
      for (const st of v.statuses ?? []) {
        if (STATUS[st.status]) await consulta('UPDATE mensagens SET status = $2, erro = $3, atualizado_em = NOW() WHERE provedor_id = $1', [st.id, STATUS[st.status], st.errors?.[0]?.title ?? null]).catch(console.error);
      }
      for (const m of v.messages ?? []) {
        if (m.type === 'text') await tratarMensagemRecebida({ de: m.from, texto: m.text?.body }).catch(console.error);
      }
    }
  }
});

// Avisos das lojas sobre assinaturas feitas no app (renovou, cancelou, reembolsou).
// O servidor nunca confia só no aviso: consulta a loja de novo antes de mudar qualquer coisa.
// Google: Pub/Sub (push) para https://SEU_DOMINIO/webhooks/google-play?segredo=GOOGLE_PLAY_WEBHOOK_SEGREDO
rotasWebhooks.post('/google-play', async (req, res) => {
  const certo = process.env.GOOGLE_PLAY_WEBHOOK_SEGREDO || '';
  const veio = String(req.query.segredo ?? '');
  const ok = certo ? (veio.length === certo.length && crypto.timingSafeEqual(Buffer.from(veio), Buffer.from(certo))) : config.modoTeste;
  if (!ok) return res.sendStatus(401);
  try { res.json(await notificacaoGoogle(req.body)); } catch (e) { console.error('[Google Play] notificação:', e.message); res.sendStatus(500); }
});
// Apple: App Store Server Notifications V2 para https://SEU_DOMINIO/webhooks/apple
rotasWebhooks.post('/apple', async (req, res) => {
  try { res.json(await notificacaoApple(req.body)); } catch (e) { console.error('[App Store] notificação:', e.message); res.sendStatus(500); }
});
