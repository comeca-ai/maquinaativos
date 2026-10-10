# SPEC: prova-digital v1

## O que é
Preserva um arquivo (print, gravação de tela ou arquivo enviado) com hash, manifesto e carimbo de tempo ancorado (OpenTimestamps/Bitcoin), guardado em cofre privado. Entrega um pacote verificável sem depender do nosso servidor.

## Estados (regra pura, `rule.ts`)
aguardando_captura (3d) → guardada (2d) → ancorando (3d) → preservada | preservada_sem_ancora. Finais: preservada, preservada_sem_ancora, falhou, recusada. `preservada_sem_ancora` é honesto: arquivo íntegro e guardado, âncora não confirmada no prazo.

## Decisões do conselho (emulações, não as pessoas reais) incorporadas
- Recusas com motivos separados e log por motivo (Amodei). Volume contado fora da regra.
- Pacote verificável offline por script independente (Musk, Altman, Prince). Exportação completa para o cliente sair (Prince).
- Chave de idempotência da âncora = hash do manifesto (Altman).
- Sem caminho de delete no Worker de escrita; leitura vai para log append-only (Karp).
- Cortar captura de URL no servidor da v1 (5 de 5).

## Divergência registrada
Karp, Musk e Altman cortariam também gravação de tela. O dono pediu print e gravação "como o usuário quiser"; mantidos porque a captura roda no navegador do usuário (custo baixo). Reavaliar com dados reais.

## Perguntas sem resposta (do dono)
1. Quem, com nome, já pediu isso? Cinco nomes para chamar esta semana (funil: 10 conversas, 1 pagador, 14 dias).
2. O que este pacote prova que o usuário não faria sozinho com um hash e um .ots?
3. Quem paga o armazenamento daqui a 10 anos, e o que acontece se a empresa fechar?
4. Preço: não definido (decisão do dono). `preco` não declarado.
5. Retenção x exclusão (LGPD): precisa de parecer jurídico.

## Dependência de framework
Captura, cofre R2 e âncora são infraestrutura (branch `framework/captura`). Esta branch só tem a regra e os casos.

## Achados do revisor (cego-primeiro) e decisão
- Entradas contraditórias (ex.: âncora sem gravação) agora são recusadas na porta, com testes em `entrada.test.ts`.
- Estado final é imutável: o runtime recusa reavaliar caso final sem `?reabrir=1`. A regra ainda dá precedência às recusas, o que fica documentado em `casos.ts`. O contador `capturasUltimas24h` é lido no momento da captura, nunca em reavaliação posterior.
- **Aberto (precisa de mudança no core, branch `framework/captura`):** o `prazoAte` gravado no log é `data da avaliação + prazoDias`, mas a regra mede prazos a partir de datas de fato (`solicitadoEm`, `gravadoEm`, `ancoraEnviadaEm`). Até o core aceitar um `prazoAte` calculado pelo produto, o campo do log não deve ser usado como prazo oficial deste produto.
