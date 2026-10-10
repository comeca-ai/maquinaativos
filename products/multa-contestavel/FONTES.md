# Fontes legais e o que NÃO foi confirmado

## Confirmado na fonte oficial (Resolução Contran 918/2022, texto compilado, gov.br)
Fonte: https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/resolucoes2/Resoluo918.compilada.pdf
(lido em 2026-10-10 por extração automática do PDF; conferir o texto integral antes de uso comercial)

- Art. 4º, caput: Notificação da Autuação (NA) em no máximo 30 dias contados do cometimento da infração.
- Art. 4º, § 1º: a não expedição da NA no prazo enseja o arquivamento do AIT.
- Art. 4º, § 2º: prazo de defesa prévia não inferior a 30 dias, contados da expedição da NA.
- Art. 3º: o AIT deve conter os dados mínimos do art. 280 do CTB.
- Art. 29: prazos em dias consecutivos, excluído o dia da notificação/publicação e incluído o dia do vencimento.

## Interpretação adotada (conferir)
- "Dia 30 ainda está no prazo": usamos `dias(infração → expedição) > 30` para considerar fora do prazo. O art. 29 trata de defesas e recursos; aplicamos a mesma lógica à NA por analogia.

## NÃO CONFIRMADO (não codificado como certeza)
- Texto exato do CTB arts. 280, 281, 282 (a página do Planalto não pôde ser lida nesta sessão). A lista de "campos mínimos do auto" por isso NÃO está codificada: a entrada `camposAusentes` vem da leitura do documento e a lista oficial precisa ser conferida.
- Prazo da Notificação da Penalidade (a extração trouxe 180 dias, mas o trecho veio truncado/ambíguo) e prazos de recurso à JARI (CTB arts. 285–287).
- Regras de autuação no ato (por isso `autuadoNoAto` fica fora de escopo na v1).
- Regras por tipo de infração: radar/medidor de velocidade, aferição do Inmetro, Lei 14.071/2020.
