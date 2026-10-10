# Oferta do Tinha Print: três planos

Data: 2026-10-10. Preços são **decisão do dono** e mudam em um lugar só: `marca.planos` em `index.ts`.
Nada aqui é fato legal; a base legal está em `FONTES.md`.

## Decisão do dono (10/10/2026): começar no Lite

Começamos **sem assinatura digital ICP-Brasil e sem carimbo de tempo ICP-Brasil**. Entregamos o arquivo no cofre, a âncora no Bitcoin (OpenTimestamps), o pacote .zip verificável e o **relatório da prova** (HTML para ver, imprimir ou salvar em PDF). O relatório e a página dizem que não há ICP-Brasil.
- Por quê: ICP exige contrato com uma ACT e e-CNPJ, e ainda não temos nenhum dos dois. O kit RFC 3161 já está pronto no framework para quando houver contrato.
- Relato do dono: o "Relatório Sites Lite" do concorrente (R$ 54) também sairia sem a autenticação ICP. **NÃO CONFIRMADO.** Na tela de compra de créditos (app.verifact.com.br/creditos/comprar, vista em 10/10/2026), o Lite aparece só com os limites: 15 min de navegação, 10 imagens, 5 MB de downloads e sem vídeo. Não achamos o texto sobre a autenticação. Até termos a fonte, não usar isso em comparação pública.

## Lançamento para testar mercado (decisão do dono, 10/10/2026)

A página mostra **um plano só: Lite, grátis no lançamento** (até 50 provas por dia por origem). Caso e Escritório saíram da página porque dependem do login por e-mail (desligado) e de pagamento (não existe). Os preços abaixo continuam sendo o plano, não o que está no ar.
- O que medir: Studio > Métricas (visita → consentiu → escolheu → guardou → baixou). Pergunta do teste: as pessoas guardam e voltam para baixar?
- Próximo teste, se o dono quiser: mostrar um preço ("R$ 9,90 por prova depois do lançamento") para medir aceitação antes de cobrar. NÃO feito.

## Os três planos (planejados; fora da página no lançamento)

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
2. **Onde perdemos:** não temos ICP-Brasil, o nosso relatório não é assinado (é uma leitura dos registros do cofre) e não capturamos o site pelo servidor (o Verifact abre o site num navegador isolado, o que atesta a origem). Um print falso enviado como arquivo recebe o mesmo carimbo. Por isso **não** dizemos "equivale ao Verifact" nem "vale como prova".
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

- ~~Relatório da prova~~: feito em 10/10/2026 (HTML imprimível, dentro do pacote e no botão "Ver relatório"). Falta a versão PDF assinada com e-CNPJ.
- Carimbo ICP-Brasil por uma ACT credenciada (custo por carimbo NÃO CONFIRMADO; pedir cotação).
- Captura do site pelo servidor (Cloudflare Browser Run: 10 horas/mês incluídas, depois US$ 0,09 por hora de navegador). Foi cortada da v1 pelo conselho; volta quando houver pagante.

## Riscos e decisões pendentes do dono

- "Cofre por 5 anos" é promessa pública. Combina com a ausência de caminho de delete, mas **briga com o pedido de exclusão da LGPD**: precisa de parecer jurídico e de uma rota de exclusão a pedido.
- Bucket Lock no R2 (trava contra apagar): reforça custódia, mas impede a exclusão. Decidir junto.
- Primeira prova grátis em cada plano: medir no funil (Studio > Métricas) se converte.
- Comparação pública com o concorrente: não citar o nome na página. Comparação objetiva é possível, mas exige cuidado (CONAR); não feita.

## O que o concorrente entrega de fato (pacote real, aberto em 2026-10-10)

