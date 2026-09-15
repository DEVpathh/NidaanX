import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.js'
import { analyseIntake, symptomCatalog } from './intake.js'

async function withServer(run, options) {
  const server = createApp(options).listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  try { await run(`http://127.0.0.1:${server.address().port}`) }
  finally { await new Promise(resolve => server.close(resolve)) }
}
const json = async (base, route, body, method = 'POST') => {
  const response = await fetch(`${base}/api/v1${route}`, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, ...(await response.json()) }
}

test('configuration defaults to Hindi and starts with concern, without a welcome step', () => withServer(async base => {
  const { data } = await json(base, '/patient-experience', null, 'GET')
  assert.equal(data.brand.name, 'NidaanX')
  assert.equal(data.languages[0].locale, 'hi-IN')
  assert.equal(data.steps.includes('Welcome'), false)
}))

test('Hinglish and Hindi complaints generate relevant questions for multiple symptoms', () => {
  const hindi = analyseIntake({ complaint: 'मुझे दो दिन से पेट में दर्द और उल्टी है', language: 'हिन्दी' })
  assert.deepEqual(hindi.symptoms, ['abdominal pain', 'vomiting'])
  assert.equal(hindi.inferredAnswers.onset, 'दो दिन से')
  assert.ok(hindi.questions.some(question => question.id === 'abdominal_pain.location'))
  assert.ok(hindi.questions.some(question => question.id === 'vomiting.frequency'))
  assert.ok(hindi.questions.every(question => /[\u0900-\u097f]/.test(question.text)))
  const hinglish = analyseIntake({ complaint: 'Mujhe bukhar aur khansi hai' })
  assert.deepEqual(hinglish.symptoms, ['fever', 'cough'])
})

test('switching language preserves question IDs and canonical answers', () => {
  const input = { complaint: 'headache for 2 days', answers: { 'headache.warning': 'no', severity: '4' } }
  const en = analyseIntake(input)
  const hi = analyseIntake({ ...input, language: 'हिन्दी' })
  assert.deepEqual(en.questions.map(question => question.id), hi.questions.map(question => question.id))
  assert.equal(hi.questions[0].options[1].value, 'no')
  assert.equal(hi.questions[0].options[1].label, 'नहीं')
  assert.notEqual(en.questions[0].text, hi.questions[0].text)
})

test('answers add phlegm and newly reported symptom follow-ups', () => {
  const dry = analyseIntake({ complaint: 'cough', answers: { 'cough.kind': 'dry' } })
  const wet = analyseIntake({ complaint: 'cough', answers: { 'cough.kind': 'phlegm', 'cough.associated': 'fever for 2 days' } })
  assert.ok(!dry.questions.some(question => question.id === 'cough.phlegm'))
  assert.ok(wet.questions.some(question => question.id === 'cough.phlegm'))
  assert.ok(wet.questions.some(question => question.id === 'fever.temperature'))
})

test('negative symptoms do not generate false urgency; positive Hindi distress does', () => {
  const negative = analyseIntake({ complaint: 'headache, no fever, no fainting' })
  assert.equal(negative.urgent, false)
  assert.deepEqual(negative.symptoms, ['headache'])
  assert.equal(analyseIntake({ complaint: 'सांस नहीं आ रही है' }).urgent, true)
  assert.equal(analyseIntake({ complaint: 'सीने में दर्द और सांस फूल रही है' }).urgent, true)
  assert.equal(analyseIntake({ complaint: 'fever', answers: { 'fever.associated': 'I cannot breathe' } }).urgent, true)
})

test('urgent answers stay flagged across subsequent answers and both pathways', () => {
  for (const pathway of ['general', 'ayush']) {
    const result = analyseIntake({ complaint: 'headache', pathway, answers: { 'headache.warning': 'yes', onset: 'today', severity: '6' } })
    assert.equal(result.urgent, true)
    assert.ok(result.urgentReasons.length)
    assert.ok(result.questions.some(question => question.id === 'headache.location'))
    assert.equal(result.questions.some(question => question.id === 'ayush.routine'), pathway === 'ayush')
  }
})

test('unknown concerns ask for clarification, without inventing a diagnosis', () => {
  const result = analyseIntake({ complaint: 'I feel strange' })
  assert.deepEqual(result.symptoms, [])
  assert.ok(result.questions.some(question => question.id === 'clarify'))
  assert.equal(result.engine, 'adaptive-rules-v2')
})

