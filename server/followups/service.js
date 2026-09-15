import { randomUUID } from 'node:crypto'
import { validDate } from '../documents/extraction.js'
export function mobileNumber(value) {
  if (typeof value !== 'string') return null
  let clean = value.replace(/[\s()-]/g, '')
  if (/^[6-9]\d{9}$/.test(clean)) clean = `+91${clean}`
  return /^\+[1-9]\d{7,14}$/.test(clean) ? clean : null
}
export const indiaDate = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
export function createSms({ env = process.env, fetchImpl = fetch } = {}) {
  const configured = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_FROM))
  const headers = { Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}` }
  const base = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages`
  return {
    configured,
    async send(to, body) {
      const form = new URLSearchParams({ To: to, Body: body, ...(env.TWILIO_MESSAGING_SERVICE_SID ? { MessagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID } : { From: env.TWILIO_FROM }) })
      const response = await fetchImpl(`${base}.json`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(15000) })
      if (!response.ok) { const error = new Error('SMS provider rejected the request.'); error.retryable = response.status === 429; error.definitive = response.status >= 400 && response.status < 500; throw error }
      const data = await response.json()
      if (!/^SM[a-fA-F0-9]{32}$/.test(data.sid ?? '')) throw new Error('SMS response was not confirmed.')
      return { id: data.sid, status: data.status }
    },
    async status(id) {
      const response = await fetchImpl(`${base}/${encodeURIComponent(id)}.json`, { headers, signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw new Error('Delivery status unavailable.')
      return (await response.json()).status
    }
  }
}
export function mountFollowups(app, { followups, patients, cases, persist, sms, now, envelope }) {
  let running = false
  // A crash during a provider call is uncertain: don't risk a duplicate SMS.
  for (const job of followups.values()) if (job.status === 'sending') job.status = 'delivery_unknown'
  app.locals.runFollowups = async () => {
    if (running) return
    running = true
    try {
      for (const job of followups.values()) {
        if (['accepted','sent'].includes(job.status) && job.providerId && sms.configured) {
          try { const status = await sms.status(job.providerId); if (['delivered','undelivered','failed','sent'].includes(status)) { job.status = status; persist() } } catch { /* Keep the known state until the next poll. */ }
          continue
        }
        if (!['scheduled','blocked','awaiting_contact','retry'].includes(job.status) || Date.parse(job.sendAt) > now().getTime() || Date.parse(job.retryAt ?? job.sendAt) > now().getTime()) continue
        if (job.date !== indiaDate(now())) { job.status = 'missed'; persist(); continue }
        const patient = [...patients.values()].find(p => p.id === job.patientId)
        if (cases.get(job.caseId)?.status !== 'approved') { job.status = 'cancelled'; persist(); continue }
        if (!patient?.smsConsent || !patient.mobile) { job.status = 'awaiting_contact'; persist(); continue }
        if (!sms.configured) { job.status = 'blocked'; persist(); continue }
        job.status = 'sending'; job.attempts += 1; persist()
        try {
          const body = /Hindi|हिन्दी|हिंदी|^hi/i.test(job.language ?? '') ? 'आज आपका क्लिनिक फॉलो-अप है। कृपया अपनी रिपोर्ट साथ लाएं। - NidaanX' : 'Your clinic follow-up is today. Please bring your records. - NidaanX'
          const result = await sms.send(patient.mobile, body)
          job.providerId = result.id; job.status = ['delivered','sent','failed','undelivered'].includes(result.status) ? result.status : 'accepted'; job.sentAt = now().toISOString()
        } catch (error) {
          job.status = error.retryable && job.attempts < 3 ? 'retry' : error.definitive ? 'failed' : 'delivery_unknown'
          job.retryAt = new Date(now().getTime() + 5 * 60_000).toISOString()
        }
        persist()
      }
    } finally { running = false }
  }
  app.get('/api/v1/followups/status', (_req, res) => res.json(envelope({ configured: sms.configured, timeZone: 'Asia/Kolkata' })))
  app.patch('/api/v1/patients/:patientId/contact', (req, res) => {
    const entry = [...patients.entries()].find(([,p]) => p.id === req.params.patientId)
    if (!entry) return res.status(404).json({ message: 'Patient not found.' })
    const mobile = mobileNumber(req.body?.mobile)
    if (!mobile || typeof req.body?.smsConsent !== 'boolean') return res.status(400).json({ message: 'Enter a valid registered mobile number and the patient’s SMS consent choice.' })
    const patient = { ...entry[1], mobile, smsConsent: req.body.smsConsent }
    patients.set(entry[0], patient)
    for (const [id, c] of cases) if (c.patientId === patient.id) cases.set(id, { ...c, patient, version: c.version + 1 })
    persist(); res.json(envelope(patient))
  })
  app.get('/api/v1/cases/:caseId/followup', (req, res) => res.json(envelope([...followups.values()].filter(j => j.caseId === req.params.caseId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)))))
  app.post('/api/v1/cases/:caseId/followup', (req, res) => {
    const current = cases.get(req.params.caseId), { date, needed = true, version } = req.body ?? {}
    if (!current) return res.status(404).json({ message: 'Case not found.' })
    if (current.status !== 'approved') return res.status(409).json({ message: 'Accept the patient’s case before scheduling a follow-up.' })
    if (current.version !== version) return res.status(409).json({ message: 'Reload this case before scheduling.' })
    const patient = [...patients.values()].find(p => p.id === current.patientId)
    if (typeof needed !== 'boolean') return res.status(400).json({ message: 'Choose whether follow-up is needed.' })
    if (needed && (!validDate(date) || date < indiaDate(now()))) return res.status(400).json({ message: 'Choose today or a future follow-up date.' })
    if ([...followups.values()].some(j => j.caseId === current.id && j.status === 'sending')) return res.status(409).json({ message: 'A reminder is being sent. Retry after its status updates.' })
    for (const job of followups.values()) if (job.caseId === current.id && ['scheduled','retry','blocked','awaiting_contact'].includes(job.status)) job.status = 'cancelled'
    const decision = { needed, date: needed ? date : null, recordedAt: now().toISOString() }
    if (!needed) {
      cases.set(current.id, { ...current, followupDecision: decision, version: current.version + 1 }); persist()
      return res.json(envelope(decision))
    }
    const job = { id: `followup-${randomUUID()}`, caseId: current.id, patientId: patient.id, date, timeZone: 'Asia/Kolkata', sendAt: new Date(Math.max(Date.parse(`${date}T09:00:00+05:30`), now().getTime())).toISOString(), status: !patient.mobile || !patient.smsConsent ? 'awaiting_contact' : sms.configured ? 'scheduled' : 'blocked', language: current.language, attempts: 0, createdAt: now().toISOString() }
    followups.set(job.id, job); cases.set(current.id, { ...current, followupDecision: decision, version: current.version + 1 }); persist()
    res.status(201).json(envelope(job))
  })
  app.delete('/api/v1/cases/:caseId/followup/:id', (req, res) => {
    const job = followups.get(req.params.id)
    if (!job || job.caseId !== req.params.caseId) return res.status(404).json({ message: 'Follow-up not found.' })
    if (!['scheduled','retry','blocked','awaiting_contact'].includes(job.status)) return res.status(409).json({ message: 'This reminder can no longer be cancelled.' })
    job.status = 'cancelled'; persist(); res.json(envelope(job))
  })
}
