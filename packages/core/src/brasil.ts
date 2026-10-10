/** Ontologia brasileira: o que a maquina entende nativamente. Tudo puro e testado. */

/** Reais (string "1.234,56" ou number) para centavos inteiros. Dinheiro NUNCA é float no motor. */
export function reaisParaCentavos(v: string | number): number {
  if (typeof v === 'number') return Math.round(v * 100)
  const limpo = v.replace(/[R$\s.]/g, '').replace(',', '.')
  const n = Number(limpo)
  if (!Number.isFinite(n)) throw new Error(`valor monetário inválido: ${v}`)
  return Math.round(n * 100)
}

export function centavosParaReais(c: number): string {
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function soDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

export function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10])
}

export function cnpjValido(cnpj: string): boolean {
  const d = soDigitos(cnpj)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = [...base].reduce((acc, ch, i) => acc + Number(ch) * (pesos[i] ?? 0), 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13])
}

/** Placa antiga (ABC-1234) ou Mercosul (ABC1D23). Devolve normalizada ou null. */
export function normalizarPlaca(p: string): string | null {
  const s = p.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^[A-Z]{3}[0-9]{4}$/.test(s) || /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(s) ? s : null
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** Dia útil = não é sábado, domingo nem feriado informado (AAAA-MM-DD). Feriados vêm de fora: a regra continua pura. */
export function ehDiaUtil(data: string, feriados: readonly string[] = []): boolean {
  const dow = new Date(`${data}T00:00:00Z`).getUTCDay()
  return dow !== 0 && dow !== 6 && !feriados.includes(data)
}

/** Soma N dias úteis a partir de `data` (o dia inicial não conta). */
export function somarDiasUteis(data: string, n: number, feriados: readonly string[] = []): string {
  const d = new Date(`${data}T00:00:00Z`)
  let falta = n
  while (falta > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (ehDiaUtil(ymd(d), feriados)) falta--
  }
  return ymd(d)
}

/** Diferença em dias corridos (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}
