import { readFileSync, writeFileSync } from 'node:fs'
import { fromTatarySnapshot } from '../shared/cozyFarmSupportImport.ts'

const inputPath = process.argv[2]
const outputPath = process.argv[3]
if (!inputPath || !outputPath) {
  console.error('Usage: tsx scripts/convert-cozy-farm-foreign.ts <input.json> <output.json>')
  process.exit(1)
}

const raw: unknown = JSON.parse(readFileSync(inputPath, 'utf8'))
const converted = fromTatarySnapshot(raw)
if (!converted) {
  console.error('Not a tatary.xyz snapshot (expected { targets: [...] })')
  process.exit(1)
}

converted.exportedAt = new Date().toISOString()
writeFileSync(outputPath, `${JSON.stringify(converted, null, 2)}\n`)
console.log(`Wrote ${converted.listings.length} listings to ${outputPath}`)
