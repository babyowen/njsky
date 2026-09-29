// 命令行推送测试：npx tsx --env-file-if-exists=.env.local scripts/push-test.ts
import { sendTestPush } from '../src/lib/push'

sendTestPush().then(r => {
  console.log(JSON.stringify(r))
  process.exit(r.ok ? 0 : 1)
})
