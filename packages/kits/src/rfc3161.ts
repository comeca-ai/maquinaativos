/**
 * Kit de carimbo de tempo RFC 3161 (o formato usado pelas Autoridades de Carimbo do Tempo, inclusive as da ICP-Brasil).
 * Sem dependências: monta o TimeStampReq em DER, envia por HTTP e lê o TimeStampResp.
 * Verificação independente: `openssl ts -verify -in carimbo-tempo.tsr -data manifesto.json -CAfile <cadeia da ACT>`.
 *
 * Importante: este kit NÃO decide se o carimbo é ICP-Brasil. Isso depende de QUAL servidor é configurado
 * (uma ACT credenciada no ITI) e do rótulo que o operador declara. Servidor de teste não é ICP.
 */

export type AlgHash = 'sha256' | 'sha512'
const OID_HASH: Record<AlgHash, string> = { sha256: '2.16.840.1.101.3.4.2.1', sha512: '2.16.840.1.101.3.4.2.3' }
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2'
const OID_TST_INFO = '1.2.840.113549.1.9.16.1.4'

/* ---------- DER: escrita ---------- */
const junta = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length } return o }
function tamanho(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n)
  const b: number[] = []
  for (let x = n; x > 0; x = Math.floor(x / 256)) b.unshift(x & 0xff)
  return Uint8Array.of(0x80 | b.length, ...b)
}
const tlv = (tag: number, valor: Uint8Array) => junta(Uint8Array.of(tag), tamanho(valor.length), valor)
const seq = (...p: Uint8Array[]) => tlv(0x30, junta(...p))
function oidDer(oid: string): Uint8Array {
  const p = oid.split('.').map(Number)
  const out: number[] = [p[0]! * 40 + p[1]!]
  for (const n of p.slice(2)) {
    const b: number[] = [n & 0x7f]
    for (let x = Math.floor(n / 128); x > 0; x = Math.floor(x / 128)) b.unshift((x & 0x7f) | 0x80)
    out.push(...b)
  }
  return tlv(0x06, Uint8Array.from(out))
}
function inteiroPositivo(bytes: Uint8Array): Uint8Array {
  let i = 0
  while (i < bytes.length - 1 && bytes[i] === 0) i++
  const v = bytes.slice(i)
  return tlv(0x02, v[0]! & 0x80 ? junta(Uint8Array.of(0), v) : v)
}

export const hexDe = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
const deHex = (h: string) => Uint8Array.from(h.match(/../g)?.map((x) => parseInt(x, 16)) ?? [])

/** TimeStampReq v1 com nonce e pedido do certificado da TSA (certReq = TRUE). */
export function pedidoCarimbo(hashHex: string, alg: AlgHash, nonce: Uint8Array): Uint8Array {
  const esperado = alg === 'sha256' ? 64 : 128
  if (!new RegExp(`^[0-9a-f]{${esperado}}$`).test(hashHex)) throw new Error(`hash ${alg} inválido`)
  const algId = seq(oidDer(OID_HASH[alg]), Uint8Array.of(0x05, 0x00))
  const imprint = seq(algId, tlv(0x04, deHex(hashHex)))
  return seq(tlv(0x02, Uint8Array.of(1)), imprint, inteiroPositivo(nonce), Uint8Array.of(0x01, 0x01, 0xff))
}

