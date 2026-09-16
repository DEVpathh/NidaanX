// Priority alerts for staff review, not diagnoses. Local protocol requires clinical validation.
export const triageConfig = { prioritySeverity:7 }
export const redFlagRules = [
  {id:'breathing',pattern:/cannot breathe|can't breathe|severe (?:difficulty breathing|breathing difficulty)|unable to finish a sentence|blue lips|सां?ँ?स\s*(?:बिल्कुल\s*)?नहीं\s*(?:आ|ले)|saans nahi (?:aa|le)/i},
  {id:'consciousness',pattern:/\bunconscious\b|\bunresponsive\b|\bfaint(?:ing|ed)\b|बेहोश/i},
  {id:'bleeding',pattern:/uncontrolled bleeding|severe bleeding|बहुत खून/i},
  {id:'seizure',pattern:/seizure (?:lasting|for) (?:[5-9]|\d{2,}) minutes|repeated seizures|ongoing seizure/i},
  {id:'stroke-signs',pattern:/sudden.{0,30}(?:one.side.{0,15}weakness|facial droop|trouble speaking)/i},
]
export function reportedRedFlags(text) {
  const clauses = text.split(/[,.;!?।\n]|\bbut\b|लेकिन/)
  return redFlagRules.filter(rule=>clauses.some(clause=>{
    const match=rule.pattern.exec(clause)
    if(!match)return false
    const before=clause.slice(0,match.index),after=clause.slice(match.index+match[0].length)
    return !(/\b(?:no|not|without|denies|history of)\s*(?:any\s*)?$/i.test(before) || /^\s*(?:नहीं|नही|nahi)/i.test(after))
  })).map(rule=>rule.id)
}

export function hasConcerningSweating(text) {
 return text.split(/[,.;!?।\n]|\bbut\b|लेकिन/).some(clause=>{
  const match=/sweat\w*|पसीना|pasina|paseena/i.exec(clause)
  return match && !(/\b(?:no|not|without|denies)\s*(?:any\s*)?$/i.test(clause.slice(0,match.index)) || /^\s*(?:नहीं|nahi)/i.test(clause.slice(match.index+match[0].length)))
 })
}
