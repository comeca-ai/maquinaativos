# Regras para qualquer agente neste repositório

Responda sempre em português. Não seja arrogante: explique o raciocínio e marque o que não foi confirmado.

## Invariantes (a plataforma garante; não contorne)
1. Todo produto usa `defineProduto()` com estados declarados, ao menos um final, e prazo em todo estado não-final.
2. Todo motivo aponta para exatamente um estado. A regra devolve `{estado, motivo}` coerentes.
3. A regra (`rule.ts`) é **pura**: sem rede, sem relógio (`ctx.hoje` vem de fora), sem modelo de IA.
4. Efeitos (pagar, enviar) ficam fora da regra e são idempotentes (`chave`).
5. Toda transição vai para o log append-only.
6. Cada estado e cada motivo tem um caso em `casos.ts`. Cada produto tem `NAO-FAREMOS.md`.

## Cercas
- Branch `produto/<x>`: só `products/<x>/**` e `apps/runtime/src/registro.gerado.ts` (gerado por `pnpm registro`).
- Branch `framework/*`: não toca produtos (exceto `funil`).
- `rule.ts` exige aprovação do dono (CODEOWNERS). Nunca faça merge sozinho.

## Antes de dizer "pronto"
`pnpm registro:check && pnpm typecheck && pnpm test`.

## Fatos legais e de domínio
Só entram em regra com fonte oficial citada (link) em `FONTES.md` do produto. Sem fonte: marque `NÃO CONFIRMADO` e não codifique como certeza.

## Segredos
Nunca grave token, chave ou senha no repositório, em `.md`, em teste ou em commit. Credenciais entram só por variável de ambiente ou `wrangler secret put`. Se uma credencial aparecer numa conversa, trate como exposta e peça a rotação.
