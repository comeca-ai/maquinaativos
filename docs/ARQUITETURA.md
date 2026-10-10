# Arquitetura

```
CAMADA 0 · FUNIL (sua)     dor → ficha → teste ≤14 dias → viva | morta | reaberta
CAMADA 1 · CONTRATO        defineProduto(): estados, motivos, regra pura, critério de morte
CAMADA 2 · FÁBRICA         pesquisador → concretizador → adversário → [dono] → especificador → implementador → revisor → [dono]
CAMADA 3 · CHÃO            Worker (Hono) → Workflow genérico → D1 (casos + log append-only) → efeitos idempotentes
```

## Fluxo de um caso em produção (sem IA)
1. `POST /api/p/:produto/casos` valida a entrada com Zod (422 se inválida; nada de caso torto).
2. Cria o caso em estado inicial e dispara o Workflow `maquina-caso`.
3. Workflow: `ler-estado` → `regra-pura` → `gravar-transicao` (atômico, idempotente) → `efeito:*` (idempotentes, chave caso+estado+nome).
4. `GET /api/casos/:id` mostra estado, motivo e todas as transições. `GET /api/vencidos` lista estados não-finais com prazo vencido.

## Frontend gerado pelo framework (mesmo Worker)
O produto declara uma `tela` (campos, texto para cada motivo, aviso, quando oferecer ajuda) como **dados** em `defineProduto`. O framework renderiza:
- `/` lista as ferramentas públicas; `/<produto>` é o formulário e o resultado, vindo de `GET /pub/<produto>/tela` e `POST /pub/<produto>/avaliar` (regra pura, sem gravar dado do documento).
- `POST /pub/<produto>/interesse` grava contato **só com consentimento** (sinal de pagador). Tudo o que é medido vai para a tabela anônima `sinais`.
- `/studio` (token hoje, Cloudflare Access depois): sinais do funil, produtos, casos vencidos, interessados.
- Turnstile é opcional: com `TURNSTILE_SECRET` definido, `/pub/*` exige o token.
Invariante: todo motivo da regra tem texto para a pessoa (o teste de contrato falha se faltar).

## Invariantes aplicadas pelo código
Ver `CLAUDE.md`. Testes: `tests/core.test.ts` (contrato e ontologia) e `tests/cobertura.test.ts` (todo produto).

## Pendências conhecidas (honestas)
- Studio é mínimo (somente leitura). Criar ficha, revisar e publicar ainda não têm tela.
- Sem limite de uso nas rotas públicas: configurar regra de rate limiting no painel da Cloudflare.
- Sinais anônimos: não há como avisar quem usou se a regra errar (só quem deixou contato).
- Leitura de documento por IA em produção (exceção ao "IA só antes de publicar") não está implementada; quando entrar, será um kit isolado com confiança ou "não li".
- Cobrança e Pix: efeitos ainda sem implementação.
- Cloudflare Access/Turnstile: hoje só Bearer token.
