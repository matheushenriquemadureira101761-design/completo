// Modelos de mensagem. O `texto` de cada um é exatamente o que deve ser cadastrado na Meta
// (WhatsApp Manager → Modelos de mensagem), com as variáveis {{1}}, {{2}}... na mesma ordem.
// Os botões de link usam a URL base + {{1}} (o código do link pessoal de pagamento).

const corpo = (...valores) => ({ type: 'body', parameters: valores.map((v) => ({ type: 'text', text: String(v) })) });
const botaoLink = (sufixo, indice = 0) => ({ type: 'button', sub_type: 'url', index: String(indice), parameters: [{ type: 'text', text: String(sufixo) }] });

export const MODELOS = {
  codigo_acesso: {
    categoria: 'AUTHENTICATION', essencial: true,
    texto: '{{1}} é o seu código de acesso da AGROVINC. Por segurança, não compartilhe com ninguém.',
    botao: 'Copiar código (tipo "copiar código"; no Android pode ser "preencher automaticamente")',
    whatsapp: (v) => [corpo(v.codigo), botaoLink(v.codigo)],
    sms: (v) => `AGROVINC: seu código de acesso é ${v.codigo}. Não compartilhe.`,
    email: (v) => ({ assunto: `Seu código de acesso: ${v.codigo}`, texto: `Olá!\n\nSeu código de acesso da AGROVINC é ${v.codigo}.\nEle vale por ${v.validade} minutos. Não compartilhe com ninguém.\n\nSe não foi você que pediu, ignore este e-mail.` }),
  },
  boas_vindas_teste: {
    categoria: 'UTILITY', essencial: true,
    texto: 'Olá, {{1}}! Seu cadastro na AGROVINC foi feito.\n\nSeu teste grátis de 7 dias já começou e vai até {{2}}. Pode usar à vontade, sem cartão e sem cobrança.\n\nPerto do fim do teste a gente te avisa por aqui. Qualquer dúvida, é só responder esta mensagem.',
    botao: 'Abrir o app → link fixo: {URL_SITE}/app',
    whatsapp: (v) => [corpo(v.nome, v.ate)],
    email: (v) => ({ assunto: 'Seu teste grátis de 7 dias começou', texto: `Olá, ${v.nome}!\n\nSeu cadastro na AGROVINC foi feito. O teste grátis vai até ${v.ate}, sem cartão e sem cobrança.` }),
  },
  teste_faltam_2_dias: {
    categoria: 'UTILITY',
    texto: '{{1}}, faltam 2 dias para acabar o seu teste grátis da AGROVINC (vai até {{2}}).\nPara continuar usando depois disso, é só assinar: R$ {{3}} por mês. Dá para assinar direto no app ou pagar com Pix ou cartão pelo botão abaixo.',
    botao: 'Ativar minha assinatura → {URL_SITE}/ativar/{{1}}',
    whatsapp: (v) => [corpo(v.nome, v.ate, v.valor), botaoLink(v.link)],
    email: (v) => ({ assunto: 'Faltam 2 dias para acabar o seu teste grátis', texto: `${v.nome}, seu teste grátis vai até ${v.ate}.\nPara continuar: R$ ${v.valor} por mês. Assine no app ou pague por aqui: ${v.url}` }),
    push: (v) => ({ titulo: 'Seu teste grátis termina em 2 dias', corpo: `O teste vai até ${v.ate}. Toque para ver como continuar.` }),
  },
  teste_ultimo_dia: {
    categoria: 'UTILITY',
    texto: 'Hoje é o último dia do seu teste grátis, {{1}}. Amanhã o acesso será pausado se a assinatura não estiver ativa.\nAssine no app ou pelo botão abaixo e continue sem parar.',
    botao: 'Ativar minha assinatura → {URL_SITE}/ativar/{{1}}',
    whatsapp: (v) => [corpo(v.nome), botaoLink(v.link)],
    email: (v) => ({ assunto: 'Hoje é o último dia do seu teste grátis', texto: `${v.nome}, amanhã o acesso será pausado se a assinatura não estiver ativa.\nAssine no app ou por aqui: ${v.url}` }),
    push: () => ({ titulo: 'Hoje é o último dia do teste grátis', corpo: 'Amanhã o acesso será pausado se a assinatura não estiver ativa.' }),
  },
  teste_terminou: {
    categoria: 'UTILITY',
    texto: '{{1}}, seu teste grátis terminou e o acesso ao app foi pausado. Seus anúncios e contatos continuam guardados.\nÉ só assinar no app ou pagar pelo botão abaixo para voltar na hora.',
    botao: 'Ativar e voltar a usar → {URL_SITE}/ativar/{{1}}',
    whatsapp: (v) => [corpo(v.nome), botaoLink(v.link)],
    email: (v) => ({ assunto: 'Seu teste grátis terminou', texto: `${v.nome}, seu acesso foi pausado. Para voltar: assine no app ou pague por aqui: ${v.url}` }),
    push: () => ({ titulo: 'Seu teste grátis terminou', corpo: 'Toque para assinar e voltar a usar na hora.' }),
  },
  pesquisa_satisfacao: {
    categoria: 'UTILITY',
    texto: 'Uma pergunta rápida, só se quiser responder: como foi sua semana na AGROVINC, {{1}}?\nResponda com uma nota de 1 a 5. Se quiser, conte também o que faltou.',
    botao: '(sem botão: a pessoa responde com texto)',
    whatsapp: (v) => [corpo(v.nome)],
  },
  lembrete_vencimento: {
    categoria: 'UTILITY',
    texto: 'Olá, {{1}}! Sua assinatura AGROVINC (R$ {{2}}) vence amanhã, {{3}}.\nSe quiser, já pode deixar paga pelo botão abaixo.',
    botao: 'Pagar → {URL_SITE}/ativar/{{1}}',
    whatsapp: (v) => [corpo(v.nome, v.valor, v.data), botaoLink(v.link)],
    email: (v) => ({ assunto: `Sua assinatura vence amanhã (${v.data})`, texto: `${v.nome}, sua assinatura de R$ ${v.valor} vence amanhã, ${v.data}.\nPague por aqui: ${v.url}` }),
    push: (v) => ({ titulo: 'Sua assinatura vence amanhã', corpo: `O vencimento é amanhã, ${v.data}.` }),
  },
  vencimento_hoje: {
    categoria: 'UTILITY',
    texto: '{{1}}, hoje é o dia do vencimento da sua assinatura AGROVINC (R$ {{2}}). Toque abaixo para pagar com Pix ou cartão.',
    botao: 'Pagar agora → {URL_SITE}/ativar/{{1}}',
    whatsapp: (v) => [corpo(v.nome, v.valor), botaoLink(v.link)],
    email: (v) => ({ assunto: 'Sua assinatura vence hoje', texto: `${v.nome}, hoje vence sua assinatura de R$ ${v.valor}. Pague por aqui: ${v.url}` }),
    push: () => ({ titulo: 'Sua assinatura vence hoje', corpo: 'Hoje é o dia do vencimento da sua assinatura.' }),
  },
  cobranca_atrasada: {
    categoria: 'UTILITY',
    texto: '{{1}}, sua assinatura venceu ontem. Pague até {{2}} para não ter o acesso pausado.',
    botao: 'Pagar agora → {URL_SITE}/ativar/{{1}}',
    whatsapp: (v) => [corpo(v.nome, v.data), botaoLink(v.link)],
    email: (v) => ({ assunto: 'Sua assinatura venceu', texto: `${v.nome}, pague até ${v.data} para não ter o acesso pausado: ${v.url}` }),
    push: () => ({ titulo: 'Sua assinatura venceu', corpo: 'Venceu ontem. Seu acesso será pausado em 2 dias.' }),
  },
  ultimo_aviso: {
    categoria: 'UTILITY',
    texto: 'Último aviso, {{1}}: amanhã, {{2}}, seu acesso à AGROVINC será pausado. Pague hoje para continuar usando sem parar.',
    botao: 'Pagar agora → {URL_SITE}/ativar/{{1}}',
    whatsapp: (v) => [corpo(v.nome, v.data), botaoLink(v.link)],
    email: (v) => ({ assunto: 'Último aviso: amanhã seu acesso será pausado', texto: `${v.nome}, pague hoje para continuar: ${v.url}` }),
    push: () => ({ titulo: 'Amanhã seu acesso será pausado', corpo: 'A assinatura venceu há 2 dias.' }),
  },
  acesso_pausado: {
    categoria: 'UTILITY',
    texto: '{{1}}, seu acesso foi pausado porque a assinatura venceu há 3 dias. Seus anúncios e contatos continuam guardados. É só pagar para voltar na hora.',
    botao: 'Pagar e voltar a usar → {URL_SITE}/ativar/{{1}}',
    whatsapp: (v) => [corpo(v.nome), botaoLink(v.link)],
    email: (v) => ({ assunto: 'Seu acesso foi pausado', texto: `${v.nome}, para voltar a usar é só pagar: ${v.url}` }),
    push: () => ({ titulo: 'Seu acesso foi pausado', corpo: 'Toque para assinar e voltar a usar na hora.' }),
  },
  recibo_pix: {
    categoria: 'UTILITY', essencial: true,
    texto: 'Pagamento recebido! Pix de R$ {{1}} em {{2}}.\nSua assinatura AGROVINC está ativa até {{3}}. O próximo Pix chega aqui nesse dia.',
    botao: '(opcional) Ver recibo → {URL_SITE}/recibo/{{1}}',
    whatsapp: (v) => [corpo(v.valor, v.data, v.ate)],
    email: (v) => ({ assunto: 'Pagamento recebido', texto: `Pix de R$ ${v.valor} em ${v.data}. Assinatura ativa até ${v.ate}.` }),
  },
  recibo_cartao: {
    categoria: 'UTILITY', essencial: true,
    texto: 'Cobrança aprovada no cartão final {{1}}: R$ {{2}}.\nSua assinatura está ativa até {{3}}.',
    botao: '(opcional) Ver recibo → {URL_SITE}/recibo/{{1}}',
    whatsapp: (v) => [corpo(v.final, v.valor, v.ate)],
    email: (v) => ({ assunto: 'Cobrança aprovada', texto: `Cartão final ${v.final}: R$ ${v.valor}. Assinatura ativa até ${v.ate}.` }),
  },
  cartao_recusado: {
    categoria: 'UTILITY', essencial: true,
    texto: '{{1}}, não conseguimos cobrar a assinatura no cartão final {{2}} (pode ser falta de limite ou cartão vencido).\nPague com Pix ou troque o cartão para não ter o acesso pausado.',
    botao: 'Pagar ou trocar cartão → {URL_SITE}/ativar/{{1}}',
    whatsapp: (v) => [corpo(v.nome, v.final), botaoLink(v.link)],
    email: (v) => ({ assunto: 'Não conseguimos cobrar no seu cartão', texto: `${v.nome}, pague com Pix ou troque o cartão: ${v.url}` }),
  },
};

MODELOS.novo_orcamento = {
  categoria: 'UTILITY', essencial: true,
  texto: 'Olá, {{1}}! {{4}} pediu um orçamento para o seu anúncio "{{2}}", {{3}}.\nAbra o app AGROVINC em Pedidos para ver e responder.',
  botao: 'Abrir o app → link fixo: {URL_SITE}/app',
  whatsapp: (v) => [corpo(v.nome, v.titulo, v.quando, v.contratante)],
  email: (v) => ({ assunto: `Novo pedido de orçamento: ${v.titulo}`, texto: `${v.nome}, ${v.contratante} pediu um orçamento para "${v.titulo}", ${v.quando}. Abra o app AGROVINC em Pedidos.` }),
  push: (v) => ({ titulo: 'Novo pedido de orçamento', corpo: `${v.contratante} quer contratar "${v.titulo}", ${v.quando}.` }),
};

export const TIPOS = Object.keys(MODELOS);
