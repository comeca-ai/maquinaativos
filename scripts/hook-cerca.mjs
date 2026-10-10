// Hook local do Claude Code: numa branch produto/<x>, recusa editar fora de products/<x>/.
import { execSync } from 'node:child_process'
let entrada = ''
process.stdin.on('data', (d) => (entrada += d))
process.stdin.on('end', () => {
  try {
    const caminho = JSON.parse(entrada)?.tool_input?.file_path ?? ''
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
    const m = branch.match(/^produto\/([a-z0-9-]+)$/)
    if (!m) process.exit(0)
    const raiz = execSync('git rev-parse --show-toplevel').toString().trim()
    const rel = caminho.startsWith(raiz) ? caminho.slice(raiz.length + 1) : caminho
    if (rel.startsWith(`products/${m[1]}/`) || rel === 'apps/runtime/src/registro.gerado.ts') process.exit(0)
    console.error(`CERCA: na branch ${branch} só é permitido editar products/${m[1]}/. Recusado: ${rel}`)
    process.exit(2)
  } catch { process.exit(0) }
})
