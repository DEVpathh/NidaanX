import { createApp } from './app.js'
import { resolve } from 'node:path'

const port = Number(process.env.PORT || 8080)
const app = createApp({ storagePath: resolve(process.env.CAREX_DATA_PATH || '.data/carex.json') })
const host = process.env.HOST || '0.0.0.0'
app.listen(port, host, () => {
  console.log(`NidaanX API listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)
})

// One backend process owns the persistent reminder queue.
void app.locals.runFollowups().catch(() => console.error('Follow-up queue could not run.'))
const reminderTimer = setInterval(() => { void app.locals.runFollowups().catch(() => console.error('Follow-up queue could not run.')) }, 60000)
reminderTimer.unref()
