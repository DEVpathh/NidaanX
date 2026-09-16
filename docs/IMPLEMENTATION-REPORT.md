# 1. What changed

The existing React/TypeScript, Express and atomic JSON architecture was extended, not rebuilt.

- Following the updated requested flow, patients complete their concern/history first, then see distinct new/existing patient entry cards. Registration validates full name, phone, gender and integer age (0–120), generates an internal UUID, and continues to permissions while retaining the collected history. Existing patients can use local demo ABHA/Aadhaar lookup or phone OTP.
- Automatic, idempotent Arjun Mehta seed with three dated records, previous diagnoses and medications, abnormal HbA1c, high/medium/low OCR scores, and an immediately available doctor case. Existing records and doctor corrections survive restart.
- Patient history, documents and chronological timeline APIs. The timeline combines actual encounters and medical documents; source text and source images expand on demand.
- Field-level OCR confidence and review. Corrected values, original values, unchanged source scores, confirmation timestamps and review history persist. Full-document text/date editing also retains prior text and field snapshots and uses version checks.
- Bilingual AYUSH question configuration and adaptive branches. A separate doctor section shows patient-reported history. Fabricated dosha scores and assumed normal physical findings were removed from intake results.
- Fever alone no longer stops intake. Defined high-risk statements, affirmative safety answers and high severity request priority staff review. Automatic alerts use the existing persistent attendant queue and acknowledgment workflow.
- Eyes, Ears, Nose and Tongue/oral-region locations come from the backend and persist with encounters.
- Existing blue/green theme now interpolates on every switch using registered CSS color properties. Reduced-motion behavior remains enabled. Forms, checkboxes, cards and responsive layouts have shared styling.
- Removed the receipt's fake live-status QR claim and fabricated fallback ABHA/token values.

# 2. Files modified

| File | Change |
|---|---|
| `server/app.js` | Required registration validation, demo gating, identity mounting, AYUSH persistence, automatic staff alerts, extended clinical fields. |
| `server/index.js` | Enable automatic demo fixtures outside production, with opt-out. |
| `server/demo.js` | New isolated fictional patient, documents, evidence and encounter seed; demo Aadhaar matcher. |
| `server/identity.js` | New bounded, expiring, attempt-limited, single-use demo OTP adapter. |
| `server/ayush.js` | New bilingual structured question configuration and history assessment. |
| `server/red-flags.js` | New centralized explicit danger patterns, negation handling and severity configuration. |
| `server/intake.js` | AYUSH branching, general history fields, ENT questions, removal of symptom-only fever escalation and invented findings. |
| `server/triage-stop.js` | Shared severity threshold and calm priority wording. |
| `server/body-map.js` | Four head/ENT location identifiers. |
| `server/documents/confidence.js` | Normalized scores, levels, configurable thresholds and semantic/clinical-text fields. |
| `server/documents/routes.js` | Patient history/timeline APIs, demo source rendering, optimistic locking and correction traceability. |
| `server/.env.example` | Demo toggle and confidence settings. |
| `server/package.json` | Acceptance tests in the normal server test command. |
| `server/acceptance.test.js` | New login, OTP, seed persistence, OCR, triage, ENT and AYUSH coverage. |
| `server/api.test.js` | Existing fixtures updated for required phone. |
| `server/records-followups.test.js` | Existing document tests updated for versioned writes. |
| `server/visual-confidence.test.js` | Required phone/version fixtures; preserve follow-up consent coverage. |
| `client/src/features/patient/PatientIdentity.tsx` | New distinct registration/login component with real backend calls. |
| `client/src/features/patient/PatientExperience.tsx` | Identity after history, preserved clinical answers across login, history access, triage status and separated summary. |
| `client/src/features/doctor/DoctorExperience.tsx` | Separate AYUSH history, additional clinical fields, patient-wide timeline. |
| `client/src/components/DocumentTimeline.tsx` | Chronological encounter/document view, source previews and persisted corrections. |
| `client/src/components/OcrConfidence.tsx` | Per-field confidence level, abnormal/review status, original values and editing. |
| `client/src/components/DocumentScanner.tsx` | Send document version when saving review. |
| `client/src/components/TokenReceiptModal.tsx` | Honest receipt data, accessible close control, no fake QR claim. |
| `client/src/components/records.css` | Keep all historical confidence fields visible. |
| `client/src/index.css` | Animated theme properties, shared typography/control/card styling, responsive corrections. |
| `client/src/services/patientService.ts` | Patient identity included in intake requests for age context and staff alerts. |
| `client/src/types/clinical.ts` | Confidence, masked identity, AYUSH and additional clinical field types. |
| `client/playwright.config.ts` | Fresh isolated storage per browser-suite run. |
| `client/tests/acceptance.spec.ts` | New complete demo, OCR review, fever/ENT/theme and AYUSH browser checks. |
| `client/tests/kiosk.spec.ts` | Reordered workflow regression coverage; subpixel tolerance for circular step indicators. |
| `README.md` | Current run commands, credentials, integrations and limitations. |
| `docs/clinical-intake.md` | Rule changes, clinical reference context and limitations. |
| `docs/IMPLEMENTATION-PLAN.md` | Architecture inspection and ordered implementation plan. |
| `docs/IMPLEMENTATION-REPORT.md` | This report and API contracts. |

