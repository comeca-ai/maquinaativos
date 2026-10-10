# Fontes e o que NÃO foi confirmado

Data da pesquisa: 2026-10-10. Pesquisa feita por agente com leitura de páginas oficiais; trechos entre aspas foram lidos na fonte.

## Lido em fonte oficial
- MP 2.200-2/2001, art. 10: documentos eletrônicos são considerados "públicos ou particulares, para todos os fins legais" (caput). Presunção de veracidade (§1º) vale para documentos assinados com certificado ICP-Brasil. O §2º diz que a MP "não obsta a utilização de outro meio de comprovação da autoria e integridade", se aceito pelas partes ou por quem o documento é oposto. https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm
  Texto literal do §2º (conferido no Planalto em 2026-10-10): "O disposto nesta Medida Provisória não obsta a utilização de outro meio de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil, desde que admitido pelas partes como válido ou aceito pela pessoa a quem for oposto o documento."
- Consequência para o produto: carimbo OpenTimestamps NÃO é ICP-Brasil e não tem a presunção do §1º. Só pode ser sustentado como "outro meio" (§2º), sujeito a aceitação.
- LGPD (Lei 13.709), art. 7º VI (exercício regular de direitos em processo), art. 16 (eliminação após o término do tratamento, com exceções) e art. 18 (eliminação de dados tratados com consentimento). https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Marco Civil (Lei 12.965), arts. 15 e 22. Obriga provedores, não este produto; pertinência baixa salvo se guardarmos IP. https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm

- CPC (Lei 13.105/2015), lido no Planalto em 2026-10-10 (https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm):
  - Art. 369: "As partes têm o direito de empregar todos os meios legais, bem como os moralmente legítimos, ainda que não especificados neste Código, para provar a verdade dos fatos em que se funda o pedido ou a defesa e influir eficazmente na convicção do juiz."
  - Art. 384: "A existência e o modo de existir de algum fato podem ser atestados ou documentados, a requerimento do interessado, mediante ata lavrada por tabelião." Parágrafo único: "Dados representados por imagem ou som gravados em arquivos eletrônicos poderão constar da ata notarial."
  - Art. 411: "Considera-se autêntico o documento quando: I - o tabelião reconhecer a firma do signatário; II - a autoria estiver identificada por qualquer outro meio legal de certificação, inclusive eletrônico, nos termos da lei; III - não houver impugnação da parte contra quem foi produzido o documento." (Trata de AUTORIA; o carimbo não identifica autor. Não usar na página.)
  - Art. 422: "Qualquer reprodução mecânica, como a fotográfica, a cinematográfica, a fonográfica ou de outra espécie, tem aptidão para fazer prova dos fatos ou das coisas representadas, se a sua conformidade com o documento original não for impugnada por aquele contra quem foi produzida." § 1º: "As fotografias digitais e as extraídas da rede mundial de computadores fazem prova das imagens que reproduzem, devendo, se impugnadas, ser apresentada a respectiva autenticação eletrônica ou, não sendo possível, realizada perícia." § 3º: "Aplica-se o disposto neste artigo à forma impressa de mensagem eletrônica."
- Esses textos alimentam a seção BASE LEGAL da página (`marca.baseLegal` em `index.ts`). Regra: só entra norma com link oficial, trecho literal e leitura honesta; o core recusa item sem link https.

## NÃO CONFIRMADO (não codificado como certeza)
- Que "blockchain é aceito como prova no Brasil". Nenhuma fonte oficial lida sustenta isso. Não encontramos acórdão que cite blockchain ou OpenTimestamps. O que as fontes sustentam: o tema é tratado caso a caso.
- ~~Texto literal do CPC, arts. 369, 384, 411 e 422~~: CONFIRMADO em 2026-10-10 (ver acima).
- Jurisprudência: só há compilação secundária (Migalhas) de decisões penais do STJ sobre prints e cadeia de custódia, e ela diverge entre turmas. Acórdãos oficiais não foram lidos. Os dois processos citados pela Verifact (TJRJ AI 0597018-62.2020.8.19.0000; TJSP 1047769-80.2020.8.26.0100) vêm de publicidade do concorrente e NÃO foram verificados em tribunal.
- Lei 14.063/2020: foco em interação com entes públicos; nada achado sobre carimbo de tempo de prova privada.
- Tempo de confirmação do OpenTimestamps ("horas") e formato do upgrade da prova: sem fonte oficial lida. O prazo `PRAZO_ANCORA_DIAS` é parâmetro de produto, não fato.
- LGPD x cadeia de custódia (exclusão a pedido vs. guarda como prova): precisa de parecer jurídico.
- Trava de retenção no R2 para impedir delete: NÃO CONFIRMADO.

## Parâmetros de produto (não são fatos legais)
`PRAZO_CAPTURA_DIAS=3`, `PRAZO_GUARDADA_DIAS=2`, `PRAZO_ANCORA_DIAS=3`, `LIMITE_CAPTURAS_24H=50`. Escolhidos para a v1, sem base em lei.

## Concorrente (dados públicos do próprio vendedor, não verificados)
verifact.com.br: "a partir de R$97 por relatório"; limites por sessão de 50 prints, 50 MB, 30 min de vídeo; promessa de aceitação em "todas as instâncias", sem decisões citadas. Não confirmado se usa blockchain.

## Atualização de 2026-10-10 (concorrente e custos de referência)
- Verifact, página pública de preços (https://publi.verifact.com.br/planos-precos/): Sites Lite R$ 54, Sites R$ 97, WhatsApp R$ 97 por relatório; PRO 5 R$ 92, PRO 12 R$ 88, PRO+ R$ 65,50 por relatório, com contrato mínimo de 12 meses. Dado do próprio vendedor.
- Verifact, painel logado na conta do dono (observado, sem iniciar captura): relatório de 97 créditos; PDF/A-2B com "assinatura certificada e carimbo de tempo ICP/Brasil"; ZIPs com SHA-512; registro "disponível para download" por 30 dias, depois "removidos sem a possibilidade de recuperação".
- Ata notarial em SP (tabela de 08/01/2026, publicada pelo 26º Tabelião de Notas, https://www.26notas.com.br/custas-notariais): primeira folha R$ 638,76; página adicional R$ 322,57 (emolumentos + tributos). Fonte de cartório, não a lei estadual: NÃO CONFIRMADO na lei.
- Aceitação judicial alegada pelo Verifact ("três instâncias"): continua NÃO VERIFICADA em tribunal.
