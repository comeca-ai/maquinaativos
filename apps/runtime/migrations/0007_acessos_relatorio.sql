-- Registro de acessos ganha dois tipos: 'relatorio' (relatório da prova gerado) e 'carimbo_tempo'
-- (reservado para o carimbo de tempo RFC 3161, ainda não ligado).
-- O SQLite não altera CHECK. Por isso a tabela é recriada COPIANDO TODAS AS LINHAS com os mesmos id, tipo,
-- origem e data. Nenhuma linha é alterada ou apagada. As travas append-only são recriadas iguais.
CREATE TABLE acessos_v2 (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  prova_id    TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('captura', 'pacote', 'arquivo_equipe', 'ancora', 'confirmacao', 'vedado', 'relatorio', 'carimbo_tempo')),
  origem_hash TEXT,
  em          TEXT NOT NULL
);
INSERT INTO acessos_v2 (id, prova_id, tipo, origem_hash, em) SELECT id, prova_id, tipo, origem_hash, em FROM acessos ORDER BY id;
DROP TABLE acessos;
ALTER TABLE acessos_v2 RENAME TO acessos;
CREATE INDEX idx_acessos_prova ON acessos (prova_id);
CREATE TRIGGER acessos_sem_update BEFORE UPDATE ON acessos BEGIN SELECT RAISE(ABORT, 'acessos é append-only'); END;
CREATE TRIGGER acessos_sem_delete BEFORE DELETE ON acessos BEGIN SELECT RAISE(ABORT, 'acessos é append-only'); END;
