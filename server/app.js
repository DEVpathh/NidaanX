import { bodyLocations, bodyMapContext, applyBodyLocations } from './body-map.js'
import { createOcr } from './documents/ocr.js'
import { mountDocuments } from './documents/routes.js'
import { createSms, mountFollowups, mobileNumber } from './followups/service.js'
import { stopForTriage } from './triage-stop.js'
import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
import { analyseIntake, symptomCatalog } from './intake.js'
import {
  bhashiniASR,
  bhashiniTranslate,
  bhashiniTransliterate,
  bhashiniTTS,
  bhashiniAudioLangDetection,
  bhashiniTextLangDetection,
  bhashiniNER,
  bhashiniOCR,
  bhashiniSpeakerVerify,
  bhashiniSpeakerDiarization,
  bhashiniLanguageDiarization,
  bhashiniVoiceCloning,
  bhashiniLipSync,
  bhashiniKWS,
  getBhashiniModelsPipeline,
  executeBhashiniPipelineCompute,
  getBhashiniTransliterationConfig
} from './bhashiniService.js'
import { BHASHINI_MODEL_REGISTRY, BHASHINI_PIPELINE_IDS } from './bhashiniConfig.js'

const experience = {
  brand: { name: 'NidaanX', organisation: 'Your health, our care' },
  languages: [{ label: 'हिन्दी', locale: 'hi-IN' }, { label: 'English', locale: 'en-IN' }],
  steps: ['Your concern', 'Patient details', 'Consent', 'Review'],
  identificationOptions: [
    { id: 'abha', label: 'ABHA ID', helper: 'Find an existing record', voiceAliases: ['abha', 'आभा'] },
    { id: 'aadhaar', label: 'Aadhaar', helper: 'Find an existing record', voiceAliases: ['aadhaar', 'aadhar', 'आधार'] },
    { id: 'manual', label: 'New patient', helper: 'Create your record', voiceAliases: ['new patient', 'नया मरीज'] },
  ],
  consentPurposes: [
    { id: 'casePreparation', label: 'Use my answers to prepare this visit' },
    { id: 'priorRecords', label: 'Allow my doctor to review earlier records, if available' },
    { id: 'careTeamSharing', label: 'Share my visit summary with the care team' },
  ],
  welcome: { eyebrow: 'NidaanX', title: 'हेलो, क्या समस्या है आपको?', description: '', prompt: 'हेलो, क्या समस्या है आपको?' },
}
const envelope = data => ({ data, requestId: randomUUID(), timestamp: new Date().toISOString() })
const isHindi = language => /हिन्दी|हिंदी|^hi|hindi/i.test(language ?? '')
const fields = ['chiefComplaint', 'hpi', 'pastHistory', 'drugAndAllergy', 'familyHistory', 'ros', 'clinicianNotes']

