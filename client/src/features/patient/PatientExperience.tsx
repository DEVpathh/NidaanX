import { GestureControls } from '../../components/GestureControls'
import { PainBodyMap } from '../../components/PainBodyMap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronRight, ClipboardList, HeartPulse, LoaderCircle, Mic, MicOff, Pencil, QrCode, RotateCcw, ShieldAlert, UserRound, Volume2 } from 'lucide-react'
import { BrandLogo } from '../../components/BrandLogo'
import { analyseComplaint, lookupPatient, registerPatient, requestAttendant } from '../../services/patientService'
import { saveConsent, submitCase } from '../../services/caseService'
import { useKioskVoice } from '../../shared/hooks/useKioskVoice'
import { DocumentScanner } from '../../components/DocumentScanner'
import { TokenReceiptModal } from '../../components/TokenReceiptModal'
import type { CaseDraft, ConsentRecord, IntakeAnalysis, IntakeQuestion, Patient, PatientExperienceConfig, PatientLookupMethod, UploadedDocument } from '../../types/clinical'

type Props = { config: PatientExperienceConfig | null; language: string; voice: boolean; ayush: boolean; active: boolean; onNewSession: () => void }
const normalizeSpoken = (value: string) => value.trim().toLowerCase().replace(/[।.!?,]/g, '').replace(/[०-९]/g, digit => String('०१२३४५६७८९'.indexOf(digit)))
const spokenNumbers: Record<string, string> = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', शून्य: '0', एक: '1', दो: '2', तीन: '3', चार: '4', पाँच: '5', पांच: '5', छह: '6', छः: '6', सात: '7', आठ: '8', नौ: '9', दस: '10' }
function parseSpoken(question: IntakeQuestion, text: string): string | null {
  const cleaned = normalizeSpoken(text)
  if (question.options) {
    const option = question.options.find(item => normalizeSpoken(item.label) === cleaned || item.value === cleaned)
    if (option) return option.value
    const yes = /^(?:yes|yeah|haan|han|हाँ|हां|जी हाँ|जी हां)(?:\s|$)/.test(cleaned)
    const no = /^(?:no|nope|nahi|nahin|नहीं|नही|जी नहीं)(?:\s|$)/.test(cleaned)
    const unsure = /(?:not sure|don't know|पता नहीं|पता नही|pata nahi)/.test(cleaned)
    const value = unsure ? 'unsure' : no ? 'no' : yes ? 'yes' : null
    return question.options.some(item => item.value === value) ? value : null
  }
  if (question.type === 'number') {
    const value = spokenNumbers[cleaned] ?? cleaned.match(/^\d+(?:\.\d+)?$/)?.[0]
    return value && Number(value) >= (question.min ?? 0) && Number(value) <= (question.max ?? 10) ? value : null
  }
  return text.trim()
}

export function PatientExperience({ config, language, voice, ayush, active, onNewSession }: Props) {
  const hi = language !== 'English'
  const t = (hindi: string, english: string) => hi ? hindi : english
  const [step, setStep] = useState(0)
  const [bodyLocations,setBodyLocations] = useState<string[]>([])
  const [complaint, setComplaint] = useState('')
  const [analysis, setAnalysis] = useState<IntakeAnalysis | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [answerDraft, setAnswerDraft] = useState('')
  const [scanInProgress,setScanInProgress] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState<PatientLookupMethod>('manual')
  const [identifier, setIdentifier] = useState('')
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Patient['sex']>('other')
  const [mobile,setMobile] = useState('')
  const [smsConsent,setSmsConsent] = useState(false)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [consents, setConsents] = useState<ConsentRecord['purposes']>({ casePreparation: false, priorRecords: false, careTeamSharing: false })
  const [submitted, setSubmitted] = useState<CaseDraft | null>(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertBusy, setAlertBusy] = useState(false)
  const requestVersion = useRef(0)
  const caseId = useRef(`case-${crypto.randomUUID()}`)
  const allAnswers = useMemo(() => ({ ...analysis?.inferredAnswers, ...answers }), [analysis, answers])
  const stopped = !!(analysis?.stopQuestionnaire || analysis?.urgent || analysis?.triageLevel === 'red' || analysis?.triageLevel === 'yellow')
  const currentQuestion = stopped ? null : analysis?.questions.find(question => !allAnswers[question.id]?.trim())
  const answeredQuestions = analysis?.questions.filter(question => allAnswers[question.id]?.trim()) ?? []
  const complete = analysis?.complete && !currentQuestion
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  const runAnalysis = async (nextAnswers: Record<string, string>, text = complaint) => {
    if (text.trim().length < 3 && !bodyLocations.length) return
    const version = ++requestVersion.current
    audio.stop(); setBusy(true); setError('')
    try {
      const result = await analyseComplaint(text, ayush ? 'ayush' : 'general', language, nextAnswers, caseId.current, bodyLocations)
      if (version !== requestVersion.current) return
      if (result.complaint) setComplaint(result.complaint)
      setAnalysis(result); setAnswers(nextAnswers); setAnswerDraft('')
    } catch { if (version === requestVersion.current) setError(t('सवाल तैयार नहीं हुए। कृपया फिर कोशिश करें। आपका जवाब सुरक्षित है।', 'Questions could not load. Please try again; your answer is still here.')) }
    finally { if (version === requestVersion.current) setBusy(false) }
  }
  const answer = (value: string) => {
    if (!currentQuestion || !value.trim() || busy) return
    if (currentQuestion.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < (currentQuestion.min ?? 0) || Number(value) > (currentQuestion.max ?? 10))) { setError(t('कृपया 0 से 10 के बीच अंक बताएं।', 'Please enter a number from 0 to 10.')); return }
    void runAnalysis({ ...answers, [currentQuestion.id]: value.trim() })
  }
  const onTranscript = (text: string) => {
    if (busy || submitted || !active || stopped) return
    if (step === 0) {
      if (!analysis) { setComplaint(text); void runAnalysis({}, text) }
      else if (currentQuestion) {
        const parsed = parseSpoken(currentQuestion, text)
        if (parsed !== null) { setAnswerDraft(parsed); answer(parsed) }
        else { setError(t(`सुना: “${text}”। कृपया दिए हुए विकल्प में से चुनें।`, `Heard “${text}”. Please choose one of the displayed answers.`)) }
      }
    } else if (step === 1) {
      if (method !== 'manual') setIdentifier(text.replace(/[^0-9०-९-]/g, '').replace(/[०-९]/g, digit => String('०१२३४५६७८९'.indexOf(digit))))
      else setName(text)
    }
  }
  const audio = useKioskVoice({ language, enabled: voice && active, onTranscript })
  const prompt = stopped ? analysis?.emergency?.message ?? t('सवाल रोक दिए गए हैं। अभी पास के स्टाफ को बुलाएं।', 'Questions have stopped. Please call nearby staff now.') : submitted
    ? t(`आपकी जानकारी डॉक्टर को भेज दी है। आपका टोकन ${submitted.token} है।`, `Your visit has been sent to the doctor. Your token is ${submitted.token}.`)
    : step === 0 ? !analysis ? t('हेलो, क्या समस्या है आपको?', 'Hello, what problem are you having?') : currentQuestion?.text ?? t('धन्यवाद। अब अपना नाम और उम्र बताएं।', 'Thank you. Next, add your name and age.')
    : step === 1 ? t('अपना नाम और उम्र बताएं, या अपना रिकॉर्ड खोजें।', 'Enter your name and age, or find your patient record.')
    : step === 2 ? t('अपनी अनुमति चुनें। हर विकल्प अलग से बदल सकते हैं।', 'Choose your permissions. You can change each option separately.')
    : t('डॉक्टर को भेजने से पहले अपनी जानकारी जांच लें।', 'Check your details before sending them to the doctor.')

  useEffect(() => {
    if (!config || busy || !active) return
    const timer = window.setTimeout(() => audio.speak(prompt, !stopped && step === 0 && (!analysis || !!currentQuestion)), 160)
    return () => { clearTimeout(timer); audio.stop() }
  // The visible prompt drives speech; draft typing never restarts it.
  }, [prompt, voice, language, config, busy, active, audio.speak, audio.stop])
  const latest = useRef({ analysis, complaint, answers })
  latest.current = { analysis, complaint, answers }
  useEffect(() => {
    const current = latest.current
    if (current.analysis) void runAnalysis(current.answers, current.complaint)
    return () => { requestVersion.current += 1 }
  // Re-localize the same answer IDs and preserve the conversation when switching modes.
  }, [language, ayush])
  useEffect(() => { setAnswerDraft(''); setError('') }, [currentQuestion?.id, step])

  const move = (next: number) => { audio.stop(); setError(''); setStep(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const identify = async () => {
    if (busy) return
    setBusy(true); setError(''); audio.stop()
    try {
      const found = method === 'manual' ? await registerPatient({ displayName: name, age: Number(age), sex, mobile, smsConsent }) : await lookupPatient(identifier, method)
      setPatient(found)
      if (method === 'manual') move(2)
    } catch { setError(method === 'manual' ? t('जानकारी सेव नहीं हुई। नाम और उम्र जांचकर फिर कोशिश करें।', 'Could not save your details. Check your name and age, then try again.') : t('रिकॉर्ड नहीं मिला। नंबर जांचें या नया मरीज़ चुनें।', 'No record found. Check the number or choose New patient.')) }
    finally { setBusy(false) }
  }
  const confirmConsent = async () => {
    if (!patient || busy) return
    setBusy(true); setError('')
    try { await saveConsent({ patientId: patient.id, purposes: consents, language, capturedAt: new Date().toISOString() }); move(3) }
    catch { setError(t('अनुमति सेव नहीं हुई। फिर कोशिश करें।', 'Your permissions could not be saved. Please retry.')) }
    finally { setBusy(false) }
  }
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([])
  const [showTokenModal, setShowTokenModal] = useState(false)

  const handleAddDocument = (doc: UploadedDocument) => {
    setUploadedDocuments(prev => [...prev, doc])
  }

  const handleRemoveDocument = (docId: string) => {
    setUploadedDocuments(prev => prev.filter(d => d.id !== docId))
  }

  const finish = async () => {
    if (!patient || !analysis || busy || submitted || scanInProgress) return
    setBusy(true); setError(''); audio.stop()
    try {
      const summary = analysis.questions.filter(question => allAnswers[question.id]).map(question => `${question.text} ${question.options?.find(option => option.value === allAnswers[question.id])?.label ?? allAnswers[question.id]}`).join('\n')
      const result = await submitCase({ id: caseId.current, bodyLocations, patientId: patient.id, status: 'draft', chiefComplaint: complaint, hpi: summary, pastHistory: allAnswers.history ?? '', drugAndAllergy: allAnswers.medicines ?? '', familyHistory: '', ros: analysis.summary, answers: allAnswers, language, pathway: ayush ? 'ayush' : 'general', urgent: analysis.urgent, documentIds: consents.priorRecords ? uploadedDocuments.map(doc => doc.id) : [] })
      setSubmitted(result)
      setShowTokenModal(true)
    } catch { setError(t('जानकारी नहीं भेजी जा सकी। फिर कोशिश करें।', 'Your visit could not be sent. Please try again.')) }
    finally { setBusy(false) }
  }
  const alertStaff = async () => {
    setAlertBusy(true)
    try { const response = await requestAttendant(`${t('प्राथमिकता समीक्षा', 'Priority review')}: ${patient?.displayName ?? ''} — ${complaint}. ${analysis?.urgentReasons.join(' ')}`, language, true); setAlertMessage(response.message) }
    catch { setAlertMessage(t('अनुरोध नहीं पहुंचा। अभी पास के स्टाफ को बुलाएं।', 'The request did not go through. Call nearby staff now.')) }
    finally { setAlertBusy(false) }
  }
  const editAnswer = (question: IntakeQuestion) => {
    const index = analysis!.questions.findIndex(item => item.id === question.id)
    const kept = Object.fromEntries(analysis!.questions.slice(0, index).filter(item => answers[item.id] !== undefined).map(item => [item.id, answers[item.id]!]))
    void runAnalysis(kept)
  }
  const editComplaint = () => { audio.stop(); requestVersion.current += 1; setBusy(false); setAnalysis(null); setAnswers({}); setAnswerDraft(''); move(0) }
  const [countdown, setCountdown] = useState(20)

  useEffect(() => {
    if (stopped && analysis?.emergency) {
      alertStaff()
    }
  }, [stopped, analysis?.emergency])

  useEffect(() => {
    if (!stopped) {
      setCountdown(20)
      return
    }
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          audio.stop()
          onNewSession()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [stopped, onNewSession, audio])

  if (!config) return <div className="loading-state" role="status"><LoaderCircle className="animate-spin" size={32}/>{t('तैयार हो रहा है…', 'Getting ready…')}</div>
  const steps = [t('आपकी परेशानी', 'Your concern'), t('आपकी जानकारी', 'Your details'), t('आपकी अनुमति', 'Permissions'), t('रिपोर्ट स्कैन', 'Document Scan'), t('समीक्षा', 'Review')]
  const consentLabels: Record<keyof ConsentRecord['purposes'], string> = {
    casePreparation: t('मेरे जवाबों से आज की मुलाकात की जानकारी तैयार करें', 'Use my answers to prepare today’s visit'),
    priorRecords: t('उपलब्ध होने पर डॉक्टर मेरी पुरानी रिपोर्ट देख सकते हैं', 'Let my doctor review earlier records, if available'),
    careTeamSharing: t('मेरी जानकारी देखभाल करने वाली टीम के साथ साझा करें', 'Share my visit summary with the care team'),
  }
  return <div className="patient-experience">
    {stopped && <div className="emergency-screen section-enter" role="alert">
      <div className="emergency-icon"><ShieldAlert size={64}/></div>
      <h1 style={{ fontSize: '2.4rem', marginBottom: '12px' }}>{t('गंभीर स्थिति - तुरंत ध्यान दें', 'SERIOUS PATIENT - IMMEDIATE ATTENTION REQUIRED')}</h1>
      <h2 style={{ fontSize: '1.6rem', color: '#fef08a' }}>{analysis?.emergency?.title ?? t('आपातकालीन स्थिति', 'Emergency Triage Alert')}</h2>
      <p style={{ fontSize: '1.45rem', margin: '24px 0', lineHeight: 1.6, fontWeight: 'bold', maxWidth: '900px' }}>{analysis?.emergency?.message ?? t('कृपया आगे कोई सवाल न भरें। तुरंत अस्पताल के स्टाफ सदस्य से मिलें।', 'Please stop answering questions. Meet hospital staff members immediately.')}</p>
      <div style={{ background: 'rgba(255,255,255,0.2)', padding: '20px 30px', borderRadius: '20px', margin: '15px 0', maxWidth: '850px' }}>
        <p style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>{t('एडमिन और अस्पताल स्टाफ को तुरंत रेड-फ्लैग अलर्ट भेजा गया है!', 'Admin & hospital staff members have been alerted instantly!')}</p>
        {alertMessage && <p style={{ marginTop: '10px', fontSize: '1.1rem' }}>{alertMessage}</p>}
      </div>
      <div style={{ marginTop: '28px', background: 'rgba(0,0,0,0.35)', padding: '16px 32px', borderRadius: '50px', display: 'inline-block' }}>
        <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#fef08a' }}>
          {t(`यह स्क्रीन ${countdown} सेकंड में स्वतः रिसेट हो जाएगी…`, `Screen automatically redirects to start in ${countdown} seconds…`)}
        </p>
      </div>
      <div style={{ marginTop: '28px', display: 'flex', gap: '18px', justifyContent: 'center' }}>
        <button disabled={alertBusy} onClick={alertStaff}>{alertBusy ? t('सूचित किया जा रहा है…', 'Notifying staff…') : t('स्टाफ को पुनः अलर्ट करें', 'Alert Staff Again')}</button>
        <button onClick={() => { audio.stop(); onNewSession() }}>{t('तुरंत रिसेट करें', 'Reset Now')}</button>
      </div>
    </div>}
    {!stopped && <nav className="stepper" aria-label={t('आपकी प्रगति', 'Your progress')}>{steps.map((label, index) => <div key={label} className={`step-item ${index === step ? 'current' : index < step ? 'done' : ''}`} aria-current={index === step ? 'step' : undefined}><span className="step-number">{index < step ? <Check size={23}/> : index + 1}</span><span className="step-title">{label}</span>{index < steps.length - 1 && <span className="step-connector"/>}</div>)}</nav>}
    {!stopped && analysis?.urgent && !submitted && <div className="urgent-banner" role="alert"><ShieldAlert size={28}/><div><h2>{t('आपातकालीन सूचना', 'Urgent Attention Needed')}</h2><p>{t('आपकी परेशानी गंभीर हो सकती है। अगर सांस लेने में तकलीफ या सीने में तेज दर्द है, तो तुरंत स्टाफ से संपर्क करें।', 'Your symptoms may require immediate clinical attention.')}</p>{alertMessage && <p>{alertMessage}</p>}</div><button disabled={alertBusy} onClick={alertStaff}>{t('सहायता मांगें', 'Request help')}</button></div>}
    {!stopped && error && <div className="inline-error" role="alert">{error}</div>}
    {stopped ? null : submitted ? <section className="success-card section-enter"><div className="success-icon"><CheckCircle2 size={54}/></div><p className="eyebrow">{t('आपका चेक-इन पूरा हुआ', 'You’re checked in')}</p><h1>{t('डॉक्टर को आपकी जानकारी मिल गई है', 'Your doctor has your visit')}</h1><p>{patient?.displayName}</p><div className="token-card"><span>{t('आपका टोकन', 'Your token')}</span><strong>{submitted.token}</strong></div><p>{t('कृपया बैठें। अपना नंबर आने पर स्टाफ आपको बुलाएगा।', 'Please take a seat. Staff will call your token.')}</p><button className="primary-button" onClick={onNewSession}>{t('अगला मरीज़', 'Next patient')}<ArrowRight/></button></section>
    : step === 0 ? <>
      <div className="section-heading"><div><p className="eyebrow"><span className="live-dot"/>{t('हम आपकी बात सुनने के लिए हैं', 'We’re here to listen')}</p><h1>{!analysis ? t('हेलो, क्या समस्या है आपको?', 'Hello, what’s troubling you?') : complete ? t('आपकी बात समझ ली है', 'Your story is ready') : t('थोड़ा और बताइए', 'Tell us a little more')}</h1><p>{!analysis ? t('आराम से अपनी परेशानी बताइए। हम एक-एक सवाल पूछेंगे।', 'Tell us what you’re feeling. We’ll take it one question at a time.') : t('आपके जवाब डॉक्टर को आपकी परेशानी समझने में मदद करेंगे।', 'Your answers help your doctor understand your concern.')}</p></div><span className="care-label"><HeartPulse size={22}/>{ayush ? t('आयुष देखभाल', 'AYUSH care') : t('एलोपैथिक देखभाल', 'Allopathic care')}</span></div>
      <GestureControls language={language} active={active && !stopped && step===0} disabled={busy} questionKey={currentQuestion?.id??'body-map'} bodyMode={!analysis} choices={currentQuestion?.options} onStart={audio.stop} onBodySelect={id=>{audio.stop();setBodyLocations(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id])}} onAnswer={answer}/>
      {!analysis && <PainBodyMap onContinue={()=>void runAnalysis({})} language={language} selected={bodyLocations} onChange={ids=>{audio.stop();setBodyLocations(ids)}} disabled={busy}/>}
      <div className="intake-layout">
        <section className="voice-card"><div className="voice-card-heading"><BrandLogo/><div><h2>{t('आपका केयर साथी', 'Your care companion')}</h2><p>{t('NidaanX आपके साथ है', 'NidaanX is with you')}</p></div></div><div className={`voice-orb ${audio.status}`}><div className="orb-ring"/><button disabled={busy || !!complete} onClick={audio.status === 'listening' ? audio.stop : audio.listen} className="main-mic" aria-label={audio.status === 'listening' ? t('सुनना रोकें', 'Stop listening') : t('माइक्रोफ़ोन शुरू करें', 'Start microphone')} aria-pressed={audio.status === 'listening'}>{audio.status === 'listening' ? <MicOff size={42}/> : <Mic size={42}/>}</button></div><h3 className="voice-status" aria-live="polite">{busy ? t('आपका जवाब समझ रहे हैं…', 'Preparing your next question…') : audio.status === 'speaking' ? t('सवाल सुनिए…', 'Listen to the question…') : audio.status === 'listening' ? t('सुन रहे हैं, बताइए…', 'Listening to you…') : complete ? t('आपके जवाब पूरे हो गए', 'Your answers are complete') : t('बोलने के लिए माइक दबाएं', 'Press the microphone to answer')}</h3><div className={`sound-bars ${audio.status !== 'idle' ? 'active' : ''}`} aria-hidden="true">{Array.from({ length: 17 }, (_, index) => <span key={index} style={{ height: `${12 + ((index * 13) % 32)}px`, animationDelay: `${index * 65}ms` }}/>)}</div>{audio.interim && <div className="transcript" aria-live="polite">“{audio.interim}”</div>}{audio.error && <p className="voice-error" role="status">{audio.error}</p>}<button className="replay-button" disabled={!voice || busy} onClick={() => audio.speak(prompt, false)}><Volume2 size={23}/>{t('सवाल फिर सुनें', 'Hear the question again')}</button><div className="voice-language"><span className="live-dot"/>{hi ? 'हिन्दी में बातचीत' : 'Conversation in English'}</div></section>
        <section className="conversation-card section-enter" aria-busy={busy}>
          {!analysis ? <><div className="question-tag"><span>01</span>{t('यहीं से शुरू करें', 'Let’s start here')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <label htmlFor="complaint" className="question-title" style={{ margin: 0 }}>{t('क्या महसूस हो रहा है?', 'How are you feeling?')}</label>

          </div>
          <p className="field-hint">{t('दर्द कहाँ है, कब से है, या कोई और परेशानी…', 'Where it hurts, when it started, or anything else…')}</p><textarea id="complaint" ref={node => { inputRef.current = node }} autoComplete="off" maxLength={5000} value={complaint} onFocus={audio.stop} onChange={event => setComplaint(event.target.value)} placeholder={t('जैसे: मुझे दो दिन से सिर में दर्द है…', 'For example: I have had a headache for two days…')}/><div className="example-chips">{[[t('सिरदर्द', 'Headache'), t('मुझे सिर में दर्द है', 'I have a headache')], [t('बुखार', 'Fever'), t('मुझे बुखार है', 'I have a fever')], [t('पेट दर्द', 'Stomach pain'), t('मेरे पेट में दर्द है', 'I have stomach pain')], [t('खाँसी', 'Cough'), t('मुझे खाँसी है', 'I have a cough')]].map(([label, value]) => <button key={label} disabled={busy} onClick={() => { setComplaint(value!); void runAnalysis({}, value!) }}>{label}</button>)}</div><div className="conversation-actions"><p>{t('आपका हर जवाब मायने रखता है।', 'Every detail helps us care for you.')}</p><button className="primary-button" disabled={(!bodyLocations.length && complaint.trim().length < 3) || busy} onClick={() => void runAnalysis({})}>{busy ? <LoaderCircle className="animate-spin"/> : <ArrowRight/>}{t('आगे बढ़ें', 'Continue')}</button></div></>
          : currentQuestion ? <><div className="question-tag"><span>{String(answeredQuestions.length + 1).padStart(2, '0')}</span>{t('आपके लिए अगला सवाल', 'Your next question')}</div><h2 className="question-title" id="current-question">{currentQuestion.text}</h2><div className="question-answer" key={currentQuestion.id}>{currentQuestion.options ? <div className="answer-options">{currentQuestion.options.map(option => <button key={option.value} disabled={busy} onClick={() => answer(option.value)}>{option.label}<ChevronRight size={24}/></button>)}</div> : <form onSubmit={event => { event.preventDefault(); answer(answerDraft) }}><textarea aria-labelledby="current-question" value={answerDraft} maxLength={5000} onFocus={audio.stop} onChange={event => setAnswerDraft(event.target.value)} placeholder={t('अपना जवाब यहां लिखें…', 'Enter your answer here…')}/><button className="primary-button" disabled={busy || !answerDraft.trim()} type="submit">{t('जवाब दें', 'Save answer')}{busy ? <LoaderCircle className="animate-spin"/> : <ArrowRight/>}</button></form>}</div><div className="context-note"><ClipboardList size={23}/><div><strong>{t('आपकी परेशानी', 'Your concern')}</strong><p>{complaint}</p></div></div><div className="question-footer"><span>{t(`${answeredQuestions.length} जवाब दर्ज हुए`, `${answeredQuestions.length} answers recorded`)}</span><button disabled={busy} onClick={editComplaint}><Pencil size={19}/>{t('परेशानी बदलें', 'Edit concern')}</button></div></>
          : <><div className="question-tag"><CheckCircle2 size={28}/>{t('धन्यवाद', 'Thank you')}</div><h2 className="question-title">{t('अब आपकी जानकारी जोड़ते हैं', 'Let’s add your details')}</h2><p>{analysis.summary}</p><div className="context-note"><HeartPulse size={26}/><p>{complaint}</p></div><button className="primary-button" onClick={() => move(1)}>{t('नाम और उम्र बताएं', 'Add name and age')}<ArrowRight/></button><button className="text-button" onClick={editComplaint}><Pencil size={20}/>{t('परेशानी बदलें', 'Edit concern')}</button></>}
        </section>
      </div>
      {analysis && answeredQuestions.length > 0 && <details className="answer-history"><summary>{t('आपके दर्ज जवाब', 'Your recorded answers')} <span>{answeredQuestions.length}</span></summary>{answeredQuestions.map(question => <div className="history-row" key={question.id}><div><p>{question.text}</p><strong>{question.options?.find(option => option.value === allAnswers[question.id])?.label ?? allAnswers[question.id]}</strong>{analysis.inferredAnswers[question.id] && !answers[question.id] && <span className="inferred-note">{t('आपकी बताई परेशानी से', 'From your description')}</span>}</div><button disabled={busy} aria-label={t('जवाब बदलें', 'Edit answer')} onClick={() => analysis.inferredAnswers[question.id] ? editComplaint() : editAnswer(question)}><Pencil size={21}/></button></div>)}</details>}
    </>
    : step === 1 ? <section className="flow-card section-enter"><p className="eyebrow">{t('आपसे परिचय', 'A little about you')}</p><h1>{t('आपकी जानकारी', 'Your details')}</h1><div className="identity-options">{(['manual', 'abha', 'aadhaar'] as PatientLookupMethod[]).map(option => <button key={option} aria-pressed={method === option} className={method === option ? 'selected' : ''} onClick={() => { setMethod(option); setPatient(null); setError(''); audio.stop() }}>{option === 'manual' ? t('नया मरीज़', 'New patient') : option === 'abha' ? t('आभा आईडी', 'ABHA ID') : t('आधार', 'Aadhaar')}</button>)}</div><form onSubmit={event => { event.preventDefault(); void identify() }}>{method === 'manual' ? <div className="patient-fields"><label>{t('पूरा नाम', 'Full name')}<input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} autoComplete="off"/></label><div className="field-grid"><label>{t('उम्र (वर्ष)', 'Age (years)')}<input required type="number" min={0} max={120} value={age} onChange={event => setAge(event.target.value)}/></label><label>{t('लिंग', 'Sex')}<select value={sex} onChange={event => setSex(event.target.value as Patient['sex'])}><option value="other">{t('अन्य / नहीं बताना चाहते', 'Other / prefer not to say')}</option><option value="female">{t('महिला', 'Female')}</option><option value="male">{t('पुरुष', 'Male')}</option></select></label></div><label>{t('मोबाइल नंबर (फॉलो-अप SMS के लिए)', 'Mobile number (for follow-up SMS)')}<input type="tel" value={mobile} onFocus={audio.stop} onChange={event => setMobile(event.target.value)} autoComplete="tel" placeholder="+91"/></label><label className="record-check"><input type="checkbox" checked={smsConsent} onChange={event => setSmsConsent(event.target.checked)}/>{t('इस नंबर पर फॉलो-अप का SMS भेज सकते हैं।', 'I agree to follow-up SMS on this number.')}</label></div> : <label className="patient-fields">{method === 'abha' ? t('आभा आईडी', 'ABHA ID') : t('आधार नंबर', 'Aadhaar number')}<input required value={identifier} onChange={event => setIdentifier(event.target.value)} inputMode="numeric" autoComplete="off"/><p className="field-hint">{t('रिकॉर्ड न मिले तो नया मरीज़ चुनें।', 'Choose New patient if your record is unavailable.')}</p></label>}{patient && method !== 'manual' && <div className="patient-match"><UserRound/><div><strong>{patient.displayName}</strong><p>{patient.age} {t('वर्ष', 'years')} · {patient.opd}</p></div><button type="button" className="primary-button" onClick={() => move(2)}>{t('यह मैं हूँ', 'This is me')}<Check/></button></div>}<div className="flow-actions"><button type="button" className="secondary-button" onClick={() => move(0)}><ArrowLeft/>{t('पीछे', 'Back')}</button><button type="submit" className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="animate-spin"/> : <ArrowRight/>}{method === 'manual' ? t('जानकारी सेव करें', 'Save details') : t('रिकॉर्ड खोजें', 'Find record')}</button></div></form></section>
    : step === 2 ? <section className="flow-card section-enter"><p className="eyebrow">{t('फैसला आपका', 'Your choice')}</p><h1>{t('आपकी अनुमति', 'Your permissions')}</h1><p>{t('इन विकल्पों को पढ़ें और अपनी अनुमति दें।', 'Read each option and choose what you agree to.')}</p><div className="consent-options">{config.consentPurposes.map(item => <label key={item.id}><input type="checkbox" checked={consents[item.id]} onChange={event => setConsents(current => ({ ...current, [item.id]: event.target.checked }))}/><span>{consentLabels[item.id]}{item.id === 'priorRecords' && <small>{t('वैकल्पिक', 'Optional')}</small>}</span></label>)}</div><button className="secondary-button" disabled={!voice} onClick={() => audio.speak(Object.values(consentLabels).join('। '), false)}><Volume2/>{t('विकल्प सुनें', 'Hear these choices')}</button>{(!consents.casePreparation || !consents.careTeamSharing) && <p className="consent-hint">{t('डॉक्टर को जानकारी भेजने के लिए पहला और तीसरा विकल्प ज़रूरी है। सहमत नहीं हैं तो स्टाफ से सीधे चेक-इन में मदद लें।', 'Preparing and sharing your visit needs the first and third permissions. If you prefer, staff can help you check in directly.')}</p>}<div className="flow-actions"><button className="secondary-button" onClick={() => move(1)}><ArrowLeft/>{t('पीछे', 'Back')}</button><button className="primary-button" disabled={busy || !consents.casePreparation || !consents.careTeamSharing} onClick={confirmConsent}>{t('अनुमति सेव करें', 'Save permissions')}{busy ? <LoaderCircle className="animate-spin"/> : <ArrowRight/>}</button></div></section>
    : step === 3 ? <section className="flow-card section-enter"><p className="eyebrow">{t('दस्तावेज़ जोड़ें', 'Attach Records')}</p><h1>{t('पुरानी रिपोर्ट या पर्चे', 'Prior Prescriptions & Lab Reports')}</h1>{consents.priorRecords && patient ? <DocumentScanner onBusyChange={setScanInProgress} patientId={patient.id} active={active} language={language} documents={uploadedDocuments} onAddDocument={handleAddDocument} onRemoveDocument={handleRemoveDocument}/> : <p>{t('रिपोर्ट स्कैन करने के लिए पिछली स्क्रीन पर पुरानी रिपोर्ट की अनुमति दें।', 'To scan records, enable prior-record permission on the previous screen.')}</p>}<div className="flow-actions"><button className="secondary-button" onClick={() => move(2)}><ArrowLeft/>{t('पीछे', 'Back')}</button><button className="primary-button" disabled={scanInProgress} onClick={() => move(4)}>{t('समीक्षा करें', 'Review & Submit')}<ArrowRight/></button></div></section>
    : <section className="flow-card review-card section-enter"><p className="eyebrow">{t('डॉक्टर के लिए तैयार', 'Ready for your doctor')}</p><h1>{t('एक बार जांच लें', 'Take a moment to review')}</h1><div className="review-grid"><div><span>{t('मरीज़', 'Patient')}</span><strong>{patient?.displayName}</strong><p>{patient?.age} {t('वर्ष', 'years')}</p><button onClick={() => move(1)}><Pencil size={19}/>{t('बदलें', 'Edit')}</button></div><div><span>{t('मुख्य परेशानी', 'Main concern')}</span><strong>{complaint}</strong><p>{analysis?.summary}</p><button onClick={() => move(0)}><Pencil size={19}/>{t('जवाब देखें', 'Review answers')}</button></div></div><details className="answer-history"><summary>{t('सभी जवाब देखें', 'See all answers')}</summary>{analysis?.questions.map(question => <div key={question.id} className="history-row"><div><p>{question.text}</p><strong>{question.options?.find(option => option.value === allAnswers[question.id])?.label ?? allAnswers[question.id]}</strong></div></div>)}</details><p className="records-note">{t('पुरानी रिपोर्ट या दवाएं साथ लाए हैं तो डॉक्टर को दिखाएं।', 'If you have earlier reports or medicines, show them to your doctor.')}</p><div className="flow-actions"><button className="secondary-button" disabled={busy} onClick={() => move(3)}><ArrowLeft/>{t('पीछे', 'Back')}</button><button className="primary-button" disabled={busy || scanInProgress} onClick={finish}>{busy ? <LoaderCircle className="animate-spin"/> : <CheckCircle2/>}{t('डॉक्टर को भेजें और टोकन लें', 'Send to doctor & get token')}</button></div></section>}
    {!submitted && <div className="session-actions"><button onClick={() => { audio.stop(); onNewSession() }}><RotateCcw size={20}/>{t('सत्र समाप्त करें', 'End session')}</button></div>}
    {submitted && showTokenModal && <TokenReceiptModal caseData={submitted} language={language} onClose={() => { setShowTokenModal(false); onNewSession() }} />}
  </div>
}
