import crypto from 'node:crypto';
import { urlFoto, salvarFoto, apagarFoto } from './armazenamento.js';
import { consulta, transacao } from '../db.js';
import { ErroApp } from '../lib/erros.js';
import { cidadeExiste, normalizarTexto } from '../lib/validacao.js';
import { coordenadas, distanciaKm } from '../lib/distancia.js';
import { agoraLocal, somarDias, formatarDataBR } from '../lib/datas.js';
import { enviarMensagem } from './mensagens/index.js';
import { temPalavraProibida } from '../lib/filtro.js';
import { primeiroNome } from './assinaturas.js';
import { idsBloqueados, anunciosDenunciadosPor, haBloqueio } from './moderacao.js';

export const CATEGORIAS = { maquinas: 'Máquinas', implementos: 'Implementos', fretes: 'Fretes', servicos: 'Serviços' };
export const UNIDADES = { hora: '/hora', hectare: '/hectare', km: '/km', dia: '/dia', servico: '/serviço' };
export { PASTA_FOTOS } from './armazenamento.js';
const MAX_FOTOS = 6;
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const precoTexto = (centavos) => {
  if (centavos == null) return 'Sob consulta';
  const v = centavos / 100;
  return 'R$ ' + (Number.isInteger(v) ? v.toLocaleString('pt-BR') : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
};

function diaDaSemana(data) {
  const [y, m, d] = data.split('-').map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "Disponível hoje" / "Disponível amanhã" / "A partir de qui, 08/10" — no fuso de quem está vendo. */
export function disponibilidadeTexto(disponivelEm, hoje) {
  if (!disponivelEm || disponivelEm <= hoje) return 'Disponível hoje';
  if (disponivelEm === somarDias(hoje, 1)) return 'Disponível amanhã';
  return `A partir de ${diaDaSemana(disponivelEm)}, ${formatarDataBR(disponivelEm, false)}`;
}

// ---------------- Validação do anúncio ----------------
function validarDados(d, parcial = false) {
  const erro = (m, c) => { throw new ErroApp(400, m, c); };
  const out = {};
  if (!parcial || d.categoria !== undefined) { if (!CATEGORIAS[d.categoria]) erro('Escolha a categoria do anúncio.', 'categoria'); out.categoria = d.categoria; }
  if (!parcial || d.titulo !== undefined) {
    const t = String(d.titulo ?? '').trim().replace(/\s+/g, ' ');
    if (t.length < 5) erro('O título precisa ter pelo menos 5 letras. Ex.: "Trator 110 cv com operador".', 'titulo');
    if (t.length > 80) erro('O título pode ter no máximo 80 letras.', 'titulo');
    out.titulo = t;
  }
  if (!parcial || d.descricao !== undefined) {
    const t = String(d.descricao ?? '').trim();
    if (t.length > 1500) erro('A descrição pode ter no máximo 1.500 letras.', 'descricao');
    out.descricao = t;
  }
  if (!parcial || d.precoCentavos !== undefined || d.unidade !== undefined) {
    if (d.precoCentavos == null || d.precoCentavos === '') { out.preco_centavos = null; out.unidade = null; }
    else {
      const c = Number(d.precoCentavos);
      if (!Number.isInteger(c) || c <= 0 || c > 100000000) erro('Confira o preço.', 'preco');
      if (!UNIDADES[d.unidade]) erro('Escolha se o preço é por hora, hectare, km, dia ou serviço.', 'unidade');
      out.preco_centavos = c; out.unidade = d.unidade;
    }
  }
  if (!parcial || d.caracteristicas !== undefined) {
    const lista = Array.isArray(d.caracteristicas) ? d.caracteristicas : [];
    const limpa = [...new Set(lista.map((x) => String(x).trim().replace(/\s+/g, ' ')).filter(Boolean))];
    if (limpa.length > 10) erro('Escolha no máximo 10 características.', 'caracteristicas');
    if (limpa.some((x) => x.length > 40)) erro('Cada característica pode ter no máximo 40 letras.', 'caracteristicas');
    out.caracteristicas = limpa;
  }
  // Filtro de conteúdo (exigência das lojas): barra palavrões e ofensas no texto do anúncio.
  if ([out.titulo, out.descricao, ...(out.caracteristicas || [])].some((t) => t && temPalavraProibida(t))) {
    erro('O anúncio tem palavras que não são permitidas. Revise o texto, por favor.', 'palavra_proibida');
  }
  if (!parcial || d.cidade !== undefined || d.uf !== undefined) {
    if (!cidadeExiste(d.cidade, d.uf)) erro('Escolha a cidade do anúncio na lista.', 'cidade');
    const [lat, lng] = coordenadas(d.cidade, d.uf);
    Object.assign(out, { cidade: d.cidade, uf: d.uf, lat, lng });
  }
  if (!parcial || d.raioKm !== undefined) {
    const r = Number(d.raioKm ?? 100);
    if (!Number.isInteger(r) || r < 1 || r > 2000) erro('O raio de atendimento precisa estar entre 1 e 2.000 km.', 'raio');
    out.raio_km = r;
  }
  if (!parcial || d.disponivelEm !== undefined) {
    if (d.disponivelEm && !/^\d{4}-\d{2}-\d{2}$/.test(d.disponivelEm)) erro('Data de disponibilidade inválida.', 'disponivel_em');
    out.disponivel_em = d.disponivelEm || null;
  }
  return out;
}

// ---------------- Leitura ----------------
async function reputacao(ids) {
  if (!ids.length) return new Map();
  const r = await consulta(`SELECT fornecedor_id, ROUND(AVG(nota)::numeric, 1) AS media, COUNT(*)::int AS total FROM avaliacoes WHERE fornecedor_id = ANY($1) GROUP BY fornecedor_id`, [ids]);
  return new Map(r.rows.map((x) => [String(x.fornecedor_id), { media: Number(x.media), total: x.total }]));
}

const fotoUrl = urlFoto;
const iniciais = (nome) => String(nome).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

function resumo(a, usuario, hoje, rep) {
  const r = rep.get(String(a.fornecedor_id));
  return {
    id: Number(a.id), categoria: a.categoria, categoriaNome: CATEGORIAS[a.categoria], titulo: a.titulo,
    preco: precoTexto(a.preco_centavos), unidade: a.unidade ? UNIDADES[a.unidade] : '', precoCentavos: a.preco_centavos, unidadeCodigo: a.unidade,
    cidade: a.cidade, uf: a.uf, distanciaKm: distanciaKm(usuario.cidade, usuario.uf, a.cidade, a.uf),
    disponibilidade: disponibilidadeTexto(a.disponivel_em, hoje), disponivelEm: a.disponivel_em,
    foto: a.foto ? fotoUrl(a.foto) : null, nota: r?.media ?? null, avaliacoes: r?.total ?? 0,
    meu: String(a.fornecedor_id) === String(usuario.id), status: a.status,
  };
}

/**
 * Lista anúncios ativos perto da pessoa.
 * Filtros: categoria, q (texto, sem precisar de acento), raio (km, a partir da cidade da pessoa), ordem (distancia | recentes).
 */
export async function listarAnuncios(usuario, { categoria, q, raio = 150, ordem = 'distancia', pagina = 1 } = {}) {
  const raioKm = Math.min(Math.max(Number(raio) || 150, 5), 3000);
  const [lat, lng] = coordenadas(usuario.cidade, usuario.uf) ?? [0, 0];
  const dLat = raioKm / 111;
  const dLng = raioKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  const valores = [lat - dLat, lat + dLat, lng - dLng, lng + dLng];
  let filtro = '';
  if (categoria && CATEGORIAS[categoria]) { valores.push(categoria); filtro = ` AND a.categoria = $${valores.length}`; }
  const { rows } = await consulta(
    `SELECT a.*, (SELECT arquivo FROM anuncio_fotos f WHERE f.anuncio_id = a.id ORDER BY ordem, id LIMIT 1) AS foto
     FROM anuncios a JOIN usuarios u ON u.id = a.fornecedor_id
     WHERE a.status = 'ativo' AND NOT a.em_analise AND u.suspenso_em IS NULL AND a.lat BETWEEN $1 AND $2 AND a.lng BETWEEN $3 AND $4${filtro}`, valores);
  const hoje = agoraLocal(usuario.fuso).data;
  const termos = q ? normalizarTexto(q).split(' ').filter(Boolean) : [];
  const bloqueados = new Set(await idsBloqueados(usuario.id));
  const denunciados = new Set(await anunciosDenunciadosPor(usuario.id));
  let lista = rows.filter((a) => !bloqueados.has(String(a.fornecedor_id)) && !denunciados.has(String(a.id))).filter((a) => {
    if (!termos.length) return true;
    const texto = normalizarTexto(`${a.titulo} ${a.descricao} ${a.caracteristicas.join(' ')} ${CATEGORIAS[a.categoria]} ${a.cidade}`);
    return termos.every((t) => texto.includes(t));
  });
  const rep = await reputacao([...new Set(lista.map((a) => a.fornecedor_id))]);
  lista = lista.map((a) => ({ ...resumo(a, usuario, hoje, rep), _criado: a.criado_em })).filter((a) => a.distanciaKm == null || a.distanciaKm <= raioKm);
  lista.sort(ordem === 'recentes' ? (a, b) => b._criado - a._criado : (a, b) => (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9) || b._criado - a._criado);
  const porPagina = 30;
  const p = Math.max(1, Number(pagina) || 1);
  return { total: lista.length, raioKm, itens: lista.slice((p - 1) * porPagina, p * porPagina).map(({ _criado, ...x }) => x) };
}

export async function obterAnuncio(usuario, id) {
  const a = (await consulta(`SELECT a.*, u.nome AS fornecedor_nome, u.criado_em AS fornecedor_desde FROM anuncios a JOIN usuarios u ON u.id = a.fornecedor_id WHERE a.id = $1`, [id])).rows[0];
  const dono = a && String(a.fornecedor_id) === String(usuario.id);
  if (!a || a.status === 'removido' || (!dono && (a.status === 'pausado' || a.em_analise))) throw new ErroApp(404, 'Este anúncio não está mais disponível.', 'anuncio_inexistente');
  if (!dono && await haBloqueio(usuario.id, a.fornecedor_id)) throw new ErroApp(404, 'Este anúncio não está mais disponível.', 'anuncio_inexistente');
  if (!dono && (await anunciosDenunciadosPor(usuario.id)).includes(String(a.id))) throw new ErroApp(404, 'Você denunciou este anúncio. Nossa equipe está analisando.', 'anuncio_denunciado');
  const fotos = (await consulta('SELECT id, arquivo FROM anuncio_fotos WHERE anuncio_id = $1 ORDER BY ordem, id', [id])).rows;
  const hoje = agoraLocal(usuario.fuso).data;
  const rep = await reputacao([a.fornecedor_id]);
  const comentarios = await comentariosDoFornecedor(a.fornecedor_id, usuario.id);
  return {
    ...resumo({ ...a, foto: fotos[0]?.arquivo }, usuario, hoje, rep),
    comentarios,
    descricao: a.descricao, caracteristicas: a.caracteristicas, raioKm: a.raio_km, emAnalise: dono ? a.em_analise : undefined,
    fotos: fotos.map((f) => ({ id: Number(f.id), url: fotoUrl(f.arquivo) })),
    fornecedor: {
      id: Number(a.fornecedor_id), nome: a.fornecedor_nome, iniciais: iniciais(a.fornecedor_nome), whatsappConfirmado: true,
      desde: new Date(a.fornecedor_desde).getFullYear(), nota: rep.get(String(a.fornecedor_id))?.media ?? null, avaliacoes: rep.get(String(a.fornecedor_id))?.total ?? 0,
    },
  };
}

export async function meusAnuncios(usuario) {
  const { rows } = await consulta(
    `SELECT a.*, (SELECT arquivo FROM anuncio_fotos f WHERE f.anuncio_id = a.id ORDER BY ordem, id LIMIT 1) AS foto,
            (SELECT COUNT(*)::int FROM orcamentos o WHERE o.anuncio_id = a.id) AS pedidos
     FROM anuncios a WHERE a.fornecedor_id = $1 AND a.status <> 'removido' ORDER BY a.criado_em DESC`, [usuario.id]);
  const hoje = agoraLocal(usuario.fuso).data;
  const rep = await reputacao([usuario.id]);
  return rows.map((a) => ({ ...resumo(a, usuario, hoje, rep), pedidos: a.pedidos, emAnalise: a.em_analise }));
}

// ---------------- Escrita ----------------
export async function criarAnuncio(usuario, dados) {
  const d = validarDados(dados);
  return transacao(async (db) => {
    if (!usuario.fornecedor) await db.query('UPDATE usuarios SET fornecedor = TRUE WHERE id = $1', [usuario.id]); // a mesma conta ganha o perfil de fornecedor
    const { rows } = await db.query(
      `INSERT INTO anuncios (fornecedor_id, categoria, titulo, descricao, preco_centavos, unidade, caracteristicas, cidade, uf, lat, lng, raio_km, disponivel_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [usuario.id, d.categoria, d.titulo, d.descricao, d.preco_centavos, d.unidade, d.caracteristicas, d.cidade, d.uf, d.lat, d.lng, d.raio_km, d.disponivel_em]);
    return { id: Number(rows[0].id) };
  });
}

async function doFornecedor(usuario, id) {
  const a = (await consulta('SELECT * FROM anuncios WHERE id = $1', [id])).rows[0];
  if (!a || a.status === 'removido') throw new ErroApp(404, 'Anúncio não encontrado.', 'anuncio_inexistente');
  if (String(a.fornecedor_id) !== String(usuario.id)) throw new ErroApp(403, 'Só quem publicou pode mudar este anúncio.', 'nao_e_dono');
  return a;
}

export async function editarAnuncio(usuario, id, dados) {
  await doFornecedor(usuario, id);
  const d = validarDados(dados, true);
  const campos = Object.keys(d);
  if (!campos.length) return { id: Number(id) };
  await consulta(`UPDATE anuncios SET ${campos.map((c, i) => `${c} = $${i + 2}`).join(', ')}, atualizado_em = NOW() WHERE id = $1`, [id, ...campos.map((c) => d[c])]);
  return { id: Number(id) };
}

export async function mudarStatusAnuncio(usuario, id, status) {
  if (!['ativo', 'pausado', 'removido'].includes(status)) throw new ErroApp(400, 'Situação inválida.', 'status');
  await doFornecedor(usuario, id);
  await consulta('UPDATE anuncios SET status = $2, atualizado_em = NOW() WHERE id = $1', [id, status]);
  return { id: Number(id), status };
}

/** Recebe a foto em base64 (o app já manda redimensionada) e confere se é mesmo uma imagem. */
export async function adicionarFoto(usuario, id, { base64 }) {
  await doFornecedor(usuario, id);
  const total = Number((await consulta('SELECT COUNT(*) FROM anuncio_fotos WHERE anuncio_id = $1', [id])).rows[0].count);
  if (total >= MAX_FOTOS) throw new ErroApp(400, `Cada anúncio pode ter até ${MAX_FOTOS} fotos.`, 'muitas_fotos');
  const limpo = String(base64 ?? '').replace(/^data:image\/[a-z]+;base64,/, '');
  const buf = Buffer.from(limpo, 'base64');
  if (buf.length < 100) throw new ErroApp(400, 'Foto vazia ou inválida.', 'foto_invalida');
  if (buf.length > 3 * 1024 * 1024) throw new ErroApp(400, 'Foto grande demais (máximo 3 MB).', 'foto_grande');
  let ext = null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = 'jpg';
  else if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ext = 'png';
  else if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') ext = 'webp';
  if (!ext) throw new ErroApp(400, 'Envie uma foto em JPG, PNG ou WEBP.', 'foto_formato');
  const nome = `${id}-${crypto.randomBytes(12).toString('hex')}.${ext}`;
  await salvarFoto(nome, buf, ext);
  const { rows } = await consulta('INSERT INTO anuncio_fotos (anuncio_id, arquivo, ordem) VALUES ($1, $2, $3) RETURNING id', [id, nome, total]);
  return { id: Number(rows[0].id), url: fotoUrl(nome) };
}

export async function removerFoto(usuario, id, fotoId) {
  await doFornecedor(usuario, id);
  const r = (await consulta('DELETE FROM anuncio_fotos WHERE id = $1 AND anuncio_id = $2 RETURNING arquivo', [fotoId, id])).rows[0];
  if (r) await apagarFoto(r.arquivo);
  return { ok: true };
}

// ---------------- Orçamentos e contato ----------------
export async function pedirOrcamento(usuario, anuncioId, { mensagem = '', dataDesejada = null }) {
  const a = (await consulta(`SELECT id, titulo, fornecedor_id FROM anuncios WHERE id = $1 AND status = 'ativo'`, [anuncioId])).rows[0];
  if (!a) throw new ErroApp(404, 'Este anúncio não está mais disponível.', 'anuncio_inexistente');
  if (String(a.fornecedor_id) === String(usuario.id)) throw new ErroApp(400, 'Este anúncio é seu.', 'proprio_anuncio');
  if (await haBloqueio(usuario.id, a.fornecedor_id)) throw new ErroApp(403, 'Não é possível pedir orçamento para este anúncio.', 'bloqueado');
  if (dataDesejada && !/^\d{4}-\d{2}-\d{2}$/.test(dataDesejada)) throw new ErroApp(400, 'Data inválida.', 'data');
  const hoje = agoraLocal(usuario.fuso).data;
  if (dataDesejada && dataDesejada < hoje) throw new ErroApp(400, 'Escolha uma data de hoje em diante.', 'data');
  const msg = String(mensagem).trim().slice(0, 800);
  const aberto = (await consulta(`SELECT id FROM orcamentos WHERE anuncio_id = $1 AND contratante_id = $2 AND status = 'enviado' AND criado_em > NOW() - INTERVAL '1 day'`, [anuncioId, usuario.id])).rows[0];
  if (aberto) throw new ErroApp(409, 'Você já pediu orçamento para este anúncio hoje. O fornecedor vai responder pelo WhatsApp.', 'orcamento_repetido');
  const { rows } = await consulta(
    `INSERT INTO orcamentos (anuncio_id, contratante_id, fornecedor_id, mensagem, data_desejada) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [anuncioId, usuario.id, a.fornecedor_id, msg, dataDesejada]);
  const fornecedor = (await consulta('SELECT * FROM usuarios WHERE id = $1', [a.fornecedor_id])).rows[0];
  const quando = dataDesejada ? `para ${diaDaSemana(dataDesejada)}, ${formatarDataBR(dataDesejada, false)}` : 'sem data definida';
  await enviarMensagem({ usuario: fornecedor, tipo: 'novo_orcamento', chave: `orcamento:${rows[0].id}`,
    vars: { nome: primeiroNome(fornecedor.nome), titulo: a.titulo, quando, contratante: primeiroNome(usuario.nome) } });
  return { id: Number(rows[0].id) };
}

/** Entrega o link do WhatsApp do fornecedor só quando a pessoa pede o contato (e registra). */
export async function contatoWhatsApp(usuario, anuncioId) {
  const a = (await consulta(`SELECT a.titulo, a.fornecedor_id, u.whatsapp FROM anuncios a JOIN usuarios u ON u.id = a.fornecedor_id WHERE a.id = $1 AND a.status = 'ativo'`, [anuncioId])).rows[0];
  if (!a) throw new ErroApp(404, 'Este anúncio não está mais disponível.', 'anuncio_inexistente');
  if (await haBloqueio(usuario.id, a.fornecedor_id)) throw new ErroApp(403, 'Não é possível falar com este fornecedor.', 'bloqueado');
  await consulta('INSERT INTO contatos (anuncio_id, contratante_id) VALUES ($1, $2)', [anuncioId, usuario.id]);
  const texto = `Olá! Vi o seu anúncio "${a.titulo}" na AGROVINC e gostaria de mais informações.`;
  return { link: `https://wa.me/${a.whatsapp}?text=${encodeURIComponent(texto)}` };
}

const STATUS_ORC = { enviado: 'Enviado', respondido: 'Respondido', fechado: 'Fechado', recusado: 'Recusado', cancelado: 'Cancelado' };

export async function listarOrcamentos(usuario, papel) {
  const campo = papel === 'recebidos' ? 'o.fornecedor_id' : 'o.contratante_id';
  const outro = papel === 'recebidos' ? 'o.contratante_id' : 'o.fornecedor_id';
  const { rows } = await consulta(
    `SELECT o.*, a.titulo, a.categoria, u.nome AS outro_nome, u.whatsapp AS outro_whatsapp, av.nota AS nota_dada
     FROM orcamentos o JOIN anuncios a ON a.id = o.anuncio_id JOIN usuarios u ON u.id = ${outro}
     LEFT JOIN avaliacoes av ON av.orcamento_id = o.id
     WHERE ${campo} = $1 ORDER BY o.criado_em DESC LIMIT 100`, [usuario.id]);
  const bloqueados = new Set(await idsBloqueados(usuario.id));
  return rows.filter((o) => !bloqueados.has(String(papel === 'recebidos' ? o.contratante_id : o.fornecedor_id))).map((o) => ({
    id: Number(o.id), anuncioId: Number(o.anuncio_id), titulo: o.titulo, categoria: o.categoria, mensagem: o.mensagem,
    dataDesejada: o.data_desejada, quando: o.data_desejada ? `${diaDaSemana(o.data_desejada)}, ${formatarDataBR(o.data_desejada, false)}` : 'Sem data definida',
    status: o.status, statusNome: STATUS_ORC[o.status], criadoEm: o.criado_em, outroNome: o.outro_nome,
    outroId: Number(papel === 'recebidos' ? o.contratante_id : o.fornecedor_id), // para poder bloquear a pessoa
    notaDada: o.nota_dada ?? null,
    podeAvaliar: papel === 'enviados' && o.status === 'fechado' && o.nota_dada == null,
    // Quem recebeu o pedido pode chamar quem pediu no WhatsApp (o pedido já é o consentimento do contato).
    whatsapp: papel === 'recebidos' ? `https://wa.me/${o.outro_whatsapp}?text=${encodeURIComponent(`Olá, ${primeiroNome(o.outro_nome)}! Recebi seu pedido de orçamento na AGROVINC para "${o.titulo}".`)}` : null,
  }));
}

export async function mudarStatusOrcamento(usuario, id, status) {
  const o = (await consulta('SELECT * FROM orcamentos WHERE id = $1', [id])).rows[0];
  if (!o) throw new ErroApp(404, 'Pedido não encontrado.', 'orcamento_inexistente');
  const souFornecedor = String(o.fornecedor_id) === String(usuario.id);
  const souContratante = String(o.contratante_id) === String(usuario.id);
  const permitido = (souFornecedor && ['respondido', 'fechado', 'recusado'].includes(status)) || (souContratante && ['cancelado', 'fechado'].includes(status));
  if (!permitido) throw new ErroApp(403, 'Você não pode mudar este pedido para essa situação.', 'status_orcamento');
  await consulta('UPDATE orcamentos SET status = $2, atualizado_em = NOW() WHERE id = $1', [id, status]);
  return { id: Number(id), status };
}

// ---------------- Avaliações ----------------
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Últimas avaliações com comentário (as de quem a pessoa bloqueou não aparecem). */
export async function comentariosDoFornecedor(fornecedorId, usuarioId, limite = 5) {
  const { rows } = await consulta(
    `SELECT av.nota, av.comentario, av.criado_em, av.contratante_id, u.nome
     FROM avaliacoes av LEFT JOIN usuarios u ON u.id = av.contratante_id
     WHERE av.fornecedor_id = $1 AND av.comentario IS NOT NULL AND av.comentario <> ''
     ORDER BY av.criado_em DESC LIMIT 20`, [fornecedorId]);
  const bloqueados = new Set(await idsBloqueados(usuarioId));
  return rows.filter((r) => !r.contratante_id || !bloqueados.has(String(r.contratante_id))).slice(0, limite).map((r) => {
    const d = new Date(r.criado_em);
    return { nota: r.nota, comentario: r.comentario, nome: r.nome ? primeiroNome(r.nome) : 'Cliente', quando: `${MESES[d.getUTCMonth()]}/${d.getUTCFullYear()}` };
  });
}

/** O contratante avalia o fornecedor depois do negócio fechado (uma vez por pedido). */
export async function avaliar(usuario, orcamentoId, { nota, comentario = '' }) {
  const n = Number(nota);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new ErroApp(400, 'Escolha de 1 a 5 estrelas.', 'nota');
  const texto = String(comentario ?? '').trim().replace(/\s+/g, ' ');
  if (texto.length > 500) throw new ErroApp(400, 'O comentário pode ter no máximo 500 letras.', 'comentario');
  if (texto && temPalavraProibida(texto)) throw new ErroApp(400, 'O comentário tem palavras que não são permitidas. Revise o texto, por favor.', 'palavra_proibida');
  const o = (await consulta('SELECT * FROM orcamentos WHERE id = $1', [orcamentoId])).rows[0];
  if (!o || String(o.contratante_id) !== String(usuario.id)) throw new ErroApp(404, 'Pedido não encontrado.', 'orcamento_inexistente');
  if (o.status !== 'fechado') throw new ErroApp(400, 'Dá para avaliar depois que o negócio for fechado.', 'nao_fechado');
  const r = await consulta(
    `INSERT INTO avaliacoes (orcamento_id, fornecedor_id, contratante_id, nota, comentario) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (orcamento_id) DO NOTHING RETURNING id`, [o.id, o.fornecedor_id, usuario.id, n, texto || null]);
  if (!r.rowCount) throw new ErroApp(409, 'Você já avaliou este negócio. Obrigado!', 'ja_avaliado');
  return { id: Number(r.rows[0].id), nota: n };
}
