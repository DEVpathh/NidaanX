import React from 'react'
import { Printer, CheckCircle, QrCode, X } from 'lucide-react'
import type { CaseDraft } from '../types/clinical'

interface TokenReceiptModalProps {
  caseData: CaseDraft
  language: string
  onClose: () => void
}

export const TokenReceiptModal: React.FC<TokenReceiptModalProps> = ({ caseData, language, onClose }) => {
  const hi = language !== 'English'

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '420px',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            padding: '0.4rem',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <CheckCircle size={44} style={{ color: '#16a34a', margin: '0 auto 0.5rem' }} />
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            {hi ? 'पंजीकरण सफल!' : 'Registration Successful!'}
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            {hi ? 'आपका टोकन नंबर तैयार है' : 'Your OPD Consultation Token is Ready'}
          </p>
        </div>

        {/* Printable Ticket */}
        <div
          id="printable-ticket"
          style={{
            background: '#f8fafc',
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '1.25rem',
            textAlign: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {caseData.pathway === 'ayush' ? 'AYUSH OPD Token' : 'Allopathy OPD Token'}
          </div>

          <div
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: caseData.triageLevel === 'red' ? '#dc2626' : caseData.triageLevel === 'yellow' ? '#d97706' : '#0284c7',
              margin: '0.5rem 0',
            }}
          >
            {caseData.token || 'A-001'}
          </div>

          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
            {caseData.patient?.displayName || 'Patient Name'}
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            {caseData.patient?.opd || 'General OPD'} · ABHA: {caseData.patient?.abhaId || '14-23-45-67-89-01'}
          </div>

          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
            
          >
            <QrCode size={40} style={{ color: '#334155' }} />
            <div style={{ textAlign: 'left', fontSize: '0.75rem', color: '#64748b' }}>
              <div>Scan for Live Status</div>
              <strong style={{ color: '#0f172a' }}>NidaanX ABDM Kiosk</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button
            onClick={handlePrint}
            className="secondary-button"
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
            }}
          >
            <Printer size={18} />
            <span>{hi ? 'प्रिंट लें' : 'Print Slip'}</span>
          </button>

          <button
            onClick={onClose}
            className="primary-button"
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span>{hi ? 'समाप्त करें' : 'Done / Reset'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
