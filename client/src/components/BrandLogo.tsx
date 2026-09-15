import { forwardRef } from 'react'

export const BrandLogo = forwardRef<HTMLImageElement, { className?: string }>(({ className = '' }, ref) => (
  <img ref={ref} src="/images/carex-logo.png" alt="NidaanX — care for you" className={`brand-logo ${className}`} draggable={false}/>
))
BrandLogo.displayName = 'BrandLogo'
