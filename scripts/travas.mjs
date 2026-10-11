// TRAVAS — os bloqueios dos agentes-guardas, promovidos a código.
// O que era convenção visível vira falha de build. Roda no CI, junto da cerca.
// Códigos nomeados igual aos bloqueios dos agentes (.claude/agents): REGRA IMPURA,
// MORTE NÃO DECLARADA, SEM FALLBACK. (ORDEM DE DEPLOY INDEFINIDA já é coberta
// pelo verificar-deploy + migrations append-only.)
// Uso: node scripts/travas.mjs
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const dirProdutos = join(RAIZ, 'products')
const produtos = readdirSync(dirProdutos, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const falhas = []

// 1. REGRA IMPURA (guarda de software): rule.ts é pura — sem rede, sem relógio,
//    sem aleatoriedade, sem ambiente. `hoje` entra como parâmetro.
//    Limite conhecido: o grep não ignora comentários; se um comentário citar um
//    padrão proibido, a trava morde — prefira reescrever o comentário.
const PROIBIDOS = [
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bDate\.now\s*\(/, 'Date.now()'],
  [/\bnew\s+Date\s*\(/, 'new Date()'],
  [/\bMath\.random\s*\(/, 'Math.random()'],
  [/\bcrypto\.randomUUID\s*\(/, 'crypto.randomUUID()'],
  [/\bperformance\.now\s*\(/, 'performance.now()'],
  [/\bprocess\.env\b/, 'process.env'],
  [/\bsetTimeout\s*\(/, 'setTimeout()'],
  [/\bsetInterval\s*\(/, 'setInterval()'],
  [/\bimport\s*\(/, 'import() dinâmico'],
]
for (const p of produtos) {
  const arq = join(dirProdutos, p, 'rule.ts')
  if (!existsSync(arq)) continue
  const fonte = readFileSync(arq, 'utf8')
  for (const [re, rotulo] of PROIBIDOS) {
    if (re.test(fonte)) {
      falhas.push(`REGRA IMPURA: products/${p}/rule.ts usa ${rotulo} — regra pura não tem rede, relógio nem ambiente`)
    }
  }
}

// 2. MORTE NÃO DECLARADA (guarda do CFO): todo produto declara criterioDeMorte
//    com prazo e métrica no defineProduto. (Aceita constante ou número no prazo.)
for (const p of produtos) {
  const arq = join(dirProdutos, p, 'index.ts')
  if (!existsSync(arq)) {
    falhas.push(`MORTE NÃO DECLARADA: products/${p}/ não tem index.ts`)
    continue
  }
  const fonte = readFileSync(arq, 'utf8')
  const ok = /criterioDeMorte\s*:\s*\{[^}]*prazoDias\s*:[^,}]+,[^}]*metrica\s*:\s*['"][^'"]+['"]/s.test(fonte)
  if (!ok) {
    falhas.push(`MORTE NÃO DECLARADA: products/${p}/index.ts sem criterioDeMorte { prazoDias, metrica } preenchido`)
  }
}

// 3. SEM FALLBACK (guarda de IA): produto que usa IA em runtime precisa declarar
//    o fallback (ex.: OCR falha → formulário manual) em algum arquivo do produto.
const USA_IA = [/@cf\//, /\benv\.AI\b/, /\bAI\.run\s*\(/]
let algumComIA = false
for (const p of produtos) {
  const dir = join(dirProdutos, p)
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.md'))
  const codigo = arquivos.filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
  if (!USA_IA.some((re) => re.test(codigo))) continue
  algumComIA = true
  const tudo = arquivos.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
  if (!/fallback/i.test(tudo)) {
    falhas.push(`SEM FALLBACK: products/${p}/ usa IA em runtime sem fallback declarado`)
  }
}
if (!algumComIA) console.log('SEM FALLBACK: nenhum produto usa IA em runtime hoje — trava armada para quando usar.')

if (falhas.length) {
  console.error(`TRAVAS: ${falhas.length} violação(ões):\n- ${falhas.join('\n- ')}`)
  process.exit(1)
}
console.log(`travas ok (${produtos.length} produto(s): regra pura, morte declarada, fallback)`)
