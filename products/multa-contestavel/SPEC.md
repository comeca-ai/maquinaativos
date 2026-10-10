# Multa Contestável · v1 (spec)

**Dor:** o motorista recebe uma notificação de multa e não sabe se há vício formal nem até quando pode se defender.
**O que entrega:** indício de vício formal de prazo/forma + o último dia da defesa. Não é aconselhamento jurídico.

## Estados
| Estado | Final | Motivos |
|---|---|---|
| aguardando_dados (inicial, prazo 7 dias) | não | falta_data_expedicao |
| contestavel | sim | na_fora_do_prazo_30d, ait_sem_dados_minimos |
| sem_vicio | sim | nenhum_vicio_detectado |
| defesa_vencida | sim | prazo_defesa_vencido |
| fora_de_escopo | sim | abordagem_no_ato |

## Regra (ordem importa)
1. Autuado no ato → fora_de_escopo.
2. Sem data de expedição da NA → aguardando_dados.
3. NA expedida > 30 dias após a infração → contestavel (arquivamento do AIT, Res. 918/2022 art. 4º).
4. Campo mínimo ausente → contestavel.
5. Hoje > prazo de defesa → defesa_vencida.
6. Caso contrário → sem_vicio ("não achamos vício formal", não "a multa é válida").

## Critério de morte da ideia (funil)
10 conversas reais em 14 dias, ao menos 1 pessoa disposta a pagar. Ver `products/funil`.

## Lacunas
Ver FONTES.md, seção NÃO CONFIRMADO.
