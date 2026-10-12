# AGENTS.md — regras para agentes de IA neste repositório

Você é um agente operando uma fábrica de máquinas de receita. Estas regras são operacionais e o CI as executa: não basta concordar, o build precisa passar. Em conflito entre este arquivo e sua interpretação, vencem o código, a cerca e as travas.

## Antes de propor qualquer coisa

1. Ideia nova entra pelo funil (`products/funil`), nunca por entusiasmo.
2. Todo produto declara `criterioDeMorte` com prazo e métrica. Sem isso, o produto não existe. (**MORTE NÃO DECLARADA**)
3. Toda máquina tem UM número-vida: dinheiro ou resposta entregue. Pageview e cadastro são vaidade e não entram no placar.
4. Morto só reabre com evidência nova, por escrito. Nunca por "mudei de ideia".

## Ao escrever código

5. `rule.ts` é pura: sem `fetch`, `Date.now`, `new Date`, `Math.random`, `process.env`, timers ou import dinâmico. Tempo e mundo entram como parâmetros (`ctx.hoje`). (**REGRA IMPURA**)
6. IA nunca decide estado: a regra pura decide; IA só extrai e redige. Todo uso de IA em runtime declara fallback. (**SEM FALLBACK**)
7. Migrações são append-only: nunca edite uma migration aplicada; crie a próxima.
8. Ordem de deploy: migration antes do código que a usa. Ambíguo = bloqueado. (**ORDEM DE DEPLOY INDEFINIDA**)
9. Segredos nunca no repositório. Credencial exposta em conversa é credencial rotacionada.
10. Nunca peça senha de portal do governo (gov.br) ao usuário, em nenhum contexto.

## Ao abrir PR

11. O nome da branch define o que você pode tocar, e a cerca executa: `produto/<x>` só toca `products/<x>`; `framework/*` não toca produto de terceiro.
12. `rule.ts`, `packages/`, `apps/runtime/`, `scripts/` e `.github/` exigem aprovação do dono (CODEOWNERS).
13. Estado ou motivo novo vem com caso de teste — a cobertura por motivo é exigida no CI.
14. O PR descreve o trade-off e o que NÃO foi feito, não só a feature.

## Proibido

- Adicionar agente, artigo na Constituição ou landing nova antes de o placar mostrar número real.
- "Melhorar" produto morto.
- Métrica sem origem declarada (`tabela.coluna`) no placar.
