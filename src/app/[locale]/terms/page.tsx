// Terms of Service page — Romanian.
// Route: /ro/terms and /en/terms (public, no auth required).

interface Props {
  params: Promise<{ locale: string }>
}

const LAST_UPDATED = '1 aprilie 2026'

export default async function TermsPage({ params }: Props) {
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
          <a href={`/${locale}/privacy`} style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>
            Politică de confidențialitate →
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
            Termeni și condiții de utilizare
          </h1>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            Ultima actualizare: {LAST_UPDATED}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <Section title="1. Acceptarea termenilor">
            <p>Prin crearea unui cont și utilizarea OrarPro, ești de acord cu acești Termeni și Condiții. Dacă nu ești de acord, te rugăm să nu utilizezi serviciul.</p>
            <p style={{ marginTop: '8px' }}>Acești termeni constituie un acord între tine (utilizatorul) și operatorul OrarPro (<strong>[ENTITATE LEGALĂ — de completat]</strong>).</p>
          </Section>

          <Section title="2. Descrierea serviciului">
            <p>OrarPro este o platformă SaaS (Software as a Service) care oferă:</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Generare automată de orare prin algoritmi de optimizare (CP-SAT, greedy)</li>
              <li>Gestionarea angajaților, turelor și constrângerilor</li>
              <li>Analiză și sugestii bazate pe inteligență artificială</li>
              <li>Export și publicare orar</li>
            </ul>
            <p style={{ marginTop: '10px' }}>Serviciul este furnizat „ca atare" (<em>as-is</em>) în perioada beta, fără garanții privind disponibilitatea continuă sau acuratețea algoritmilor.</p>
          </Section>

          <Section title="3. Contul tău">
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Ești responsabil pentru securitatea contului tău și a parolei</li>
              <li>Nu poți transfera contul unui terț</li>
              <li>Trebuie să ai cel puțin 18 ani sau să fi obținut consimțământul unui tutore legal</li>
              <li>Trebuie să furnizezi informații corecte la înregistrare</li>
              <li>Ne rezervăm dreptul de a suspenda conturile care încalcă acești termeni</li>
            </ul>
          </Section>

          <Section title="4. Utilizare acceptabilă">
            <p>Prin utilizarea OrarPro, te angajezi să <strong>nu</strong>:</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Utiliza serviciul în scopuri ilegale sau frauduloase</li>
              <li>Introduce date false sau înșelătoare despre angajați sau organizație</li>
              <li>Încerca să accesezi datele altor organizații</li>
              <li>Supraîncărca sau perturba infrastructura serviciului</li>
              <li>Reverse-engineer sau copia codul sursă al aplicației</li>
              <li>Revinde sau sublicenția accesul la serviciu fără acord scris</li>
            </ul>
          </Section>

          <Section title="5. Date și proprietate intelectuală">
            <p><strong>Datele tale:</strong> Îți aparțin în totalitate. Prin utilizarea serviciului, ne acorzi o licență limitată de procesare a datelor exclusiv pentru furnizarea serviciului.</p>
            <p style={{ marginTop: '10px' }}><strong>Algoritmii și codul:</strong> Algoritmii de generare, interfața și codul OrarPro ne aparțin și sunt protejați de legile privind proprietatea intelectuală.</p>
            <p style={{ marginTop: '10px' }}><strong>Date anonimizate:</strong> Ne rezervăm dreptul de a folosi date agregate și anonimizate (fără identificare personală) pentru îmbunătățirea serviciului.</p>
          </Section>

          <Section title="6. Disponibilitate și limitări">
            <p>Ne străduim să menținem serviciul disponibil, dar:</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Nu garantăm disponibilitate 100% — pot exista întreruperi pentru mentenanță</li>
              <li>Algoritmii de generare produc soluții optime sau fezabile, dar nu garantăm satisfacerea tuturor constrângerilor în orice situație</li>
              <li>Funcționalitățile se pot schimba în perioada beta</li>
            </ul>
          </Section>

          <Section title="7. Răspundere">
            <p>În limitele permise de legea română:</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Nu suntem răspunzători pentru daune indirecte sau pierderi de profit rezultate din utilizarea sau imposibilitatea utilizării serviciului</li>
              <li>Răspunderea noastră totală față de tine nu va depăși suma plătită de tine în ultimele 3 luni (sau 0 RON în perioada beta gratuită)</li>
              <li>Nu suntem răspunzători pentru deciziile de resurse umane luate pe baza orarelor generate</li>
            </ul>
          </Section>

          <Section title="8. Suspendare și reziliere">
            <p><strong>Tu poți:</strong> șterge contul oricând din Setări → Șterge cont. Datele vor fi șterse în 30 de zile.</p>
            <p style={{ marginTop: '8px' }}><strong>Noi putem:</strong> suspenda sau închide contul tău dacă încalci acești termeni, cu notificare prin email (cu excepția cazurilor de fraudă sau activitate ilegală).</p>
          </Section>

          <Section title="9. Modificări ale termenilor">
            <p>Putem modifica acești termeni cu notificare de minimum 14 zile prin email sau în aplicație. Continuarea utilizării serviciului după această perioadă constituie acceptul noilor termeni.</p>
          </Section>

          <Section title="10. Legea aplicabilă">
            <p>Acești termeni sunt guvernați de legea română. Orice litigiu se va soluționa pe cale amiabilă sau, în lipsa unui acord, la instanțele competente din România.</p>
          </Section>

          <Section title="11. Contact">
            <p>
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