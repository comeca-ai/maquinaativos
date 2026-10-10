# Multa Contestável — Especificação Detalhada (v2)

> Documento de produto completo. A v1 (`SPEC.md`) continua sendo o contrato mínimo vivo;
> esta especificação é o plano de evolução. Filosofia máquina de ativos: **IA generativa só
> trabalha antes de publicar** — em produção roda regra pura em código.

---

## 1. A dor e a tese

**Dor:** o motorista recebe a notificação de multa e não sabe (a) se há vício formal,
(b) até quando pode se defender, (c) se vale pagar com 40% de desconto ou recorrer.

**Tese:** recorrer é direito, é grátis e não piora nada — o padrão é recorrer; pagar é a
exceção calculada. A ferramenta decide com números, não com medo.

**Escala da dor (senso de mercado, 2024–2025):** ~75 milhões de multas/ano no Brasil;
PRF sozinha passou de 10 milhões em 2025. Concorrência paga provada (Doutor Multas,
Zapay, Gringo). Nosso diferencial: resposta em segundos, zero dado pessoal, honestidade
radical (às vezes recomendamos PAGAR).

---

## 2. O funil completo (onde mora o negócio)

```
1. Foto da notificação OU 3 datas            [grátis]
2. Veredito: indício de vício + último dia    [grátis]
3. Matemática: desconto 40% vs. recorrer      [grátis — viraliza]
4. Minuta de defesa prévia personalizada      [PAGO: R$ 27–47 via PIX]
   + guia de protocolo do SEU órgão autuador
5. Acompanhamento de prazo (lembretes)        [grátis — retorno]
6. Se indeferido: minuta JARI                 [pago ou incluso]
7. Clube motorista profissional               [R$ 14,90/mês — fase 3]
```

**Garantia invertida (fase 2, não no lançamento):** "se indeferido, devolvemos 100%".
Só ligar depois de medir a taxa real de deferimento nos primeiros 90 dias — a garantia
é sustentável apenas se o motor de teses provar acerto. O cliente prova o indeferimento
para receber a devolução — ou seja, ele mesmo alimenta nossa métrica de resultado.

**O que NÃO faremos (reforço ao NAO-FAREMOS.md):**
- Não cobramos % do valor da multa (êxito): incentivo podre + cobrança impossível.
- Não protocolamos pelo usuário: portais exigem login gov.br pessoal; pedir senha é
  problema jurídico e de segurança. Guiamos até a porta; quem envia é o motorista.

---

## 3. De onde vêm os dados

### 3.1 Entradas do usuário
| Fonte | Como | Fase |
|---|---|---|
| 3 datas + abordagem (v1 atual) | formulário | hoje |
| Foto da notificação | OCR assistido → usuário confirma | v1.5 |
| PDF da Infração (app CNH do Brasil) | upload → extração de texto | v1.5 |

**Decisão de arquitetura (alinhar com a filosofia do repo):** OCR/LLM em runtime NÃO
decide nada. A IA só preenche o formulário; o usuário confirma; a **regra pura** dá o
veredito. IA propõe, humano confirma, regra decide.

### 3.2 Datasets internos (curados, versionados no repo)
| Dataset | Conteúdo | Fonte | Manutenção |
|---|---|---|---|
| `infracoes_ctb` | código → descrição, pontos, valor base, órgão competente | Anexo I CTB / Renainf | revisão semestral |
| `orgaos_autuadores` | órgão → UF, portal de protocolo, docs exigidos, formato, limite de MB | pesquisa manual portal a portal | curadoria contínua; começa com Detran-SP, RJ, PR, RS, SC, MG, PB + PRF + DNIT |
| `teses_defesa` | tese → gatilhos, fundamentos, template de minuta | CTB arts. 280–290, Res. 918/2022 | advogado revisa antes de publicar |

### 3.3 O que NÃO existe (e precisa estar no spec)
- **Senatran/RENAINF não tem API pública de consulta de infração.** Não dependemos dela.
  Toda informação vem do documento que o usuário tem na mão.
- **SNE (Sistema de Notificação Eletrônica):** para aderentes, a NA conta como expedida
  na disponibilização eletrônica, e o usuário é considerado notificado 30 dias após a
  inclusão no sistema. O motor precisa do ramo "você aderiu ao SNE?" ou a análise de
  prazo sai errada para esse grupo crescente.

---

## 4. Motor de regras (evolução da regra pura v1)

Estados atuais preservados. Evoluções:

1. **Ramo SNE** (novo): se usuário aderiu ao SNE, prazo conta da disponibilização, não
   da expedição postal.
2. **Prescrição da NP** (Notificação da Penalidade): pendente de confirmação legal
   (FONTES.md marca 180 dias como ambíguo) — codificar só após leitura do texto integral.
3. **Matriz desconto vs. recurso** (novo): cruza valor, pontos, risco de suspensão da CNH
   e força da tese → recomendação RECORRER / PAGAR COM DESCONTO. Regra pura, auditável.
   Atenção: pagar com 40% de desconto = reconhecer a infração e renunciar à defesa
   (CTB arts. 284 e 282-A) — a tela precisa dizer isso explicitamente.
