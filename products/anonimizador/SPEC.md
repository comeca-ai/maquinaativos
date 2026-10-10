# Anonimizador — Especificação (v1)

> Seu pincel de privacidade. Antes de enviar um documento para uma IA, um e-mail ou
> qualquer destino, você escolhe o que proteger. Tudo processado no navegador.
>
> Filosofia máquina de ativos: **um motor de regra pura, três cascas de interface**.
> Nenhum byte do usuário toca num servidor nosso — isso é arquitetura e é propaganda.

---

## 1. A dor e a tese

**Dor:** todo mundo já sentiu o frio na barriga antes de colar um contrato, um exame ou
uma planilha de clientes no ChatGPT. Empresas bloqueiam IA por medo de vazamento;
pessoas usam mesmo assim, no escuro.

**Tese:** privacidade não é esconderijo, é controle. A ferramenta que deixa o usuário
decidir — o que fica, o que sai, reversível ou não — vende alívio de uma hesitação real
e diária. O timing é o ativo: a dor cresce a cada adoção de IA.

**Diferencial:** processamento 100% local, verificável por qualquer um ("abre o inspetor
do navegador e confere: nada sai"). A gente não pode vazar o que a gente nunca recebe.

---

## 2. Arquitetura: um motor, três cascas

```
packages/engine        ← biblioteca TS pura: detectores, substituição, mapa de reversão
                         zero DOM, zero rede, 100% testável (casos.ts)

apps/site              ← Cloudflare Pages/Workers: landing + ferramenta completa
apps/extension         ← Chrome/Firefox (Manifest V3): pincel em qualquer página
apps/extension (IA)    ← content scripts por domínio: chatgpt.com, claude.ai,
                         gemini.google.com, copilot.microsoft.com — botão "Proteger"
```

A engine é o produto. As cascas são descartáveis e substituíveis. Se um site de IA mudar
o DOM, quebra uma casca — o motor segue intacto e testado.

---

## 3. O motor (`packages/engine`)

### 3.1 Detectores (regra pura, sem LLM)
| Detector | Como | Confiança |
|---|---|---|
| CPF / CNPJ | regex + dígito verificador | alta |
| E-mail, telefone, CEP, placa (Mercosul e antiga), cartão (Luhn) | regex + validação | alta |
| RG, CNH, PIS/Pasep | regex + dígito | média |
| Valores monetários, datas, endereços | regex + heurística | média |
| **Nomes de pessoas** | lista de nomes + NER pequeno em WASM/ONNX (opcional, local) | **baixa — sempre exige confirmação visual** |

Regra de ouro: detector de baixa confiança **sugere**, nunca decide. IA propõe, humano
confirma, regra executa. O usuário sempre vê a lista do que será protegido antes.

### 3.2 Substituição
- Tokens legíveis: `[NOME 1]`, `[CPF 1]`, `[EMPRESA 2]` — a IA recebe texto coerente e
  responde em contexto;
- **Mapa de reversão** (`token → valor original`): gerado no navegador, fica no navegador
  (IndexedDB/session), nunca sai do dispositivo;
- Modo **irreversível** (anonimização de verdade, sem mapa) e modo **reversível**
  (pseudonimização, mapa local) — o usuário escolhe, a tela explica a diferença em uma
  frase. Cuidado jurídico: na LGPD "anônimo" é irreversível; o copy nunca promete o que
  o modo reversível não entrega.

### 3.3 Perfis de proteção
Presets salvos localmente: "contrato", "prontuário", "RH", "financeiro", "meus dados
sempre" (o próprio nome/CPF do usuário, protegido por padrão em tudo).

---

## 4. Casca 1 — Site

- Landing + ferramenta completa: cola texto, sobe PDF/imagem, pincel em canvas;
- **Redação real, não cosmética:** PDF vira página rasterizada e achatada (o texto
  original deixa de existir no arquivo); texto colado vira substituição real. Nunca
  retângulo preto por cima de texto vivo — isso é o bug que derrubou advogado e governo;
- SEO: "como anonimizar documento para ChatGPT", "tirar CPF de PDF" — a dor tem busca;
- Zero login, zero conta, zero servidor de documentos. Analytics só de página, nunca de
  conteúdo.

## 5. Casca 2 — Extensão de navegador (Manifest V3)

- Botão/atalho em qualquer campo de texto da web: protege antes de enviar (e-mail, forms,
  tickets);
- Pincel em página: selecionar trecho → menu de contexto → proteger;
- Mesma engine, importada como pacote. Publicação Chrome Web Store + Firefox Add-ons.

## 6. Casca 3 — Integração com as IAs (o killer feature)

Content script por domínio (chatgpt.com, claude.ai, gemini.google.com, copilot...):

1. Botão **"Proteger"** ao lado do enviar da IA;
2. Intercepta o prompt, roda a engine, mostra o que será protegido, usuário confirma;
3. Envia o texto protegido à IA;
4. **Re-identificação local:** quando a resposta volta, a extensão troca `[NOME 1]` por
   "João Silva" **só na tela do usuário**. A IA nunca viu o dado; o usuário lê a resposta
   como se nada tivesse acontecido.

**Risco conhecido:** os sites de IA mudam o DOM com frequência. Mitigação: seletores
versionados por domínio em dataset próprio no repo (`seletores_ia`), fallback gracioso
("não achei o campo — copie o texto protegido aqui"), e telemetria de quebra (sem
conteúdo) para saber quando um seletor morreu.

---

## 7. O que NÃO faremos

- **Não subimos documento para servidor.** Nem "só para OCR" — OCR roda local
  (tesseract.js / Workers AI só em modo opt-in explícito e avisado). Se um dia existir
  função com servidor, ela é outra feature, avisada, nunca o padrão.
- **Não prometemos anonimização jurídica perfeita.** Detector de nome erra; a revisão
  humana é parte do produto, não um detalhe. Disclaimer em toda saída.
- **Não guardamos o mapa de reversão.** Perdeu o mapa, perdeu a reversão — a tela diz
  isso antes.
- **Não viramos DLP enterprise no v1.** Sem console de admin, sem SSO, sem política de
  empresa — isso é fase 3 e outro contrato de produto.
- **Não cobramos pelo grátis.** Texto colado + pincel são gratuitos para sempre; é a
  isca e é a prova de confiança.

---

## 8. Modelo de dados (quase inexistente — de propósito)

Tudo local: IndexedDB no navegador (perfis, mapas de reversão da sessão, preferências).
No máximo, D1 para waitlist/conta Pro futura — sem nunca registrar conteúdo protegido.
LGPD quase não se aplica a nós: não somos controladores de nada. Isso vira copy de
marketing.

---

## 9. Monetização e funil

```
Site grátis (texto + pincel básico)        → SEO + viralização
Extensão grátis (proteger em qualquer site) → hábito diário
Integração IA grátis com limite            → o gancho
PRO R$ 9,90/mês:                            → receita
  perfis ilimitados, batch de documentos,
  PDF/OCR avançado, modo irreversível em lote,
  re-identificação automática em todas as IAs
```

Fase 3 (depois de provado): versão equipes/empresa — políticas compartilhadas, log de
auditoria local exportável, rollout via política de navegador. Aí sim conversa com DLP.

---

## 10. Métricas de vida/morte

- **Gesto do pincel:** 10 pessoas testam o protótipo burro (regex + canvas); se não
  entenderem sem explicação, o problema é UX — resolver antes de escrever o resto;
- % de usuários do site que instalam a extensão (meta: 10%);
- Uso semanal da extensão (DAU/WAU — extensão que não vira hábito morre);
- Conversão para Pro (meta: 3% dos ativos semanais em 90 dias);
- **Morte:** se em 90 dias a extensão não tiver uso semanal recorrente (produto de
  uso único), o site vira ferramenta-isca do ecossistema e Pro morre.

---

## 11. Roadmap

| Fase | Escopo | Gate |
|---|---|---|
| v0 | engine (CPF/CNPJ/e-mail/telefone/CEP/placa) + casos de teste | 100% dos casos.ts verdes |
| v1 | site: cola texto, pincel em imagem/PDF rasterizado, cópia protegida | teste do gesto com 10 pessoas |
| v1.5 | detector de nomes (sugestão + confirmação), perfis, modo reversível | revisão de falsos positivos |
| v2 | extensão MV3 (Chrome) | 100 usuários ativos do site |
| v2.5 | integração IAs: chatgpt.com + claude.ai, re-identificação local | extensão com uso semanal |
| v3 | Pro (batch, OCR, perfis avançados) via PIX/cartão | métricas do funil |
| v4 | Firefox, mais IAs, versão equipes | Pro sustentável |

---

## 12. Riscos

- **Redação falsa** (pintar por cima sem remover): risco existencial; teste automatizado
  obrigatório — o PDF gerado não pode conter o texto original em nenhuma camada;
- **DOM das IAs muda:** seletores versionados + fallback manual + telemetria de quebra;
- **Nome x LGPD:** copy sempre distingue irreversível (anônimo) de reversível
  (pseudonimizado); nunca vender o modo reversível como "anonimização total";
- **Falsa sensação de segurança:** detector de nomes erra — a UI força revisão humana
  da lista antes de aplicar, sempre.
