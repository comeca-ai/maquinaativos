# FONTES — Base legal do Anonimizador

> Verificado em 2026-10-11. Fonte primária sempre: Planalto + gov.br/ANPD.
> Quando o Guia de Anonimização da ANPD for publicado em versão final, revisar
> o SPEC.md e o copy do produto.

---

## 1. LGPD — Lei 13.709/2018 (Planalto)

https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm

### Art. 5º, III — dado anonimizado
> "dado relativo a titular que não possa ser identificado, considerando a utilização
> de meios técnicos razoáveis e disponíveis na ocasião de seu tratamento"

### Art. 5º, XI — anonimização
> "utilização de meios técnicos razoáveis e disponíveis no momento do tratamento,
> por meio dos quais um dado perde a possibilidade de associação, direta ou indireta,
> a um indivíduo"

### Art. 12 — o efeito jurídico (o artigo mais importante para nós)
> "Os dados anonimizados não serão considerados dados pessoais para os fins desta Lei,
> salvo quando o processo de anonimização ao qual foram submetidos for revertido,
> utilizando exclusivamente meios próprios, ou quando, com esforços razoáveis,
> puder ser revertido."
>
> §1º — "razoável" leva em conta custo e tempo para reverter, tecnologias disponíveis
> e uso exclusivo de meios próprios.
> §2º — dados de perfil comportamental de pessoa identificada também são pessoais.
> §3º — a ANPD pode dispor sobre padrões e técnicas de anonimização e verificar
> sua segurança. (É daqui que nasce o Guia — ver seção 2.)

**Consequência:** se existe mapa de reversão acessível, NÃO é anonimização —
o dado continua pessoal e a LGPD inteira continua incidindo. Nosso modo
reversível nunca pode ser vendido como "anonimização".

### Art. 13, §4º — pseudonimização
> "o tratamento por meio do qual um dado perde a possibilidade de associação,
> direta ou indireta, a um indivíduo, senão pelo uso de informação adicional
> mantida separadamente pelo controlador em ambiente controlado e seguro"

**Consequência:** nosso modo reversível é pseudonimização. O mapa
`token → valor` é a "informação adicional mantida separadamente" — fica no
IndexedDB do navegador do usuário, on-device, sem sync. "Ambiente controlado
e seguro" é requisito técnico que precisamos poder demonstrar.

---

## 2. ANPD — Guia de Anonimização e Pseudonimização (EM ANDAMENTO)

- **Estudo Preliminar** (dez/2023, publicado jan/2024):
  https://www.gov.br/participamaisbrasil/blob/baixar/37060
- **Consulta pública:** 30/jan/2024 a 14/mar/2024 (prorrogada):
  https://www.gov.br/anpd/pt-br/assuntos/noticias/prorrogadas-consultas-sobre-guia-de-anonimizacao-e-norma-de-direitos-dos-titulares
- **Status (verificado 2026-10):** minuta final chegou ao Conselho Diretor, foi
  devolvida à Coordenação-Geral de Normatização para ajustes ligados a IA, e nova
  minuta foi remetida ao Conselho. **Guia final ainda NÃO publicado.**

### O que a minuta já estabelece (vale como melhor prática)
- **Técnicas legítimas de pseudonimização:** substituição, ofuscação, tokenização,
  cifração, mascaramento, salting → exatamente o que o nosso motor faz;
- **Anonimização = metodologia baseada em risco:** definir Risco de Reidentificação
  Aceitável (RRA), aplicar técnicas, medir o Risco Mensurado (RRM); se RRM > RRA,
  o conjunto NÃO está anonimizado;
- **Reidentificação por cruzamento:** remover nome/CPF não basta — combinações de
  dados soltos (local + data + condição rara) podem re-identificar. Nossa UI deve
  avisar isso;
- O guia menciona técnicas específicas para **texto e imagens** — revisar quando
  a versão final sair.

---

## 3. Checklist de conformidade do produto (derivado das fontes)

- [ ] Copy nunca chama o modo reversível de "anonimização" — é pseudonimização;
- [ ] Modo irreversível: sem mapa, sem log, sem recuperação — só assim se aproxima
      de "dado anonimizado" (art. 12);
- [ ] Mapa de reversão: 100% on-device (IndexedDB/session), sem sync, sem telemetria
      de conteúdo — demonstrável;
- [ ] UI avisa que dado solto combinado pode re-identificar (risco residual);
- [ ] Redação real em arquivos: nada de camada preta sobre texto vivo (o PDF gerado
      não contém o original em nenhuma camada — teste automatizado);
- [ ] Quando a ANPD publicar o Guia final: revisar técnicas, copy e este arquivo.
