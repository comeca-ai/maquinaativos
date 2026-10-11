-- Placar de caixa: um número-vida por máquina, apurado pelo cron diário.
-- Snapshot por dia: a chave (produto, dia, metrica) torna a apuração idempotente
-- (rodar duas vezes no mesmo dia corrige a linha do dia, não duplica).
-- Não é log de transições — esse continua append-only em `transicoes`/`acessos`.
-- Regra anti-vaidade: só entra número que é dinheiro ou resposta entregue.
CREATE TABLE metricas (
  produto TEXT NOT NULL,
  dia     TEXT NOT NULL,                       -- AAAA-MM-DD (America/Sao_Paulo)
  metrica TEXT NOT NULL,                       -- ex.: provas_guardadas, defesas_pagas
  valor   REAL NOT NULL,
  origem  TEXT NOT NULL,                       -- de onde o número saiu (tabela.coluna)
  PRIMARY KEY (produto, dia, metrica)
);
