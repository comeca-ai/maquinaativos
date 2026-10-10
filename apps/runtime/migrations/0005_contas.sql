-- Contas por link mágico (Cloudflare Email Service). O e-mail NUNCA é gravado:
-- só um HMAC dele (email_hash) com o segredo SEGREDO_CONTA. Sem o segredo não há como voltar ao e-mail.
CREATE TABLE contas (
  id         TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL UNIQUE,
  criada_em  TEXT NOT NULL
);

-- Link de entrada: vale 15 minutos e uma vez só. Guardamos só o SHA-256 do token.
CREATE TABLE links_login (
  token_hash     TEXT PRIMARY KEY,
  email_hash     TEXT NOT NULL,
  origem_hash    TEXT NOT NULL,                -- HMAC do IP, só para limitar abuso
  produto        TEXT,
  vincular_prova TEXT,                         -- prova que a pessoa provou ser dela (com o código) e quer guardar na conta
  criado_em      TEXT NOT NULL,
  expira_em      TEXT NOT NULL,
  usado_em       TEXT
);
CREATE INDEX idx_links_email ON links_login (email_hash, criado_em);
CREATE INDEX idx_links_origem ON links_login (origem_hash, criado_em);

-- Sessão: cookie HttpOnly com token aleatório; aqui só o SHA-256 dele.
CREATE TABLE sessoes (
  token_hash   TEXT PRIMARY KEY,
  conta_id     TEXT NOT NULL,
  criada_em    TEXT NOT NULL,
  expira_em    TEXT NOT NULL,
  encerrada_em TEXT
);
CREATE INDEX idx_sessoes_conta ON sessoes (conta_id);

-- Prova pode pertencer a uma conta (quando enviada logado, ou vinculada depois com o código de recuperação).
ALTER TABLE provas ADD COLUMN conta_id TEXT;
CREATE INDEX idx_provas_conta ON provas (conta_id, gravado_em);
