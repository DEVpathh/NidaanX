// Deliberately fake identities and records. Never enabled in production.
import { reviewThreshold, confidenceLevel } from './documents/confidence.js'
export function seedDemo({ patients, documents, cases }) {
  const id = 'patient-demo-arjun'
  if ([...patients.values()].some(p => p.id === id)) return
  const patient = { id, displayName: 'Arjun Mehta', mobile: '+919876543210', sex: 'male', age: 42, abhaId: '91-2345-6789-0123', aadhaarLast4: '7777', demo: true, verified: false, opd: 'General OPD', smsConsent: false }
  patients.set(id, patient)
  const fixtures = [
    ['2025-03-12', 'prescription', 'Diabetes prescription', [['Diagnosis','Type 2 Diabetes Mellitus',96],['Medication','Metformin 500 mg',98],['Dosage','1 tablet twice daily',92],['Hospital','Demo community clinic',78]]],
    ['2025-11-18', 'lab_report', 'Previous investigations', [['HbA1c','7.8%',97,true],['Reference range','HbA1c laboratory reference: 4.0–5.6%',90],['Hemoglobin','13.4 g/dL',95]]],
    ['2026-02-06', 'prescription', 'Hypertension prescription', [['Diagnosis','Hypertension',88],['Medication','Amlodipine 5 mg',91],['Frequency','Once daily?',62]]],
  ]
  const documentIds = fixtures.map(([date,type,name,rows], index) => {
    const docId = `demo-arjun-doc-${index+1}`
    const elements = rows.map(([kind,value,confidence,abnormal], i) => ({id:`field-${i}`,kind,value,originalValue:value,confidence,normalizedConfidence:confidence/100,confidenceLevel:confidenceLevel(confidence),confidenceBasis:'demo-fixture',sourceDocument:docId,requiresAssurance:confidence<reviewThreshold(),assurance:null,abnormal:!!abnormal}))
    documents.set(docId,{id:docId,patientId:id,fileName:name,fileType:type,documentDate:date,uploadedAt:`${date}T10:00:00.000Z`,source:'demo-fixture',demo:true,extractedText:rows.map(([k,v])=>`${k}: ${v}`).join('\n'),elements,confidenceThreshold:reviewThreshold(),dateCandidates:[],abbreviations:[],units:[],reviewed:true,ocrStatus:'ready',version:1})
    return docId
  })
  cases.set('case-demo-arjun',{id:'case-demo-arjun',patientId:id,patient,status:'submitted',token:'DEMO-001',chiefComplaint:'Review of previous diabetes and hypertension records',hpi:'Demo historical record prepared for clinician review.',pastHistory:'Type 2 diabetes recorded March 2025. Hypertension recorded February 2026.',drugAndAllergy:'See source-linked medication fields below. Drug allergies: not recorded.',familyHistory:'Father reported to have type 2 diabetes (demo history).',ros:'Not collected for this historical demo encounter.',surgicalHistory:'No previous surgery reported (demo).',personalHistory:'Sedentary desk work (demo).',pathway:'general',documentIds,urgent:false,triageLevel:'green',version:1,createdAt:'2026-02-06T10:00:00.000Z',updatedAt:'2026-02-06T10:00:00.000Z'})
}

export const matchesDemoAadhaar = (patient, digits) => patient.id === 'patient-demo-arjun' && patient.demo && digits === '999988887777'
