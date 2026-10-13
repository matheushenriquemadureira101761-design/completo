-- AGROVINC — marketplace: anúncios, fotos, pedidos de orçamento, contatos e avaliações

CREATE TABLE IF NOT EXISTS anuncios (
  id                 BIGSERIAL PRIMARY KEY,
  fornecedor_id      BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria          TEXT NOT NULL CHECK (categoria IN ('maquinas', 'implementos', 'fretes', 'servicos')),
  titulo             TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 5 AND 80),
  descricao          TEXT NOT NULL DEFAULT '' CHECK (char_length(descricao) <= 1500),
  preco_centavos     INTEGER CHECK (preco_centavos IS NULL OR preco_centavos > 0),   -- NULL = sob consulta
  unidade            TEXT CHECK (unidade IN ('hora', 'hectare', 'km', 'dia', 'servico')),
  caracteristicas    TEXT[] NOT NULL DEFAULT '{}',
  cidade             TEXT NOT NULL,
  uf                 CHAR(2) NOT NULL,
  lat                DOUBLE PRECISION NOT NULL,
  lng                DOUBLE PRECISION NOT NULL,
  raio_km            INTEGER NOT NULL DEFAULT 100 CHECK (raio_km BETWEEN 1 AND 2000),
  disponivel_em      DATE,                          -- NULL = disponível agora
  status             TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'removido')),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((preco_centavos IS NULL) = (unidade IS NULL))
);
CREATE INDEX IF NOT EXISTS anuncios_busca ON anuncios (status, categoria);
CREATE INDEX IF NOT EXISTS anuncios_fornecedor ON anuncios (fornecedor_id);

CREATE TABLE IF NOT EXISTS anuncio_fotos (
  id          BIGSERIAL PRIMARY KEY,
  anuncio_id  BIGINT NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
  arquivo     TEXT NOT NULL,
  ordem       SMALLINT NOT NULL DEFAULT 0,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamentos (
  id              BIGSERIAL PRIMARY KEY,
  anuncio_id      BIGINT NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
  contratante_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fornecedor_id   BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mensagem        TEXT NOT NULL DEFAULT '' CHECK (char_length(mensagem) <= 800),
  data_desejada   DATE,
  status          TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'respondido', 'fechado', 'recusado', 'cancelado')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orcamentos_contratante ON orcamentos (contratante_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS orcamentos_fornecedor ON orcamentos (fornecedor_id, criado_em DESC);

-- Quem tocou em "Chamar no WhatsApp" (o número só é entregue quando a pessoa pede o contato)
CREATE TABLE IF NOT EXISTS contatos (
  id              BIGSERIAL PRIMARY KEY,
  anuncio_id      BIGINT NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
  contratante_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Avaliação do fornecedor (vem depois de um orçamento fechado; a tela de avaliar entra numa próxima etapa)
CREATE TABLE IF NOT EXISTS avaliacoes (
  id              BIGSERIAL PRIMARY KEY,
  orcamento_id    BIGINT UNIQUE REFERENCES orcamentos(id) ON DELETE SET NULL,
  fornecedor_id   BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  contratante_id  BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  nota            SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario      TEXT CHECK (char_length(comentario) <= 500),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS avaliacoes_fornecedor ON avaliacoes (fornecedor_id);
