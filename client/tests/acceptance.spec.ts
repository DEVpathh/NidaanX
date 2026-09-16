import {test,expect,Page} from '@playwright/test'
async function open(page:Page){await page.goto('/');await page.getByRole('button',{name:'Please tap to awake the kiosk'}).click();await expect(page.locator('.wake-screen')).toHaveCount(0);await page.getByRole('button',{name:'आवाज़ चालू',exact:true}).click();await page.getByRole('combobox',{name:'Language / भाषा'}).selectOption('English')}
async function finishHistory(page:Page) {
 await expect(page.getByRole('button',{name:'I am an Existing Patient'})).toHaveCount(0)
 await page.locator('#complaint').fill('Headache for 2 days');await page.getByRole('button',{name:'Continue',exact:true}).click()
 for(let i=0;i<40;i++){
  await expect(page.locator('.conversation-card')).toHaveAttribute('aria-busy','false')
  if(await page.getByRole('button',{name:'Continue to login',exact:true}).isVisible()){await page.getByRole('button',{name:'Continue to login',exact:true}).click();return}
  const choices=page.locator('.answer-options button'),no=page.locator('.answer-options').getByRole('button',{name:'No',exact:true});let button
  if(await choices.count())button=await no.count()?no:choices.first()
  else if(await page.locator('.severity-scale').isVisible())button=page.locator('.severity-scale').getByRole('button',{name:'4',exact:true})
  else{await page.locator('.question-answer textarea').fill('No other issues');button=page.getByRole('button',{name:'Save answer',exact:true})}
  await Promise.all([page.waitForResponse(r=>r.url().includes('/intake/questions')&&r.status()===200),button.click()])
 }
 throw new Error('History did not complete')
}
for(const method of ['Phone + OTP','ABHA ID','Aadhaar Number / Card'])test(`existing patient ${method} and meaningful history`,async({page})=>{
 await open(page);await finishHistory(page);await page.getByRole('button',{name:'I am an Existing Patient'}).click();await page.getByRole('button',{name:method,exact:true}).click()
 if(method==='Phone + OTP'){await page.getByLabel('Phone Number',{exact:true}).fill('9876543210');await page.getByRole('button',{name:'Request OTP',exact:true}).click();await page.getByLabel('OTP',{exact:true}).fill('123456')}
 else await page.getByLabel(method==='ABHA ID'?'ABHA ID':'Aadhaar Number',{exact:true}).fill(method==='ABHA ID'?'91-2345-6789-0123':'9999 8888 7777')
 await page.getByRole('button',{name:'Open patient record'}).click();await expect(page.locator('.patient-match')).toContainText('Arjun Mehta');await expect(page.locator('.patient-match')).not.toContainText('9999 8888');await page.getByText('My previous medical history',{exact:true}).click();await expect(page.locator('.document-timeline')).toContainText('Metformin 500 mg');await expect(page.locator('.document-timeline')).toContainText('7.8%')
})
test('doctor sees confidence, corrects a field, and reload retains assurance',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Doctor',exact:true}).click();await page.getByRole('textbox',{name:'Search patients'}).fill('Arjun Mehta');await page.locator('.queue-item').first().click()
 const low=page.locator('.ocr-entry').filter({hasText:'Once daily?'}).first();await expect(low).toContainText('62%');await expect(low).toContainText('Doctor review required');await low.getByRole('button',{name:'Review / correct'}).click();await low.locator('input').fill('Once daily');await low.getByRole('button',{name:'Confirm as doctor'}).click();await expect(page.locator('.document-timeline')).toContainText('Doctor confirmed');await page.screenshot({path:'artifacts/doctor-timeline.png',fullPage:true})
 await page.reload();await page.getByRole('button',{name:'Please tap to awake the kiosk'}).click();await expect(page.locator('.wake-screen')).toHaveCount(0);await page.getByRole('combobox',{name:'Language / भाषा'}).selectOption('English');await page.getByRole('button',{name:'Doctor',exact:true}).click();await page.getByRole('textbox',{name:'Search patients'}).fill('Arjun Mehta');await page.locator('.queue-item').first().click();await expect(page.locator('.document-timeline')).toContainText('Doctor confirmed')
})
test('fever continues, ENT regions select, theme transitions repeat and mobile fits',async({page})=>{
 await open(page)
 for(const id of ['eyes','ears','nose','tongue']){const button=page.locator(`button[data-body-location="${id}"]`);await button.click();await expect(button).toHaveAttribute('aria-pressed','true')}
 await page.getByRole('button',{name:'Clear all',exact:true}).click();await page.locator('#complaint').fill('I have fever');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#current-question')).toContainText('fever');await expect(page.locator('.emergency-screen')).toHaveCount(0)
 for(let i=0;i<3;i++){await page.getByRole('button',{name:'AYUSH',exact:true}).click();await expect(page.locator('.app-shell')).toHaveClass(/ayush-mode/);await expect(page.locator('.mode-transition[data-mode=ayush]')).toBeVisible();expect(await page.locator('.mode-transition-logo').evaluate(e=>e.getAnimations().some(a=>a.playState==='running'))).toBeTruthy();await expect.poll(()=>page.locator('.app-shell').evaluate(e=>getComputedStyle(e).getPropertyValue('--brand').trim())).toBe('rgb(35, 130, 70)');await page.getByRole('button',{name:'Allopathy',exact:true}).click();await expect.poll(()=>page.locator('.app-shell').evaluate(e=>getComputedStyle(e).getPropertyValue('--brand').trim())).toBe('rgb(19, 110, 209)')}
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'artifacts/fever-mobile.png',fullPage:true})
})
test('AYUSH interview reaches a separate persisted doctor summary',async({page})=>{
 await open(page);const name=`AYUSH Browser ${Date.now()}`;await page.getByRole('button',{name:'AYUSH',exact:true}).click();await page.locator('#complaint').fill('Headache for 3 days');await page.getByRole('button',{name:'Continue',exact:true}).click()
 const prompts:string[]=[]
 for(let i=0;i<45;i++){
  await expect(page.locator('.conversation-card')).toHaveAttribute('aria-busy','false')
  if(await page.getByRole('button',{name:'Continue to login',exact:true}).isVisible())break
  prompts.push(await page.locator('#current-question').innerText())
  const choices=page.locator('.answer-options button'),no=page.locator('.answer-options').getByRole('button',{name:'No',exact:true})
  let button
  if(await choices.count())button=await no.count()?no:choices.first()
  else if(await page.locator('.severity-scale').isVisible())button=page.locator('.severity-scale').getByRole('button',{name:'4',exact:true})
  else {await page.locator('.question-answer textarea').fill('Patient reports usual routine');button=page.getByRole('button',{name:'Save answer',exact:true})}
  await Promise.all([page.waitForResponse(r=>r.url().includes('/intake/questions')&&r.status()===200),button.click()])
 }
 expect(prompts.some(p=>p.includes('body build'))).toBeTruthy();expect(prompts.some(p=>p.includes('appetite and digestion'))).toBeTruthy();expect(prompts.some(p=>p.includes('pass stool'))).toBeTruthy()
 await page.getByRole('button',{name:'Continue to login',exact:true}).click();await page.getByRole('button',{name:'I am a New Patient'}).click();await page.getByLabel('Full Name',{exact:true}).fill(name);await page.getByLabel('Age',{exact:true}).fill('42');await page.getByLabel('Phone Number',{exact:true}).fill('9876543212');await page.getByRole('button',{name:'Register & continue'}).click();await page.getByLabel('Use my answers to prepare today’s visit',{exact:true}).check();await page.getByLabel('Share my visit summary with the care team',{exact:true}).check();await page.getByRole('button',{name:'Save permissions',exact:true}).click();await page.getByRole('button',{name:'Review & Submit',exact:true}).click();await page.getByRole('button',{name:'Send to doctor & get token',exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Doctor',exact:true}).click();await page.getByRole('textbox',{name:'Search patients'}).fill(name);await page.locator('.queue-item').first().click();await expect(page.locator('.ayush-history')).toContainText('AYUSH / Ayurvedic History');await expect(page.locator('.ayush-history')).toContainText('Patient reports usual routine');await expect(page.locator('.ayush-history')).not.toContainText('Dominant');await expect(page.locator('div.clinical-fields')).toContainText('Headache for 3 days');await page.screenshot({path:'artifacts/ayush-summary.png',fullPage:true})
})
test('reduced motion skips pathway animation and retains the chosen theme',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page)
 await page.getByRole('button',{name:'AYUSH',exact:true}).click();await expect(page.locator('.app-shell')).toHaveClass(/ayush-mode/);await expect(page.locator('.mode-transition')).toHaveCount(0)
 await page.getByRole('button',{name:'Allopathy',exact:true}).click();await expect(page.locator('.app-shell')).not.toHaveClass(/ayush-mode/);await expect(page.locator('.mode-transition')).toHaveCount(0)
})
