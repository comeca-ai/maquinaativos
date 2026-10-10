import { describe, it, expect } from 'vitest'
import { validarProduto, lacunas, divergencias, type Produto, type CasoDeTeste } from '@maquina/core'

// Todo produto em products/<x>/ passa por AQUI. Quem não cobre estado e motivo não entra.
const produtos = import.meta.glob('../products/*/index.ts', { eager: true }) as Record<string, { default: Produto }>
const naoFaremos = import.meta.glob('../products/*/NAO-FAREMOS.md', { query: '?raw', eager: true })
const casos = import.meta.glob('../products/*/casos.ts', { eager: true }) as Record<string, { casos: CasoDeTeste[] }>

describe('cerca de qualidade de todos os produtos', () => {
  it('há ao menos um produto', () => {
    expect(Object.keys(produtos).length).toBeGreaterThan(0)
  })

  for (const [caminho, mod] of Object.entries(produtos)) {
    const pasta = caminho.replace('/index.ts', '')
    const p = mod.default
    describe(p.nome, () => {
      const c = casos[`${pasta}/casos.ts`]?.casos

      it('contrato válido', () => expect(validarProduto(p)).toEqual([]))
      it('tem casos.ts', () => expect(c, `${pasta}/casos.ts ausente`).toBeDefined())
      it('tem NAO-FAREMOS.md', () => expect(Object.keys(naoFaremos)).toContain(`${pasta}/NAO-FAREMOS.md`))
      it('cada estado e cada motivo tem teste', () => expect(lacunas(p, c ?? [])).toEqual({ estados: [], motivos: [] }))
      it('todos os casos batem com a regra', async () => expect(await divergencias(p, c ?? [])).toEqual([]))
    })
  }
})
