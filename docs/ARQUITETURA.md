# Arquitetura

```
CAMADA 0 · FUNIL (sua)     dor → ficha → teste ≤14 dias → viva | morta | reaberta
CAMADA 1 · CONTRATO        defineProduto(): estados, motivos, regra pura, critério de morte
CAMADA 2 · FÁBRICA         pesquisador → concretizador → adversário → [dono] → especificador → implementador → revisor → [dono]
CAMADA 3 · CHÃO            Worker (Hono) → Workflow genérico → D1 (casos + log append-only) → efeitos idempotentes
```

## Fluxo de um caso em produção (sem IA)
1. `POST /p/:produto/casos` valida a entrada com Zod (422 se inválida; nada de caso torto).
2. Cria o caso em estado inicial e dispara o Workflow `maquina-caso`.
3. Workflow: `ler-estado` → `regra-pura` → `gravar-transicao` (atômico, idempotente) → `efeito:*` (idempotentes, chave caso+estado+nome).
4. `GET /casos/:id` mostra estado, motivo e todas as transições. `GET /vencidos` lista estados não-finais com prazo vencido.

## Invariantes aplicadas pelo código
Ver `CLAUDE.md`. Testes: `tests/core.test.ts` (contrato e ontologia) e `tests/cobertura.test.ts` (todo produto).

## Pendências conhecidas (honestas)
- Studio (interface) ainda não existe; hoje a API é o painel.
- Leitura de documento por IA em produção (exceção ao "IA só antes de publicar") não está implementada; quando entrar, será um kit isolado com confiança ou "não li".
- Cobrança e Pix: efeitos ainda sem implementação.
- Cloudflare Access/Turnstile: hoje só Bearer token.
