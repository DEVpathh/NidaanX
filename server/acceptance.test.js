import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.js'
import { analyseIntake } from './intake.js'
async function run(options,fn){const server=createApp(options).listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j)});const req=async(path,body,method=body?'POST':'GET')=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()}};try{await fn(req)}finally{await new Promise(r=>server.close(r))}}
test('demo identities, OTP expiry/replay/attempt limits, history and OCR corrections survive restart',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'carex-demo-')),storagePath=join(directory,'data.json');let time=new Date('2026-09-11T00:00:00Z')
 const options={storagePath,demoMode:true,now:()=>time}
 try{await run(options,async req=>{
  for(const [method,id] of [['abha','91-2345-6789-0123'],['aadhaar','9999 8888 7777']]){const r=await req(`/patients/lookup?method=${method}&identifier=${encodeURIComponent(id)}`);assert.equal(r.data.displayName,'Arjun Mehta');assert.equal(r.data.aadhaar,undefined);assert.equal(r.data.aadhaarLast4,'7777')}
  await req('/patients',{displayName:'Duplicate local test record',age:35,sex:'other',mobile:'9876543210'})
  assert.equal((await req('/auth/phone/request-otp',{phone:'9876543210'})).status,200)
  assert.equal((await req('/auth/phone/request-otp',{phone:'9876543210'})).status,429)
  assert.equal((await req('/auth/phone/verify-otp',{phone:'9876543210',otp:'000000'})).status,401)
  assert.equal((await req('/auth/phone/verify-otp',{phone:'9876543210',otp:'123456'})).data.displayName,'Arjun Mehta')
  assert.equal((await req('/auth/phone/verify-otp',{phone:'9876543210',otp:'123456'})).status,401)
  await req('/auth/phone/request-otp',{phone:'9876543210'});time=new Date(time.getTime()+301000)
  assert.equal((await req('/auth/phone/verify-otp',{phone:'9876543210',otp:'123456'})).status,401)
  await req('/auth/phone/request-otp',{phone:'9876543210'});for(let i=0;i<5;i++)await req('/auth/phone/verify-otp',{phone:'9876543210',otp:'000000'})
  assert.equal((await req('/auth/phone/verify-otp',{phone:'9876543210',otp:'123456'})).status,401)
  const newPatient=(await req('/patients',{displayName:'Returning Local Patient',age:30,sex:'other',mobile:'9876543212'})).data
  const challenge=await req('/auth/phone/request-otp',{phone:'9876543212'});assert.match(challenge.data.demoOtp,/^\d{6}$/)
  assert.equal((await req('/auth/phone/verify-otp',{phone:'9876543212',otp:challenge.data.demoOtp})).data.id,newPatient.id)
  const events=(await req('/patients/patient-demo-arjun/timeline')).data;assert.equal(events.length,4);assert.deepEqual(events.map(e=>e.date),[...events.map(e=>e.date)].sort());assert.ok(events.some(e=>e.abnormal))
  const docs=(await req('/patients/patient-demo-arjun/documents')).data;assert.equal(docs.length,3);assert.deepEqual(new Set(docs.flatMap(d=>d.elements.map(e=>e.confidenceLevel))),new Set(['high','medium','low']))
  const doc=docs[2],field=doc.elements.find(e=>e.confidence===62),url=`/cases/case-demo-arjun/documents/${doc.id}/elements/${field.id}`
  const changed=await req(url,{version:doc.version,value:'Once daily',confirmed:true},'PATCH');assert.equal(changed.status,200);assert.equal(changed.data.elements.at(-1).originalValue,'Once daily?');assert.equal(changed.data.elements.at(-1).confidence,62)
  assert.equal((await req(url,{version:doc.version,value:'twice daily',confirmed:true},'PATCH')).status,409)
 });await run(options,async req=>{const docs=(await req('/patients/patient-demo-arjun/documents')).data;assert.equal(docs.length,3);assert.equal(docs[2].elements.at(-1).assurance.confirmed,true);assert.equal(docs[2].elements.at(-1).value,'Once daily');assert.equal((await req('/patients/patient-demo-arjun/history')).data.structuredFields.at(-1).value,'Once daily')})}finally{rmSync(directory,{recursive:true,force:true})}
})
test('new patient validation, fever followups, real priority queue and ENT persistence',()=>run({},async req=>{
 for(const body of [{displayName:'',age:42,sex:'male',mobile:'9876543211'},{displayName:'Test',age:42,sex:'male'},{displayName:'Test',age:150,sex:'male',mobile:'9876543211'}])assert.equal((await req('/patients',body)).status,400)
 const patient=(await req('/patients',{displayName:'New Patient',age:25,sex:'other',mobile:'9876543211'})).data;assert.ok(patient.id)
 for(const complaint of ['I have fever','मुझे बुखार है','Mujhe bukhar hai']){const r=await req('/intake/questions',{complaint,sessionId:'fever',patientId:patient.id});assert.equal(r.data.stopQuestionnaire,false);assert.ok(r.data.questions.some(q=>q.id==='fever.temperature'))}
 assert.equal((await req('/attendant-requests')).data.length,0)
 const high=await req('/intake/questions',{complaint:'severe difficulty breathing',sessionId:'red',patientId:patient.id});assert.equal(high.data.stopQuestionnaire,true);assert.equal(high.data.triageAlert.status,'queued')
 await req('/intake/questions',{complaint:'severe difficulty breathing',sessionId:'red',patientId:patient.id});assert.equal((await req('/attendant-requests')).data.length,1)
 await req(`/attendant-requests/${high.data.triageAlert.requestId}`,{},'PATCH');assert.equal((await req('/attendant-requests')).data.length,0)
 const bodyLocations=['eyes','ears','nose','tongue'];const r=await req('/intake/questions',{complaint:'',bodyLocations});assert.deepEqual(r.data.bodyLocations,bodyLocations);assert.ok(r.data.questions.some(q=>q.id.startsWith('eye.')))
 await req('/consents',{patientId:patient.id,purposes:{casePreparation:true,priorRecords:false,careTeamSharing:true}})
 const visit=await req('/cases/submit',{patientId:patient.id,chiefComplaint:'ENT discomfort',bodyLocations,pathway:'ayush',answers:{'ayush.digestion':'low','ayush.prakriti':'Usually slim'}});assert.deepEqual(visit.data.bodyLocations,bodyLocations);assert.equal(visit.data.ayushAssessment.parameters.prakriti,'Usually slim')
 assert.equal((await req('/auth/phone/request-otp',{phone:'9876543210'})).status,503)
 assert.equal((await req('/patients/lookup?method=abha&identifier=91-2345-6789-0123')).status,503)
}))
test('AYUSH branches collect history without fabricated findings; negatives do not escalate',()=>{
 const normal=analyseIntake({complaint:'headache'});assert.equal(normal.questions.some(q=>q.id.startsWith('ayush.')),false)
 const a=analyseIntake({complaint:'headache',pathway:'ayush',answers:{'ayush.digestion':'low'}});assert.ok(a.questions.some(q=>q.id==='ayush.afterMeals'));assert.equal(a.tridosha,undefined);assert.equal(a.ayushAssessment.parameters.sara,'Not collected')
 const b=analyseIntake({complaint:'headache',pathway:'ayush',answers:{'ayush.digestion':'regular'}});assert.ok(!b.questions.some(q=>q.id==='ayush.afterMeals'))
 for(const complaint of ['no severe difficulty breathing','no unconscious state','I have fever, no fainting'])assert.equal(analyseIntake({complaint}).urgent,false)
})