Arquivos de um registro do próprio dono (dados pessoais NÃO copiados para cá):
- **Relatório PDF (13 págs.)**: capa com responsável (nome e CPF); introdução que cita ISO/IEC 27037, CPP art. 158-A, MP 2.200-2 e CPC arts. 369 e 411-II; selos "Assinatura certificada" (e-CNPJ, certificado PJ A3) e "Carimbo de tempo ICP-Brasil"; validador online com QR code; detalhes da sessão (início, fim, duração, fuso, IP de saída); cada imagem com nome, tamanho, SHA-512, SHA3-512, hora e URL de origem, e uma tarja com o ID e a hora sobre a imagem; vídeo MP4 (10 fps) com SHA-512; histórico de navegação; informações do domínio (IPs IPv4/IPv6); lista de metadados com hashes; texto de validação manual (validar.iti.gov.br). Formato PDF/A-3B, assinatura PAdES LT.
- **ZIP de conteúdo**: PNGs, MP4, info.csv (hashes) e id.json.
- **ZIP de metadados**: HTML renderizado de cada página visitada, log de requisições do navegador (URL, status, tamanho, SHA-256, IP remoto, cabeçalhos de resposta), histórico de navegação, DNS e SSL do domínio, RDAP, WHOIS e traceroute.
- Ambiente: Firefox numa máquina isolada do Verifact; o usuário navega por ela. O registro fica 30 dias para download.

## Entrega superior, dentro da lei (plano v2)

| # | Entrega | Base | Depende do dono? |
|---|---|---|---|
| 1 | **Captura pelo servidor**: o usuário navega num navegador isolado da Cloudflare (Browser Run com Live View) e nós guardamos tela, vídeo/gravação da sessão, HTML renderizado, requisições, DNS, certificado TLS e RDAP. Funciona também a partir do celular (é um link). Fecha a maior fraqueza: a origem. | CPC art. 422 §1º (material para autenticação/perícia). NÃO CONFIRMADO: se a Live View pode ser usada por cliente final e embutida na página; precisa de protótipo. | Não |
| 2 | **Dupla âncora**: além do Bitcoin (independe de qualquer empresa, inclusive de nós), carimbo de tempo **ICP-Brasil** de uma ACT credenciada no manifesto. | DOC-ICP-12 v1.3, itens 1.1.2 e 1.3.3: carimbos são emitidos por ACTs e pessoas jurídicas podem solicitar (https://www.gov.br/iti/pt-br/assuntos/legislacao/documentos-principais/doc-icp-12versao-1-3.pdf). Custo por carimbo: NÃO CONFIRMADO. | Sim: contrato com uma ACT |
| 3 | **Relatório PDF/A assinado** com certificado ICP-Brasil da empresa (e-CNPJ), em linguagem que um juiz lê em 2 minutos, com QR para um verificador. | MP 2.200-2 art. 10 §1º (presunção sobre o signatário: atesta que FOMOS nós que geramos o relatório, não que o conteúdo é verdadeiro). | Sim: CNPJ da operação + e-CNPJ (em nuvem, para assinar no servidor) |
| 4 | **Verificador público que roda no navegador**: a pessoa solta o .zip e confere tudo localmente (nada sobe para nós). Mais forte que um validador que depende do servidor do fornecedor. | Técnico. | Não |
| 5 | **Guarda de 5 anos + cadeia de custódia visível**: o log append-only de acessos vira parte do relatório. Concorrente: 30 dias. | LGPD arts. 7º e 16 (guarda para exercício de direitos); tensão com art. 18 precisa de parecer. | Parecer jurídico |
| 6 | **SHA-512 e SHA3-512** além do SHA-256 (paridade com o que perito espera ver). | Técnico. | Não |
| 7 | Ponte para **ata notarial** quando o caso exigir fé pública (o pacote vai junto). | CPC art. 384 p.ú. (confirmado). Ata eletrônica a distância (Provimento CNJ 100/2020): NÃO CONFIRMADO em fonte oficial nesta data. | Parceria com cartório (sem captação de clientela) |

O que NÃO fazer: dizer que "vale como prova" ou que "equivale a ICP" antes de ter ICP; citar o concorrente pelo nome na página; guardar CPF sem necessidade (só se o usuário pedir identificação no relatório, com consentimento); prometer aceitação em tribunal.