test('every catalog group has unique bilingual question IDs and supports a completed intake', () => {
  assert.ok(symptomCatalog.length >= 20)
  for (const item of symptomCatalog) {
    const complaint = item.id === 'ear' ? 'ear pain' : item.id === 'eye' ? 'eye pain' : item.en
    const result = analyseIntake({ complaint })
    assert.ok(result.symptoms.includes(item.en), `Detects ${item.id}`)
    assert.equal(new Set(result.questions.map(question => question.id)).size, result.questions.length)
    const answers = Object.fromEntries(result.questions.map(question => [question.id, question.id === 'diarrhoea.fluids' ? 'yes' : question.options ? question.options.find(option => option.value === 'no')?.value ?? question.options[0].value : question.type === 'number' ? '3' : 'not known']))
    assert.equal(analyseIntake({ complaint, answers }).complete, true, item.id)
  }
})

test('API rejects malformed answers and out-of-range option values', () => withServer(async base => {
  assert.equal((await json(base, '/intake/questions', { complaint: 'cough', answers: { 'cough.kind': 'invalid_option' } })).status, 400)
  assert.equal((await json(base, '/intake/questions', { complaint: 'headache', answers: { 'headache.warning': 'maybe' } })).status, 400)
  assert.equal((await json(base, '/intake/questions', { complaint: 'headache', answers: [] })).status, 400)
}))

async function registerAndSubmit(base) {
  const patient = (await json(base, '/patients', { displayName: 'Test Patient', age: 35, sex: 'female' })).data
  const purposes = { casePreparation: true, priorRecords: false, careTeamSharing: true }
  await json(base, '/consents', { patientId: patient.id, purposes, language: 'हिन्दी' })
  const analysis = analyseIntake({ complaint: 'headache for 2 days' })
  const answers = Object.fromEntries(analysis.questions.map(question => [question.id, question.options ? 'no' : question.type === 'number' ? '4' : 'Not known']))
  return (await json(base, '/cases/submit', { id: 'case-test', patientId: patient.id, chiefComplaint: 'headache for 2 days', hpi: 'Patient intake', answers })).data
}

test('patient submissions appear in doctor queue; edits and decisions persist; stale edits are rejected', () => withServer(async base => {
  const submitted = await registerAndSubmit(base)
  const queue = await json(base, '/cases', null, 'GET')
  assert.equal(queue.data.length, 1)
  assert.equal(queue.data[0].patient.displayName, 'Test Patient')
  const edited = await json(base, `/cases/${submitted.id}`, { version: 1, hpi: 'Clinician corrected history', clinicianNotes: 'Reviewed today', status: 'approved' }, 'PATCH')
  assert.equal(edited.status, 200)
  assert.equal(edited.data.version, 2)
  assert.equal(edited.data.hpi, 'Clinician corrected history')
  const latest = (await json(base, '/cases', null, 'GET')).data[0]
  assert.equal(latest.status, 'approved')
  assert.equal(latest.hpi, 'Clinician corrected history')
  assert.equal((await json(base, `/cases/${submitted.id}`, { version: 1, hpi: 'Stale overwrite' }, 'PATCH')).status, 409)
  assert.equal((await json(base, `/cases/${submitted.id}`, { version: 2, clinicianNotes: '', status: 'rejected' }, 'PATCH')).status, 400)
  assert.equal((await json(base, `/cases/${submitted.id}`, { version: 2, clinicianNotes: 'Needs additional history', status: 'rejected' }, 'PATCH')).data.status, 'rejected')
}))

test('patient consent is required; new registrations accept a valid age of zero', () => withServer(async base => {
  const registered = await json(base, '/patients', { displayName: 'Infant Test', age: 0, sex: 'male' })
  assert.equal(registered.status, 201)
  assert.equal((await json(base, '/cases/submit', { patientId: registered.data.id, chiefComplaint: 'fever' })).status, 400)
  assert.equal((await json(base, '/patients', { displayName: 'Invalid', age: -1, sex: 'male' })).status, 400)
}))

test('help requests reach the staff queue and can be acknowledged', () => withServer(async base => {
  const request = await json(base, '/attendant-requests', { reason: 'Priority help', language: 'हिन्दी', urgent: true })
  assert.equal(request.data.status, 'queued')
  assert.match(request.data.message, /स्टाफ/)
  assert.equal((await json(base, '/attendant-requests', null, 'GET')).data.length, 1)
  await json(base, `/attendant-requests/${request.data.requestId}`, {}, 'PATCH')
  assert.equal((await json(base, '/attendant-requests', null, 'GET')).data.length, 0)
}))

test('saved cases survive an API restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'carex-test-'))
  const options = { storagePath: join(directory, 'cases.json') }
  try {
    await withServer(base => registerAndSubmit(base), options)
    await withServer(async base => {
      const { data } = await json(base, '/cases', null, 'GET')
      assert.equal(data.length, 1)
      assert.equal(data[0].patient.displayName, 'Test Patient')
    }, options)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
