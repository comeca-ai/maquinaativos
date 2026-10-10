import { lerOts, alturasBitcoin, pendentes } from './opentimestamps'

/**
 * Verificação offline de um pacote de prova (arquivo + manifesto.json + prova.ots).
 * Não usa rede nem o nosso servidor. A checagem final no Bitcoin é do cliente oficial (`ots verify`).
 */
export interface ResultadoPacote {
  integro: boolean
  itens: { ok: boolean; texto: string }[]
  ots: 'ausente' | 'pendente' | 'bitcoin' | 'invalido'
  alturasBitcoin: number[]
}

const RESERVADOS = new Set(['manifesto.json', 'prova.ots', 'LEIA-ME.txt', 'RELATORIO.html'])

async function sha(b: Uint8Array) {
  const d = await crypto.subtle.digest('SHA-256', b)
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export async function verificarPacote(arquivos: { nome: string; dados: Uint8Array }[]): Promise<ResultadoPacote> {
  const itens: ResultadoPacote['itens'] = []
  const marca = (ok: boolean, texto: string) => itens.push({ ok, texto })
  const man = arquivos.find((a) => a.nome === 'manifesto.json')
  const otsArq = arquivos.find((a) => a.nome === 'prova.ots')
  // RELATORIO.html é só leitura humana dos registros: não entra na conferência (o que vale é arquivo + manifesto + .ots).
  const arq = arquivos.find((a) => !RESERVADOS.has(a.nome))
  let ots: ResultadoPacote['ots'] = 'ausente'
  let alturas: number[] = []

  if (!man) marca(false, 'manifesto.json ausente')
  if (!arq) marca(false, 'arquivo preservado ausente')
  if (man && arq) {
    let m: { arquivo?: { sha256?: string; bytes?: number; nome?: string } } | null = null
    try { m = JSON.parse(new TextDecoder().decode(man.dados)) } catch { marca(false, 'manifesto.json não é JSON válido') }
    if (m?.arquivo?.sha256) {
      const h = await sha(arq.dados)
      marca(h === m.arquivo.sha256, `SHA-256 do arquivo ${h === m.arquivo.sha256 ? 'confere com o' : 'DIFERE do'} manifesto (${h})`)
      marca(arq.dados.length === m.arquivo.bytes, `tamanho ${arq.dados.length} bytes ${arq.dados.length === m.arquivo.bytes ? 'confere' : 'DIFERE do manifesto'}`)
    } else if (m) marca(false, 'manifesto sem arquivo.sha256')
  }
  if (man && otsArq) {
    try {
      const { digestHex } = lerOts(otsArq.dados)
      const hm = await sha(man.dados)
      marca(hm === digestHex, `SHA-256 do manifesto ${hm === digestHex ? 'é o digest carimbado em' : 'DIFERE do digest de'} prova.ots (${hm})`)
      alturas = alturasBitcoin(otsArq.dados)
      ots = alturas.length ? 'bitcoin' : pendentes(otsArq.dados).length ? 'pendente' : 'invalido'
    } catch (e) { ots = 'invalido'; marca(false, `prova.ots inválida: ${(e as Error).message}`) }
  } else if (man) marca(false, 'prova.ots ausente: sem carimbo de tempo')
  return { integro: itens.length > 0 && itens.every((i) => i.ok), itens, ots, alturasBitcoin: alturas }
}
