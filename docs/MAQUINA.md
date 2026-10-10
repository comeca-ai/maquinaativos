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
| Captura de prova | `PUT /pub/<p>/captura` | PROVAS (R2), DB, CASO_WF | arquivo no cofre, `provas`, `acessos` | R2 (classe A) + D1 + 1 Workflow |
| Relatório da prova | `POST /pub/<p>/provas/<id>/relatorio` (chave ou sessão), `GET /api/provas/<id>/relatorio` (equipe), e `RELATORIO.html` dentro do pacote | PROVAS, DB | lê manifesto, caso e `acessos`; grava 1 acesso `relatorio` | 1 leitura R2 (classe B) + D1 |
| Funil por origem | `POST /pub/<p>/evento` (com `origem`) e cabeçalho `x-funil-origem` no envio, no download e no login; `GET /api/funil` | DB | `contagem_origem`: contador por produto, dia, origem e etapa (sem cookie, sem pessoa; até 40 origens por dia, o resto vira "outro") | D1 (1 escrita a mais por evento) |
| Quem voltou | `GET /api/retorno?dias=30` | DB | calculado de `provas` + `acessos` (nada novo é coletado) | D1 (leitura) |
| Link mágico | `/pub/conta/link`, `/entrar`, `/sair`, `/eu`, `/provas` | EMAIL (Email Service), DB | `contas` (só HMAC do e-mail), `links_login`, `sessoes` | 3.000 e-mails/mês incluídos no Workers Paid, depois US$ 0,35/1.000 |
| Manutenção (cron `17 * * * *`) | — | DB, PROVAS, CASO_WF | âncoras OTS, reavaliação só com fato novo ou prazo vencido | CPU + steps de Workflow |
Valores de preço da Cloudflare: confirmar na documentação oficial antes de decidir (não codificado aqui).

## Revisão Cloudflare de 10/10/2026 (jhoneme)
Feito: TLS mínimo 1.2 e HTTPS obrigatório na zona tinhaprint.com.br; limite de taxa (20 req/10 s por IP em PUT/POST `/pub/*`, só no domínio); cron sem Workflow por hora por prova; nome do arquivo fora da URL (logs); limite de upload 95 MiB (corpo máximo 100 MB na zona Free).
Para ligar o login: verificar o domínio no Email Service e trocar `LOGIN_EMAIL` para `ligado` em wrangler.jsonc.
Pendente: zona `pending` (nameservers no Registro.br); domínio no Email Service (os registros atuais SPF `-all`, DMARC `reject` e MX nulo bloqueiam e-mail); Cloudflare Access em `/studio` e `/api`; desligar workers.dev depois do domínio ativo; decidir Bucket Lock no R2 (custódia x LGPD).
Atenção: o deploy pelo Git (merge na `main`) não aplica migrações. Aplique `pnpm db:remoto` ANTES do merge que depende de migração nova.
Segredos do Worker: `API_TOKEN`, `SEGREDO_ORIGEM`, `SEGREDO_CONTA` (não rotacione o `SEGREDO_CONTA` sem migração: ele identifica as contas).

## Relatório da prova (nível Lite, 10/10/2026)
- Leitura humana de tudo o que o cofre tem sobre a prova: arquivo, hashes, hora do servidor (Brasília e UTC), manifesto literal, âncora OpenTimestamps, situação do caso, cadeia de custódia (acessos, com "mesma origem do envio", "outra origem", "sistema" ou "equipe", sem mostrar o código), dados pessoais guardados, como conferir e o que prova e não prova. A base legal da marca entra no fim.
- **Sem ICP-Brasil**: o relatório diz que não tem assinatura digital nem carimbo de tempo ICP-Brasil. O kit RFC 3161 (`packages/kits/src/rfc3161.ts`) está pronto, mas NÃO está ligado no runtime; liga quando houver contrato com uma ACT.
- HTML sem nenhum script (CSP `default-src 'none'`), tudo escapado, imprimível em A4 ("Salvar como PDF" no navegador).
- Migração `0007` recria a tabela `acessos` para aceitar os tipos `relatorio` e `carimbo_tempo` (o SQLite não altera CHECK). Copia todas as linhas com os mesmos ids e datas e recria as travas append-only. Aplicar com `pnpm db:remoto` ANTES do deploy do código.

## Não confirmado
- Fatos legais do produto Multa (CTB, JARI) seguem `NÃO CONFIRMADO` até haver fonte em `FONTES.md`.
- Limite de requisições nas rotas públicas: regra de WAF/rate limit ainda precisa ser criada no painel.
