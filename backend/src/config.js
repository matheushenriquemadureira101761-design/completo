import 'dotenv/config';

const num = (v, padrao) => (v === undefined || v === '' ? padrao : Number(v));

export const config = {
  ambiente: process.env.NODE_ENV || 'development',
  porta: num(process.env.PORTA, 3333),
  bancoUrl: process.env.DATABASE_URL || 'postgres://agrovinc:agrovinc@localhost:5432/agrovinc',
  urlSite: process.env.URL_SITE || 'https://agrovinc.com.br',
  segredoServidor: process.env.SEGREDO_SERVIDOR || 'troque-este-segredo-em-producao',
  versaoTermos: process.env.VERSAO_TERMOS || '1.3',

  assinatura: { valorCentavos: num(process.env.VALOR_CENTAVOS, 2990) },

  codigo: {
    digitos: num(process.env.CODIGO_DIGITOS, 6),        // 6 é mais seguro que 4
    validadeMin: num(process.env.CODIGO_VALIDADE_MIN, 10),
    tentativas: num(process.env.CODIGO_TENTATIVAS, 5),
    esperaReenvioSeg: num(process.env.CODIGO_ESPERA_SEG, 60),
    maxPorHoraNumero: num(process.env.CODIGO_MAX_HORA_NUMERO, 5),
    maxPorHoraIp: num(process.env.CODIGO_MAX_HORA_IP, 60), // alto de propósito: nas operadoras, muita gente divide o mesmo IP
    limiteAuthPorMinutoIp: num(process.env.AUTH_LIMITE_MINUTO_IP, 120),
  },

  // API oficial do WhatsApp (Meta Cloud API). Sem token, o servidor funciona em "modo simulação".
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    numeroId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    versaoApi: process.env.WHATSAPP_API_VERSION || 'v21.0',
    segredoApp: process.env.WHATSAPP_APP_SECRET || '',       // confere a assinatura dos webhooks
    tokenVerificacao: process.env.WHATSAPP_VERIFY_TOKEN || '', // usado na hora de cadastrar o webhook na Meta
    idioma: process.env.WHATSAPP_IDIOMA || 'pt_BR',
  },

  email: {
    host: process.env.SMTP_HOST || '',
    porta: num(process.env.SMTP_PORTA, 587),
    usuario: process.env.SMTP_USUARIO || '',
    senha: process.env.SMTP_SENHA || '',
    remetente: process.env.EMAIL_REMETENTE || 'AGROVINC <nao-responda@agrovinc.com.br>',
  },

  pagamento: {
    segredoWebhook: process.env.PAGAMENTO_WEBHOOK_SEGREDO || '',
    validadeLinkDias: num(process.env.LINK_PAGAMENTO_DIAS, 7),
    provedor: (process.env.PAGAMENTO_PROVEDOR || '').toLowerCase(), // 'asaas' (vazio = simulação em modo de teste)
    asaas: {
      chave: process.env.ASAAS_API_KEY || '',
      url: (process.env.ASAAS_URL || 'https://api.asaas.com/v3').replace(/\/$/, ''), // teste: https://api-sandbox.asaas.com/v3
      tokenWebhook: process.env.ASAAS_WEBHOOK_TOKEN || '',
    },
  },

  // Desligado em produção: permite simular pagamentos e compras na loja durante os testes.
  modoTeste: (process.env.MODO_TESTE ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true',
};

if (config.ambiente === 'production' && config.segredoServidor.startsWith('troque')) {
  throw new Error('Defina SEGREDO_SERVIDOR no .env antes de rodar em produção.');
}
