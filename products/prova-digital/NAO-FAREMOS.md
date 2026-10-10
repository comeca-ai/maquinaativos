# O que a Prova Digital não fará

- Não afirma validade jurídica. Quem decide se a prova é admitida é o juiz. O produto entrega integridade e data, não sentença.
- Não substitui ata notarial.
- Não prova que o conteúdo é verdadeiro. Prova que este arquivo existia nesta data e não mudou desde então. Um print forjado e enviado como arquivo recebe o mesmo carimbo (por isso o manifesto registra a origem: captura no navegador ou arquivo enviado).
- Nenhuma IA toca no arquivo capturado nem decide o estado. A regra é pura.
- Não captura sem consentimento, nem conteúdo íntimo ou de menores.
- Não guarda IP nem user-agent sem consentimento explícito.
- Não apaga nem sobrescreve provas: o Worker de escrita não tem caminho de delete. Leitura de arquivo vai para log append-only.
- Não captura URL no servidor na v1 (Browser Rendering): ampliaria a superfície de abuso antes de saber quem paga.
