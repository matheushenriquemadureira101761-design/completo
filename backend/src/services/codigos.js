import { consulta, transacao } from '../db.js';
import { config } from '../config.js';
import { gerarCodigo, embaralhar, conferir, gerarToken, resumo } from '../lib/seguranca.js';
import { ErroApp } from '../lib/erros.js';
import { enviarCodigoAcesso } from './mensagens/index.js';

/** Pede um código. Limites: espera entre pedidos, máximo por hora por número e por IP. */
export async function pedirCodigo({ whatsapp, canal, email, ip }) {
  const c = config.codigo;
  const ultimo = (await consulta('SELECT criado_em FROM codigos_acesso WHERE whatsapp = $1 ORDER BY criado_em DESC LIMIT 1', [whatsapp])).rows[0];
  if (ultimo) {
    const passou = (Date.now() - new Date(ultimo.criado_em).getTime()) / 1000;
    if (passou < c.esperaReenvioSeg) {
      const falta = Math.ceil(c.esperaReenvioSeg - passou);
      throw new ErroApp(429, `Espere ${falta} segundos para pedir outro código.`, 'aguarde', { segundos: falta });
    }
  }
  const porNumero = Number((await consulta("SELECT COUNT(*) FROM codigos_acesso WHERE whatsapp = $1 AND criado_em > NOW() - INTERVAL '1 hour'", [whatsapp])).rows[0].count);
  if (porNumero >= c.maxPorHoraNumero) throw new ErroApp(429, 'Muitos pedidos de código para este número. Tente de novo daqui a 1 hora.', 'limite_numero');
  if (ip) {
    const porIp = Number((await consulta("SELECT COUNT(*) FROM codigos_acesso WHERE ip = $1 AND criado_em > NOW() - INTERVAL '1 hour'", [ip])).rows[0].count);
    if (porIp >= c.maxPorHoraIp) throw new ErroApp(429, 'Muitos pedidos de código. Tente de novo mais tarde.', 'limite_ip');
  }

  const codigo = gerarCodigo();
  const destino = canal === 'email' ? email : whatsapp;
  const { rows } = await consulta(
    `INSERT INTO codigos_acesso (whatsapp, canal, destino, codigo_hash, expira_em, ip)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval, $6) RETURNING id`,
    [whatsapp, canal, destino, embaralhar(codigo), String(c.validadeMin), ip ?? null],
  );
  const envio = await enviarCodigoAcesso({ canal, whatsapp, email, codigo, chave: `codigo:${rows[0].id}` });
  if (!envio.ok) throw new ErroApp(502, 'Não conseguimos enviar o código agora. Tente outro canal ou tente de novo.', 'falha_envio');
  return { digitos: c.digitos, validadeMin: c.validadeMin, esperaSeg: c.esperaReenvioSeg, canal: envio.reserva || canal, simulado: !!envio.simulado, _codigoTeste: config.modoTeste ? codigo : undefined };
}

/** Confere o código. Devolve um passe curto (30 min) que prova que o número é da pessoa.
 *  A tentativa errada é gravada ANTES de responder o erro (senão o limite de tentativas não valeria). */
export async function verificarCodigo({ whatsapp, codigo }) {
  const r = await transacao(async (db) => {
    const reg = (await db.query(
      `SELECT * FROM codigos_acesso WHERE whatsapp = $1 AND usado_em IS NULL ORDER BY criado_em DESC LIMIT 1 FOR UPDATE`, [whatsapp],
    )).rows[0];
    if (!reg) return { erro: new ErroApp(400, 'Peça um código primeiro.', 'sem_codigo') };
    if (new Date(reg.expira_em) < new Date()) return { erro: new ErroApp(400, 'Esse código venceu. Peça um novo.', 'codigo_vencido') };
    if (reg.tentativas >= config.codigo.tentativas) return { erro: new ErroApp(429, 'Muitas tentativas erradas. Peça um novo código.', 'muitas_tentativas') };
    if (!conferir(String(codigo ?? ''), reg.codigo_hash)) {
      await db.query('UPDATE codigos_acesso SET tentativas = tentativas + 1 WHERE id = $1', [reg.id]);
      const restam = config.codigo.tentativas - reg.tentativas - 1;
      return { erro: new ErroApp(400, restam > 0 ? `Código errado. Você ainda tem ${restam} tentativa${restam > 1 ? 's' : ''}.` : 'Código errado. Peça um novo código.', 'codigo_errado', { restam }) };
    }
    await db.query('UPDATE codigos_acesso SET usado_em = NOW() WHERE id = $1', [reg.id]);
    const passe = gerarToken();
    await db.query("INSERT INTO verificacoes (token_hash, whatsapp, expira_em) VALUES ($1, $2, NOW() + INTERVAL '30 minutes')", [resumo(passe), whatsapp]);
    return { passe };
  });
  if (r.erro) throw r.erro; // lançado depois do COMMIT: a tentativa errada fica gravada
  return r.passe;
}

/** Usa o passe (uma vez só) e devolve o número confirmado. */
export async function usarPasse(db, passe) {
  const r = (await db.query(
    'UPDATE verificacoes SET usado_em = NOW() WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > NOW() RETURNING whatsapp', [resumo(passe ?? '')],
  )).rows[0];
  if (!r) throw new ErroApp(401, 'A confirmação do número venceu. Peça um novo código.', 'passe_invalido');
  return r.whatsapp;
}
