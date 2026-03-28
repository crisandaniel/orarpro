'use client'

// Public contact page — no authentication required.
// Accessible at /ro/contact and /en/contact.
// Used by: privacy policy and terms of service pages.

import { useState } from 'react'
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react'

export default function PublicContactPage() {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !message) return
    setLoading(true)
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
    } catch { /* ignore */ }
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e5e7eb' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>O</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>OrarPro</span>
          </a>
          <a href="/ro/login" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none' }}>
            Autentificare →
          </a>
        </div>
      </div>

      {/* Form */}
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
            Contact
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
            Întrebări despre confidențialitate, termeni sau orice altceva — îți răspundem în cel mai scurt timp.
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '0.5px solid #e5e7eb' }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle style={{ width: '40px', height: '40px', color: '#059669', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '15px', fontWeight: 500, color: '#111827', marginBottom: '6px' }}>
                Mesaj trimis!
              </p>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>
                Îți mulțumim. Te vom contacta în curând.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                    Nume
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ion Popescu"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '8px',
                      border: '0.5px solid #d1d5db', fontSize: '14px',
                      color: '#111827', background: '#fff', boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                    Email <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ion@exemplu.ro"
                    required
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '8px',
                      border: '0.5px solid #d1d5db', fontSize: '14px',
                      color: '#111827', background: '#fff', boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Mesaj <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Descrie pe scurt cu ce te putem ajuta..."
                  required
                  rows={5}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '8px',
                    border: '0.5px solid #d1d5db', fontSize: '14px',
                    color: '#111827', background: '#fff', boxSizing: 'border-box',
                    outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email || !message}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '10px 20px', borderRadius: '8px', border: 'none',
                  background: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: 500,
                  cursor: loading || !email || !message ? 'not-allowed' : 'pointer',
                  opacity: loading || !email || !message ? 0.5 : 1,
                }}
              >
                {loading ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : <ArrowRight style={{ width: '16px', height: '16px' }} />}
                Trimite mesajul
              </button>
            </form>
          )}
        </div>

        <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>
          Datele tale sunt procesate conform{' '}
          <a href="/ro/privacy" style={{ color: '#6b7280' }}>Politicii de confidențialitate</a>.
        </p>
      </div>
    </div>
  )
}