4. **Autuação no ato:** sai de `fora_de_escopo` quando as regras forem confirmadas.

**Critério de qualidade da regra:** toda recomendação precisa ser explicável em uma frase
("recomendamos recorrer porque a notificação saiu 12 dias depois do prazo legal").

---

## 5. A minuta (o produto pago)

**NÃO é LLM em runtime.** É template engine:

- Templates por tese, escritos/revisados por IA + advogado **antes de publicar**
  (dentro da filosofia: IA no build, não no caso real);
- Slots preenchidos por regra pura: dados do AIT, tese, fundamentos, pedido;
- Saída: PDF pronto para assinar (assinatura gov.br aceita nos portais, Decreto
  10.543/2020) + guia passo a passo do órgão autuador específico (link do portal,
  documentos exigidos, formato, tamanho máximo de arquivo);
- Disclaimer permanente: ferramenta de triagem/documento, não aconselhamento jurídico.

---

## 6. O que precisamos da Cloudflare

| Serviço | Uso | Status |
|---|---|---|
| Workers (Hono) | app inteiro | ✅ já é o chão (`apps/runtime`) |
| Workflows | caso real percorre os estados | ✅ já é o padrão do repo |
| D1 | log append-only + tabelas do produto (`casos`, `orgaos`, `infracoes`, `minutas`, `pagamentos`) | ✅ já existe (`maquina`) |
| R2 | fotos de notificação, PDFs de minuta — cofre privado, sem link público | ⬜ criar bucket `multa` |
| Workers AI | OCR assistido da notificação (modelo de visão) — só preenche formulário | ⬜ avaliar `@cf/llava-hf/llava-1.5-7b-hf`; fallback = formulário manual |
| Cron Triggers | lembretes de prazo de defesa (D-7, D-2, D-1) | ⬜ novo |
| Turnstile | anti-bot no formulário público | ⬜ novo |
| Cache API / CDN | página pública estática e rápida no Brasil inteiro | ✅ implícito |

**Fora da Cloudflare (decisões pendentes):**
- **PIX:** gateway com webhook (avaliar Mercado Pago vs. Asaas) — decisão antes da fase paga;
- **E-mail:** Resend via REST (padrão da casa; sem chave = no-op com log);
- **Sinergia prova-digital:** o comprovante de protocolo e a notificação podem ser
  carimbados no Tinha Print (cross-sell natural; mesmo cofre R2, mesmo log append-only).

---

## 7. Modelo de dados (D1)

```
casos        id, created_at, origem_entrada (form|foto|pdf), estado, motivo,
             data_infracao, data_expedicao_na, data_limite_defesa, autuado_no_ato,
             aderiu_sne, orgao_autuador, codigo_infracao, valor, pontos
pagamentos   id, caso_id, valor, status, provider, txid, created_at, refunded_at
minutas      id, caso_id, tese, template_versao, r2_key_pdf, created_at
orgaos       id, nome, uf, portal_url, docs_exigidos (json), formato, limite_mb
infracoes    codigo, descricao, pontos, valor_base, orgao_competente
resultados   caso_id, desfecho (deferido|indeferido), fonte (usuario|garantia), created_at
```

`resultados` é a tabela mais importante do produto: sem ela não sabemos se as teses
funcionam e não podemos ligar a garantia.

---

## 8. Métricas e critérios de vida/morte

**Funil (já vigente):** 10 conversas reais em 14 dias, ≥1 disposta a pagar.

**Novas métricas de produto:**
- % de casos com indício de vício (se < 5%, o funil aperta demais — revisar teses);
- conversão veredito → minuta paga (meta inicial: 8%);
- taxa de deferimento reportada (alimenta a decisão da garantia);
- % que escolhe "pagar com desconto" por recomendação nossa (mede confiança, não fracasso).

**Critério de morte revisado:** se em 90 dias a conversão paga < 3% OU a taxa de
deferimento reportada < 20%, o produto vira triagem gratuita permanente (isca para o
ecossistema) e a camada paga morre.

---

## 9. Roadmap

| Fase | Escopo | Gate |
|---|---|---|
| v1 (no ar) | formulário 3 datas, veredito, sem pagamento | — |
| v1.5 | OCR assistido + PDF da CNH do Brasil + ramo SNE + matriz desconto/recurso | revisão legal das teses |
| v2 | minuta paga (PIX) + guia por órgão (5 Detrans + PRF/DNIT) | funil das 10 conversas |
| v2.5 | garantia invertida | 90 dias de dados de `resultados` |
| v3 | clube motorista profissional R$ 14,90/mês + lembretes + JARI | 100 minutas vendidas |

---

## 10. Riscos e honestidade

- **OAB:** somos ferramenta e template, não advocacia. Disclaimer em toda saída.
- **LGPD:** não pedimos placa, CPF nem foto de documento com dados sensíveis além do
  necessário à minuta; fotos em R2 privado; log append-only auditável.
- **Verdade na recomendação:** quando não houver tese, recomendamos pagar com desconto.
  É o que nos separa do despachante que vende recurso para tudo — e o que faz o usuário
  voltar na próxima multa.
