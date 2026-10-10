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
echo 'API_TOKEN=teste-local' > .dev.vars
pnpm db:local
pnpm dev                   # http://localhost:8787  (/ = público, /studio = interno)
```

## Publicar
**Pelo painel da Cloudflare (recomendado):** Workers & Pages → Create → Import a repository → este repositório, branch `main`.
- Nome do Worker: `maquinaativos`. Root directory: em branco.
- Deploy command: o padrão (`npx wrangler deploy`) já funciona. Para aplicar migrações novas junto, use `pnpm run publicar`. **Não use `pnpm deploy`**: é um comando interno do pnpm.
- Antes: crie o banco D1 `maquina` e cole o `database_id` em `wrangler.jsonc`.
- Depois: Settings → Variables & Secrets → secret `API_TOKEN`.

**Pelo terminal:** `npx wrangler login`, `npx wrangler secret put API_TOKEN`, `pnpm run publicar`.

## Kit Cloudflare (chamadas por API)
`packages/kits/src/cloudflare.ts`: cliente tipado da API REST (verificar token, D1, R2, KV, Workers, Workers AI). É para ferramentas e agentes **antes de publicar**; o Worker em produção usa bindings.
```bash
export CLOUDFLARE_ACCOUNT_ID=...   # no ambiente, nunca no repositório
export CLOUDFLARE_API_TOKEN=...
pnpm cf verificar | d1:listar | r2:listar | kv:listar | workers:listar
pnpm cf d1:sql maquina "SELECT count(*) FROM sinais"
pnpm cf ai @cf/meta/llama-3.1-8b-instruct "texto"
```

## Criar um produto
Branch `produto/<nome>`, só dentro de `products/<nome>/`: `index.ts`, `rule.ts`, `casos.ts`, `NAO-FAREMOS.md`; depois `pnpm registro`. A CI recusa se faltar teste por estado e por motivo, ou se a branch tocar fora da pasta.
