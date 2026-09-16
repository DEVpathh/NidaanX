import { randomBytes, randomInt, createHmac, timingSafeEqual } from 'node:crypto'
import { mobileNumber } from './followups/service.js'
export function mountIdentity(app, { patients, demoMode, envelope, now }) {
  const challenges = new Map(), secret = randomBytes(32)
  const hash = value => createHmac('sha256',secret).update(value).digest()
  app.post('/api/v1/auth/phone/request-otp', (req,res) => {
    if (!demoMode) return res.status(503).json({message:'Phone authentication provider is not configured.'})
    const phone = mobileNumber(req.body?.phone)
    if (!phone) return res.status(400).json({message:'Enter a valid phone number.'})
    const previous = challenges.get(phone), time = now().getTime()
    if (previous && time - previous.createdAt < 30000) return res.status(429).json({message:'Wait 30 seconds before requesting another OTP.'})
    for (const [key,value] of challenges) if (time-value.createdAt>600000) challenges.delete(key)
    if (challenges.size>1000) return res.status(429).json({message:'Please try again later.'})
    const matches = [...patients.values()].filter(p=>p.mobile===phone)
    // Demo credentials always refer to the seeded fixture, even if local test registrations reused its phone.
    const patient = matches.find(p=>p.demo && p.id==='patient-demo-arjun') ?? (matches.length===1 ? matches[0] : null)
    const code = patient?.id==='patient-demo-arjun' ? '123456' : String(randomInt(100000,1000000))
    challenges.set(phone,{digest:hash(code),createdAt:time,expiresAt:time+300000,attempts:0})
    res.json(envelope({success:true,mode:'demo',message:patient && !patient.demo ? `Demo only: no SMS sent. Your local demo OTP is ${code}.` : 'Demo only: no SMS sent. Use the documented demo OTP for the demo patient.',...(patient && !patient.demo ? {demoOtp:code} : {}),expiresIn:300}))
  })
  app.post('/api/v1/auth/phone/verify-otp', (req,res) => {
    if (!demoMode) return res.status(503).json({message:'Phone authentication provider is not configured.'})
    const phone = mobileNumber(req.body?.phone), entry = challenges.get(phone)
    if (!entry || entry.expiresAt<=now().getTime() || entry.attempts>=5) return res.status(401).json({message:'OTP expired or unavailable. Request a new OTP.'})
    entry.attempts++
    const matches = [...patients.values()].filter(p=>p.mobile===phone)
    // Demo credentials always refer to the seeded fixture, even if local test registrations reused its phone.
    const patient = matches.find(p=>p.demo && p.id==='patient-demo-arjun') ?? (matches.length===1 ? matches[0] : null)
    if (typeof req.body?.otp!=='string' || !timingSafeEqual(hash(req.body.otp),entry.digest) || !patient) return res.status(401).json({message:'Invalid phone or OTP.'})
    challenges.delete(phone)
    res.json(envelope(patient))
  })
}
