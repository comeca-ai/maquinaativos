// ARQUIVO GERADO por scripts/gerar-registro.mjs. Não edite à mão.
import type { Produto } from '@maquina/core'
import p_funil from '../../../products/funil/index'
import p_prova_digital from '../../../products/prova-digital/index'

export const produtos: Record<string, Produto> = {
  'funil': p_funil as unknown as Produto,
  'prova-digital': p_prova_digital as unknown as Produto,
}
