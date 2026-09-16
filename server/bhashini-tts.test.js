import assert from 'node:assert/strict'
import test from 'node:test'
import { getBhashiniServiceId } from './bhashiniConfig.js'
import { bhashiniTTS } from './bhashiniService.js'

test('Hindi TTS sends the complete intro to the voice verified to preserve आपको', async t => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body))
    return {
      ok: true,
      json: async () => ({ pipelineResponse: [{ audio: [{ audioContent: 'test-audio' }] }] }),
    }
  })

  // Cover both initial playback and replay; pronunciation itself needs live audio validation.
  for (let playback = 0; playback < 2; playback += 1) {
    const result = await bhashiniTTS({ text: 'हेलो, क्या समस्या है आपको?', language: 'hi', gender: 'female' })
    assert.equal(result.audioContent, 'test-audio')
    assert.equal(result.engine, 'Dhruva')
  }
  assert.equal(requests.length, 2)
  for (const request of requests) {
    assert.equal(request.pipelineTasks[0].config.serviceId, 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4')
    assert.equal(request.pipelineTasks[0].config.language.sourceLanguage, 'hi')
    assert.equal(request.inputData.input[0].source, 'हेलो, क्या समस्या है आपको?')
  }
})

test('Hindi locale aliases select the Hindi voice while English retains its existing voice', () => {
  for (const language of ['hi', 'hi-IN', 'Hindi', 'हिन्दी']) {
    assert.equal(getBhashiniServiceId('TTS', language), 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4')
  }
  assert.equal(getBhashiniServiceId('TTS', 'en'), 'Bhashini/IITM/TTS')
})
