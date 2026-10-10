/**
 * Preço como DADO no contrato do produto. A regra nunca lê preço (continua pura);
 * o runtime usa para mostrar o valor, abrir pedido e calcular margem.
 * Princípio: a CHECAGEM é grátis; a AÇÃO (o que resolve o problema) é paga.
 * Pagamento automático (Stripe etc.) é o passo 2: aqui só se declara o preço e se registra pedido manual.
 */
export type ModeloPreco = 'interno' | 'gratis' | 'por_caso' | 'assinatura' | 'fracao'

export interface Preco {
  modelo: ModeloPreco
  /** Valor em centavos: por_caso = por ação; assinatura = por mês. */
  centavos?: number
  /** fracao: percentual (1-50) do valor que o produto recuperou/economizou para a pessoa. */
  fracaoPct?: number
  /** O que é grátis (ex.: "diagnóstico do auto"). */
  gratis: string
  /** O que é pago (ex.: "minuta da defesa pronta para protocolar"). Vazio só em interno/gratis. */
  pago?: string
  /** Custo estimado para atender 1 caso, em centavos (infra + IA + tempo do parceiro). Base da margem. */
  custoPorCasoCentavos: number
}

export function validarPreco(p: Preco): string[] {
  const e: string[] = []
  const inteiro = (n: unknown) => typeof n === 'number' && Number.isInteger(n)
  if (!inteiro(p.custoPorCasoCentavos) || p.custoPorCasoCentavos < 0) e.push('preco.custoPorCasoCentavos deve ser inteiro >= 0')
  if (!p.gratis) e.push('preco.gratis é obrigatório: diga o que a pessoa recebe sem pagar')
  if (p.modelo === 'por_caso' || p.modelo === 'assinatura') {
    if (!inteiro(p.centavos) || (p.centavos ?? 0) <= 0) e.push(`preco.centavos deve ser inteiro > 0 no modelo ${p.modelo}`)
    if (!p.pago) e.push('preco.pago é obrigatório: diga o que se paga')
  }
  if (p.modelo === 'fracao') {
    if (typeof p.fracaoPct !== 'number' || p.fracaoPct < 1 || p.fracaoPct > 50) e.push('preco.fracaoPct deve estar entre 1 e 50')
    if (!p.pago) e.push('preco.pago é obrigatório: diga o que se paga')
  }
  return e
}

/** Margem por caso em centavos, quando o preço é fixo. fracao/interno/gratis: null (depende do caso). */
export function margemPorCaso(p: Preco): number | null {
  if (p.modelo === 'por_caso') return (p.centavos ?? 0) - p.custoPorCasoCentavos
  return null
}

export const cobraAgora = (p: Preco | undefined): boolean => !!p && (p.modelo === 'por_caso' || p.modelo === 'assinatura')
