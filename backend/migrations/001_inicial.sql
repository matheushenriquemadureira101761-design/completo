-- AGROVINC — estrutura inicial do banco (PostgreSQL)

CREATE TABLE IF NOT EXISTS usuarios (
  id                BIGSERIAL PRIMARY KEY,
  whatsapp          TEXT NOT NULL UNIQUE,            -- só dígitos com DDI: 5566999999999
  nome              TEXT NOT NULL,
  email             TEXT,
  contratante       BOOLEAN NOT NULL DEFAULT FALSE,  -- a mesma conta pode ter os dois perfis
  fornecedor        BOOLEAN NOT NULL DEFAULT FALSE,
  cidade            TEXT NOT NULL,
  uf                CHAR(2) NOT NULL,
  fuso              TEXT NOT NULL,                    -- ex.: America/Cuiaba
  senha_hash        TEXT,                             -- opcional (entrar sem código)
  versao_termos     TEXT NOT NULL,
  aceite_termos_em  TIMESTAMPTZ NOT NULL,
  aceita_mensagens  BOOLEAN NOT NULL DEFAULT TRUE,    -- respondeu SAIR = FALSE (código e recibos continuam)
  documento         TEXT,                             -- CPF ou CNPJ, informado no pagamento
  teste_inicio      DATE NOT NULL,
  teste_fim         DATE NOT NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (contratante OR fornecedor)
);

CREATE TABLE IF NOT EXISTS assinaturas (
  usuario_id     BIGINT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  origem         TEXT NOT NULL CHECK (origem IN ('site', 'loja_google', 'loja_apple')),
  metodo         TEXT NOT NULL CHECK (metodo IN ('pix', 'cartao', 'loja')),
  dia_cobranca   SMALLINT NOT NULL CHECK (dia_cobranca BETWEEN 1 AND 31),
  vencimento     DATE NOT NULL,
  cancelada_em   TIMESTAMPTZ,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id              BIGSERIAL PRIMARY KEY,
  usuario_id      BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  origem          TEXT NOT NULL,
  metodo          TEXT NOT NULL,
  valor_centavos  INTEGER NOT NULL,
  id_externo      TEXT NOT NULL UNIQUE,              -- id da empresa de pagamento ou da loja (evita contar 2x)
  pago_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vence_em        DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS codigos_acesso (
  id           BIGSERIAL PRIMARY KEY,
  whatsapp     TEXT NOT NULL,
  canal        TEXT NOT NULL CHECK (canal IN ('whatsapp', 'sms', 'email')),
  destino      TEXT NOT NULL,                        -- número ou e-mail para onde foi
  codigo_hash  TEXT NOT NULL,                        -- nunca o código em si
  expira_em    TIMESTAMPTZ NOT NULL,
  tentativas   SMALLINT NOT NULL DEFAULT 0,
  usado_em     TIMESTAMPTZ,
  ip           TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS codigos_por_numero ON codigos_acesso (whatsapp, criado_em DESC);
CREATE INDEX IF NOT EXISTS codigos_por_ip ON codigos_acesso (ip, criado_em DESC);

-- Depois de confirmar o código, a pessoa recebe um "passe" curto para concluir o cadastro.
CREATE TABLE IF NOT EXISTS verificacoes (
  token_hash  TEXT PRIMARY KEY,
  whatsapp    TEXT NOT NULL,
  expira_em   TIMESTAMPTZ NOT NULL,
  usado_em    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessoes (
  id             BIGSERIAL PRIMARY KEY,
  usuario_id     BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL UNIQUE,
  plataforma     TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_uso_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrada_em   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mensagens (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo          TEXT NOT NULL,
  canal         TEXT NOT NULL,
  destino       TEXT NOT NULL,
  chave         TEXT NOT NULL UNIQUE,                -- impede mandar a mesma mensagem 2x
  status        TEXT NOT NULL DEFAULT 'na_fila',     -- na_fila | enviada | entregue | lida | falhou | simulada
  provedor_id   TEXT,
  erro          TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mensagens_provedor ON mensagens (provedor_id);

CREATE TABLE IF NOT EXISTS links_pagamento (
  token_hash  TEXT PRIMARY KEY,
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em   TIMESTAMPTZ NOT NULL,
  usado_em    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pesquisas (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  nota        SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_tokens (
  token       TEXT PRIMARY KEY,
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  plataforma  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guarda só um "resumo embaralhado" do número: mesmo se a conta for excluída,
-- impede ganhar um novo teste grátis com o mesmo WhatsApp.
CREATE TABLE IF NOT EXISTS testes_usados (
  whatsapp_hash  TEXT PRIMARY KEY,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migracoes (
  nome       TEXT PRIMARY KEY,
  aplicada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
