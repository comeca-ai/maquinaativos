-- Esteira: ideias passam pelo funil (que é um produto: seu estado vive em `casos`).
CREATE TABLE ideias (
  id           TEXT PRIMARY KEY,
  titulo       TEXT NOT NULL,
  dor          TEXT NOT NULL,
  quem_paga    TEXT NOT NULL DEFAULT '',
  produto_alvo TEXT,                        -- nome do produto quando a ideia vira spec/produto
  inicio       TEXT NOT NULL,               -- AAAA-MM-DD, começa o relógio de 14 dias
  conversas_reais        INTEGER NOT NULL DEFAULT 0,
  disposicao_a_pagar     INTEGER NOT NULL DEFAULT 0,
  margem_por_caso_centavos INTEGER NOT NULL DEFAULT 0,
  evidencia_dor   INTEGER NOT NULL DEFAULT 0,
  sacada_copiavel INTEGER NOT NULL DEFAULT 0,
  notas        TEXT NOT NULL DEFAULT '',
  caso_id      TEXT,                        -- caso do funil (estado oficial)
  criado_em    TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_ideias_caso ON ideias (caso_id);

-- Pedidos: pagamento MANUAL nesta etapa (você envia o Pix e marca como pago). Stripe é o passo 2.
CREATE TABLE pedidos (
  id             TEXT PRIMARY KEY,
  produto        TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
  status         TEXT NOT NULL CHECK (status IN ('pendente', 'pago', 'cancelado')) DEFAULT 'pendente',
  contato        TEXT NOT NULL,
  consentimento  INTEGER NOT NULL CHECK (consentimento = 1),
  criado_em      TEXT NOT NULL,
  pago_em        TEXT
);
CREATE INDEX idx_pedidos_produto ON pedidos (produto, status);

-- Custos reais por produto (infra, IA, parceiro), para medir margem de verdade.
CREATE TABLE custos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  produto  TEXT NOT NULL,
  tipo     TEXT NOT NULL,
  centavos INTEGER NOT NULL CHECK (centavos >= 0),
  nota     TEXT NOT NULL DEFAULT '',
  em       TEXT NOT NULL
);
CREATE INDEX idx_custos_produto ON custos (produto);
