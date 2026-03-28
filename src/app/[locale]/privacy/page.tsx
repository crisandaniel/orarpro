// Privacy Policy page — Romanian, GDPR compliant.
// Placeholder [ENTITATE LEGALĂ] to be filled when legal entity is established.
// Route: /ro/privacy and /en/privacy (public, no auth required).

import { getTranslations } from 'next-intl/server'

interface Props {
  params: Promise<{ locale: string }>
}

const LAST_UPDATED = '1 aprilie 2026'

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e5e7eb' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href={`/${locale}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>O</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>OrarPro</span>
          </a>
          <a href={`/${locale}/terms`} style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>
            Termeni și condiții →
          </a>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Document legal
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
            Politică de confidențialitate
          </h1>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            Ultima actualizare: {LAST_UPDATED}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <Section title="1. Cine suntem">
            <p>OrarPro este un serviciu de generare automată a orarelor destinat companiilor din sectorul HoReCa, fabricilor, unităților de retail și instituțiilor de învățământ.</p>
            <p style={{ marginTop: '8px' }}>Datele tale sunt procesate de operatorul OrarPro (<strong>[ENTITATE LEGALĂ — de completat]</strong>). Până la înregistrarea entității legale, poți lua legătura cu noi la adresa: <a href={`/${locale}/contact`} style={{ color: '#2563eb' }}>formularul de contact</a>.</p>
          </Section>

          <Section title="2. Ce date colectăm">
            <p>Colectăm doar datele necesare pentru funcționarea serviciului:</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>Date de cont:</strong> adresă email, nume (opțional), fotografie de profil (din Google, dacă folosești autentificarea Google)</li>
              <li><strong>Date organizație:</strong> numele companiei, tipul de abonament</li>
              <li><strong>Date angajați:</strong> nume, nivel de experiență, disponibilitate — introduse de tine</li>
              <li><strong>Date de utilizare:</strong> orare generate, asignări, constrângeri configurate</li>
              <li><strong>Date tehnice:</strong> adresă IP, tip browser — colectate automat de infrastructura Supabase și Vercel</li>
            </ul>
          </Section>

          <Section title="3. De ce procesăm datele tale">
            <p>Procesăm datele pe baza <strong>contractului</strong> dintre tine și OrarPro (art. 6(1)(b) GDPR) pentru:</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Autentificarea și gestionarea contului tău</li>
              <li>Generarea și stocarea orarelor</li>
              <li>Afișarea statisticilor și rapoartelor</li>
            </ul>
            <p style={{ marginTop: '10px' }}>Pe baza <strong>interesului legitim</strong> (art. 6(1)(f) GDPR):</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Îmbunătățirea algoritmului de generare</li>
              <li>Prevenirea abuzurilor și fraudei</li>
            </ul>
            <p style={{ marginTop: '10px' }}>Pe baza <strong>consimțământului</strong> tău (art. 6(1)(a) GDPR):</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Comunicări de marketing (dacă ai bifat opțiunea)</li>
            </ul>
          </Section>

          <Section title="4. Cu cine împărtășim datele">
            <p>Nu vindem datele tale. Le transmitem doar furnizorilor de servicii necesari pentru funcționarea OrarPro:</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>Supabase</strong> (SUA — bază de date, autentificare) — date protejate prin Clauze Contractuale Standard UE</li>
              <li><strong>Vercel</strong> (SUA — hosting) — date protejate prin Clauze Contractuale Standard UE</li>
              <li><strong>Google</strong> (SUA — autentificare OAuth) — dacă folosești „Conectare cu Google"</li>
              <li><strong>Anthropic</strong> (SUA — analiză AI orare) — date anonimizate, fără date personale ale angajaților</li>
            </ul>
          </Section>

          <Section title="5. Cât timp păstrăm datele">
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Date de cont: pe durata utilizării serviciului + 30 de zile după ștergerea contului</li>
              <li>Orare și asignări: până la ștergerea manuală sau a contului</li>
              <li>Jurnale tehnice: maximum 30 de zile</li>
            </ul>
          </Section>

          <Section title="6. Drepturile tale (GDPR)">
            <p>Conform Regulamentului (UE) 2016/679, ai dreptul la:</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>Acces</strong> — să primești o copie a datelor tale</li>
              <li><strong>Rectificare</strong> — să corectezi datele inexacte</li>
              <li><strong>Ștergere</strong> — să solicite ștergerea datelor („dreptul de a fi uitat")</li>
              <li><strong>Restricție</strong> — să limitezi procesarea în anumite situații</li>
              <li><strong>Portabilitate</strong> — să primești datele în format structurat (JSON/CSV)</li>
              <li><strong>Opoziție</strong> — față de procesarea bazată pe interes legitim</li>
              <li><strong>Retragerea consimțământului</strong> — oricând, pentru procesările bazate pe consimțământ</li>
            </ul>
            <p style={{ marginTop: '12px' }}>Pentru a-ți exercita drepturile, scrie-ne la <a href={`/${locale}/contact`} style={{ color: '#2563eb' }}>formularul de contact</a>. Răspundem în maximum 30 de zile.</p>
            <p style={{ marginTop: '8px' }}>Ai și dreptul de a depune o plângere la <strong>ANSPDCP</strong> (Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal): <a href="https://www.dataprotection.ro" style={{ color: '#2563eb' }} target="_blank" rel="noopener">dataprotection.ro</a>.</p>
          </Section>

          <Section title="7. Cookie-uri">
            <p>OrarPro folosește exclusiv cookie-uri funcționale necesare pentru autentificare (sesiune Supabase). Nu folosim cookie-uri de tracking sau publicitate.</p>
          </Section>

          <Section title="8. Securitate">
            <p>Datele tale sunt stocate criptat (în tranzit via HTTPS, în repaus în baza de date Supabase). Accesul la date este restricționat prin Row-Level Security (RLS) — fiecare utilizator vede doar datele organizației sale.</p>
          </Section>

          <Section title="9. Modificări ale politicii">
            <p>Vom notifica utilizatorii cu privire la modificările importante prin email sau prin mesaj în aplicație. Versiunile anterioare ale politicii sunt disponibile la cerere.</p>
          </Section>

          <Section title="10. Contact">
            <p>Pentru orice întrebare legată de confidențialitate:</p>
            <p style={{ marginTop: '8px' }}>
              <strong>OrarPro</strong><br />
              Email: <a href={`/${locale}/contact`} style={{ color: '#2563eb' }}>formularul de contact</a><br />
              Website: <a href="https://www.orarpro.ro" style={{ color: '#2563eb' }}>www.orarpro.ro</a>
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '10px', paddingBottom: '8px', borderBottom: '0.5px solid #f3f4f6' }}>
        {title}
      </h2>
      <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.7' }}>
        {children}
      </div>
    </div>
  )
}