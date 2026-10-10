# Fontes e o que NÃO foi confirmado

Data da pesquisa: 2026-10-10. Pesquisa feita por agente com leitura de páginas oficiais; trechos entre aspas foram lidos na fonte.

## Lido em fonte oficial
- MP 2.200-2/2001, art. 10: documentos eletrônicos são considerados "públicos ou particulares, para todos os fins legais" (caput). Presunção de veracidade (§1º) vale para documentos assinados com certificado ICP-Brasil. O §2º diz que a MP "não obsta a utilização de outro meio de comprovação da autoria e integridade", se aceito pelas partes ou por quem o documento é oposto. https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm
- Consequência para o produto: carimbo OpenTimestamps NÃO é ICP-Brasil e não tem a presunção do §1º. Só pode ser sustentado como "outro meio" (§2º), sujeito a aceitação.
- LGPD (Lei 13.709), art. 7º VI (exercício regular de direitos em processo), art. 16 (eliminação após o término do tratamento, com exceções) e art. 18 (eliminação de dados tratados com consentimento). https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Marco Civil (Lei 12.965), arts. 15 e 22. Obriga provedores, não este produto; pertinência baixa salvo se guardarmos IP. https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm

## NÃO CONFIRMADO (não codificado como certeza)
- Que "blockchain é aceito como prova no Brasil". Nenhuma fonte oficial lida sustenta isso. Não encontramos acórdão que cite blockchain ou OpenTimestamps. O que as fontes sustentam: o tema é tratado caso a caso.
- Texto literal do CPC, arts. 369, 384 (ata notarial), 411 e 422. A página do Planalto (https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm) vem truncada na leitura automática. Conferir manualmente antes de citar.
- Jurisprudência: só há compilação secundária (Migalhas) de decisões penais do STJ sobre prints e cadeia de custódia, e ela diverge entre turmas. Acórdãos oficiais não foram lidos. Os dois processos citados pela Verifact (TJRJ AI 0597018-62.2020.8.19.0000; TJSP 1047769-80.2020.8.26.0100) vêm de publicidade do concorrente e NÃO foram verificados em tribunal.
- Lei 14.063/2020: foco em interação com entes públicos; nada achado sobre carimbo de tempo de prova privada.
- Tempo de confirmação do OpenTimestamps ("horas") e formato do upgrade da prova: sem fonte oficial lida. O prazo `PRAZO_ANCORA_DIAS` é parâmetro de produto, não fato.
- LGPD x cadeia de custódia (exclusão a pedido vs. guarda como prova): precisa de parecer jurídico.
- Trava de retenção no R2 para impedir delete: NÃO CONFIRMADO.

## Parâmetros de produto (não são fatos legais)
`PRAZO_CAPTURA_DIAS=3`, `PRAZO_GUARDADA_DIAS=2`, `PRAZO_ANCORA_DIAS=3`, `LIMITE_CAPTURAS_24H=50`. Escolhidos para a v1, sem base em lei.

## Concorrente (dados públicos do próprio vendedor, não verificados)
verifact.com.br: "a partir de R$97 por relatório"; limites por sessão de 50 prints, 50 MB, 30 min de vídeo; promessa de aceitação em "todas as instâncias", sem decisões citadas. Não confirmado se usa blockchain.