# 3. Database changes

No SQL database or migration framework existed. The existing JSON maps remain the persistence layer. The root npm scripts start the backend in `server/`, so the default relative path is `server/.data/carex.json`; `CAREX_DATA_PATH` overrides it. Writes use a temporary file and atomic rename with private file permissions.

Patient records add `demo` and `aadhaarLast4` for the demo identity. Full Aadhaar is not stored in the patient record or returned. Encounters add `surgicalHistory`, `personalHistory` and `ayushAssessment`. Documents retain their existing `elements` relationship and gain normalized confidence, confidence level, source links, optional abnormal flags, original text, text history and element review history. Triage alerts extend the existing attendant requests with patient/session identity. Timeline events are derived from documents and encounters; no duplicate timeline store is maintained.

Seeding is idempotent by `patient-demo-arjun`; it does not reset corrections on restart. OTP challenges are HMAC-digested with an ephemeral random key, live only in bounded server memory, expire after five minutes, permit five verification attempts, and are consumed on success. Request cooldown is 30 seconds. Restart invalidates outstanding challenges. Other uniquely matched registered patients can return through phone login in demo mode; their randomly generated demo OTP is explicitly displayed by the local adapter. Shared phone numbers do not silently select a profile.

# 4. APIs

Base: `/api/v1`. JSON success responses use `{ "data": ..., "requestId": "uuid", "timestamp": "ISO date" }`. Errors use `{ "message": "..." }`. The response column below describes `data`. IDs in paths come from API responses. These are local prototype APIs; staff roles are not authenticated authorization boundaries.

Common returned records:

- **Patient**: `{id,displayName,age,sex,mobile,smsConsent,opd,verified,abhaId?,aadhaarLast4?,demo?}`.
- **Document**: `{id,patientId,fileName,fileType,documentDate,extractedText,elements,confidenceThreshold,reviewed,ocrStatus,version,...}`. Image bytes are not embedded in JSON responses.
- **OCR field**: `{id,kind,value,originalValue,confidence,normalizedConfidence,confidenceLevel,confidenceBasis,sourceDocument,requiresAssurance,assurance,reviewHistory?,abnormal?}`. `confidence` retains the existing percentage convention; `normalizedConfidence` is 0–1 or null.
- **Case**: `{id,patientId,patient,token,status,chiefComplaint,hpi,pastHistory,surgicalHistory,personalHistory,drugAndAllergy,familyHistory,ros,answers,questions,pathway,ayushAssessment?,documentIds,bodyLocations,triageLevel,version,...}`.

