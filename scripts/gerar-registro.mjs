// Gera apps/runtime/src/registro.gerado.ts a partir de products/*/index.ts.
// Assim um produto novo entra no runtime SEM editar nenhum arquivo do framework.
// Uso: node scripts/gerar-registro.mjs [--check]
import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const pasta = join(raiz, 'products')
const saida = join(raiz, 'apps/runtime/src/registro.gerado.ts')

const nomes = readdirSync(pasta, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(pasta, d.name, 'index.ts')))
  .map((d) => d.name)
  .sort()

const ident = (n) => 'p_' + n.replace(/[^a-z0-9]/g, '_')
const conteudo = [
  '// ARQUIVO GERADO por scripts/gerar-registro.mjs. Não edite à mão.',
  "import type { Produto } from '@maquina/core'",
  ...nomes.map((n) => `import ${ident(n)} from '../../../products/${n}/index'`),
  '',
  'export const produtos: Record<string, Produto> = {',
  ...nomes.map((n) => `  '${n}': ${ident(n)} as unknown as Produto,`),
  '}',
  '',
].join('\n')

if (process.argv.includes('--check')) {
  const atual = existsSync(saida) ? readFileSync(saida, 'utf8') : ''
  if (atual !== conteudo) {
    console.error('registro.gerado.ts está desatualizado. Rode: pnpm registro')
    process.exit(1)
  }
  console.log('registro ok')
} else {
  writeFileSync(saida, conteudo)
  console.log(`registro gerado com ${nomes.length} produto(s): ${nomes.join(', ')}`)
}
