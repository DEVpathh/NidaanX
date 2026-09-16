# Existing architecture and implementation plan

React/TypeScript + Vite client; Express JavaScript API; atomic JSON maps persisted by server/app.js. No SQL migrations or production authentication. PatientExperience owns voice, body selections, questions, consent, scan and submission. DoctorExperience edits versioned cases; AdminExperience polls the existing attendant queue. OCR uses Apple Vision or Google Vision, with evidence-based token confidence and versioned clinician assurance in documents/routes.js. DocumentTimeline currently shows only attached scans. AYUSH currently asks two generic questions and invents default dosha findings. CSS custom properties change abruptly because unregistered properties/gradient backgrounds cannot interpolate.

1. Extend existing patient/document/case maps with isolated idempotent demo seed, demo identity/OTP adapter, history APIs and patient-wide timeline.
2. Put distinct new/existing entry before intake, retain registration validation and consent, add phone OTP.
3. Extend confidence with semantic fields, levels, original values and review history; reuse doctor review and timeline.
4. Replace fabricated AYUSH findings with configured bilingual patient-history questions and adaptive branches; persist separate assessment.
5. Centralize explicit red flags, remove symptom-only yellow stops; persist triage into attendant queue with identifiers/status.
6. Restore interpolated theme transition, standardize controls and add backend-owned ENT locations.
7. Run API regression, new acceptance coverage, build and browser flows. Document exact APIs and limitations.