| Method | Endpoint | Purpose | Request | Response |
|---|---|---|---|---|
| GET | `/health` | API status | None | `{status:"ok",intakeEngine,symptomGroups}` |
| GET | `/patient-experience` | Kiosk configuration | None | `{brand,languages,steps,identificationOptions,consentPurposes,welcome}` |
| POST | `/patients` | Register patient | `{displayName:"Example Patient",mobile:"9876543211",age:35,sex:"other",smsConsent:false}` | `201 Patient` |
| GET | `/patients/lookup` | Demo ABHA lookup | Query `method=abha&identifier=91-2345-6789-0123` | `Patient`; 404 absent; 503 without demo adapter |
| GET | `/patients/lookup` | Demo Aadhaar lookup | Query `method=aadhaar&identifier=999988887777` | `Patient` containing only masked Aadhaar suffix |
| POST | `/auth/phone/request-otp` | Request demo OTP challenge | `{phone:"9876543210"}` | `{success:true,mode:"demo",message,expiresIn:300,demoOtp?:"generated code"}`; no SMS sent |
| POST | `/auth/phone/verify-otp` | Verify and consume challenge | `{phone:"9876543210",otp:"123456"}` | `Patient`; 401 invalid/expired/consumed |
| GET | `/patients/:patientId/profile` | Retrieve profile | Path ID | `Patient` |
| GET | `/patients/:patientId/history` | Structured previous records | Path ID | `{patient,visits:Case[],documents:Document[],structuredFields:OCRField[]}` |
| GET | `/patients/:patientId/documents` | Retrieve old/scanned documents | Path ID | `Document[]` |
| GET | `/patients/:patientId/timeline` | Chronological medical history | Path ID; optional `caseId` for clinician consent context | `[{id,date,type,summary,source,abnormal?,document?,visit?}]` |
| PATCH | `/patients/:patientId/contact` | Update follow-up contact/consent | `{mobile:"9876543211",smsConsent:true}` | `Patient` |
| POST | `/consents` | Save explicit permissions | `{patientId,language:"English",purposes:{casePreparation:true,priorRecords:true,careTeamSharing:true}}` | `201 {patientId,purposes,language,capturedAt}` |
| GET | `/body-map` | Backend-owned selectable regions | None | `[{id,en,hi}]`, including eyes/ears/nose/tongue |
| POST | `/intake/questions` | Adaptive normal/AYUSH history and priority evaluation | `{patientId,sessionId,complaint:"I have fever",language:"English",pathway:"general",answers:{},bodyLocations:[]}` | `{questions,inferredAnswers,symptoms,complete,triageLevel,urgent,urgentReasons,stopQuestionnaire,ayushAssessment?,triageAlert?,...}` |
| GET | `/cases/draft` | Empty visit structure | None | Empty draft case with unique ID |
| POST | `/cases/submit` | Persist completed normal/AYUSH responses and encounter | `{id,patientId,chiefComplaint,hpi,pastHistory,drugAndAllergy,familyHistory,ros,answers,pathway:"ayush",language,documentIds:[],bodyLocations:[]}` | `201 Case`; matching existing ID returns existing Case |
| GET | `/cases` | Doctor queue and saved history | None | `Case[]` |
| PATCH | `/cases/:caseId` | Save clinician changes/decision | `{version:1,hpi:"Reviewed history",clinicianNotes:"Reviewed",status:"approved"}`; clinical fields optional | Updated `Case`; 409 stale version |
| GET | `/cases/:caseId/fhir` | Existing basic FHIR-shaped export | Path ID | FHIR document bundle; not an ABDM-certified export |
| GET | `/documents/status` | OCR adapter and thresholds | None | `{available,provider,handwriting,reviewRequired,confidenceThreshold,confidenceThresholds}` |
| POST | `/documents/scan` | Store camera image and run OCR | `{patientId,fileType:"prescription",image:"data:image/png;base64,...",originalImage:"data:image/png;base64,..."}` | `202 Document` with processing status; requires prior-record consent |
| GET | `/documents/:documentId/ocr` | Poll extraction status/fields | Path ID | `Document` |
| GET | `/documents/:documentId/image` | Source image | Optional `original=true` | Image bytes, not JSON; explicitly fictional SVG for seed documents |
| PATCH | `/documents/:documentId` | Review/correct document text/date | `{version:1,documentDate:"2025-03-12",extractedText:"...",reviewed:true}`; date may be null | Updated `Document`; 409 stale version |
| PATCH | `/cases/:caseId/documents/:documentId/elements/:elementId` | Doctor confirms/corrects a field | `{version:1,value:"Once daily",confirmed:true}` | Updated `Document` retaining original value, source score and review trail |
| DELETE | `/documents/:documentId` | Remove unattached scan | Path ID | `{deleted:true}`; 409 if attached to submitted case |
| GET | `/cases/:caseId/timeline` | Compatible document timeline endpoint | Path ID | Chronological `Document[]` |
| POST | `/attendant-requests` | Manual help/priority request | `{reason:"Patient needs help",language:"English",urgent:true}` | `201 {requestId,status:"queued",createdAt,message,...}` |
| GET | `/attendant-requests` | Active staff alerts | None | Queued request array, including automatic intake alerts |
| PATCH | `/attendant-requests/:id` | Staff acknowledgment | `{}` | Request with `status:"acknowledged"` |
| GET | `/followups/status` | SMS reminder adapter status | None | `{configured,timeZone:"Asia/Kolkata"}` |
| GET | `/cases/:caseId/followup` | Reminder history | Path ID | Follow-up array |
| POST | `/cases/:caseId/followup` | Schedule/cancel need for follow-up | `{version,needed:true,date:"YYYY-MM-DD"}` or `{version,needed:false}` | Follow-up record or `{needed:false,date:null,recordedAt}`; requires approved case |
| DELETE | `/cases/:caseId/followup/:id` | Cancel pending reminder | Path IDs | Follow-up with cancelled status |

