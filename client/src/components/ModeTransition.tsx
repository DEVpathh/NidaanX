import { useEffect, useRef, type RefObject } from 'react'
import { BrandLogo } from './BrandLogo'

// Reuse the wake-screen's logo-to-header motion for both care pathways.
export function ModeTransition({target, ayush, language, onDone}:{target:RefObject<HTMLImageElement>;ayush:boolean;language:string;onDone:()=>void}) {
  const logo=useRef<HTMLImageElement>(null)
  useEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){onDone();return}
    const destination=target.current?.getBoundingClientRect(), source=logo.current?.getBoundingClientRect()
    if(!destination||!source||!logo.current?.animate){onDone();return}
    const x=destination.x+destination.width/2-source.x-source.width/2
    const y=destination.y+destination.height/2-source.y-source.height/2
    const animation=logo.current.animate([
      {transform:'translate(0, 12px) scale(.75)',opacity:0,offset:0},
      {transform:'translate(0, 0) scale(1)',opacity:1,offset:.25},
      {transform:`translate(${x}px, ${y}px) scale(${destination.width/source.width})`,opacity:1,offset:.92},
      {transform:`translate(${x}px, ${y}px) scale(${destination.width/source.width})`,opacity:0,offset:1},
    ],{duration:950,easing:'cubic-bezier(.65,0,.2,1)',fill:'forwards'})
    animation.onfinish=onDone
    return()=>{animation.onfinish=null;animation.cancel()}
  },[target,onDone])
  return <div className="mode-transition" data-mode={ayush?'ayush':'general'} aria-hidden="true"><BrandLogo ref={logo} className="mode-transition-logo"/><span className="mode-transition-label">{ayush?(language==='English'?'AYUSH':'आयुष'):(language==='English'?'Allopathy':'एलोपैथी')}</span></div>
}
