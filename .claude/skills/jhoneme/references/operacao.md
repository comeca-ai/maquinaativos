# Código e operação

## Descoberta e acesso

Use primeiro conectores, APIs ou CLI já disponíveis e autorizados; interface autenticada é alternativa. Não presuma que uma chave citada na conversa está acessível. Confirme conta, recurso, ambiente e identidade antes de alterar estado. No navegador, siga as regras da sessão e extraia apenas seções necessárias: páginas de configuração podem mostrar variáveis em texto claro.

Leia AGENTS.md, manifesto, lockfile, configuração Wrangler, migrações e pipeline do projeto. Identifique fonte e versão implantada; um Worker publicado manualmente pode divergir do Git. Não copie valores secretos para código, memória, logs ou documentos.

## Código e publicação

- Use a versão real de Wrangler/framework, compatibilidade de runtime e tipos gerados pelo projeto. Valide opções na [configuração oficial](https://developers.cloudflare.com/workers/wrangler/configuration/). Bindings e variáveis podem exigir declaração por ambiente; não suponha herança.
- Prefira correção mínima para o comportamento solicitado. Revise autenticação/autorização, limites das entradas, SQL parametrizado e efeitos de repetição quando pertinentes à mudança.
- Teste o contrato que pode quebrar: binding correto, migração compatível, evento repetido, timeout, falta de provedor, isolamento por usuário e estados de falha. Use ferramentas existentes; para alterações simples, não crie uma suíte espelhando detalhes internos.
- Prepare diff, resultado dos checks, versão atual, plano de recuperação e impacto de dados. Publicação de código e migração de dados têm recuperações distintas; rollback do Worker não restaura automaticamente banco, fila ou efeitos externos.
- Após implantação autorizada, verifique domínio/rota real, logs, erro, latência e a função afetada. Não faça transações financeiras, envio de mensagens ou alteração de registros de usuários como smoke test sem autorização específica.

## Diagnóstico de incidentes

Estabeleça início, escopo, impacto, última mudança e sinal de saúde. Compare versão/configuração, erros de binding, limites, D1, filas, chamadas externas e credenciais expiradas. Reduza a hipótese com observação; não aumente indiscriminadamente retries, CPU ou permissões. Preserve evidências sem copiar dados pessoais. Recupere com o caminho autorizado de menor impacto e verifique saúde antes da análise de causa raiz.

## Limpeza por serviço

Inventarie o conjunto e suas dependências antes de remover: Worker/Pages, domínio/rota, cron, fila, D1, R2, KV, Durable Object, Workflow, token, integração de build e serviço externo. Distingua recurso exclusivo de recurso compartilhado. Nome parecido, zero requisições ou token expirado não demonstram que pode apagar todo o grupo.

Prepare backup recuperável de dados relevantes, schema/índices e configurações necessárias. Verifique exportação completa, restauração, contagens/integridade e armazenamento seguro. Se algo não puder ser recuperado, informe a lacuna antes da ação irreversível e obtenha a decisão necessária para esse risco. Ao excluir um Worker, confira também o destino do estado de Durable Objects; não presuma que sobreviverá.

Revogue apenas acessos identificados e autorizados. Nunca amplie permissões para facilitar uma auditoria. Tokens de mesmo nome podem ter IDs e consumidores distintos. Um token referenciado em build pode já não existir; diferencie “ausente”, “revogado agora” e “não verificado”.

Remover app não equivale a excluir zona DNS, cancelar registro de domínio, apagar repositório ou encerrar assinatura. Trate essas operações separadamente conforme escopo. Verifique listas paginadas e atualizadas; caches do painel podem manter contagens antigas.

Registre para cada recurso: tipo/ID/ambiente, autorização corrente, ação realmente executada, backup e teste, evidência final e pendências. Não chame limpeza parcial de completa. Atualize o painel de decisões sem perder o histórico.
