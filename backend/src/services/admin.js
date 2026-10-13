// Consultas do painel administrativo (equipe). Só leitura, exceto remover anúncio.
import { consulta } from '../db.js';
import { ErroApp } from '../lib/erros.js';
import { formatarCelular } from '../lib/validacao.js';
import { CATEGORIAS, precoTexto, UNIDADES } from './anuncios.js';
import { MOTIVOS } from './moderacao.js';

const POR_PAGINA = 50;
const pagina = (p) => Math.max(1, Math.min(1000, Number(p) || 1));
const celular = (e164) => (e164 ? formatarCelular(String(e164).slice(2)) : '');
const reais = (c) => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const termo = (q) => `%${String(q ?? '').trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

export async function resumo() {
  const um = async (sql) => Number((await consulta(sql)).rows[0].n);
  const [usuarios, novos7d, emTeste, assinantes, suspensos, anunciosNoAr, anunciosEmAnalise, denunciasAbertas, pedidos7d, fechados30d, receitaCentavos] = await Promise.all([
    um('SELECT COUNT(*) n FROM usuarios'),
    um(`SELECT COUNT(*) n FROM usuarios WHERE criado_em > NOW() - INTERVAL '7 days'`),
    um(`SELECT COUNT(*) n FROM usuarios u WHERE u.teste_fim >= CURRENT_DATE AND NOT EXISTS (SELECT 1 FROM assinaturas a WHERE a.usuario_id = u.id AND a.vencimento >= CURRENT_DATE)`),
    um('SELECT COUNT(*) n FROM assinaturas WHERE vencimento >= CURRENT_DATE'),
    um('SELECT COUNT(*) n FROM usuarios WHERE suspenso_em IS NOT NULL'),
    um(`SELECT COUNT(*) n FROM anuncios WHERE status = 'ativo' AND NOT em_analise`),
    um('SELECT COUNT(*) n FROM anuncios WHERE em_analise'),
    um(`SELECT COUNT(DISTINCT anuncio_id) n FROM denuncias WHERE status = 'aberta'`),
    um(`SELECT COUNT(*) n FROM orcamentos WHERE criado_em > NOW() - INTERVAL '7 days'`),
    um(`SELECT COUNT(*) n FROM orcamentos WHERE status = 'fechado' AND atualizado_em > NOW() - INTERVAL '30 days'`),
    um(`SELECT COALESCE(SUM(valor_centavos), 0) n FROM pagamentos WHERE pago_em >= date_trunc('month', NOW())`),
  ]);
  return { usuarios, novos7d, emTeste, assinantes, suspensos, anunciosNoAr, anunciosEmAnalise, denunciasAbertas, pedidos7d, fechados30d, receitaMes: reais(receitaCentavos) };
}

const br = (d) => d.split('-').reverse().join('/');
function situacaoTexto(u) {
  if (u.suspenso_em) return 'Suspenso';
  if (u.vencimento && u.vencimento >= u.hoje) return `Assinante até ${br(u.vencimento)}`;
  if (u.vencimento) return `Assinatura venceu em ${br(u.vencimento)}`;
  if (u.teste_fim >= u.hoje) return `Teste grátis até ${br(u.teste_fim)}`;
  return `Teste terminou em ${br(u.teste_fim)}`;
}

export async function listarUsuarios({ q, pagina: p } = {}) {
  const pg = pagina(p);
  const digitos = String(q ?? '').replace(/\D/g, '');
  const valores = [];
  let filtro = '';
  if (q && String(q).trim()) {
    valores.push(termo(q));
    filtro = `WHERE (u.nome ILIKE $1 OR u.cidade ILIKE $1`;
    if (digitos.length >= 4) { valores.push(`%${digitos}%`); filtro += ` OR u.whatsapp LIKE $2`; }
    filtro += ')';
  }
  const total = Number((await consulta(`SELECT COUNT(*) n FROM usuarios u ${filtro}`, valores)).rows[0].n);
  const { rows } = await consulta(
    `SELECT u.id, u.nome, u.whatsapp, u.cidade, u.uf, u.contratante, u.fornecedor, u.criado_em, u.suspenso_em, u.teste_fim,
            a.vencimento, a.origem, CURRENT_DATE::text AS hoje,
            (SELECT COUNT(*)::int FROM anuncios x WHERE x.fornecedor_id = u.id AND x.status <> 'removido') AS anuncios
     FROM usuarios u LEFT JOIN assinaturas a ON a.usuario_id = u.id ${filtro}
     ORDER BY u.criado_em DESC LIMIT ${POR_PAGINA} OFFSET ${(pg - 1) * POR_PAGINA}`, valores);
  return {
    total, pagina: pg, porPagina: POR_PAGINA,
    itens: rows.map((u) => ({
      id: Number(u.id), nome: u.nome, whatsapp: celular(u.whatsapp), cidade: `${u.cidade} - ${u.uf}`,
      perfis: [u.contratante && 'Contratante', u.fornecedor && 'Fornecedor'].filter(Boolean).join(' e ') || '—',
      criadoEm: u.criado_em, suspenso: Boolean(u.suspenso_em), situacao: situacaoTexto(u), anuncios: u.anuncios,
    })),
  };
}

export async function detalheUsuario(id) {
  const u = (await consulta(
    `SELECT u.*, a.vencimento, a.origem, a.metodo, a.cancelada_em, CURRENT_DATE::text AS hoje
     FROM usuarios u LEFT JOIN assinaturas a ON a.usuario_id = u.id WHERE u.id = $1`, [id])).rows[0];
  if (!u) throw new ErroApp(404, 'Usuário não encontrado.', 'usuario_inexistente');
  const [anuncios, pagamentos, denuncias, pedidos] = await Promise.all([
    consulta(`SELECT id, titulo, categoria, status, em_analise, criado_em FROM anuncios WHERE fornecedor_id = $1 ORDER BY criado_em DESC LIMIT 50`, [id]),
    consulta(`SELECT origem, metodo, valor_centavos, pago_em, vence_em FROM pagamentos WHERE usuario_id = $1 ORDER BY pago_em DESC LIMIT 24`, [id]),
    consulta(`SELECT d.motivo, d.detalhe, d.status, d.criado_em, a.titulo FROM denuncias d JOIN anuncios a ON a.id = d.anuncio_id WHERE d.denunciado_id = $1 ORDER BY d.criado_em DESC LIMIT 50`, [id]),
    consulta(`SELECT
                (SELECT COUNT(*)::int FROM orcamentos WHERE contratante_id = $1) AS pediu,
                (SELECT COUNT(*)::int FROM orcamentos WHERE fornecedor_id = $1) AS recebeu,
                (SELECT ROUND(AVG(nota)::numeric, 1) FROM avaliacoes WHERE fornecedor_id = $1) AS nota,
                (SELECT COUNT(*)::int FROM avaliacoes WHERE fornecedor_id = $1) AS avaliacoes`, [id]),
  ]);
  const ORIGEM = { site: 'Site', loja_google: 'Google Play', loja_apple: 'App Store' };
  const METODO = { pix: 'Pix', cartao: 'Cartão', loja: 'Loja' };
  const p = pedidos.rows[0];
  return {
    id: Number(u.id), nome: u.nome, whatsapp: celular(u.whatsapp), email: u.email, cidade: `${u.cidade} - ${u.uf}`,
    perfis: [u.contratante && 'Contratante', u.fornecedor && 'Fornecedor'].filter(Boolean).join(' e ') || '—',
    criadoEm: u.criado_em, suspenso: Boolean(u.suspenso_em), situacao: situacaoTexto(u),
    assinatura: u.vencimento ? { origem: ORIGEM[u.origem] ?? u.origem, metodo: METODO[u.metodo] ?? u.metodo, vencimento: u.vencimento, cancelada: Boolean(u.cancelada_em) } : null,
    pedidos: { pediu: p.pediu, recebeu: p.recebeu }, nota: p.nota == null ? null : Number(p.nota), avaliacoes: p.avaliacoes,
    anuncios: anuncios.rows.map((a) => ({ id: Number(a.id), titulo: a.titulo, categoria: CATEGORIAS[a.categoria], status: a.em_analise ? 'Em análise' : a.status, criadoEm: a.criado_em })),
    pagamentos: pagamentos.rows.map((x) => ({ origem: ORIGEM[x.origem] ?? x.origem, metodo: METODO[x.metodo] ?? x.metodo, valor: reais(x.valor_centavos), pagoEm: x.pago_em, venceEm: x.vence_em })),
    denuncias: denuncias.rows.map((d) => ({ motivo: MOTIVOS[d.motivo], detalhe: d.detalhe, status: d.status, criadoEm: d.criado_em, titulo: d.titulo })),
  };
}

export async function listarAnunciosEquipe({ q, status, pagina: p } = {}) {
  const pg = pagina(p);
  const valores = [];
  const cond = [];
  if (q && String(q).trim()) { valores.push(termo(q)); cond.push(`(a.titulo ILIKE $${valores.length} OR u.nome ILIKE $${valores.length} OR a.cidade ILIKE $${valores.length})`); }
  if (status === 'em_analise') cond.push('a.em_analise');
  else if (['ativo', 'pausado', 'removido'].includes(status)) { valores.push(status); cond.push(`a.status = $${valores.length} AND NOT a.em_analise`); }
  else cond.push(`a.status <> 'removido'`);
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const total = Number((await consulta(`SELECT COUNT(*) n FROM anuncios a JOIN usuarios u ON u.id = a.fornecedor_id ${where}`, valores)).rows[0].n);
  const { rows } = await consulta(
    `SELECT a.id, a.titulo, a.categoria, a.status, a.em_analise, a.cidade, a.uf, a.preco_centavos, a.unidade, a.criado_em,
            u.id AS fornecedor_id, u.nome AS fornecedor,
            (SELECT COUNT(*)::int FROM orcamentos o WHERE o.anuncio_id = a.id) AS pedidos,
            (SELECT COUNT(*)::int FROM denuncias d WHERE d.anuncio_id = a.id AND d.status = 'aberta') AS denuncias
     FROM anuncios a JOIN usuarios u ON u.id = a.fornecedor_id ${where}
     ORDER BY a.criado_em DESC LIMIT ${POR_PAGINA} OFFSET ${(pg - 1) * POR_PAGINA}`, valores);
  return {
    total, pagina: pg, porPagina: POR_PAGINA,
    itens: rows.map((a) => ({
      id: Number(a.id), titulo: a.titulo, categoria: CATEGORIAS[a.categoria], cidade: `${a.cidade} - ${a.uf}`,
      preco: precoTexto(a.preco_centavos) + (a.unidade ? UNIDADES[a.unidade] : ''),
      status: a.em_analise ? 'em_analise' : a.status, fornecedorId: Number(a.fornecedor_id), fornecedor: a.fornecedor,
      pedidos: a.pedidos, denuncias: a.denuncias, criadoEm: a.criado_em,
    })),
  };
}

export async function removerAnuncioEquipe(id) {
  const r = await consulta(`UPDATE anuncios SET status = 'removido', em_analise = FALSE, atualizado_em = NOW() WHERE id = $1 AND status <> 'removido' RETURNING id`, [id]);
  if (!r.rowCount) throw new ErroApp(404, 'Anúncio não encontrado ou já removido.', 'anuncio_inexistente');
  await consulta(`UPDATE denuncias SET status = 'procedente', acao = 'remover_anuncio', resolvido_em = NOW() WHERE anuncio_id = $1 AND status = 'aberta'`, [id]);
  return { ok: true };
}

const STATUS_ORC = { enviado: 'Enviado', respondido: 'Respondido', fechado: 'Fechado', recusado: 'Recusado', cancelado: 'Cancelado' };
export async function listarPedidosEquipe({ pagina: p } = {}) {
  const pg = pagina(p);
  const total = Number((await consulta('SELECT COUNT(*) n FROM orcamentos')).rows[0].n);
  const { rows } = await consulta(
    `SELECT o.id, o.status, o.criado_em, o.data_desejada, a.titulo, c.nome AS contratante, f.nome AS fornecedor, av.nota
     FROM orcamentos o JOIN anuncios a ON a.id = o.anuncio_id JOIN usuarios c ON c.id = o.contratante_id JOIN usuarios f ON f.id = o.fornecedor_id
     LEFT JOIN avaliacoes av ON av.orcamento_id = o.id
     ORDER BY o.criado_em DESC LIMIT ${POR_PAGINA} OFFSET ${(pg - 1) * POR_PAGINA}`);
  return {
    total, pagina: pg, porPagina: POR_PAGINA,
    itens: rows.map((o) => ({ id: Number(o.id), titulo: o.titulo, contratante: o.contratante, fornecedor: o.fornecedor, status: STATUS_ORC[o.status], criadoEm: o.criado_em, dataDesejada: o.data_desejada, nota: o.nota ?? null })),
  };
}

export async function listarPagamentosEquipe({ pagina: p } = {}) {
  const pg = pagina(p);
  const total = Number((await consulta('SELECT COUNT(*) n FROM pagamentos')).rows[0].n);
  const { rows } = await consulta(
    `SELECT p.id, p.origem, p.metodo, p.valor_centavos, p.pago_em, p.vence_em, u.id AS usuario_id, u.nome
     FROM pagamentos p JOIN usuarios u ON u.id = p.usuario_id ORDER BY p.pago_em DESC LIMIT ${POR_PAGINA} OFFSET ${(pg - 1) * POR_PAGINA}`);
  const ORIGEM = { site: 'Site', loja_google: 'Google Play', loja_apple: 'App Store' };
  const METODO = { pix: 'Pix', cartao: 'Cartão', loja: 'Loja' };
  return {
    total, pagina: pg, porPagina: POR_PAGINA,
    itens: rows.map((x) => ({ id: Number(x.id), usuarioId: Number(x.usuario_id), nome: x.nome, origem: ORIGEM[x.origem] ?? x.origem, metodo: METODO[x.metodo] ?? x.metodo, valor: reais(x.valor_centavos), pagoEm: x.pago_em, venceEm: x.vence_em })),
  };
}
