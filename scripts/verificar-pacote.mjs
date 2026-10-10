// Verificador OFFLINE de pacote de prova (pasta ou .zip). Não usa rede nem o servidor da máquina.
// Uso: node scripts/verificar-pacote.mjs <pasta-ou-arquivo.zip>
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { verificarPacote } from '../packages/kits/src/pacote.ts'
import { lerZipStore } from '../packages/kits/src/zip.ts'

const alvo = process.argv[2]
if (!alvo) { console.error('uso: node scripts/verificar-pacote.mjs <pasta-ou-arquivo.zip>'); process.exit(2) }
const arquivos = statSync(alvo).isDirectory()
  ? readdirSync(alvo).filter((n) => statSync(join(alvo, n)).isFile()).map((n) => ({ nome: n, dados: new Uint8Array(readFileSync(join(alvo, n))) }))
  : lerZipStore(new Uint8Array(readFileSync(alvo)))
const r = await verificarPacote(arquivos)
for (const i of r.itens) console.log(`${i.ok ? 'OK    ' : 'FALHOU'} ${i.texto}`)
console.log(`Carimbo OpenTimestamps: ${{ ausente: 'ausente', pendente: 'pendente (ainda sem bloco Bitcoin; rode "ots upgrade prova.ots" depois de algumas horas)', bitcoin: `ancorado no Bitcoin, bloco(s) ${r.alturasBitcoin.join(', ')} (confirme com "ots verify prova.ots")`, invalido: 'INVÁLIDO' }[r.ots]}`)
console.log(r.integro ? 'RESULTADO: integridade confere.' : 'RESULTADO: integridade NÃO confere.')
console.log('Atenção: isto prova integridade e data, não a veracidade do conteúdo nem a aceitação judicial.')
process.exit(r.integro ? 0 : 1)
