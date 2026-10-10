# Arquitetura, workflows e IA opcional

## Parta do trabalho a executar

Investigue duração, CPU, estado, consistência, latência, volume, disponibilidade, isolamento e recuperação. Escolha o menor conjunto de serviços compatível com esses requisitos. Preserve a linguagem e ferramentas existentes quando adequadas; para um motor novo leve, TypeScript e contratos JSON são candidatos naturais, não uma obrigação de reescrever projetos.

| Necessidade | Candidato a avaliar | Decisão a justificar |
|---|---|---|
| Site estático/API/SSR | Assets + Worker, ou manter Pages existente | Requisitos do framework, autenticação, cache e publicação |
| Trabalho assíncrono | Queue + consumidor | Concorrência, repetição, ordem necessária e tratamento de falhas |
| Processo durável em etapas | Workflows | Esperas, eventos, passos, retomada, retenção e custo |
| Coordenação por entidade | Durable Object | Estado por entidade, contenção, recuperação e hibernação |
| SQL operacional | D1 ou banco existente | Consultas, tamanho, migração, concorrência e limites vigentes |
| Objetos/arquivos | R2 | Acesso, retenção, recuperação e dependências compartilhadas |
| Leitura distribuída de configuração/cache | KV ou cache apropriado | Consistência necessária, atualização e invalidação |
| Dependência nativa/processo pesado | Container ou execução externa | Compatibilidade, capacidade, inicialização e custo total |
| CI/CD | Builds ou pipeline existente | Build/teste/publicação; não tratar pipeline como backend de produção intercambiável |

Workers, Workflows e uma interface visual são camadas diferentes. MCP é uma interface de ferramentas e não substitui o motor, o agendador ou o controle de autorização. Para comparar Temporal, n8n e Cloudflare, examine execução durável, operação própria versus gerenciada, licença dos componentes, portabilidade e custo de manutenção. Não confunda runtime aberto com toda a plataforma gerenciada aberta; verifique LICENSE e contrato no componente exato.

## Motor com IA desligável

Proponha uma separação testável:

1. **Definição versionada:** grafo serializável com nós, dependências, entradas/saídas tipadas, versão e referências a segredos. A interface visual edita essa definição; não cria estado executável invisível.
2. **Validação:** schemas, recursos permitidos, dependências, ciclos permitidos com limite, cardinalidade/fan-out e orçamento. Mudanças propostas por IA atravessam a mesma validação das mudanças humanas.
3. **Executor:** agenda tarefas e registra estado fora da memória de uma única requisição. Cada efeito externo recebe chave idempotente. Estabeleça timeout, tentativas limitadas, backoff, cancelamento, retomada e eventual compensação. Não prometa exactly-once entre serviços sem protocolo que a sustente.
4. **Adaptadores:** lógica de negócio separada das APIs de Cloudflare e fornecedores. Contratos claros para armazenamento, fila, relógio e provedor de IA; abstraia apenas fronteiras úteis.
5. **IA opcional:** nós de interpretação, classificação ou geração são identificáveis e têm política quando desligados: regra determinística, entrada humana ou estado “aguardando”. Não finja que uma etapa generativa funciona sem modelo. Tarefas determinísticas não dependem de uma decisão do LLM.
6. **MCP e UI:** clientes do mesmo executor, com identidade, escopo por ação e histórico. Não expor credencial administrativa como ferramenta genérica a todos os agentes.

Teste desligando completamente o provedor de IA, interrompendo uma etapa e repetindo o mesmo evento. Verifique ausência de efeitos duplicados, estado recuperável e sinalização honesta de tarefas que exigem contribuição humana. Reexecutar chamadas externas e reproduzir decisões registradas são operações distintas.

Consulte a [documentação de Agents](https://developers.cloudflare.com/agents/), [Workflows](https://developers.cloudflare.com/workflows/) e [espera e repetição](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/) antes de escolher APIs. Essas capacidades evoluem; adapte aos pacotes instalados.

## Consolidação inteligente

Um domínio principal pode organizar navegação sem fundir todos os processos e bancos. Mapeie URLs, login, cookies, permissões, tarefas agendadas, webhooks e dados antes de unir aplicações. Compartilhe código que repete regras; preserve fronteiras de produto, clientes e produção/homologação. Faça transição por rota/função com verificação e retorno definidos.

Para sincronizações: identificar um responsável por tarefa, checkpoint/cursor, hash de conteúdo, lote limitado e atualização apenas do que mudou. Proteger contra sobreposição; a deduplicação precisa ser persistente se houver retomada. Preserve decisões editoriais e alterações manuais durante upserts.

Para bases versionadas: identificar versão ativa em consultas operacionais e manter consultas históricas explícitas. Totais pré-calculados só substituem agregações após reconciliar consistência e regras de atualização. Aplique EXPLAIN e medições antes de criar índices ou migrar dados.
