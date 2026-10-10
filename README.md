# maquinaativos

Máquina interna que transforma dores brasileiras em produtos, sobre uma base única na Cloudflare.
**IA generativa só trabalha antes de publicar** (ideia, ficha, spec, código, revisão). O caso real roda num Workflow, com regra pura em código.

## Camadas
| Camada | Onde | O que é |
|---|---|---|
| 0 · Funil | `products/funil` | decide se uma ideia merece existir: ficha, teste de 14 dias, viva/morta |
| 1 · Contrato | `packages/core` | `defineProduto()`: estados, motivos, regra pura, critério de morte |
| 2 · Fábrica | `.claude/agents` | agentes que escrevem produtos (nunca rodam em produção) |
| 3 · Chão | `apps/runtime` | Worker (Hono) + Workflow genérico + D1 (log append-only) |

Veja `docs/ARQUITETURA.md`.

## Rodar local
```bash
pnpm install
pnpm test                  # contrato, ontologia BR, cobertura de cada produto
echo 'API_TOKEN=teste-local' > apps/runtime/.dev.vars
pnpm db:local
pnpm dev                   # http://localhost:8787
```

## Subir no Wrangler
```bash
npx wrangler login
npx wrangler d1 create maquina          # cole o database_id em apps/runtime/wrangler.jsonc
pnpm db:remoto
npx wrangler secret put API_TOKEN -c apps/runtime/wrangler.jsonc
pnpm deploy
```

## Criar um produto
Branch `produto/<nome>`, só dentro de `products/<nome>/`: `index.ts`, `rule.ts`, `casos.ts`, `NAO-FAREMOS.md`; depois `pnpm registro`. A CI recusa se faltar teste por estado e por motivo, ou se a branch tocar fora da pasta.
