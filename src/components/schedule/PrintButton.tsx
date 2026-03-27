'use client'

// Client component for the Download PDF button on the print preview page.
// Calls window.print() which triggers the browser's Save as PDF dialog.
// Used by: schedules/[id]/print/page.tsx.

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 18px', borderRadius: '8px', border: 'none',
        cursor: 'pointer', background: '#2563eb', color: 'white',
        fontSize: '13px', fontWeight: 500,
      }}
    >
      ⬇ Descarcă PDF
    </button>
  )
}