-- Sinais anônimos do funil: quantas avaliações e quantos pedidos de ajuda por produto/motivo.
-- NÃO guarda nenhum dado do documento da pessoa (sem datas, placas ou CPF).
CREATE TABLE sinais (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  produto TEXT NOT NULL,
  tipo    TEXT NOT NULL CHECK (tipo IN ('avaliou', 'quero_ajuda')),
  motivo  TEXT,
  em      TEXT NOT NULL
);
CREATE INDEX idx_sinais_produto ON sinais (produto, tipo);

-- Interessados: só com consentimento explícito. É o "pagador potencial" do critério de morte.
-- LGPD: finalidade única (falar sobre este produto). Apague após o teste de 14 dias se a ideia morrer.
CREATE TABLE interesses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  produto      TEXT NOT NULL,
  contato      TEXT NOT NULL,
  motivo       TEXT,
  consentimento INTEGER NOT NULL CHECK (consentimento = 1),
  em           TEXT NOT NULL
);
CREATE INDEX idx_interesses_produto ON interesses (produto);
