# Oferta do Tinha Print: três planos

Data: 2026-10-10. Preços são **decisão do dono** e mudam em um lugar só: `marca.planos` em `index.ts`.
Nada aqui é fato legal; a base legal está em `FONTES.md`.

## Os três planos (o que aparece na página)

| Plano | Preço | O que inclui | Para quem |
|---|---|---|---|
| **Avulso** | R$ 9,90 por prova (a primeira é grátis) | 1 arquivo até 95 MB (print, vídeo ou PDF), carimbo no Bitcoin, pacote .zip verificável, cópia no cofre por 5 anos | quem tem um print no celular e quer guardar agora |
| **Caso** (destaque) | R$ 39 por até 30 provas, válidas por 12 meses (R$ 1,30 por prova) | a conversa inteira, conta por e-mail (Minhas provas), pacote sem depender do código, cofre 5 anos | quem está numa briga com várias telas: golpe, consumidor, família, trabalho |
| **Escritório** | R$ 149 por mês, sem fidelidade | até 200 provas por mês, conta por e-mail, cofre 5 anos | advogado e pequeno escritório |

Hoje (teste): guardar é grátis, até 50 por dia por origem. Os planos passam a valer quando o login por e-mail estiver ligado.

## Por que esses números (contra o concorrente)

Concorrente: Verifact. Dados vistos em 10/10/2026, na página pública de preços e logado na conta do dono (nenhuma captura iniciada, nada comprado):
- Avulso: Sites Lite R$ 54 (15 min, 10 imagens, 5 MB, sem vídeo); Sites R$ 97 (30 min com vídeo, 50 imagens, 51 MB); WhatsApp R$ 97 (60 min). Combos até 15% de desconto. PRO 5 R$ 92, PRO 12 R$ 88, PRO+ R$ 65,50 por relatório, com contrato mínimo de 12 meses. Fontes: https://publi.verifact.com.br/planos-precos/ e o painel logado (relatório consumiu "97 créditos").
- Entrega: PDF/A-2B "protegido com assinatura certificada e carimbo de tempo ICP/Brasil", ZIP do conteúdo e ZIP de metadados com SHA-512.
- **Guarda o registro por 30 dias**: "Depois de expirado, os arquivos serão removidos sem a possibilidade de recuperação" (painel logado).
- Só computador (sem celular ou tablet), segundo a página pública.

Referência de cartório: ata notarial em SP, primeira folha R$ 638,76 e página adicional R$ 322,57 (emolumentos + tributos, tabela de 08/01/2026 publicada pelo 26º Tabelião de Notas: https://www.26notas.com.br/custas-notariais). É fonte de cartório, não a lei estadual: conferir antes de citar em público.

Leitura:
1. **Onde ganhamos:** celular (o print já está lá), preço por arquivo (de 6 a 75 vezes menor por prova), guarda de 5 anos (contra 30 dias) e pacote que se confere sem nós.
2. **Onde perdemos:** não temos ICP-Brasil, não temos relatório PDF assinado e não capturamos o site pelo servidor (o Verifact abre o site num navegador isolado, o que atesta a origem). Um print falso enviado como arquivo recebe o mesmo carimbo. Por isso **não** dizemos "equivale ao Verifact" nem "vale como prova".
3. **Posição:** o primeiro passo barato e imediato, no celular, antes que apaguem. Quando o caso exigir fé pública ou captura atestada, a página manda para a ata notarial (e, no futuro, para o nosso plano com captura pelo servidor).

## Custo por prova (o que sustenta o preço)

Medido na documentação oficial da Cloudflare em 10/10/2026 (conferir na fatura):
- R2: armazenamento US$ 0,015 por GB-mês. Um print de 5 MB por 5 anos ≈ US$ 0,005; um vídeo de 95 MB por 5 anos ≈ US$ 0,09.
- E-mail (link mágico): 3.000 incluídos por mês no Workers Paid, depois US$ 0,35 por 1.000.
- Workflows: ~3 passos por prova (500 mil incluídos por mês, depois US$ 0,80 por 100 mil).
- OpenTimestamps: grátis (calendários públicos).
- Fixo: Workers Paid US$ 5/mês (já pago).
Custo variável: **menos de R$ 0,50 por prova no pior caso** (vídeo de 95 MB por 5 anos). NÃO CONFIRMADO: a taxa do meio de pagamento (Pix por gateway) ainda não foi escolhida.

## O que falta construir para vender (nesta ordem)

1. Domínio ativo e e-mail verificado → `LOGIN_EMAIL=ligado` (depende do dono: nameservers no Registro.br).
2. **Créditos por conta**: saldo, consumo a cada prova guardada, bloqueio sem saldo depois da primeira grátis.
3. **Pagamento**: começar com o pedido manual (Pix fora da plataforma, o dono marca "pago" no Studio e o crédito entra). Gateway é o passo 2 da máquina.
4. Plano Escritório: renovação mensal e limite de 200.

## Roadmap que vira preço (não vendemos antes de existir)

- Relatório PDF da prova (o que advogado anexa no processo).
- Carimbo ICP-Brasil por uma ACT credenciada (custo por carimbo NÃO CONFIRMADO; pedir cotação).
- Captura do site pelo servidor (Cloudflare Browser Run: 10 horas/mês incluídas, depois US$ 0,09 por hora de navegador). Foi cortada da v1 pelo conselho; volta quando houver pagante.

## Riscos e decisões pendentes do dono

- "Cofre por 5 anos" é promessa pública. Combina com a ausência de caminho de delete, mas **briga com o pedido de exclusão da LGPD**: precisa de parecer jurídico e de uma rota de exclusão a pedido.
- Bucket Lock no R2 (trava contra apagar): reforça custódia, mas impede a exclusão. Decidir junto.
- Primeira prova grátis em cada plano: medir no funil (Studio > Métricas) se converte.
- Comparação pública com o concorrente: não citar o nome na página. Comparação objetiva é possível, mas exige cuidado (CONAR); não feita.