# 5. Demo credentials

All values below are fake demo data only.

- Patient: **Arjun Mehta**
- Phone: **9876543210**
- OTP: **123456**
- ABHA: **91-2345-6789-0123**
- Aadhaar: **9999 8888 7777**
- Gender: Male; age: 42.

Wake the kiosk, choose English if desired, complete the history questions, then select Existing Patient and use any method. Open “My previous medical history” after login. In Doctor workspace, select Arjun's `DEMO-001` case to demonstrate the timeline and the 62% frequency field. Confirming that field persists, so a restart intentionally does not reset its verification state. Use a fresh, separate `CAREX_DATA_PATH` if you need a new recording dataset; do not delete an existing real data file.

# 6. OCR confidence

Real OCR uses the existing Apple Vision or Google Vision word/line evidence. Word scores are preferred; inherited line scores are labeled. Matching field/line scores use the conservative minimum of contributing token scores. Missing evidence stays unknown and requires review. No real OCR score is invented. The seed's scores are explicitly fixture data, not measured provider output.

Defaults: high ≥85%, medium ≥70% and <85%, low <70%. `OCR_HIGH_THRESHOLD`, `OCR_MEDIUM_THRESHOLD` and `OCR_REVIEW_THRESHOLD` configure them; review defaults to below 85%, so medium fields are also reviewable. Ambiguous abbreviations and unknown confidence require review regardless of high score. Normalized 0–1 scores accompany legacy percentages. A high score never means doctor verification.

Field review uses version checks. Source scores and original values remain unchanged; corrected values and review history are persisted in the same document model. The patient history API derives structured fields from that canonical record, so corrections appear in later doctor views. Full-text editing preserves prior snapshots and recalculates changed entries for fresh review.

# 7. Emergency detection

`server/red-flags.js` centralizes explicit high-risk statements, negation handling and the existing 7/10 priority threshold. `server/intake.js` retains symptom-specific affirmative safety questions and chest-pain associated-symptom checks. `server/triage-stop.js` pauses urgent encounters and preserves escalation across requests/restarts.

Fever alone stays green and asks warning signs, duration, severity, temperature and associated symptoms. Severe breathing trouble, unresponsiveness, uncontrolled bleeding, specified seizure patterns or stroke-like statements can request priority review. Red/yellow is staff prioritization, not a diagnosis. Automatic alerts are stored once per session in the existing attendant queue with patient/session ID, reason, timestamp and status. Staff can acknowledge them. No external paging is claimed.

