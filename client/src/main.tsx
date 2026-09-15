import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, Camera, HandHelping, Languages, Leaf, Moon, Stethoscope, Volume2, VolumeX, X } from 'lucide-react'
import './index.css'
import { PatientExperience } from './features/patient/PatientExperience'
import { DoctorExperience } from './features/doctor/DoctorExperience'
import { AdminExperience } from './features/admin/AdminExperience'
import { BrandLogo } from './components/BrandLogo'
import { getPatientExperience, requestAttendant } from './services/patientService'
import type { PatientExperienceConfig } from './types/clinical'

export type Role = 'patient' | 'doctor' | 'admin'
function App() {
  const [role, setRole] = useState<Role>('patient')
  const [config, setConfig] = useState<PatientExperienceConfig | null>(null)
  const [language, setLanguage] = useState('हिन्दी')
  const [voice, setVoice] = useState(true)
  const [ayush, setAyush] = useState(false)
  const [phase, setPhase] = useState<'asleep' | 'waking' | 'awake'>('asleep')
  const [session, setSession] = useState(0)
  const [helpMessage, setHelpMessage] = useState('')
  const [helpBusy, setHelpBusy] = useState(false)
  const [configError, setConfigError] = useState(false)
  const headerLogo = useRef<HTMLImageElement>(null)
  const wakeLogo = useRef<HTMLImageElement>(null)
  const waking = useRef(false)
  const hi = language !== 'English'
  const t = (hindi: string, english: string) => hi ? hindi : english
  const loadConfig = () => { setConfigError(false); getPatientExperience().then(setConfig).catch(() => setConfigError(true)) }
  useEffect(loadConfig, [])
  useEffect(() => { document.documentElement.lang = hi ? 'hi' : 'en' }, [hi])

  const wake = () => {
    if (waking.current || phase !== 'asleep') return
    waking.current = true
    if (voice && window.speechSynthesis) {
      const unlock = new SpeechSynthesisUtterance(' ')
      unlock.lang = 'hi-IN'; window.speechSynthesis.speak(unlock)
    }
    setPhase('waking')
    const from = wakeLogo.current?.getBoundingClientRect()
    const to = headerLogo.current?.getBoundingClientRect()
    const finish = () => { setPhase('awake'); waking.current = false }
    if (!from || !to || !wakeLogo.current?.animate) { finish(); return }
    const animation = wakeLogo.current.animate([
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${to.x + to.width / 2 - from.x - from.width / 2}px, ${to.y + to.height / 2 - from.y - from.height / 2}px) scale(${to.width / from.width})` },
    ], { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 950, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' })
    animation.onfinish = finish
  }
  const reset = () => { window.speechSynthesis?.cancel(); setPhase('asleep'); setSession(current => current + 1); setRole('patient'); setLanguage('हिन्दी'); setAyush(false); setVoice(true); setHelpMessage('') }
  const askForHelp = async () => {
    setHelpBusy(true)
    try { const result = await requestAttendant('Patient requested help from kiosk', language); setHelpMessage(result.message) }
    catch { setHelpMessage(t('सहायता अनुरोध नहीं भेजा जा सका। कृपया पास के स्टाफ को बुलाएं।', 'The help request could not be sent. Please call nearby staff.')) }
    finally { setHelpBusy(false) }
  }

  return <div className={`app-shell ${ayush ? 'ayush-mode' : ''}`}>
    <div {...(phase !== 'awake' ? { inert: '' } : {})} className={phase === 'awake' ? 'app-content awake' : 'app-content'}>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-lockup"><BrandLogo ref={headerLogo}/><div><div className="brand-name">Nidaan<span>X</span></div><p>{t('आपकी सेहत, हमारा साथ', 'Your health, our care')}</p></div></div>
          <div className="header-tools">

            <label className="language-control"><Languages size={23}/><select aria-label="Language / भाषा" value={language} onChange={event => setLanguage(event.target.value)}><option value="हिन्दी">हिन्दी</option><option value="English">English</option></select></label>
            <button aria-pressed={voice} onClick={() => setVoice(current => !current)} className={`audio-control ${voice ? 'enabled' : ''}`}>{voice ? <Volume2 size={28}/> : <VolumeX size={28}/>}<span>{t(voice ? 'आवाज़ चालू' : 'आवाज़ बंद', voice ? 'Audio on' : 'Audio off')}</span></button>
            <button aria-label={t('सहायता', 'Get help')} disabled={helpBusy} onClick={askForHelp} className="help-control"><HandHelping size={24}/><span>{t('सहायता', 'Get help')}</span></button>
          </div>
        </div>
        <div className="header-subrow"><nav aria-label={t('कार्यस्थल', 'Workspace')}>{(['patient', 'doctor', 'admin'] as Role[]).map(item => <button key={item} aria-pressed={role === item} onClick={() => setRole(item)} className={`role-pill ${role === item ? 'selected' : ''}`}>{item === 'patient' ? t('मरीज़', 'Patient') : item === 'doctor' ? t('डॉक्टर', 'Doctor') : t('स्टाफ', 'Staff')}</button>)}</nav><div className="pathway-switch" aria-label={t('चिकित्सा पद्धति', 'Care pathway')}><button aria-pressed={!ayush} className={!ayush ? 'selected' : ''} onClick={() => setAyush(false)}><Stethoscope size={21}/>{t('एलोपैथी', 'Allopathy')}</button><button aria-pressed={ayush} className={ayush ? 'selected' : ''} onClick={() => setAyush(true)}><Leaf size={21}/>{t('आयुष', 'AYUSH')}</button></div></div>
      </header>
      <main className="main-content">
        <div hidden={role !== 'patient'}>{phase === 'awake' && (configError ? <div className="error-card" role="alert"><h1>{t('कनेक्शन नहीं हो पाया', 'Unable to connect')}</h1><p>{t('कृपया फिर कोशिश करें या स्टाफ की सहायता लें।', 'Please retry or ask staff for help.')}</p><button className="primary-button" onClick={loadConfig}>{t('फिर कोशिश करें', 'Retry')}<ArrowRight size={22}/></button></div> : <PatientExperience key={session} active={role === 'patient'} config={config} language={language} voice={voice} ayush={ayush} onNewSession={reset}/>)}</div>
        {phase === 'awake' && role === 'doctor' && <DoctorExperience language={language}/>}
        {phase === 'awake' && role === 'admin' && <AdminExperience language={language}/>}
      </main>
      <footer className="app-footer"><span>{t('आपकी जानकारी डॉक्टर को आपकी देखभाल में मदद करती है।', 'Your answers help your doctor care for you.')}</span>{role !== 'patient' && <button onClick={reset}><Moon size={19}/>{t('कियोस्क सुलाएं', 'Sleep kiosk')}</button>}</footer>
    </div>
    {helpMessage && <div className="toast" role="status"><p>{helpMessage}</p><button onClick={() => setHelpMessage('')} aria-label={t('बंद करें', 'Close')}><X/></button></div>}
    {phase !== 'awake' && <button onClick={wake} className={`wake-screen ${phase === 'waking' ? 'waking' : ''}`} aria-label="Please tap to awake the kiosk"><div className="wake-orbit"/><BrandLogo ref={wakeLogo} className="wake-logo"/><div className="wake-note"><p>Please tap to awake the kiosk</p><p lang="hi">शुरू करने के लिए स्क्रीन छुएं</p><span className="wake-touch"><span/></span></div></button>}
  </div>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)
