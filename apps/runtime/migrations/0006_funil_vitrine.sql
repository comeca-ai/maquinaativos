-- Funil da vitrine: só CONTADORES agregados por dia. Nenhuma linha por pessoa, sem IP, sem cookie, sem terceiros.
CREATE TABLE contagem_vitrine (
  produto TEXT NOT NULL,
  etapa   TEXT NOT NULL CHECK (etapa IN ('visita', 'consentiu', 'escolheu', 'guardou', 'baixou', 'pediu_link', 'entrou')),
  dia     TEXT NOT NULL,                       -- AAAA-MM-DD (America/Sao_Paulo)
  total   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (produto, etapa, dia)
);
