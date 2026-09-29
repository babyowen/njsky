// 命令行手动采集：npx tsx scripts/collect-once.ts
import { collectOnce } from '../src/lib/collect'

collectOnce().then(r => {
  console.log(JSON.stringify(r, null, 2))
  process.exit(r.ok ? 0 : 1)
})