/* ---------- DER: leitura ---------- */
interface No { tag: number; ini: number; fim: number; valorIni: number }
function ler(b: Uint8Array, pos: number): No {
  const tag = b[pos]!
  let len = b[pos + 1]!
  let p = pos + 2
  if (len & 0x80) {
    const n = len & 0x7f
    if (n === 0 || n > 4) throw new Error('DER: tamanho não suportado')
    len = 0
    for (let i = 0; i < n; i++) len = len * 256 + b[p + i]!
    p += n
  }
  if (p + len > b.length) throw new Error('DER: truncado')
  return { tag, ini: pos, fim: p + len, valorIni: p }
}
function filhos(b: Uint8Array, no: No): No[] {
  const out: No[] = []
  for (let p = no.valorIni; p < no.fim;) { const f = ler(b, p); out.push(f); p = f.fim }
  return out
}
function oidTexto(b: Uint8Array, no: No): string {
  const v = b.slice(no.valorIni, no.fim)
  const p: number[] = [Math.floor(v[0]! / 40), v[0]! % 40]
  let acc = 0
  for (const x of v.slice(1)) { acc = acc * 128 + (x & 0x7f); if (!(x & 0x80)) { p.push(acc); acc = 0 } }
  return p.join('.')
}
const valor = (b: Uint8Array, no: No) => b.slice(no.valorIni, no.fim)
function inteiroHex(b: Uint8Array, no: No): string { let h = hexDe(valor(b, no)); while (h.startsWith('00') && h.length > 2) h = h.slice(2); return h }
function tempoGeneralizado(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(s)
  if (!m) throw new Error(`genTime inesperado: ${s}`)
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${(m[7] ?? '').slice(0, 4)}Z`
}

export interface InfoCarimbo {
  status: number
  politica: string
  algHash: AlgHash | string
  hashCarimbado: string
  serie: string
  geradoEm: string
  nonce: string | null
}

/** Lê um TimeStampResp (ou só o token, ContentInfo). Devolve o token em DER e os dados do TSTInfo. */
export function lerRespostaCarimbo(resposta: Uint8Array): { status: number; token: Uint8Array | null; info: InfoCarimbo | null } {
  const raiz = ler(resposta, 0)
  const partes = filhos(resposta, raiz)
  let status = 0
  let tokenNo: No | undefined
  if (partes[0]?.tag === 0x30 && partes[0] && filhos(resposta, partes[0])[0]?.tag === 0x02) {
    // TimeStampResp: SEQUENCE { PKIStatusInfo, ContentInfo? }
    status = parseInt(inteiroHex(resposta, filhos(resposta, partes[0])[0]!), 16)
    tokenNo = partes[1]
  } else tokenNo = raiz // já é o ContentInfo
  if (!tokenNo) return { status, token: null, info: null }
  const token = resposta.slice(tokenNo.ini, tokenNo.fim)
  const ci = filhos(resposta, tokenNo)
  if (oidTexto(resposta, ci[0]!) !== OID_SIGNED_DATA) throw new Error('token não é SignedData')
  const signedData = filhos(resposta, ci[1]!)[0]!
  const encap = filhos(resposta, signedData).find((n, i) => i > 0 && n.tag === 0x30)!
  const [tipo, explicito] = filhos(resposta, encap)
  if (oidTexto(resposta, tipo!) !== OID_TST_INFO) throw new Error('conteúdo não é TSTInfo')
  const octeto = filhos(resposta, explicito!)[0]!
  const tst = ler(resposta, octeto.valorIni)
  const c = filhos(resposta, tst)
  const imprint = filhos(resposta, c[2]!)
  const algOid = oidTexto(resposta, filhos(resposta, imprint[0]!)[0]!)
  const alg = (Object.keys(OID_HASH) as AlgHash[]).find((k) => OID_HASH[k] === algOid) ?? algOid
  let nonce: string | null = null
  for (const n of c.slice(5)) if (n.tag === 0x02) { nonce = inteiroHex(resposta, n); break }
  return {
    status, token,
    info: {
      status, politica: oidTexto(resposta, c[1]!), algHash: alg, hashCarimbado: hexDe(valor(resposta, imprint[1]!)),
      serie: inteiroHex(resposta, c[3]!), geradoEm: tempoGeneralizado(new TextDecoder().decode(valor(resposta, c[4]!))), nonce,
    },
  }
}

export interface OpcoesCarimbo { url: string; autorizacao?: string; timeoutMs?: number; alg?: AlgHash }

/** Pede o carimbo e confere que a resposta carimbou EXATAMENTE o nosso hash, com o nosso nonce. */
export async function carimbar(hashHex: string, o: OpcoesCarimbo): Promise<{ resposta: Uint8Array; info: InfoCarimbo }> {
  const alg = o.alg ?? 'sha256'
  const nonce = crypto.getRandomValues(new Uint8Array(8))
  nonce[0] = (nonce[0]! & 0x7f) | 0x01 // positivo e sem zero à esquerda
  const r = await fetch(o.url, {
    method: 'POST',
    headers: { 'content-type': 'application/timestamp-query', accept: 'application/timestamp-reply', ...(o.autorizacao ? { authorization: o.autorizacao } : {}) },
    body: pedidoCarimbo(hashHex, alg, nonce),
    signal: AbortSignal.timeout(o.timeoutMs ?? 10000),
  })
  if (!r.ok) throw new Error(`TSA respondeu HTTP ${r.status}`)
  const resposta = new Uint8Array(await r.arrayBuffer())
  const { status, info } = lerRespostaCarimbo(resposta)
  if (status > 1 || !info) throw new Error(`TSA recusou (status ${status})`)
  if (info.hashCarimbado !== hashHex.toLowerCase()) throw new Error('TSA carimbou um hash diferente do pedido')
  if (info.nonce !== hexDe(nonce).replace(/^(00)+/, '')) throw new Error('nonce da resposta não confere')
  return { resposta, info }
}
