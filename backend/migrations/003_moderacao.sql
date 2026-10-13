-- AGROVINC — moderação (exigência das lojas para conteúdo publicado por usuários):
-- denúncias de anúncios, bloqueio entre usuários e suspensão de conta pela equipe.

-- Anúncio com denúncias suficientes sai da lista até a equipe analisar.
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS em_analise BOOLEAN NOT NULL DEFAULT FALSE;
-- Conta suspensa pela equipe: não entra no app e os anúncios somem.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspenso_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS denuncias (
  id              BIGSERIAL PRIMARY KEY,
  anuncio_id      BIGINT NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
  denunciado_id   BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  denunciante_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motivo          TEXT NOT NULL CHECK (motivo IN ('golpe', 'proibido', 'ofensivo', 'falso', 'outro')),
  detalhe         TEXT NOT NULL DEFAULT '' CHECK (char_length(detalhe) <= 500),
  status          TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'procedente', 'improcedente')),
  acao            TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolvido_em    TIMESTAMPTZ,
  UNIQUE (denunciante_id, anuncio_id)
);
CREATE INDEX IF NOT EXISTS denuncias_abertas ON denuncias (status, criado_em);

CREATE TABLE IF NOT EXISTS bloqueios (
  bloqueador_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  bloqueado_id   BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bloqueador_id, bloqueado_id),
  CHECK (bloqueador_id <> bloqueado_id)
);
CREATE INDEX IF NOT EXISTS bloqueios_bloqueado ON bloqueios (bloqueado_id);
