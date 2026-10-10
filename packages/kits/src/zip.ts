/**
 * ZIP "stored" (sem compressão) em streaming, sem dependências: o Worker não segura o arquivo todo na memória.
 * Usa data descriptor (CRC e tamanho vêm depois dos dados) e diretório central ao final. Limite: 4 GiB por entrada (sem zip64).
 */
export interface EntradaZip {
  nome: string
  dados: ReadableStream<Uint8Array> | Uint8Array
}

const TABELA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
function crc32(atual: number, b: Uint8Array): number { let c = ~atual >>> 0; for (let i = 0; i < b.length; i++) c = TABELA[(c ^ b[i]!) & 0xff]! ^ (c >>> 8); return ~c >>> 0 }

const u16 = (n: number) => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff)
const u32 = (n: number) => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff)
const junta = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length } return o }

function dos(d: Date) {
  const ano = Math.max(1980, d.getUTCFullYear())
  return { hora: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1), data: ((ano - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate() }
}

export function zipStore(entradas: readonly EntradaZip[], quando: Date = new Date()): ReadableStream<Uint8Array> {
  const { hora, data } = dos(quando)
  async function* gerar(): AsyncGenerator<Uint8Array> {
    const central: Uint8Array[] = []
    let offset = 0
    const emitir = (b: Uint8Array) => { offset += b.length; return b }
    for (const e of entradas) {
      const nome = new TextEncoder().encode(e.nome)
      const inicio = offset
      yield emitir(junta(u32(0x04034b50), u16(20), u16(0x0808), u16(0), u16(hora), u16(data), u32(0), u32(0), u32(0), u16(nome.length), u16(0), nome))
      let crc = 0, tamanho = 0
      if (e.dados instanceof Uint8Array) { crc = crc32(0, e.dados); tamanho = e.dados.length; yield emitir(e.dados) }
      else {
        const r = e.dados.getReader()
        for (;;) { const { done, value } = await r.read(); if (done) break; crc = crc32(crc, value); tamanho += value.length; yield emitir(value) }
      }
      if (tamanho > 0xffffffff) throw new Error('entrada maior que 4 GiB')
      yield emitir(junta(u32(0x08074b50), u32(crc), u32(tamanho), u32(tamanho)))
      central.push(junta(u32(0x02014b50), u16(20), u16(20), u16(0x0808), u16(0), u16(hora), u16(data), u32(crc), u32(tamanho), u32(tamanho), u16(nome.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(inicio), nome))
    }
    const inicioCentral = offset
    let tamCentral = 0
    for (const c of central) { tamCentral += c.length; yield emitir(c) }
    yield emitir(junta(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(tamCentral), u32(inicioCentral), u16(0)))
  }
  const it = gerar()
  return new ReadableStream<Uint8Array>({
    async pull(c) { const { done, value } = await it.next(); if (done) c.close(); else c.enqueue(value) },
    async cancel() { await it.return(undefined) },
  })
}

/** Lê um ZIP "stored" pelo diretório central (usado pelo verificador offline e nos testes). */
export function lerZipStore(zip: Uint8Array): { nome: string; dados: Uint8Array }[] {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('ZIP inválido: sem diretório central')
  const n = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const out: { nome: string; dados: Uint8Array }[] = []
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP inválido: entrada central')
    if (dv.getUint16(p + 10, true) !== 0) throw new Error('ZIP com compressão não é suportado aqui; extraia com unzip')
    const crcEsperado = dv.getUint32(p + 16, true)
    const tam = dv.getUint32(p + 24, true)
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true)
    const off = dv.getUint32(p + 42, true)
    const nome = new TextDecoder().decode(zip.slice(p + 46, p + 46 + nl))
    const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true)
    const dados = zip.slice(ini, ini + tam)
    if (crc32(0, dados) !== crcEsperado) throw new Error(`CRC inválido em ${nome}`)
    out.push({ nome, dados })
    p += 46 + nl + el + cl
  }
  return out
}
