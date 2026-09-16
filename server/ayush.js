// Patient-reported history only; examination and Samprapti interpretation belong to the clinician.
const field = (key, category, en, hi, extra = {}) => ({id:`ayush.${key}`,category,en,hi,type:'text',inputType:'text',required:true,clinicalTag:category,followUpRules:[],...extra})
export const ayushQuestions = [
  field('prakriti','Prakriti','Before this illness, what were your usual body build, skin tendency, temperature preference and sleep pattern?','इस बीमारी से पहले शरीर की बनावट, त्वचा, गर्मी/ठंड की पसंद और नींद कैसी थी?'),
  field('vikriti','Vikriti','What has changed from your usual health during this illness?','इस बीमारी में आपकी सामान्य सेहत से क्या बदलाव हुआ?'),
  field('digestion','Agni','How is your appetite and digestion: regular, irregular, low, or burning?','भूख और पाचन कैसे हैं: नियमित, अनियमित, कम या जलन?',{type:'choice',inputType:'choice',options:[['regular','Regular','नियमित'],['irregular','Irregular','अनियमित'],['low','Low appetite','कम भूख'],['burning','Burning','जलन']]}),
  field('afterMeals','Agni','Describe heaviness, bloating or discomfort after meals and when it occurs.','भोजन के बाद भारीपन, गैस या तकलीफ कब होती है?',{followUpRules:[{answer:'ayush.digestion',not:'regular'}]}),
  field('koshtha','Koshtha','How often do you pass stool? Is it usually hard, loose, or regular?','मल कितनी बार होता है? सामान्यतः सख्त, पतला या नियमित है?'),
  field('ahara','Ahara','Describe your diet, meal times, food preferences and recent dietary changes.','भोजन का प्रकार, समय, पसंद और हाल के बदलाव बताएं।'),
  field('routine','Vihara','Describe daily activity, occupation, sleep and stress-related routine changes.','दिनचर्या, काम, शारीरिक गतिविधि, नींद और तनाव से जुड़े बदलाव बताएं।'),
  field('nidana','Nidana','What foods, activities, exposures or situations seem to worsen or relieve your symptoms?','कौन से भोजन, काम या परिस्थितियां परेशानी बढ़ाती या कम करती हैं?'),
  field('samprapti','Samprapti history','How did the symptoms develop and change over time? Your clinician will interpret this history.','लक्षण समय के साथ कैसे बढ़े या बदले? चिकित्सक इस इतिहास की समीक्षा करेंगे।'),
  field('sara','Sara','Have you noticed changes in skin, hair, strength or recovery from illness?','त्वचा, बाल, ताकत या बीमारी से उबरने में बदलाव देखा है?'),
  field('samhanana','Samhanana','Describe your usual physical build and any recent loss of strength.','अपनी सामान्य शारीरिक बनावट और हाल की कमजोरी बताएं।'),
  field('pramana','Pramana','What are your measured height and weight, if known?','यदि पता है तो मापी गई लंबाई और वजन बताएं।'),
  field('satmya','Satmya','Which foods and routines suit you, and which do you not tolerate?','कौन सा भोजन और दिनचर्या अनुकूल है, किससे परेशानी होती है?'),
  field('sattva','Sattva','How are you coping with stress, and what support is available?','तनाव से कैसे निपटते हैं और क्या सहायता मिलती है?'),
  field('aharaShakti','Ahara Shakti','How much can you comfortably eat, and how soon do you feel hungry again?','कितना भोजन आराम से खा पाते हैं और दोबारा भूख कब लगती है?'),
  field('vyayamaShakti','Vyayama Shakti','What activity can you comfortably do before needing rest?','आराम की जरूरत से पहले कितनी गतिविधि आराम से कर पाते हैं?'),
  field('dailySupport','Vihara','Do you need support with walking or daily activities?','क्या चलने या रोजमर्रा के काम में सहायता चाहिए?',{minAge:65}),
  field('jointRoutine','Vihara','How do rest, movement and time of day affect stiffness?','आराम, चलने और दिन के समय से अकड़न पर क्या असर होता है?',{symptoms:['joint_pain','back_pain']}),
]
export function selectAyushQuestions(answers, symptoms, patient = {}) {
  return ayushQuestions.filter(q => (!q.minAge || patient.age >= q.minAge) && (!q.symptoms || symptoms.some(s=>q.symptoms.includes(s.id))) && q.followUpRules.every(rule=>answers[rule.answer] && answers[rule.answer]!==rule.not))
}
export function ayushAssessment(answers, patient = {}) {
  return { source:'patient-reported history; clinician review required', parameters:Object.fromEntries(ayushQuestions.map(q=>[q.category === 'Agni' && q.id.endsWith('digestion') ? 'Agni' : q.id.slice(6), answers[q.id] || 'Not collected'])), vaya:patient.age ?? 'Not recorded', examination:'Sara, Samhanana and Pramana require clinician examination; no findings inferred.', samprapti:'Clinician interpretation pending' }
}
