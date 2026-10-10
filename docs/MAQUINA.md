# A máquina: estrutura, fluxo e mapa de custos

Passo 1 = a máquina funcionando sem cobrança automática. Passo 2 = pagamento (Stripe ou outro): **não implementado**.

## Estrutura de diretórios
```
.claude/agents/          fábrica: pesquisador, concretizador, adversario, especificador, implementador, revisor
.claude/skills/jhoneme/  método Cloudflare (mapa produto→rota→Worker→binding→dado→custo). Contexto privado do dono NÃO é versionado.
packages/core/           contrato defineProduto, motor, tela, preco (preço como dado)
packages/kits/           chamadas por API (cloudflare.ts); pagamentos/ só no passo 2
apps/runtime/src/        Worker: /pub (público), /api (Studio, Bearer), Workflow genérico
apps/runtime/migrations/ 0001 casos+log, 0002 sinais, 0003 esteira (ideias, pedidos, custos)
apps/runtime/public/     frontend sem build: páginas públicas geradas da `tela` + Studio
products/<x>/            rule.ts pura, casos.ts, FONTES.md, NAO-FAREMOS.md, preco no index.ts
scripts/                 cf.mjs (API Cloudflare), registro, cerca, verificar-deploy
docs/                    ARQUITETURA.md, MAQUINA.md
```

## Fluxo da esteira
Nova dor → Ficha (evidência, quem paga, planilha) → Teste de 14 dias (o funil é um produto: regra pura decide viva/morta) → Spec → Produto publicado → Pedido manual → Medição.

## Preço (no contrato)
`preco` em `defineProduto`: modelo (`interno | gratis | por_caso | assinatura | fracao`), centavos, `gratis` (a checagem), `pago` (a ação), `custoPorCasoCentavos`. A regra nunca lê preço. Sem `preco` declarado a plataforma não abre pedido.

## Pagamento nesta etapa
Pedido registrado em `pedidos` (pendente). Você recebe por Pix fora da plataforma e marca "pago" no Studio. Sem gateway, sem dado de cartão.

## Cloudflare por API
`packages/kits/src/cloudflare.ts` + `pnpm cf` (D1, R2, KV, Workers, Workers AI). Token só em variável de ambiente (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`). Em produção o Worker usa bindings, nunca token amplo.

## Mapa produto → rota → binding → custo
| Peça | Rota | Binding | Dado | Custo |
|---|---|---|---|---|
| Página pública | `/`, `/<produto>` | ASSETS | nenhum | requisições do Worker |
| Avaliar | `/pub/<p>/avaliar` | DB | `sinais` anônimo | D1 (escrita) |
| Interesse/Pedido | `/pub/<p>/interesse`, `/pub/<p>/pedido` | DB | `interesses`, `pedidos` (com consentimento) | D1 |
| Caso durável | `/api/p/<p>/casos` | CASO_WF, DB | `casos`, `transicoes` | Workflows + D1 |
| Esteira | `/api/ideias` | DB, CASO_WF | `ideias` | D1 |
| Métricas | `/api/metricas` | DB | agregados | D1 (leitura) |
Valores de preço da Cloudflare: confirmar na documentação oficial antes de decidir (não codificado aqui).

## Não confirmado
- Fatos legais do produto Multa (CTB, JARI) seguem `NÃO CONFIRMADO` até haver fonte em `FONTES.md`.
- Limite de requisições nas rotas públicas: regra de WAF/rate limit ainda precisa ser criada no painel.
