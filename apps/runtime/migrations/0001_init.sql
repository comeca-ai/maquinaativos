-- Estado atual de cada caso.
CREATE TABLE casos (
  id            TEXT PRIMARY KEY,
  produto       TEXT NOT NULL,
  versao        TEXT NOT NULL,
  estado        TEXT NOT NULL,
  motivo        TEXT NOT NULL,
  final         INTEGER NOT NULL DEFAULT 0,
  prazo_ate     TEXT,
  criado_em     TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_casos_produto_estado ON casos (produto, estado);
CREATE INDEX idx_casos_prazo ON casos (prazo_ate) WHERE final = 0;

-- Log append-only: toda transição fica registrada, nunca é alterada nem apagada.
CREATE TABLE transicoes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id      TEXT NOT NULL,
  produto      TEXT NOT NULL,
  versao       TEXT NOT NULL,
  de           TEXT NOT NULL,
  para         TEXT NOT NULL,
  motivo       TEXT NOT NULL,
  hash_entrada TEXT NOT NULL,
  hoje         TEXT NOT NULL,
  em           TEXT NOT NULL
);
CREATE INDEX idx_transicoes_caso ON transicoes (caso_id);

CREATE TRIGGER transicoes_sem_update BEFORE UPDATE ON transicoes
BEGIN SELECT RAISE(ABORT, 'transicoes é append-only'); END;
CREATE TRIGGER transicoes_sem_delete BEFORE DELETE ON transicoes
BEGIN SELECT RAISE(ABORT, 'transicoes é append-only'); END;

-- Idempotência de efeitos: cada efeito roda no máximo uma vez por caso+estado.
CREATE TABLE efeitos_feitos (
  chave TEXT PRIMARY KEY,
  em    TEXT NOT NULL
);
