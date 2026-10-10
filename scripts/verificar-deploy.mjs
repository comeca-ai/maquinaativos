// Falha ANTES do deploy, com mensagem clara, se a configuração ainda tem o ID de banco de mentira.
import { readFileSync } from 'node:fs'
const cfg = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
if (/"database_id":\s*"0{8}-0{4}-0{4}-0{4}-0{12}"/.test(cfg)) {
  console.error('\nPARE: o wrangler.jsonc ainda tem o database_id de mentira (00000000-...).\n' +
    'Crie o banco: Cloudflare > Storage & Databases > D1 > Create > nome "maquina",\n' +
    'copie o Database ID e cole em wrangler.jsonc (campo database_id). Depois publique de novo.\n')
  process.exit(1)
}
console.log('config ok')
