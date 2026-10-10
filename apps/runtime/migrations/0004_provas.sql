-- Captura de evidência: cofre (R2) + manifesto + âncora. Dados pessoais mínimos:
-- o IP NUNCA é gravado; só um HMAC dele (origem_hash) para limitar abuso por volume.
CREATE TABLE provas (
  id                TEXT PRIMARY KEY,
  produto           TEXT NOT NULL,
  caso_id           TEXT NOT NULL,
  chave_hash        TEXT NOT NULL,                 -- SHA-256 do código de recuperação (o código só existe na tela do usuário)
  origem            TEXT NOT NULL CHECK (origem IN ('navegador', 'arquivo_enviado')),
  nome_arquivo      TEXT NOT NULL,
  mime              TEXT NOT NULL,
  bytes             INTEGER NOT NULL CHECK (bytes > 0),
  sha256            TEXT NOT NULL,
  manifesto_sha256  TEXT NOT NULL,
  solicitado_em     TEXT NOT NULL,                 -- AAAA-MM-DD (America/Sao_Paulo)
  gravado_em        TEXT NOT NULL,                 -- ISO UTC, relógio do SERVIDOR
  gravado_em_dia    TEXT NOT NULL,                 -- AAAA-MM-DD (America/Sao_Paulo)
  origem_hash       TEXT NOT NULL,
  volume_na_captura INTEGER NOT NULL,              -- capturas da origem em 24h NO MOMENTO da captura
  ancora            TEXT NOT NULL DEFAULT 'nao_enviada' CHECK (ancora IN ('nao_enviada', 'enviada', 'confirmada')),
  ancora_enviada_em TEXT,                          -- AAAA-MM-DD
  ancora_calendarios INTEGER NOT NULL DEFAULT 0,
  chave_ots         TEXT,                          -- objeto R2 da prova pendente
  chave_ots_confirmada TEXT,                       -- objeto R2 da prova promovida (novo objeto: nada é sobrescrito)
  ots_altura        INTEGER,
  vedado            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_provas_origem ON provas (origem_hash, gravado_em);
CREATE INDEX idx_provas_ancora ON provas (ancora);

-- Todo acesso fica registrado e é imutável (append-only), inclusive os da equipe.
CREATE TABLE acessos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  prova_id    TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('captura', 'pacote', 'arquivo_equipe', 'ancora', 'confirmacao', 'vedado')),
  origem_hash TEXT,
  em          TEXT NOT NULL
);
CREATE INDEX idx_acessos_prova ON acessos (prova_id);
CREATE TRIGGER acessos_sem_update BEFORE UPDATE ON acessos BEGIN SELECT RAISE(ABORT, 'acessos é append-only'); END;
CREATE TRIGGER acessos_sem_delete BEFORE DELETE ON acessos BEGIN SELECT RAISE(ABORT, 'acessos é append-only'); END;

-- Recusas ficam registradas (com motivo), mas com teto por origem para o log não virar vetor de abuso.
CREATE TABLE recusas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  produto     TEXT NOT NULL,
  origem_hash TEXT NOT NULL,
  estado      TEXT NOT NULL,
  motivo      TEXT NOT NULL,
  caso_id     TEXT NOT NULL,
  em          TEXT NOT NULL
);
CREATE INDEX idx_recusas_origem ON recusas (origem_hash, em);
