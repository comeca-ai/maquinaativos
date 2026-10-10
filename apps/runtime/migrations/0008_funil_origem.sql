-- Funil por ORIGEM da visita (Instagram, Google, WhatsApp, campanha...). Continua só contador agregado por dia:
-- nenhuma linha por pessoa, sem IP, sem cookie. A origem é a mesma para todos que chegam pelo mesmo lugar.
-- A origem vem normalizada do servidor (lista conhecida, utm_source simples ou nome do site), com teto de
-- origens distintas por produto e dia: o que passa do teto conta como "outro". Assim ninguém enche a tabela.
CREATE TABLE contagem_origem (
  produto TEXT NOT NULL,
  dia     TEXT NOT NULL,                       -- AAAA-MM-DD (America/Sao_Paulo)
  origem  TEXT NOT NULL,
  etapa   TEXT NOT NULL CHECK (etapa IN ('visita', 'consentiu', 'escolheu', 'guardou', 'baixou', 'pediu_link', 'entrou')),
  total   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (produto, dia, origem, etapa)
);
