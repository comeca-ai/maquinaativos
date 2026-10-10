/**
 * Kit OpenTimestamps (OTS): ancora um SHA-256 em calendários públicos (que agregam e gravam no Bitcoin)
 * e monta o arquivo .ots padrão. Sem dependências, roda em Worker e em Node.
 * Verificação independente: `ots verify` (cliente oficial) ou https://opentimestamps.org.
 * A confirmação no Bitcoin não é imediata: a prova nasce "pendente" e é promovida por `atualizar()`.
 */
const MAGIC = Uint8Array.from([0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94])
const TAG_PENDENTE = '83dfe30d2ef90c8e'
const TAG_BITCOIN = '0588960d73d71901'
const OP_SHA256 = 0x08
const OP_APPEND = 0xf0
const OP_PREPEND = 0xf1

/** Agregadores (onde se ENVIA o digest): padrão do cliente oficial. Respondem HTTP 200 (verificado em 2026-10-10). */
export const AGREGADORES_PADRAO = [
  'https://a.pool.opentimestamps.org',
  'https://b.pool.opentimestamps.org',
  'https://a.pool.eternitywall.com',
  'https://ots.btc.catallaxy.com',
]
/** Calendários que aparecem como atestado pendente nas respostas reais (verificado em 2026-10-10). Só estes são consultados no upgrade. */
export const CALENDARIOS_ATESTADO = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
  'https://btc.calendar.catallaxy.com',
]

export interface Atestado { tag: string; payload: Uint8Array }
export interface Op { tag: number; arg?: Uint8Array }
export interface No { atestados: Atestado[]; ops: { op: Op; filho: No }[] }

/* ---------- bytes ---------- */
export const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
export const deHex = (h: string) => Uint8Array.from(h.match(/../g)?.map((x) => parseInt(x, 16)) ?? [])
const igual = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])
const junta = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length } return o }

class Leitor {
  pos = 0
  b: Uint8Array
  constructor(b: Uint8Array) { this.b = b }
  u8() { if (this.pos >= this.b.length) throw new Error('OTS truncado'); return this.b[this.pos++]! }
  bytes(n: number) { if (this.pos + n > this.b.length) throw new Error('OTS truncado'); const r = this.b.slice(this.pos, this.pos + n); this.pos += n; return r }
  varuint() { let v = 0, shift = 0; for (;;) { const x = this.u8(); v += (x & 0x7f) * 2 ** shift; if (!(x & 0x80)) return v; shift += 7; if (shift > 35) throw new Error('varuint grande demais') } }
  varbytes() { return this.bytes(this.varuint()) }
  fim() { return this.pos >= this.b.length }
}
const escreveVaruint = (n: number) => { const o: number[] = []; do { let x = n % 128; n = Math.floor(n / 128); if (n > 0) x |= 0x80; o.push(x) } while (n > 0); return Uint8Array.from(o) }
const escreveVarbytes = (b: Uint8Array) => junta(escreveVaruint(b.length), b)

/* ---------- árvore ---------- */
function lerNo(l: Leitor, prof = 0): No {
  if (prof > 64) throw new Error('OTS profundo demais')
  const no: No = { atestados: [], ops: [] }
  for (;;) {
    let t = l.u8()
    const mais = t === 0xff
    if (mais) t = l.u8()
    if (t === 0x00) {
      const tag = hex(l.bytes(8))
      no.atestados.push({ tag, payload: l.varbytes() })
    } else {
      const op: Op = { tag: t }
      if (t === OP_APPEND || t === OP_PREPEND) op.arg = l.varbytes()
      else if (t !== OP_SHA256) throw new Error(`operação OTS não suportada: 0x${t.toString(16)}`)
      no.ops.push({ op, filho: lerNo(l, prof + 1) })
    }
    if (!mais) return no
  }
}

function escreverNo(no: No): Uint8Array {
  const itens: Uint8Array[] = []
  for (const a of no.atestados) itens.push(junta(Uint8Array.of(0x00), deHex(a.tag), escreveVarbytes(a.payload)))
  for (const { op, filho } of no.ops) itens.push(junta(Uint8Array.of(op.tag), op.arg ? escreveVarbytes(op.arg) : new Uint8Array(), escreverNo(filho)))
  if (itens.length === 0) throw new Error('nó OTS vazio')
  return junta(...itens.map((it, i) => (i < itens.length - 1 ? junta(Uint8Array.of(0xff), it) : it)))
}

/** Une duas árvores com a mesma mensagem. Funde operações idênticas. */
function fundir(a: No, b: No) {
  for (const at of b.atestados) if (!a.atestados.some((x) => x.tag === at.tag && igual(x.payload, at.payload))) a.atestados.push(at)
  for (const ob of b.ops) {
    const par = a.ops.find((oa) => oa.op.tag === ob.op.tag && ((!oa.op.arg && !ob.op.arg) || (oa.op.arg && ob.op.arg && igual(oa.op.arg, ob.op.arg))))
    if (par) fundir(par.filho, ob.filho)
    else a.ops.push(ob)
  }
}

async function aplicar(op: Op, msg: Uint8Array): Promise<Uint8Array> {
  if (op.tag === OP_SHA256) return new Uint8Array(await crypto.subtle.digest('SHA-256', msg))
  if (op.tag === OP_APPEND) return junta(msg, op.arg!)
  return junta(op.arg!, msg)
}

