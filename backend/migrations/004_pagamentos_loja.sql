-- 004: empresa de pagamento (site), compras pela loja e id externo da assinatura.

-- Cliente da pessoa na empresa de pagamento (ex.: Asaas). Um por usuário.
CREATE TABLE IF NOT EXISTS pagamento_clientes (
  usuario_id  BIGINT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  provedor    TEXT NOT NULL,
  cliente_id  TEXT NOT NULL,
  documento   TEXT NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provedor, cliente_id)
);

-- Cobranças criadas pelo site: Pix avulso (um por mês) ou assinatura no cartão.
CREATE TABLE IF NOT EXISTS cobrancas (
  id_externo     TEXT PRIMARY KEY,                -- id na empresa de pagamento (cobrança ou assinatura)
  provedor       TEXT NOT NULL,
  usuario_id     BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('pix', 'assinatura_cartao')),
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'recusada', 'cancelada')),
  link_hash      TEXT,                            -- link pessoal que originou a cobrança
  dados          JSONB NOT NULL DEFAULT '{}',
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cobrancas_usuario ON cobrancas (usuario_id, criado_em DESC);

-- Assinatura no cartão (empresa de pagamento) ou compra original da loja: permite cancelar e localizar.
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS id_externo TEXT;

-- Compras feitas pela loja. A loja avisa renovações usando estes ids.
CREATE TABLE IF NOT EXISTS compras_loja (
  id_original    TEXT PRIMARY KEY,                -- Google: purchaseToken; Apple: originalTransactionId
  plataforma     TEXT NOT NULL CHECK (plataforma IN ('android', 'ios')),
  usuario_id     BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  produto        TEXT,
  vence_em       DATE,
  status         TEXT NOT NULL DEFAULT 'ativa',
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS compras_loja_usuario ON compras_loja (usuario_id);

-- Avaliações: uma por negócio fechado (o UNIQUE de orcamento_id já existe).
CREATE INDEX IF NOT EXISTS avaliacoes_recentes ON avaliacoes (fornecedor_id, criado_em DESC);
