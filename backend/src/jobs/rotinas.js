// Roda a cada 10 minutos. Para cada pessoa, olha a hora no fuso DELA: às 9h, manda o lembrete do dia.
// A chave única de cada mensagem garante que ninguém recebe o mesmo lembrete duas vezes.
import { pool, consulta } from '../db.js';
import { agoraLocal, lembreteDoDia, formatarDataBR, somarDias } from '../lib/datas.js';
import { enviarMensagem } from '../services/mensagens/index.js';
import { criarLinkPagamento, primeiroNome, valorBR } from '../services/assinaturas.js';

export const HORA_DOS_LEMBRETES = 9;

export async function rodarLembretes(instante = new Date()) {
  const trava = await pool.connect();
  try {
    const { rows: [t] } = await trava.query('SELECT pg_try_advisory_lock(74201) AS ok');
    if (!t.ok) return { pulou: 'outra_instancia' };
    const { rows } = await consulta(`SELECT u.*, a.vencimento, a.origem FROM usuarios u LEFT JOIN assinaturas a ON a.usuario_id = u.id`);
    let enviadas = 0;
    for (const u of rows) {
      const { data: hoje, hora } = agoraLocal(u.fuso, instante);
      if (hora !== HORA_DOS_LEMBRETES) continue;
      for (const tipo of lembreteDoDia({ testeFim: u.teste_fim, vencimento: u.vencimento, origem: u.origem }, hoje)) {
        const precisaLink = !['pesquisa_satisfacao'].includes(tipo);
        const vars = {
          nome: primeiroNome(u.nome), valor: valorBR(), ate: formatarDataBR(u.teste_fim, false),
          data: tipo === 'cobranca_atrasada' ? formatarDataBR(somarDias(u.vencimento, 2), false)
            : tipo === 'ultimo_aviso' ? formatarDataBR(somarDias(u.vencimento, 3), false)
              : u.vencimento ? formatarDataBR(u.vencimento, false) : undefined,
          link: precisaLink ? await criarLinkPagamento(u.id) : undefined,
        };
        const r = await enviarMensagem({ usuario: u, tipo, vars, chave: `${tipo}:${u.id}:${hoje}` });
        if (!r.pulada) enviadas++;
      }
    }
    return { enviadas };
  } finally {
    await trava.query('SELECT pg_advisory_unlock(74201)').catch(() => {});
    trava.release();
  }
}

export function iniciarRotinas() {
  const rodar = () => rodarLembretes().catch((e) => console.error('[Rotinas]', e));
  rodar();
  return setInterval(rodar, 10 * 60 * 1000);
}
