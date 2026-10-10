# Custos e medição

## Fontes e validade

Não mantenha uma tabela eterna de preços. Em cada orçamento registre data da consulta, moeda, plano, unidade de cobrança, franquia, arredondamento, período, créditos, mínimos contratuais e exclusões. A fatura/assinatura da conta prevalece sobre uma hipótese de plano público.

Páginas oficiais consultadas na preparação desta habilidade em 08/10/2026; reabra quando usar:

- [Workers](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2](https://developers.cloudflare.com/r2/pricing/)
- [Containers](https://developers.cloudflare.com/containers/platform/pricing/)
- [Workflows](https://developers.cloudflare.com/workflows/reference/pricing/)
- [Ativos estáticos](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

Descubra preços dos demais produtos no [índice oficial](https://developers.cloudflare.com/llms.txt), especialmente Durable Objects, Queues, KV, Stream, Images, Workers AI, AI Gateway, Vectorize, Hyperdrive, Browser Run, Builds, logs, DNS/zonas e Zero Trust. Leia só os usados na solução. Para alternativas externas, use fontes primárias do fornecedor e condições do projeto.

## Modelo econômico

Estime separadamente: assinaturas fixas + excedentes de cada dimensão + serviços externos + trabalho operacional. Para tarifa linear, custo variável = max(0, uso − franquia aplicável) ÷ unidade × tarifa; adapte para faixas, mínimos, arredondamentos e classes. Não aplique a fórmula linear cegamente a todas as cobranças.

Franquias compartilhadas devem ser calculadas no total da conta antes de atribuir custo aos serviços. Não cobre a mensalidade inteira por Worker nem multiplique franquias por aplicação. Mostre custo total, custo incremental e critério de rateio. Separe projeção bruta de valor coberto por créditos: vencimento ou não renovação não torna a arquitetura gratuita.

Use cenários base, crescimento e pico com hipóteses explícitas: volume de eventos, fan-out, tentativas, tamanho dos dados, retenção, CPU por operação e chamadas externas. Calcule custo por resultado útil, como documento processado ou sincronização concluída. Receita, margem, esforço de migração e prazo de retorno só entram quando houver dados; não invente pesos ou percentuais de economia.

## O que medir por produto

| Produto | Dimensões e armadilhas a conferir |
|---|---|
| Workers / Pages | Separar ativos, execução dinâmica, CPU, invocações HTTP/cron/fila e builds. Tempo de espera não equivale a CPU. Verificar regras de cache utilizadas: Workers Cache pode alterar cobrança de requests inclusive de estáticos. Plano da zona e Workers Paid são distintos. |
| D1 | Linhas lidas/escritas, armazenamento e distribuição por consulta. Poucas queries podem varrer milhões de linhas. Índices podem reduzir leitura e acrescentar escrita. O próprio diagnóstico remoto consome uso. Preferir EXPLAIN antes de contagens completas em grandes bases. |
| Containers | Duração ativa, memória/disco provisionados, CPU ativa, rede por região e serviços associados. Mediana de memória não basta para dimensionar: analisar p95/p99, inicialização, concorrência e falta de memória. Conferir suspensão e número de instâncias. |
| Workflows | Invocações, CPU, passos e armazenamento/retensão do estado. Conferir vigência das cobranças e repetição de passos; nunca assumir que esperar ou terminar zera toda a cobrança. |
| R2 | GB-mês, operações A/B, classe, arredondamento, recuperação e permanência mínima. Classe menos cara por GB pode custar mais no acesso. Egress gratuito do R2 não torna gratuitos os serviços conectados. |
| Outros | Durable Objects: atividade, armazenamento e requisições; Queues: operações e repetição; Stream: minutos armazenados/entregues; IA: modelo, tokens/unidade, tentativas; logs: volume, amostragem e retenção. Buscar preços específicos atuais. |

## Comparação antes/depois

Alinhe janela, fuso, ciclo de cobrança, usuários e carga. Marque diferenças entre valores arredondados do painel e exportações precisas. Separe tráfego interno, cron, bots e clientes; baixo tráfego HTTP não prova abandono.

Exemplo de raciocínio: reduzir 384 gatilhos por dia para 96 reduz gatilhos em 75%, mas a mesma quantidade de itens processados pode manter CPU, escrita e custo. Meça esses resultados separadamente.

Alertas financeiros não equivalem a um teto rígido. Para conter execução descontrolada, proponha limites de CPU, tamanho, concorrência, fan-out e tentativas, além de orçamento por tarefa e mecanismo de interrupção. Valide quais controles realmente impedem consumo e o impacto de bloquear usuários legítimos.
