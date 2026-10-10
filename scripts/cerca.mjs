// A CERCA. Roda no CI e como hook local.
// Regra: numa branch produto/<x>, só podem mudar arquivos de products/<x>/ e o registro gerado.
// Numa branch framework/*, products/<x> (x != funil) não pode mudar.
// Uso: node scripts/cerca.mjs <branch> <refBase>
import { execSync } from 'node:child_process'

const branch = process.argv[2] ?? execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
const base = process.argv[3] ?? 'origin/main'
const arquivos = execSync(`git diff --name-only ${base}...HEAD`).toString().split('\n').filter(Boolean)

const GERADO = 'apps/runtime/src/registro.gerado.ts'
let proibidos = []

const m = branch.match(/^produto\/([a-z0-9-]+)$/)
if (m) {
  const dir = `products/${m[1]}/`
  proibidos = arquivos.filter((f) => !f.startsWith(dir) && f !== GERADO)
  if (proibidos.length) {
    console.error(`CERCA: a branch ${branch} só pode tocar ${dir}** e ${GERADO}. Violações:\n- ${proibidos.join('\n- ')}`)
    process.exit(1)
  }
} else if (/^framework\//.test(branch)) {
  proibidos = arquivos.filter((f) => f.startsWith('products/') && !f.startsWith('products/funil/'))
  if (proibidos.length) {
    console.error(`CERCA: branch de framework não pode tocar produtos (exceto funil). Violações:\n- ${proibidos.join('\n- ')}`)
    process.exit(1)
  }
}
console.log(`cerca ok (${branch}, ${arquivos.length} arquivo(s) alterado(s))`)