export function createApp({ storagePath = null, ocr = createOcr(), sms = createSms(), now = () => new Date() } = {}) {
  const saved = storagePath && existsSync(storagePath) ? JSON.parse(readFileSync(storagePath, 'utf8')) : {}
  const patients = new Map(saved.patients ?? [
    ['14-23-45-67-89-01', { id: 'patient-riya-sharma', displayName: 'Riya Sharma', abhaId: '14-23-45-67-89-01', age: 42, sex: 'female', opd: 'OPD 04', verified: true }],
  ])
  const consents = new Map(saved.consents ?? [])
  const cases = new Map(saved.cases ?? [])
  const attendantRequests = new Map(saved.attendantRequests ?? [])
  const documents = new Map(saved.documents ?? [])
  const followups = new Map(saved.followups ?? [])
  const triageSessions = new Map(saved.triageSessions ?? [])
  for (const doc of documents.values()) if (doc.ocrStatus === 'processing') { doc.ocrStatus = 'needs_review'; doc.ocrMessage = 'Scan interrupted. Review the image or retake.' }
  const persist = () => {
    if (!storagePath) return
    mkdirSync(dirname(storagePath), { recursive: true })
    writeFileSync(`${storagePath}.tmp`, JSON.stringify({ documents: [...documents], followups: [...followups], triageSessions: [...triageSessions], patients: [...patients], consents: [...consents], cases: [...cases], attendantRequests: [...attendantRequests] }, null, 2), { mode: 0o600 })
    renameSync(`${storagePath}.tmp`, storagePath)
  }
  const app = express()
  app.use(cors())
  app.use('/api/v1/documents/scan', express.json({ limit: '14mb' }))
  app.use(express.json({ limit: '2mb' }))
  mountDocuments(app, { documents, patients, consents, cases, persist, ocr, envelope })
  mountFollowups(app, { followups, patients, cases, persist, sms, now, envelope })
  app.get('/api/v1/body-map', (_req,res) => res.json(envelope(bodyLocations.map(({concern,...item})=>item))))
  app.get('/api/v1/health', (_req, res) => res.json(envelope({ status: 'ok', intakeEngine: 'adaptive-rules-v2', symptomGroups: symptomCatalog.length })))
  app.get('/api/v1/patient-experience', (_req, res) => res.json(envelope(experience)))
  app.get('/api/v1/patients/lookup', (req, res) => {
    const identifier = String(req.query.identifier ?? '').trim()
    const method = String(req.query.method ?? '')
    if (!identifier || !['abha', 'aadhaar'].includes(method)) return res.status(400).json({ message: 'Enter an identifier and a valid lookup method.' })
    const patient = patients.get(identifier) ?? [...patients.values()].find(p => method === 'abha' && p.abhaId?.replace(/\D/g, '') === identifier.replace(/\D/g, ''))
    if (!patient) return res.status(404).json({ message: 'No matching patient. Check the number or register as a new patient.' })
    res.json(envelope(patient))
  })
  app.post('/api/v1/patients', (req, res) => {
    const { displayName, age, sex, mobile, smsConsent = false } = req.body ?? {}
    if (typeof displayName !== 'string' || displayName.trim().length < 2 || age === '' || age === null || !Number.isFinite(Number(age)) || Number(age) < 0 || Number(age) > 120 || !['female', 'male', 'other'].includes(sex)) return res.status(400).json({ message: 'Enter a name, an age from 0 to 120, and a valid sex.' })
    if ((mobile && !mobileNumber(mobile)) || typeof smsConsent !== 'boolean' || (smsConsent && !mobile)) return res.status(400).json({ message: 'Enter a valid mobile number for follow-up SMS.' })
    const id = `patient-${randomUUID()}`
    const patient = { id, displayName: displayName.trim(), age: Number(age), sex, mobile: mobile ? mobileNumber(mobile) : null, smsConsent, opd: 'General OPD', verified: false }
    patients.set(id, patient); persist()
    res.status(201).json(envelope(patient))
  })
  app.post('/api/v1/consents', (req, res) => {
    const { patientId, purposes, language } = req.body ?? {}
    if (![...patients.values()].some(p => p.id === patientId) || !purposes || ['casePreparation', 'priorRecords', 'careTeamSharing'].some(key => typeof purposes[key] !== 'boolean')) return res.status(400).json({ message: 'A registered patient and explicit consent choices are required.' })
    const consent = { patientId, purposes, language, capturedAt: new Date().toISOString() }
    consents.set(patientId, consent); persist()
    res.status(201).json(envelope(consent))
  })
  app.post('/api/v1/intake/questions', (req, res) => {
    let bodyContext
    try { bodyContext = bodyMapContext(req.body?.bodyLocations, String(req.body?.complaint ?? '').trim()) } catch (error) { return res.status(400).json({message:error.message}) }
    const complaint = bodyContext.complaint
    if (complaint.length < 3 || complaint.length > 5000) return res.status(400).json({ message: 'Please describe the problem in 3 to 5000 characters.' })
    const answers = req.body?.answers ?? {}
    if (!answers || Array.isArray(answers) || typeof answers !== 'object' || Object.entries(answers).some(([key, value]) => key.length > 100 || typeof value !== 'string' || value.length > 5000)) return res.status(400).json({ message: 'Invalid follow-up answers.' })
    let analysis = analyseIntake({ complaint, pathway: req.body?.pathway, language: req.body?.language, answers })
    for (const question of analysis.questions) {
      const value = answers[question.id]
      if (value === undefined || !value.trim()) continue
      if (question.options && !question.options.some(option => option.value === value)) return res.status(400).json({ message: 'Choose one of the displayed answers.' })
    }
    analysis = stopForTriage(analysis, req.body?.language, triageSessions.get(req.body?.sessionId))
    if (analysis.stopQuestionnaire && typeof req.body?.sessionId === 'string' && req.body.sessionId.length <= 100) { triageSessions.set(req.body.sessionId, analysis.triageLevel); persist() }
    analysis = applyBodyLocations(analysis, bodyContext, req.body?.answers)
    res.json(envelope(analysis))
  })
  app.get('/api/v1/cases/draft', (_req, res) => res.json(envelope({ id: `case-${randomUUID()}`, patientId: '', status: 'draft', chiefComplaint: '', hpi: '', pastHistory: '', drugAndAllergy: '', familyHistory: '', ros: '' })))
  app.get('/api/v1/cases', (_req, res) => res.json(envelope([...cases.values()].sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.createdAt.localeCompare(a.createdAt)))))
  app.post('/api/v1/cases/submit', (req, res) => {
    const body = { ...(req.body ?? {}) }
    let bodyContext
    try { bodyContext = bodyMapContext(body.bodyLocations, String(body.chiefComplaint ?? '')); body.chiefComplaint = bodyContext.complaint } catch (error) { return res.status(400).json({message:error.message}) }
    const patient = [...patients.values()].find(p => p.id === body.patientId)
    if (!patient || typeof body.chiefComplaint !== 'string' || body.chiefComplaint.trim().length < 3) return res.status(400).json({ message: 'A registered patient and chief complaint are required.' })
    const consent = consents.get(patient.id)
    if (!consent?.purposes.casePreparation || !consent?.purposes.careTeamSharing) return res.status(400).json({ message: 'Consent to prepare and share this visit is required. Ask an attendant for an alternative check-in.' })
    if (body.id && cases.has(body.id)) return res.json(envelope(cases.get(body.id)))
    const analysis = analyseIntake({ complaint: body.chiefComplaint, answers: body.answers ?? {}, pathway: body.pathway, language: body.language })
    const documentIds = body.documentIds ?? []
    if (!Array.isArray(documentIds) || documentIds.length > 30 || documentIds.some(id => !documents.has(id) || documents.get(id).patientId !== patient.id || !documents.get(id).reviewed) || (documentIds.length && !consent.purposes.priorRecords)) return res.status(400).json({ message: 'Review each scanned document and confirm permission before submitting.' })
    const triaged = stopForTriage(analysis, body.language, triageSessions.get(body.id))
    const submitted = {
      ...Object.fromEntries(fields.map(key => [key, String(body[key] ?? '').slice(0, 20000)])),
      id: body.id || `case-${randomUUID()}`, patientId: patient.id, patient,
      status: 'submitted', token: `A-${String(cases.size + 1).padStart(3, '0')}`,
      language: body.language, pathway: body.pathway === 'ayush' ? 'ayush' : 'general',
      bodyLocations: bodyContext.ids,
      answers: { ...analysis.inferredAnswers, ...body.answers }, questions: triaged.questions,
      urgent: triaged.urgent, stopQuestionnaire: triaged.stopQuestionnaire, documentIds, urgentReasons: analysis.urgentReasons,
      triageLevel: triaged.triageLevel,
      tridosha: analysis.tridosha,
      dashavidha: analysis.dashavidha,

      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
    }
    cases.set(submitted.id, submitted); persist()
    res.status(201).json(envelope(submitted))
  })
  app.patch('/api/v1/cases/:caseId', (req, res) => {
    const current = cases.get(req.params.caseId)
    if (!current) return res.status(404).json({ message: 'Case not found.' })
    if (req.body?.version !== current.version) return res.status(409).json({ message: 'This case changed in another session. Reload the latest case before saving.' })
    if (req.body.status && !['submitted', 'approved', 'rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid review status.' })
    const changes = {}
    for (const key of fields) if (req.body[key] !== undefined) {
      if (typeof req.body[key] !== 'string' || req.body[key].length > 20000) return res.status(400).json({ message: 'Invalid case field.' })
      changes[key] = req.body[key].trim()
    }
    if (changes.chiefComplaint === '') return res.status(400).json({ message: 'The chief complaint cannot be empty.' })
    if (req.body.status === 'rejected' && !(changes.clinicianNotes ?? current.clinicianNotes)?.trim()) return res.status(400).json({ message: 'Please add a reason in clinician notes before rejecting.' })
    const updated = { ...current, ...changes, status: req.body.status ?? current.status, updatedAt: new Date().toISOString(), version: current.version + 1 }
    cases.set(current.id, updated); persist()
    res.json(envelope(updated))
  })
  app.post('/api/v1/attendant-requests', (req, res) => {
    const request = { requestId: randomUUID(), reason: String(req.body?.reason ?? '').slice(0, 5000), language: req.body?.language, urgent: Boolean(req.body?.urgent), status: 'queued', createdAt: new Date().toISOString(), message: isHindi(req.body?.language) ? 'सहायता अनुरोध स्टाफ की सूची में जोड़ दिया है। तुरंत मदद चाहिए तो पास के स्टाफ को बुलाएं।' : 'Your help request is in the staff queue. For immediate help, call nearby staff.' }
    attendantRequests.set(request.requestId, request); persist()
    res.status(201).json(envelope(request))
  })
  app.get('/api/v1/attendant-requests', (_req, res) => res.json(envelope([...attendantRequests.values()].filter(request => request.status === 'queued'))))
  app.patch('/api/v1/attendant-requests/:id', (req, res) => {
    const request = attendantRequests.get(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found.' })
    const updated = { ...request, status: 'acknowledged' }
    attendantRequests.set(request.requestId, updated); persist()
    res.json(envelope(updated))
  })
  // Module D — ABDM FHIR R4 Bundle Export
  app.get('/api/v1/cases/:caseId/fhir', (req, res) => {
    const current = cases.get(req.params.caseId)
    if (!current) return res.status(404).json({ message: 'Case not found.' })

    const fhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-${current.id}`,
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `urn:uuid:${current.patientId}`,
          resource: {
            resourceType: 'Patient',
            id: current.patientId,
            name: [{ text: current.patient?.displayName ?? 'Patient' }],
            gender: current.patient?.sex ?? 'unknown',
            identifier: [{ system: 'https://healthid.ndhm.gov.in', value: current.patient?.abhaId ?? 'ABHA-NOT-LINKED' }]
          }
        },
        {
          fullUrl: `urn:uuid:condition-${current.id}`,
          resource: {
            resourceType: 'Condition',
            id: `condition-${current.id}`,
            subject: { reference: `urn:uuid:${current.patientId}` },
            code: { text: current.chiefComplaint },
            clinicalStatus: { coding: [{ code: 'active' }] }
          }
        },
        {
          fullUrl: `urn:uuid:triage-${current.id}`,
          resource: {
            resourceType: 'Observation',
            id: `triage-${current.id}`,
            subject: { reference: `urn:uuid:${current.patientId}` },
            code: { text: 'Triage & History Intake Summary' },
            valueString: `Triage: ${current.triageLevel ?? 'green'} | Pathway: ${current.pathway ?? 'general'}`
          }
        }
      ]
    }
    res.json(envelope(fhirBundle))
  })

  // Bhashini Integration Routes
  app.get('/api/v1/bhashini/models', (_req, res) => res.json(envelope({ registry: BHASHINI_MODEL_REGISTRY, pipelines: BHASHINI_PIPELINE_IDS })))

  app.post('/api/v1/bhashini/pipeline-config', async (req, res, next) => {
    try {
      const { pipelineId, pipelineTasks, taskType, sourceLanguage, targetLanguage, useConfig } = req.body ?? {}
      const result = await getBhashiniModelsPipeline({ pipelineId, pipelineTasks, taskType, sourceLanguage, targetLanguage, useConfig })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/transliteration-config', async (req, res, next) => {
    try {
      const { pipelineId, sourceLanguage = 'en', targetLanguage = 'hi', useConfig } = req.body ?? {}
      const result = await getBhashiniTransliterationConfig({ pipelineId, sourceLanguage, targetLanguage, useConfig })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/pipeline-compute', async (req, res, next) => {
    try {
      const { pipelineId, tasks, audioBase64, text, sourceLanguage, targetLanguage, gender } = req.body ?? {}
      const result = await executeBhashiniPipelineCompute({ pipelineId, tasks, audioBase64, text, sourceLanguage, targetLanguage, gender })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })


  app.post('/api/v1/bhashini/asr', async (req, res, next) => {
    try {
      const { audioBase64, language = 'hi', samplingRate = 16000, audioFormat = 'wav' } = req.body ?? {}
      if (!audioBase64) return res.status(400).json({ message: 'audioBase64 is required.' })
      const result = await bhashiniASR({ audioBase64, language, samplingRate, audioFormat })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/translate', async (req, res, next) => {
    try {
      const { text, sourceLanguage = 'en', targetLanguage = 'hi' } = req.body ?? {}
      if (!text) return res.status(400).json({ message: 'text is required.' })
      const result = await bhashiniTranslate({ text, sourceLanguage, targetLanguage })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/transliterate', async (req, res, next) => {
    try {
      const { text, sourceLanguage = 'en', targetLanguage = 'hi', isSentence = false, numSuggestions = 5, serviceId } = req.body ?? {}
      if (!text) return res.status(400).json({ message: 'text is required.' })
      const result = await bhashiniTransliterate({ text, sourceLanguage, targetLanguage, isSentence, numSuggestions, serviceId })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/tts', async (req, res, next) => {
    try {
      const { text, language = 'hi', gender = 'female' } = req.body ?? {}
      if (!text) return res.status(400).json({ message: 'text is required.' })
      const result = await bhashiniTTS({ text, language, gender })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/audio-lang-detection', async (req, res, next) => {
    try {
      const { audioBase64, audioUri, samplingRate = 16000, audioFormat = 'wav', serviceId } = req.body ?? {}
      if (!audioBase64 && !audioUri) return res.status(400).json({ message: 'audioBase64 or audioUri is required.' })
      const result = await bhashiniAudioLangDetection({ audioBase64, audioUri, samplingRate, audioFormat, serviceId })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/text-lang-detection', async (req, res, next) => {
    try {
      const { text, serviceId } = req.body ?? {}
      if (!text) return res.status(400).json({ message: 'text is required.' })
      const result = await bhashiniTextLangDetection({ text, serviceId })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/ner', async (req, res, next) => {
    try {
      const { text, language = 'hi' } = req.body ?? {}
      if (!text) return res.status(400).json({ message: 'text is required.' })
      const result = await bhashiniNER({ text, language })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/ocr', async (req, res, next) => {
    try {
      const { imageBase64, imageUri, modality = 'Printed Text', language = 'hi', textDetection = false, serviceId } = req.body ?? {}
      if (!imageBase64 && !imageUri) return res.status(400).json({ message: 'imageBase64 or imageUri is required.' })
      const result = await bhashiniOCR({ imageBase64, imageUri, modality, language, textDetection, serviceId })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/speaker-verify', async (req, res, next) => {
    try {
      const { audioBase64, audioUri, speakerId } = req.body ?? {}
      if (!audioBase64 && !audioUri) return res.status(400).json({ message: 'audioBase64 or audioUri is required.' })
      const result = await bhashiniSpeakerVerify({ audioBase64, audioUri, speakerId })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/speaker-diarization', async (req, res, next) => {
    try {
      const { audioBase64, audioUri, numberOfSpeakers = 2, preProcessors = [], serviceId } = req.body ?? {}
      if (!audioBase64 && !audioUri) return res.status(400).json({ message: 'audioBase64 or audioUri is required.' })
      const result = await bhashiniSpeakerDiarization({ audioBase64, audioUri, numberOfSpeakers, preProcessors, serviceId })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/language-diarization', async (req, res, next) => {
    try {
      const { audioBase64, audioUri } = req.body ?? {}
      if (!audioBase64 && !audioUri) return res.status(400).json({ message: 'audioBase64 or audioUri is required.' })
      const result = await bhashiniLanguageDiarization({ audioBase64, audioUri })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/voice-cloning', async (req, res, next) => {
    try {
      const { text, referenceAudioBase64, language = 'hi' } = req.body ?? {}
      if (!text) return res.status(400).json({ message: 'text is required.' })
      const result = await bhashiniVoiceCloning({ text, referenceAudioBase64, language })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/lip-sync', async (req, res, next) => {
    try {
      const { videoBase64, audioBase64 } = req.body ?? {}
      const result = await bhashiniLipSync({ videoBase64, audioBase64 })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.post('/api/v1/bhashini/kws', async (req, res, next) => {
    try {
      const { audioBase64, keywords = [], language = 'hi' } = req.body ?? {}
      if (!audioBase64) return res.status(400).json({ message: 'audioBase64 is required.' })
      const result = await bhashiniKWS({ audioBase64, keywords, language })
      res.json(envelope(result))
    } catch (err) { next(err) }
  })

  app.use((err, _req, res, _next) => res.status(err.status === 400 ? 400 : 500).json({ message: err.status === 400 ? 'Invalid request body.' : 'Unable to save or load data. Please try again.' }))
  return app
}

