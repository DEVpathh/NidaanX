/**
 * Bhashini Model Registry & Service ID Mapping
 * Configured with official Bhashini Service IDs and Pipeline IDs for ASR, Translation, Transliteration, TTS, Audio Language Detection, Text Language Detection, NER, OCR, Speaker Verification, Diarization, Voice Cloning, and KWS.
 */

export const BHASHINI_PIPELINE_IDS = {
  iitMadras: '660fa5bec7fb5b0328229016',     // ASR and TTS task types
  iitBombay: '660f813c0413087224435d2c',     // Translation task type
  iiitHyderabad: '660f866443e53d4133f65317', // Translation task type
  initialPipeline: '64392f96daac500b55c543cd'// ASR, Translation, Transliteration, TTS
}

export const BHASHINI_MODEL_REGISTRY = {
  // 1. Speech Recognition (STT / ASR)
  ASR: {
    multilingualIndic: {
      serviceId: 'bhashini/ai4bharat/conformer-multilingual-asr',
      provider: 'AI4Bharat',
      languages: ['as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'gom', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur']
    },
    hindiConformer: {
      serviceId: 'ai4bharat/conformer-hi-gpu--t4',
      provider: 'AI4Bharat',
      languages: ['hi']
    },
    englishWhisper: {
      serviceId: 'ai4bharat/whisper-medium-en--gpu--t4',
      provider: 'AI4Bharat',
      languages: ['en']
    },
    indoAryanConformer: {
      serviceId: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
      provider: 'AI4Bharat',
      languages: ['hi', 'bn', 'mr', 'ur', 'or', 'pa', 'gu', 'sa']
    },
    dravidianConformer: {
      serviceId: 'ai4bharat/conformer-multilingual-dravidian-gpu--t4',
      provider: 'AI4Bharat',
      languages: ['te', 'kn', 'ml', 'ta']
    },
    iitmDravidian: {
      serviceId: 'bhashini/iitm/asr-dravidian--gpu--t4',
      provider: 'IIT Madras',
      languages: ['te', 'kn', 'ml', 'ta']
    },
    iitmIndoAryan: {
      serviceId: 'bhashini/iitm/asr-indoaryan--gpu--t4',
      provider: 'IIT Madras',
      languages: ['gu', 'or', 'hi', 'mr', 'pa', 'bn']
    },
    iitmMisc: {
      serviceId: 'bhashini/iitm/asr-misc--gpu--t4',
      provider: 'IIT Madras',
      languages: ['bho', 'ur']
    },
    iiscMaithili: {
      serviceId: 'bhashini/iisc/asr-mai-t4',
      provider: 'IISC',
      languages: ['mai']
    },
    iiscBhojpuri: {
      serviceId: 'bhashini/iisc/asr-bho-t4',
      provider: 'IISC',
      languages: ['bho']
    }
  },

  // 2. Neural Machine Translation (NMT)
  NMT: {
    iiitAll: {
      serviceId: 'bhashini/iiith/nmt-all',
      provider: 'IIIT Hyderabad',
      description: 'Supports 36 Indian languages and dialects including Hindi, English, Assamese, Awadhi, Bengali, Bhojpuri, Braj, Bodo, Dogri, Konkani, Gondi, Gujarati, Hinglish, Ho, Kannada, Kashmiri, Khasi, Mizo, Maithili, Magahi, Malayalam, Marathi, Manipuri, Nepali, Oriya, Punjabi, Sanskrit, Santali, Sinhala, Sindhi, Tamil, Tulu, Telugu, Urdu, Kangri'
    },
    indicTransV2: {
      serviceId: 'ai4bharat/indictrans-v2-all-gpu--t4',
      provider: 'AI4Bharat',
      description: 'Supports 22 scheduled Indian languages and English'
    },
    iiitV1: {
      serviceId: 'Bhashini/IIITH/Trans/V1',
      provider: 'IIIT Hyderabad',
      languages: ['hi', 'en', 'te', 'or', 'gu', 'ur', 'pa', 'sd', 'doi', 'ks']
    },
    iitbTrilingual: {
      serviceId: 'iitb/trilingual-en_hi_mr-v1-gpu--t4',
      provider: 'IIT Bombay',
      languages: ['en', 'as', 'mr', 'hi', 'brx', 'ne', 'mai', 'gom']
    },
    aukbcDisco: {
      serviceId: 'bhashini/aukbc/disco-nmt',
      provider: 'AUKBC',
      languages: ['ml', 'hi', 'ta']
    },
    cdacNoida: {
      serviceId: 'bhashini/cdac-noida/nmt',
      provider: 'CDAC-Noida',
      languages: ['en', 'hi', 'ta', 'or', 'bn']
    },
    cdacPune: {
      serviceId: 'bhashini/cdac-pune/nmt',
      provider: 'CDAC-Pune',
      languages: ['en', 'kn', 'gu', 'ml']
    },
    iitKgp: {
      serviceId: 'bhashini/iitkhg/nmt',
      provider: 'IIT Kharagpur',
      languages: ['hi', 'sa']
    }
  },

  // 3. Transliteration
  Transliteration: {
    indicXlit: {
      serviceId: 'ai4bharat/indicxlit--cpu-fsv2',
      provider: 'AI4Bharat',
      description: 'Multilingual Roman script to Indic scripts transliteration for 24 languages'
    }
  },

  // 4. Text-to-Speech (TTS)
  TTS: {
    iitmTTS: {
      serviceId: 'Bhashini/IITM/TTS',
      provider: 'IIT Madras',
      languages: ['as', 'bn', 'brx', 'doi', 'en', 'gu', 'hi', 'kn', 'gom', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'raj', 'sa', 'ta', 'te', 'ur', 'sat', 'sd', 'ks']
    },
    indicTTSDravidian: {
      serviceId: 'ai4bharat/indic-tts-coqui-dravidian-gpu--t4',
      provider: 'AI4Bharat',
      languages: ['ml', 'kn', 'ta', 'te']
    },
    indicTTSIndoAryan: {
      serviceId: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
      provider: 'AI4Bharat',
      languages: ['hi', 'mr', 'as', 'bn', 'gu', 'or', 'raj', 'pa']
    },
    indicTTSMisc: {
      serviceId: 'ai4bharat/indic-tts-coqui-misc-gpu--t4',
      provider: 'AI4Bharat',
      languages: ['en', 'mni', 'brx']
    },
    iiscTTS: {
      serviceId: 'Bhashini/IISC/TTS',
      provider: 'IISC (SYSPIN)',
      languages: ['kn', 'te', 'en', 'hi', 'mr', 'bn', 'gu', 'mai', 'bho', 'chg', 'mag']
    },
    iiscSourashtra: {
      serviceId: 'bhashini/iisc/sourashtra/tts',
      provider: 'IISC',
      languages: ['sourashtra', 'ta']
    }
  },

  // 5. Audio Language Detection (ALD)
  AudioLangDetection: {
    iitMandi: {
      serviceId: 'bhashini/iitmandi/audio-lang-detection/gpu',
      provider: 'IIT Mandi',
      languages: ['as', 'bn', 'en', 'hi', 'kn', 'gu', 'ml', 'mr', 'or', 'pa', 'ta', 'te']
    },
    bhashiniALD: {
      serviceId: 'bhashini/ald',
      provider: 'Bhashini Core',
      languages: ['as', 'bn', 'en', 'hi', 'kn', 'gu', 'ml', 'mr', 'or', 'pa', 'ta', 'te']
    }
  },

  // 6. Text Language Detection (TLD)
  TextLangDetection: {
    indicLangDetection: {
      serviceId: 'bhashini/indic-lang-detection-all',
      provider: 'AI4Bharat',
      languages: ['as', 'bn', 'brx', 'doi', 'en', 'gu', 'hi', 'kn', 'ks', 'gom', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur']
    },
    iiithTextLangDetect: {
      serviceId: 'bhashini/iiiith/indic-lang-detection-all',
      provider: 'IIIT Hyderabad',
      languages: ['as', 'bn', 'en', 'gu', 'hi', 'kn', 'ml', 'mni', 'mr', 'or', 'pa', 'ta', 'te', 'ur']
    },
    bhashiniTLD: {
      serviceId: 'bhashini/indic/tld',
      provider: 'Bhashini Core',
      languages: ['as', 'brx', 'bn', 'doi', 'en', 'gu', 'hi', 'kn', 'ks', 'gom', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur']
    }
  },

  // 7. Named Entity Recognition (NER)
  NER: {
    iiithNER: {
      serviceId: 'bhashini/iiith/ner',
      provider: 'IIIT Hyderabad',
      languages: ['hi', 'ur', 'or', 'te']
    },
    indicNER: {
      serviceId: 'bhashini/ai4bharat/indic-ner',
      provider: 'AI4Bharat',
      languages: ['as', 'bn', 'gu', 'hi', 'kn', 'ml', 'te', 'mr', 'or', 'pa', 'ta']
    },
    aukbcNER: {
      serviceId: 'bhashini/aukbc/ner',
      provider: 'AUKBC',
      languages: ['hi', 'bn', 'mr', 'pa', 'kn', 'ml', 'ta', 'en']
    }
  },

  // 8. Optical Character Recognition (OCR)
  OCR: {
    sceneText: {
      serviceId: 'bhashini/iiith-ocr-sceneText-all',
      provider: 'IIIT Hyderabad',
      modality: 'Scene Text',
      languages: ['as', 'bn', 'gu', 'hi', 'kn', 'ml', 'mni', 'mr', 'or', 'pa', 'ta', 'te', 'ur']
    },
    handwrittenBhasha: {
      serviceId: 'bhashini/iiith/ocr-hw-bhaasha',
      provider: 'IIIT Hyderabad',
      modality: 'Handwritten',
      languages: ['bn', 'hi', 'ml', 'mr', 'pa', 'te', 'kn', 'ta']
    },
    printedBhasha: {
      serviceId: 'bhashini/iiith-bhasha-ocr',
      provider: 'IIIT Hyderabad',
      modality: 'Printed Text',
      languages: ['as', 'bn', 'brx', 'doi', 'en', 'gu', 'hi', 'kn', 'ks', 'gom', 'mai', 'ne', 'ml', 'mni', 'mr', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te']
    }
  },

  // 9. Speaker Enrollment & Verification
  SpeakerVerification: {
    enrollment: {
      serviceId: 'bhashini/iitdharwad/speaker-enrollment',
      provider: 'IIT Dharwad',
      languages: ['all']
    },
    verification: {
      serviceId: 'bhashini/iitdharwad/speaker-verification',
      provider: 'IIT Dharwad',
      languages: ['all']
    }
  },

  // 10. Speaker Diarization
  SpeakerDiarization: {
    iiscDiarization: {
      serviceId: 'bhashini/iisc/speaker-diarization',
      provider: 'IISC',
      languages: ['all']
    },
    openSourceDiarization: {
      serviceId: 'bhashini/speaker-diarization',
      provider: 'Open Source',
      languages: ['all']
    }
  },

  // 11. Language Diarization
  LanguageDiarization: {
    nitkLanguageDiarization: {
      serviceId: 'bhashini/nitk/language-diarization',
      provider: 'NITK',
      languages: ['all']
    }
  },

  // 12. Voice Cloning
  VoiceCloning: {
    indicF5: {
      serviceId: 'bhashini/ai4b/indicf5-tts',
      provider: 'AI4Bharat',
      languages: ['as', 'bn', 'gu', 'hi', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te']
    }
  },

  // 13. Lip Sync
  LipSync: {
    iitmLipSync: {
      serviceId: 'bhashini/iitm/lip-sync',
      provider: 'IIT Madras',
      languages: ['all']
    }
  },

  // 14. Key-Word Spotting (KWS)
  KWS: {
    iitgKWS: {
      serviceId: 'bhashini/iitg/kws',
      provider: 'IIT Guwahati',
      languages: ['bn', 'mni', 'mzo']
    }
  }
}

/**
 * Normalizes language inputs (names or ISO codes) to Bhashini standard 2-letter ISO codes.
 */
export function normalizeLanguageCode(lang = 'hi') {
  const clean = String(lang).toLowerCase().trim()
  if (/^hi|hindi|हिंदी|हिन्दी/.test(clean)) return 'hi'
  if (/^en|english|अंग्रेजी/.test(clean)) return 'en'
  if (/^as|assamese|असमिया/.test(clean)) return 'as'
  if (/^bn|bengali|बांग्ला/.test(clean)) return 'bn'
  if (/^gu|gujarati|गुजराती/.test(clean)) return 'gu'
  if (/^kn|kannada|कन्नड़/.test(clean)) return 'kn'
  if (/^ml|malayalam|मलयालम/.test(clean)) return 'ml'
  if (/^mr|marathi|मराठी/.test(clean)) return 'mr'
  if (/^or|odia|ओड़िया/.test(clean)) return 'or'
  if (/^pa|punjabi|पंजाबी/.test(clean)) return 'pa'
  if (/^ta|tamil|तमिल/.test(clean)) return 'ta'
  if (/^te|telugu|तेलुगु/.test(clean)) return 'te'
  if (/^ur|urdu|उर्दू/.test(clean)) return 'ur'
  if (/^sa|sanskrit|संस्कृत/.test(clean)) return 'sa'
  if (/^bho|bhojpuri|भोजपुरी/.test(clean)) return 'bho'
  if (/^mai|maithili|मैथिली/.test(clean)) return 'mai'
  return clean || 'hi'
}

/**
 * Resolves appropriate Service ID for a task and language.
 */
export function getBhashiniServiceId(taskType, language = 'hi') {
  const code = normalizeLanguageCode(language)
  if (taskType === 'ASR') {
    if (code === 'en') return BHASHINI_MODEL_REGISTRY.ASR.englishWhisper.serviceId
    if (code === 'hi') return BHASHINI_MODEL_REGISTRY.ASR.hindiConformer.serviceId
    return BHASHINI_MODEL_REGISTRY.ASR.multilingualIndic.serviceId
  }
  if (taskType === 'NMT') {
    return BHASHINI_MODEL_REGISTRY.NMT.iiitAll.serviceId
  }
  if (taskType === 'TTS') {
    // IITM drops the final syllable of the Hindi welcome's “आपको”.
    // The Hindi-capable Indic voice preserves the complete question.
    if (code === 'hi') return BHASHINI_MODEL_REGISTRY.TTS.indicTTSIndoAryan.serviceId
    return BHASHINI_MODEL_REGISTRY.TTS.iitmTTS.serviceId
  }
  if (taskType === 'Transliteration') {
    return BHASHINI_MODEL_REGISTRY.Transliteration.indicXlit.serviceId
  }
  if (taskType === 'OCR') {
    return BHASHINI_MODEL_REGISTRY.OCR.printedBhasha.serviceId
  }
  if (taskType === 'NER') {
    return BHASHINI_MODEL_REGISTRY.NER.indicNER.serviceId
  }
  if (taskType === 'AudioLangDetection') {
    return BHASHINI_MODEL_REGISTRY.AudioLangDetection.iitMandi.serviceId
  }
  if (taskType === 'TextLangDetection') {
    return BHASHINI_MODEL_REGISTRY.TextLangDetection.indicLangDetection.serviceId
  }
  if (taskType === 'VoiceCloning') {
    return BHASHINI_MODEL_REGISTRY.VoiceCloning.indicF5.serviceId
  }
  return null
}
