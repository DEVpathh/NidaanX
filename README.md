# NidaanX

NidaanX is a Hindi-first, voice-assisted medical intake kiosk with a connected doctor and staff workspace.

## Run

```bash
npm install
npm run dev:full
```

Open **http://localhost:5173**. The API listens on **http://127.0.0.1:8080**. Start both services with `dev:full`; Vite proxies `/api` to the API. `VITE_API_BASE_URL` can point the frontend to another API origin.

## Experience

- The supplied leaf/mortar logo fills the wake screen. Touch the screen to animate it into the header and begin directly with “हेलो, क्या समस्या है आपको?”
- Hindi is the default. English switches the interface, current question, speech output and recognition language while retaining answers.
- Allopathic mode is blue / sky blue; AYUSH changes the palette and logo to green. Large text and large touch controls are always enabled.
- The kiosk asks one relevant question at a time. It supports 23 symptom groups, Hinglish aliases, multiple symptoms, simple duration extraction, branching questions and explicit warning responses. It uses an adaptive rules engine; an external LLM is not configured. See [clinical notes and sources](docs/clinical-intake.md).
- Voice reads the visible prompt, stops before listening, and places recognized speech into the current answer. Spoken answers advance intake questions. Text and touch remain available. Audio off cancels queued speech; the microphone remains an explicit input control.
- After intake, patients register or look up a record, select permissions, review and submit. Real tokens and patient records appear in the doctor queue.
- Doctors can search/filter, edit all clinical fields, save, approve, and reject with a reason. Version checks protect against stale edits. Staff can acknowledge actual help requests.
- A submitted session ends with a token and a Next patient button that clears the interface and returns it to the wake screen.

## Voice setup

Use a browser that implements Web Speech recognition, such as desktop Chrome, on localhost or HTTPS, and allow microphone access. Speech recognition may use the browser vendor's network service. Hindi playback needs a Hindi voice available on the device/browser. Unsupported browsers, blocked microphone permission, network errors and synthesis failures show a message and retain text/touch controls. Automated tests simulate speech events; test an actual microphone and Hindi voice on the target kiosk hardware.

## Storage and integrations

The development API stores registrations, consent records, submitted cases, edits and help requests in `.data/carex.json`, using atomic file replacement. Set `CAREX_DATA_PATH` to change the location. Tests use isolated temporary storage. The default API is bound to loopback.

This is a local prototype: role tabs are navigation, not authenticated staff authorization. It has no production identity provider, external ABHA/Aadhaar service, scanner, OCR, clinical database, or external notification delivery. A sample ABHA lookup (`14-23-45-67-89-01`) is available; new patient registration is functional. Prior-record endpoints return no fabricated data. Configure authentication, secure production storage and reviewed clinical protocols before deploying with real patient records.

## Validate

```bash
npm run build
npm run test:api
npm run test:e2e
```

Browser tests use installed Google Chrome, an isolated API on port 8081 and Vite on 5174. Screenshots and test data go in ignored `artifacts/`. They cover wake/layout, language/theme switching, speech sequencing, patient submission, doctor edits and reload persistence, help requests, and recoverable failures.

Logo asset and generation prompt: [docs/logo-asset.md](docs/logo-asset.md).