/* ---------- arquivo .ots ---------- */
export function montarOts(digestHex: string, raiz: No): Uint8Array {
  return junta(MAGIC, escreveVaruint(1), Uint8Array.of(OP_SHA256), deHex(digestHex), escreverNo(raiz))
}

export function lerOts(ots: Uint8Array): { digestHex: string; raiz: No } {
  const l = new Leitor(ots)
  if (!igual(l.bytes(MAGIC.length), MAGIC)) throw new Error('não é um arquivo .ots')
  if (l.varuint() !== 1) throw new Error('versão OTS não suportada')
  if (l.u8() !== OP_SHA256) throw new Error('só SHA-256 é suportado')
  const digestHex = hex(l.bytes(32))
  const raiz = lerNo(l)
  if (!l.fim()) throw new Error('bytes sobrando no .ots')
  return { digestHex, raiz }
}

const percorrer = (no: No, f: (a: Atestado) => void) => { no.atestados.forEach(f); no.ops.forEach((o) => percorrer(o.filho, f)) }
const uriPendente = (a: Atestado) => new TextDecoder().decode(new Leitor(a.payload).varbytes())

/** Alturas de bloco Bitcoin atestadas (lista vazia = só pendente). */
export function alturasBitcoin(ots: Uint8Array): number[] {
  const { raiz } = lerOts(ots)
  const r: number[] = []
  percorrer(raiz, (a) => { if (a.tag === TAG_BITCOIN) r.push(new Leitor(a.payload).varuint()) })
  return r
}

export function pendentes(ots: Uint8Array): string[] {
  const { raiz } = lerOts(ots)
  const r: string[] = []
  percorrer(raiz, (a) => { if (a.tag === TAG_PENDENTE) r.push(uriPendente(a)) })
  return r
}

/* ---------- rede ---------- */
/** `calendarios`: em ancorar() são os agregadores de envio; em atualizar() são os hosts de atestado permitidos. */
export interface OpcoesOts { fetch?: typeof fetch; calendarios?: readonly string[]; timeoutMs?: number }

async function comTimeout(f: typeof fetch, url: string, init: RequestInit, ms: number) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms)
  try { return await f(url, { ...init, signal: c.signal }) } finally { clearTimeout(t) }
}

/** Envia o digest aos calendários e devolve o .ots (pendente) e quantos calendários responderam. */
export async function ancorar(digestHex: string, o: OpcoesOts = {}): Promise<{ ots: Uint8Array; calendarios: string[] }> {
  if (!/^[0-9a-f]{64}$/.test(digestHex)) throw new Error('digest deve ser SHA-256 hex minúsculo')
  const f = o.fetch ?? fetch
  const alvos = o.calendarios ?? AGREGADORES_PADRAO
  const corpo = deHex(digestHex)
  const respostas = await Promise.all(alvos.map(async (cal) => {
    try {
      const r = await comTimeout(f, `${cal}/digest`, { method: 'POST', body: corpo, headers: { accept: 'application/vnd.opentimestamps.v1', 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'maquinaativos-ots/1' } }, o.timeoutMs ?? 10_000)
      if (!r.ok) return null
      const l = new Leitor(new Uint8Array(await r.arrayBuffer()))
      const no = lerNo(l)
      return l.fim() ? { cal, no } : null
    } catch { return null }
  }))
  const ok = respostas.filter((x): x is { cal: string; no: No } => x !== null)
  if (ok.length === 0) throw new Error('nenhum calendário OpenTimestamps respondeu')
  const raiz: No = { atestados: [], ops: [] }
  for (const x of ok) fundir(raiz, x.no)
  return { ots: montarOts(digestHex, raiz), calendarios: ok.map((x) => x.cal) }
}

/**
 * Tenta promover atestados pendentes a Bitcoin. Só consulta URIs dentro da lista de calendários
 * (a URI vem de dados remotos: sem esta trava seria SSRF).
 */
export async function atualizar(ots: Uint8Array, o: OpcoesOts = {}): Promise<{ ots: Uint8Array; mudou: boolean; alturas: number[] }> {
  const f = o.fetch ?? fetch
  const permitidos = new Set((o.calendarios ?? CALENDARIOS_ATESTADO).map((c) => c.replace(/\/+$/, '')))
  const { digestHex, raiz } = lerOts(ots)
  let mudou = false
  async function andar(no: No, msg: Uint8Array) {
    for (const a of [...no.atestados]) {
      if (a.tag !== TAG_PENDENTE) continue
      const uri = uriPendente(a).replace(/\/+$/, '')
      if (!permitidos.has(uri)) continue
      try {
        const r = await comTimeout(f, `${uri}/timestamp/${hex(msg)}`, { headers: { accept: 'application/vnd.opentimestamps.v1', 'user-agent': 'maquinaativos-ots/1' } }, o.timeoutMs ?? 10_000)
        if (!r.ok) continue
        const l = new Leitor(new Uint8Array(await r.arrayBuffer()))
        const novo = lerNo(l)
        if (!l.fim()) continue
        no.atestados = no.atestados.filter((x) => x !== a)
        fundir(no, novo)
        mudou = true
      } catch { /* continua pendente */ }
    }
    for (const { op, filho } of no.ops) await andar(filho, await aplicar(op, msg))
  }
  await andar(raiz, deHex(digestHex))
  const novo = mudou ? montarOts(digestHex, raiz) : ots
  return { ots: novo, mudou, alturas: alturasBitcoin(novo) }
}
