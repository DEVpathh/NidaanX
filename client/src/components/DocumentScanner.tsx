import { OcrConfidence } from './OcrConfidence'
import { useEffect, useRef, useState } from 'react'
import { Camera, Check, LoaderCircle, RotateCw, Trash2, X } from 'lucide-react'
import type { UploadedDocument } from '../types/clinical'
import { apiRequest } from '../services/apiClient'
import { defaultCorners, detectDocument, rectify, rotatePage, type Point } from '../shared/scanning/documentImage'
import './records.css'
type Props = { language: string; patientId: string; active?: boolean; onBusyChange?: (busy: boolean) => void; documents: UploadedDocument[]; onAddDocument: (doc: UploadedDocument) => void; onRemoveDocument: (id: string) => void }
export function DocumentScanner({ language, patientId, active = true, onBusyChange, documents, onAddDocument, onRemoveDocument }: Props) {
  const hi=language!=='English',t=(h:string,e:string)=>hi?h:e
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),generation=useRef(0),canvas=useRef<HTMLCanvasElement|null>(null),original=useRef('')
  const [phase,setPhase]=useState<'idle'|'camera'|'crop'|'ocr'|'review'>('idle'),[image,setImage]=useState(''),[corners,setCorners]=useState<Point[]>(defaultCorners),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [pollRound,setPollRound]=useState(0)
  const [adjusting,setAdjusting]=useState(false),[autoDetected,setAutoDetected]=useState(false)
  const [liveCorners,setLiveCorners]=useState<Point[]|null>(null),[videoSize,setVideoSize]=useState({width:0,height:0})
  const [fileType,setFileType]=useState<UploadedDocument['fileType']>('prescription'),[review,setReview]=useState<UploadedDocument|null>(null),[text,setText]=useState(''),[date,setDate]=useState(''),[confirmed,setConfirmed]=useState(false)
  useEffect(()=>{onBusyChange?.(phase!=='idle'||busy);return()=>onBusyChange?.(false)},[phase,busy,onBusyChange])
  const stop=()=>{generation.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null}
  useEffect(()=>()=>stop(),[])
  useEffect(()=>{if(!active){stop();setPhase(p=>p==='camera'?'idle':p)}},[active])
  useEffect(()=>{if(phase==='camera'&&video.current&&stream.current){video.current.srcObject=stream.current;void video.current.play().catch(()=>setError(t('कैमरा शुरू नहीं हुआ। फिर प्रयास करें।','Camera could not start. Please retry.')))}},[phase])
  useEffect(()=>{
    if(phase!=='camera'||!active)return
    const sample=document.createElement('canvas')
    const timer=window.setInterval(()=>{
      const source=video.current
      if(!source?.videoWidth||source.readyState<2)return
      const scale=Math.min(1,480/Math.max(source.videoWidth,source.videoHeight))
      sample.width=Math.round(source.videoWidth*scale);sample.height=Math.round(source.videoHeight*scale)
      sample.getContext('2d')!.drawImage(source,0,0,sample.width,sample.height)
      const result=detectDocument(sample)
      setLiveCorners(result&&result.confidence>=.65?result.corners:null)
    },600)
    return()=>window.clearInterval(timer)
  },[phase,active])
  useEffect(()=>{
    if(phase!=='ocr'||!review)return
    let cancelled=false,attempts=0
    const timer=window.setInterval(async()=>{
      if(++attempts>100){window.clearInterval(timer);if(!cancelled){setError(t('स्कैन में समय लग रहा है। फिर स्थिति देखें।','OCR is taking longer. Check its status again.'));setBusy(false)}return}
      try{const doc=await apiRequest<UploadedDocument>(`/api/v1/documents/${review.id}/ocr`);if(!cancelled&&doc.ocrStatus!=='processing'){setReview(doc);setText(doc.extractedText);setDate('');setPhase('review');setBusy(false);window.clearInterval(timer)}}catch{if(!cancelled)setError(t('स्कैन की स्थिति नहीं मिली। कनेक्शन जांचें।','Could not check the scan. Check the connection.'))}
    },1500)
    return()=>{cancelled=true;window.clearInterval(timer)}
  },[phase,review?.id,pollRound])
  const start=async()=>{
    stop();const token=generation.current;setError('');setBusy(true);setLiveCorners(null);setVideoSize({width:0,height:0})
    try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera requires localhost or HTTPS.')
      const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}},audio:false})
      if(token!==generation.current){media.getTracks().forEach(track=>track.stop());return}stream.current=media;setPhase('camera')
    }catch{if(token===generation.current)setError(t('कैमरा नहीं खुला। कैमरे की अनुमति दें और फिर कोशिश करें, या स्टाफ की मदद लें।','Camera unavailable. Allow camera access and retry, or ask staff for help.'))}finally{setBusy(false)}
  }
  const capture=()=>{
    if(!video.current?.videoWidth)return
    const c=document.createElement('canvas');const scale=Math.min(1,2400/video.current.videoWidth);c.width=Math.round(video.current.videoWidth*scale);c.height=Math.round(video.current.videoHeight*scale);c.getContext('2d')!.drawImage(video.current,0,0,c.width,c.height)
    canvas.current=c;original.current=c.toDataURL('image/jpeg',.92)
    const result=detectDocument(c),found=!!result&&result.confidence>=.65
    const pageCorners=found?result.corners:defaultCorners()
    setCorners(pageCorners);setAutoDetected(found);setError('')
    if(found){
      try{setImage(rectify(c,pageCorners).toDataURL('image/jpeg',.94));setAdjusting(false)}
      catch{setImage(original.current);setAdjusting(true);setAutoDetected(false)}
    }else{setImage(original.current);setAdjusting(true)}
    stop();setPhase('crop')
  }
  const preview=()=>{
    if(!canvas.current)return
    try{setImage(rectify(canvas.current,corners).toDataURL('image/jpeg',.94));setAdjusting(false);setError('')}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not straighten the page.')}
  }
  const rotate=()=>{
    if(!canvas.current)return
    canvas.current=rotatePage(canvas.current)
    // Keep the selected physical page when rotating, including manual adjustments.
    const rotated=corners.map(p=>({x:1-p.y,y:p.x}))
    const ordered=[rotated[3]!,rotated[0]!,rotated[1]!,rotated[2]!]
    setCorners(ordered);setError('')
    if(adjusting)setImage(canvas.current.toDataURL('image/jpeg',.92))
    else try{setImage(rectify(canvas.current,ordered).toDataURL('image/jpeg',.94))}
    catch{setImage(canvas.current.toDataURL('image/jpeg',.92));setAdjusting(true)}
  }
  const scan=async()=>{
    if(!canvas.current)return
    setBusy(true);setError('')
    try{const corrected=rectify(canvas.current,corners).toDataURL('image/jpeg',.94);setImage(corrected);setAdjusting(false)
      const doc=await apiRequest<UploadedDocument>('/api/v1/documents/scan',{method:'POST',body:JSON.stringify({patientId,image:corrected,originalImage:original.current,fileType})});setReview(doc);setPhase('ocr');setConfirmed(false)
    }catch(cause){if(canvas.current){setImage(canvas.current.toDataURL('image/jpeg',.92));setAdjusting(true)}setError(cause instanceof Error?cause.message:'Scan failed.')}finally{setBusy(false)}
  }
  const discard=async()=>{stop();if(review)await apiRequest(`/api/v1/documents/${review.id}`,{method:'DELETE'}).catch(()=>{});setReview(null);setImage('');setPhase('idle');setError('')}
  const save=async()=>{if(!review)return;setBusy(true);try{const doc=await apiRequest<UploadedDocument>(`/api/v1/documents/${review.id}`,{method:'PATCH',body:JSON.stringify({extractedText:text,documentDate:date||null,reviewed:true})});onAddDocument(doc);setPhase('idle');setReview(null);setImage('')}catch(cause){setError(cause instanceof Error?cause.message:'Could not save scan.')}finally{setBusy(false)}}
  return <section className="document-scanner"><h2><Camera/> {t('कैमरे से रिपोर्ट स्कैन करें','Scan records with the camera')}</h2><p>{t('एक बार में एक पन्ना कैमरे के सामने रखें। किसी भी क्रम में स्कैन करें; डॉक्टर की समयरेखा रिपोर्ट की तारीख से बनेगी।','Place one page in front of the camera. Scan in any order; the doctor’s timeline uses the report date.')}</p>
    {error&&<p role="alert" className="inline-error">{error}</p>}
    {phase==='idle'&&<><label>{t('दस्तावेज़ का प्रकार','Document type')}<select value={fileType} onChange={e=>setFileType(e.target.value as UploadedDocument['fileType'])}><option value="prescription">{t('पर्चा','Prescription')}</option><option value="lab_report">{t('लैब रिपोर्ट','Lab report')}</option><option value="discharge_summary">{t('डिस्चार्ज सारांश','Discharge summary')}</option><option value="other">{t('अन्य रिकॉर्ड','Other record')}</option></select></label><button className="primary-button" disabled={busy} onClick={()=>void start()}><Camera/>{t('कैमरा खोलें','Open camera')}</button></>}
    {phase==='camera'&&<><div className="camera-frame" style={{aspectRatio:videoSize.width?`${videoSize.width} / ${videoSize.height}`:'4 / 3',maxWidth:videoSize.height?Math.min(720,650*videoSize.width/videoSize.height):720}}><video ref={video} muted autoPlay playsInline className="camera-preview" onLoadedMetadata={e=>setVideoSize({width:e.currentTarget.videoWidth,height:e.currentTarget.videoHeight})} onResize={e=>{setVideoSize({width:e.currentTarget.videoWidth,height:e.currentTarget.videoHeight});setLiveCorners(null)}}/>{liveCorners&&<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Detected page edges"><polygon points={liveCorners.map(p=>`${p.x*100},${p.y*100}`).join(' ')}/></svg>}</div><p role="status">{liveCorners?t('पन्ने के किनारे मिल गए हैं। स्थिर रखकर फोटो लें।','Page edges found. Hold still and capture.'):t('पूरा पन्ना कैमरे में रखें। चारों किनारे साफ दिखने चाहिए।','Keep the entire page in view with all four edges visible.')}</p><div className="record-actions"><button className="primary-button" disabled={!videoSize.width} onClick={capture}><Camera/>{t('पन्ने की फोटो लें','Capture page')}</button><button className="secondary-button" onClick={()=>void discard()}><X/>{t('रद्द करें','Cancel')}</button></div></>}
    {phase==='crop'&&<>
      <p role="status">{adjusting
        ? autoDetected?t('ज़रूरत हो तो बिंदुओं को पन्ने के कोनों पर खींचें।','Drag the handles only if the page corners need adjustment.'):t('पन्ने के किनारे साफ नहीं मिले। फिर फोटो लें या चारों कोने चुनें।','The page edges are unclear. Retake the photo or select the four corners.')
        :t('पन्ना सीधा कर दिया है। जांचें कि पूरा पन्ना दिख रहा है।','The page has been straightened. Check that the entire page is included.')}</p>
      {adjusting?<div className="crop-preview"><img src={image} alt={t('कैमरे से लिया पन्ना','Captured page')}/><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Page corners"><polygon points={corners.map(p=>`${p.x*100},${p.y*100}`).join(' ')}/>{corners.map((p,i)=><circle key={i} cx={p.x*100} cy={p.y*100} r="2.5" tabIndex={0} role="slider" aria-label={`Page corner ${i+1}`} aria-valuetext={`${Math.round(p.x*100)}, ${Math.round(p.y*100)}`} onKeyDown={e=>{const d:{[key:string]:Point}={ArrowLeft:{x:-.01,y:0},ArrowRight:{x:.01,y:0},ArrowUp:{x:0,y:-.01},ArrowDown:{x:0,y:.01}};if(d[e.key]){e.preventDefault();const delta=d[e.key]!;setCorners(old=>old.map((v,k)=>k===i?{x:Math.max(0,Math.min(1,v.x+delta.x)),y:Math.max(0,Math.min(1,v.y+delta.y))}:v))}}} onPointerDown={e=>e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const r=e.currentTarget.ownerSVGElement!.getBoundingClientRect();setCorners(old=>old.map((v,k)=>k===i?{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}:v))}} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)}/>)}</svg></div>
        :<img className="record-preview" src={image} alt={t('सीधा किया हुआ पन्ना','Straightened page')}/>}
      <div className="record-actions">
        <button className="secondary-button" disabled={busy} onClick={rotate}><RotateCw/>{t('घुमाएं','Rotate')}</button>
        {adjusting?<button className="secondary-button" disabled={busy} onClick={preview}>{t('सीधा पन्ना देखें','Preview straightened page')}</button>
          :<button className="secondary-button" disabled={busy} onClick={()=>{setImage(canvas.current!.toDataURL('image/jpeg',.92));setAdjusting(true)}}>{t('किनारे बदलें','Adjust corners')}</button>}
        <button className="primary-button" disabled={busy} onClick={()=>void scan()}>{busy?<LoaderCircle className="animate-spin"/>:<Check/>}{adjusting?t('सीधा करें और पढ़ें','Straighten & read'):t('पन्ने का टेक्स्ट पढ़ें','Read page')}</button>
        <button className="secondary-button" disabled={busy} onClick={()=>void start()}>{t('फिर फोटो लें','Retake')}</button>
      </div>
    </>}
    {phase==='ocr'&&<><img className="record-preview" src={image} alt="Straightened page"/><p role="status"><LoaderCircle className="animate-spin"/>{t('पन्ने का टेक्स्ट पढ़ रहे हैं…','Reading text from the page…')}</p><button className="secondary-button" onClick={()=>{setError('');setPollRound(n=>n+1)}}>{t('स्थिति फिर देखें','Check OCR again')}</button></>}
    {phase==='review'&&review&&<><img className="record-preview" src={image} alt={t('सीधा किया हुआ पन्ना','Straightened page')}/><p>{review.ocrMessage || t('हस्तलिखित दवाएं और अंक फोटो से मिलाकर जांचें। गलत या अस्पष्ट टेक्स्ट ठीक करें।','Check handwritten medicines and numbers against the scan. Correct unclear or incorrect text.')}</p><label>{t('पन्ने से पढ़ा गया टेक्स्ट','Text read from the page')}<textarea rows={8} value={text} onChange={e=>setText(e.target.value)}/></label><label>{t('रिपोर्ट की तारीख (न मिलने पर खाली छोड़ें)','Report date (leave blank if unknown)')}<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{!!review.dateCandidates.length&&<div className="record-actions">{review.dateCandidates.map(d=><button key={d.date} className="secondary-button" onClick={()=>setDate(d.date)}>{d.date} ({d.source})</button>)}</div>}<p>{t('एक से अधिक तारीख हो तो इस रिकॉर्ड की मुलाकात/जांच की तारीख चुनें।','If several dates appear, choose the visit/test date for this record.')}</p><OcrConfidence elements={review.elements} threshold={review.confidenceThreshold} language={language}/><label className="record-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{t('स्कैन और तारीख जांच ली है; जो नहीं पढ़ सका/सकी वह डॉक्टर देखेंगे।','I checked the scan and date; the doctor will review anything unreadable.')}</label><button className="primary-button" disabled={busy||!confirmed} onClick={()=>void save()}><Check/>{t('रिकॉर्ड जोड़ें','Add record')}</button></>}
    {phase!=='idle'&&phase!=='camera'&&<button className="secondary-button" disabled={busy} onClick={()=>void discard()}><X/>{t('यह स्कैन हटाएं','Discard scan')}</button>}
    {!!documents.length&&<ul className="scanned-list">{documents.map(doc=><li key={doc.id}><span>{doc.fileType.replace(/_/g,' ')} · {doc.documentDate||t('तारीख की पुष्टि बाकी','Date unknown')}</span><button aria-label={t('स्कैन हटाएं','Remove scan')} onClick={async()=>{try{await apiRequest(`/api/v1/documents/${doc.id}`,{method:'DELETE'});onRemoveDocument(doc.id)}catch{setError('Could not remove scan.')}}}><Trash2/></button></li>)}</ul>}
  </section>
}