Clinical context and limitations: [WHO IITT](https://www.who.int/tools/triage). The application is not a validated IITT implementation.

# 8. AYUSH mode

`server/ayush.js` owns bilingual question IDs, categories, input types, options, required flags, clinical tags and follow-up rules. Normal mode keeps general history. AYUSH adds Prakriti, Vikriti, Agni, Koshtha, Ahara, Vihara, Nidana, symptom progression for Samprapti review, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti and Vyayama Shakti. Vaya comes from registered age.

After-meal questions branch from digestion answers, stiffness/routine questions depend on musculoskeletal complaints, and daily-support questions apply to older patients. Inapplicable branch answers are excluded from the assessment. Uncollected values remain “Not collected.” Physical examination and Samprapti interpretation remain clinician tasks. AYUSH responses persist separately from the general HPI and render in a dedicated doctor section. Concept reference: [Ministry of AYUSH](https://ayusoft.ayush.gov.in/principles-of-ayurveda/).

# 9. Medical timeline

The backend derives chronological events from the existing patient-associated document and encounter maps. It sorts oldest-first with unknown dates last. Prescription, lab report, discharge-summary and other documents retain their own source/type; submitted visits appear as consultations. No frontend clinical fixture array is used. `DocumentTimeline.tsx` renders the events, abnormal indicators, confidence and expandable source details. The clinician passes case context so prior-record consent controls historical access within that view.

# 10. Run the project

From the repository root:

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run dev:full
```

Open **http://localhost:5173**. API: **http://127.0.0.1:8080**. The seed runs automatically outside production unless `CAREX_DEMO_MODE=false`.

Separate terminals, if preferred:

```bash
npm run dev:server
npm run dev:client
```

Optional environment configuration: copy `server/.env.example` to `server/.env`, then adjust backend-only values. Demo mode cannot be enabled when `NODE_ENV=production`. Disabling demo mode does not erase previously persisted fixtures. Production identity APIs report unavailable until a real adapter is implemented.

Validation:

```bash
npm run build
npm run test:server
npm run test:e2e
```

Browser tests use installed Google Chrome, API port 8081, Vite port 5174 and fresh test storage. Screenshots are in ignored `client/artifacts/`.

# 11. Testing

- TypeScript and production Vite build: passed.
- Server regression and acceptance suite: 30 tests passed, including OTP expiry/replay/attempt limits, restart persistence, OCR evidence/assurance, consent, follow-up reminders, triage and ENT.
- Browser coverage includes registration through doctor approval, all three demo logins, previous history, OCR correction across reload, fever follow-ups, explicit danger alerts, repeated theme switches, Hindi speech lifecycle, network/microphone failure recovery, mobile widths and a full AYUSH submission to the separate doctor summary.
- Screenshot inspection: distinct entry cards, doctor timeline and responsive layouts. Browser rendering can produce tiny fractional bounding-box differences during animation; the circular-step assertion allows less than 0.1 pixel difference.
- Final browser suite: **12 passed** (57.8 seconds). `git diff --check` passed.

# 12. Remaining limitations

- Local demo only: role tabs are not staff authentication, patient demo lookup is not proof of government identity, and the JSON store is not a production encrypted clinical database.
- No real ABHA/Aadhaar authentication, authentication SMS, hospital HIS, external staff paging or production identity sessions are connected. The OTP adapter explicitly sends no SMS.
- Camera OCR adapters are implemented; automated tests exercise their contracts with controlled evidence. A physical camera, handwritten prescriptions, local Swift/Apple Vision execution and cloud credentials were not independently validated on target kiosk hardware during this change.
- Seed source images are explicitly fictional rendered documents, not actual scanned historical medical records.
- Clinical extraction is conservative token/line and labeled-field extraction, not a general clinical NLP model. Abnormal seed labs are supplied by the fixture; arbitrary real lab reports require clinician interpretation.
- Rules collect history and request staff review. They do not diagnose, prescribe, validate a Prakriti classification or replace clinical examination. Clinical validation, security hardening and production integrations remain required before real patient deployment.
- The existing basic FHIR export is not claimed to pass an ABDM conformance validator. No real SMS reminder delivery was exercised without provider credentials.


## Follow-up: requested flow and visible animation

The login screen now follows completed clinical history. Login preserves complaint, answers, body locations and the encounter identifier. `client/src/components/ModeTransition.tsx` reuses the wake animation style: a centred logo moves into the header on each AYUSH/Allopathy switch. Rapid switches cancel the previous animation, and reduced-motion preferences skip it. `client/src/main.tsx` owns the transition state; CSS adds a brief themed background and caption.

The reported details-fetch failure came from an older Node backend process still running the previous API. Restarting it restored patient lookup and timeline responses (HTTP 200 through the running frontend). Root `package.json` and `server/package.json` now use Node watch mode for development. No patient data was deleted.

Phone-login follow-up: the configured demo number selects the explicit seeded Arjun fixture even when local test registrations reused that number. Other ambiguous shared phone numbers still do not select a profile automatically. Symptom-first login and repeated/reduced-motion pathway animation checks passed; the AYUSH complaint and answers survive registration into the doctor summary.
