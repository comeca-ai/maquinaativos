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

## Cópia de teste (v2) e chaves
- **Produção** = `main`, Worker `maquinaativos`, banco `maquina`, cofre `maquina-provas`. O que ainda não está pronto entra na `main` **desligado** por uma chave (`LOGIN_EMAIL` é a primeira).
- **Cópia de teste** = Worker `maquinaativos-teste` (`--env teste` no `wrangler.jsonc`), banco `maquina-teste`, cofre `maquina-provas-teste`, workflow `maquina-caso-teste`. Tudo ligado (`LOGIN_EMAIL=ligado`), faixa amarela "Cópia de TESTE" no topo e `noindex`. Nada ali toca dados de produção.
- Publicação: `.github/workflows/teste.yml`, a cada push na `main`, ou sob demanda para qualquer ramo (Actions > copia-de-teste > Run workflow > ramo). Aplica as migrações no banco de teste, publica e cria `SEGREDO_CONTA` e `SEGREDO_ORIGEM` aleatórios se faltarem.
- O dono precisa fazer uma vez:
  1. Criar um token novo na Cloudflare (Workers Scripts: Edit, D1: Edit, Account Settings: Read, Workers R2 Storage: Edit) e **revogar o token antigo** que passou pela conversa.
  2. No GitHub, em Settings > Secrets and variables > Actions, cadastrar `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
  3. Opcional, para ver o Studio da cópia: `npx wrangler secret put API_TOKEN --env teste`.
  4. Recomendado: proteger `maquinaativos-teste.<conta>.workers.dev` com Cloudflare Access (Workers > maquinaativos-teste > Settings > Domains & Routes > workers.dev > Cloudflare Access).
- A "prévia" automática do Workers Builds nos outros ramos usa os bindings de PRODUÇÃO e hoje falha. Não use essa prévia para testar dados; use a cópia de teste.

## Ligar o link mágico (envio de e-mail do domínio)
Conferido na documentação oficial em 10/10/2026 (https://developers.cloudflare.com/email-service/configuration/domains/):
1. Em **DNS > Records** do tinhaprint.com.br, apague o TXT `_dmarc` (`v=DMARC1; p=reject;`). A ativação cria o DMARC dela no mesmo nome, e dois registros DMARC invalidam os dois.
2. Em **Compute > Email Service > Email Sending > Onboard Domain**, escolha `tinhaprint.com.br` e conclua. Ela cria MX, SPF e DKIM em `cf-bounce.tinhaprint.com.br` e o DMARC em `_dmarc`.
3. O SPF da raiz (`v=spf1 -all`) e o MX nulo da raiz podem ficar: o envio usa o subdomínio `cf-bounce`. Com o MX nulo, respostas ao `acesso@` não chegam a lugar nenhum. NÃO CONFIRMADO: se algum provedor penaliza remetente com MX nulo na raiz; se aparecer problema de entrega, trocar o MX nulo por Email Routing.
4. Testar na cópia de teste (o login já está ligado lá). Funcionou: PR trocando `LOGIN_EMAIL` para `"ligado"` nas vars de produção.

## Não confirmado
- Fatos legais do produto Multa (CTB, JARI) seguem `NÃO CONFIRMADO` até haver fonte em `FONTES.md`.
- Limite de requisições nas rotas públicas: regra de WAF/rate limit ainda precisa ser criada no painel.
