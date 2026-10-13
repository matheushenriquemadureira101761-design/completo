import { cancelarCobrancaAutomatica } from './pagamento/index.js';
import { consulta, transacao } from '../db.js';
import { config } from '../config.js';
import { validarCelular, celularE164, validarEmail, cidadeExiste } from '../lib/validacao.js';
import { fusoDaCidade, agoraLocal, fimDoTeste, somarDias, formatarDataBR } from '../lib/datas.js';
import { embaralhar, conferir, resumo } from '../lib/seguranca.js';
import { ErroApp } from '../lib/erros.js';
import { usarPasse } from './codigos.js';
import { criarSessao } from './sessoes.js';
import { enviarMensagem } from './mensagens/index.js';
import { primeiroNome } from './assinaturas.js';

export function numeroValido(whatsapp) {
  const erro = validarCelular(whatsapp);
  if (erro) throw new ErroApp(400, erro, 'celular_invalido');
  return celularE164(whatsapp);
}

/**
 * Conclui a entrada depois do código confirmado:
 * - número novo: cria a conta e começa o teste grátis de 7 dias;
 * - número que já tem conta: entra nela (e acrescenta o outro perfil, se a pessoa escolheu um diferente).
 */
export async function concluirEntrada({ passe, nome, cidade, uf, email, senha, aceiteTermos, plataforma }) {
  // Usuário único: toda conta já nasce habilitada para contratar e oferecer.
  // A separação por perfil não é mais pedida no cadastro.
  return transacao(async (db) => {
    const whatsapp = await usarPasse(db, passe);
    const existente = (await db.query('SELECT * FROM usuarios WHERE whatsapp = $1 FOR UPDATE', [whatsapp])).rows[0];

    if (existente) {
      if (existente.suspenso_em) throw new ErroApp(403, 'Esta conta está suspensa por descumprir os Termos de Uso. Fale com o suporte.', 'conta_suspensa');
      // Garante que contas antigas ganhem os dois perfis (usuário único).
      if (!existente.contratante || !existente.fornecedor) {
        await db.query('UPDATE usuarios SET contratante = TRUE, fornecedor = TRUE WHERE id = $1', [existente.id]);
      }
      const token = await criarSessao(db, existente.id, plataforma);
      return { token, novo: false, usuarioId: existente.id };
    }

    if (!String(nome ?? '').trim() || String(nome).trim().length < 3) throw new ErroApp(400, 'Digite o seu nome completo.', 'nome');
    if (!uf || !cidade || !cidadeExiste(cidade, uf)) throw new ErroApp(400, 'Escolha a sua cidade na lista.', 'cidade');
    if (email && validarEmail(email)) throw new ErroApp(400, validarEmail(email), 'email');
    if (senha && String(senha).length < 6) throw new ErroApp(400, 'A senha precisa ter pelo menos 6 caracteres.', 'senha');
    if (aceiteTermos !== true) throw new ErroApp(400, 'Para continuar, aceite os Termos de Uso e a Política de Privacidade.', 'termos');

    const fuso = fusoDaCidade(cidade, uf);
    const hoje = agoraLocal(fuso).data;
    // Um teste grátis por número: se esse WhatsApp já usou, a conta nasce sem teste.
    const jaTestou = (await db.query('SELECT 1 FROM testes_usados WHERE whatsapp_hash = $1', [resumo(whatsapp)])).rowCount > 0;
    const testeFim = jaTestou ? somarDias(hoje, -1) : fimDoTeste(hoje);

    const { rows } = await db.query(
      `INSERT INTO usuarios (whatsapp, nome, email, contratante, fornecedor, cidade, uf, fuso, senha_hash, versao_termos, aceite_termos_em, teste_inicio, teste_fim)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12) RETURNING *`,
      [whatsapp, String(nome).trim(), email ? String(email).trim() : null, true, true,
        cidade, uf, fuso, senha ? embaralhar(senha) : null, config.versaoTermos, hoje, testeFim],
    );
    await db.query('INSERT INTO testes_usados (whatsapp_hash) VALUES ($1) ON CONFLICT DO NOTHING', [resumo(whatsapp)]);
    const usuario = rows[0];
    const token = await criarSessao(db, usuario.id, plataforma);
    return { token, novo: true, usuarioId: usuario.id, usuario, jaTestou };
  }).then(async (r) => {
    if (r.novo && !r.jaTestou) {
      await enviarMensagem({ usuario: r.usuario, tipo: 'boas_vindas_teste', chave: `boas_vindas:${r.usuarioId}`,
        vars: { nome: primeiroNome(r.usuario.nome), ate: formatarDataBR(r.usuario.teste_fim, false) } });
    }
    return { token: r.token, novo: r.novo };
  });
}

/** Entrar com senha (opcional), por exemplo num celular novo. */
export async function entrarComSenha({ whatsapp, senha, plataforma }) {
  const numero = numeroValido(whatsapp);
  const u = (await consulta('SELECT * FROM usuarios WHERE whatsapp = $1', [numero])).rows[0];
  if (!u || !u.senha_hash || !conferir(senha, u.senha_hash)) throw new ErroApp(401, 'Número ou senha não conferem. Você também pode entrar com o código.', 'senha_errada');
  if (u.suspenso_em) throw new ErroApp(403, 'Esta conta está suspensa por descumprir os Termos de Uso. Fale com o suporte.', 'conta_suspensa');
  return transacao(async (db) => ({ token: await criarSessao(db, u.id, plataforma) }));
}

/** Exclusão de conta (exigência das lojas). Mantém só o resumo do número em testes_usados. */
export async function excluirConta(usuarioId) {
  // Para a cobrança automática no cartão antes de apagar (a assinatura da loja a pessoa cancela na própria loja).
  // Se não der para cancelar agora, a conta não é apagada: senão a pessoa seguiria sendo cobrada.
  try { await cancelarCobrancaAutomatica(usuarioId); } catch (e) {
    console.error(`[Conta] não cancelou o cartão do usuário ${usuarioId}: ${e.message}`);
    throw new ErroApp(502, 'Não conseguimos cancelar a cobrança no seu cartão agora. Tente excluir a conta de novo em alguns minutos.', 'cancelamento_pendente');
  }
  await consulta('DELETE FROM usuarios WHERE id = $1', [usuarioId]);
}

export function perfilPublico(u) {
  return {
    id: u.id, nome: u.nome, primeiroNome: primeiroNome(u.nome), whatsapp: u.whatsapp, email: u.email,
    contratante: u.contratante, fornecedor: u.fornecedor, cidade: u.cidade, uf: u.uf,
    temSenha: Boolean(u.senha_hash), testeFim: u.teste_fim, testeFimBR: formatarDataBR(u.teste_fim, false),
  };
}
