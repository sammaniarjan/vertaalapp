import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

interface SystemInfo {
  system: {
    platform: string;
    arch: string;
    cpu_count: number;
    ram_total_gb: number;
    ram_available_gb: number;
    ram_percent_used: number;
    disk_free_gb: number;
  };
  models: Record<string, string>;
  stt_engine: string;
  cache_size_mb: number | null;
}

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const openedAt = useRef(0);

  useEffect(() => {
    if (open) {
      openedAt.current = Date.now();
      setLoading(true);
      fetch('http://127.0.0.1:8001/api/system')
        .then((r) => r.json())
        .then((data) => setSysInfo(data))
        .catch(() => setSysInfo(null))
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const safeClose = () => {
    if (Date.now() - openedAt.current > 300) {
      onClose();
    }
  };

  const ramPct = sysInfo?.system.ram_percent_used ?? 0;
  const ramColor = ramPct > 85 ? '#E53E3E' : ramPct > 60 ? '#ECC94B' : 'var(--teal)';

  return createPortal(
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) safeClose(); }}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()}>
        <button style={closeBtn} onClick={safeClose}>×</button>

        <div style={headingStyle}>Vertaalapp</div>
        <div style={versionStyle}>v1.0.0 — Manava</div>

        {/* Wat is Vertaalapp */}
        <div style={sectionTitle}>Wat is Vertaalapp?</div>
        <div style={card}>
          <div style={text}>
            Vertaalapp is een <strong>real-time spraakvertaalapplicatie</strong>.
            De app luistert naar gesproken taal, herkent wat er gezegd wordt en
            vertaalt het direct naar de andere taal. Zo kunnen twee personen elkaar
            verstaan, ook als zij elkaars taal niet spreken.
          </div>
          <div style={{ ...textMuted, marginTop: '10px' }}>
            Vertaalapp ondersteunt meer dan 15 talen, waaronder Nederlands, Arabisch,
            Turks, Farsi, Somalisch en Tigrinya.
          </div>
        </div>

        {/* Hoe werkt het */}
        <div style={sectionTitle}>Hoe werkt het?</div>
        <div style={card}>
          <div style={text}>
            <strong>1. Talen kiezen</strong> — Selecteer op het startscherm de twee talen
            voor het gesprek (bijvoorbeeld Nederlands en Arabisch). Download eenmalig de
            taalmodellen.
          </div>
          <div style={{ ...text, marginTop: '10px' }}>
            <strong>2. Gesprek voeren</strong> — Plaats het apparaat tussen u en de
            andere spreker. Druk op de knop aan uw kant (links) om te spreken. De
            andere spreker drukt op de knop aan hun kant (rechts). U kunt ook de
            toetsen A en L op het toetsenbord gebruiken.
          </div>
          <div style={{ ...text, marginTop: '10px' }}>
            <strong>3. Vertaling verschijnt</strong> — De gesproken tekst wordt
            automatisch omgezet naar tekst en vertaald. Beide partijen zien het
            gesprek in hun eigen taal.
          </div>
        </div>

        {/* Kwaliteit van vertalingen */}
        <div style={sectionTitle}>Kwaliteit van vertalingen</div>
        <div style={card}>
          <div style={insetNote}>
            De vertalingen worden gegenereerd door AI-taalmodellen. De kwaliteit
            is over het algemeen goed, maar niet foutloos — vooral bij vaktermen,
            nuances en dialecten kunnen afwijkingen voorkomen. Gebruik de
            vertaling als ondersteuning bij het gesprek, niet als vervanging
            van een professionele vertaler in situaties waar precisie cruciaal is.
          </div>
        </div>

        {/* Privacy & Gegevens */}
        <div style={sectionTitle}>Privacy & Gegevensbescherming</div>
        <div style={card}>
          <div style={text}>
            <strong>Alle verwerking gebeurt lokaal op dit apparaat.</strong>
          </div>
          <ul style={{ ...text, paddingLeft: '18px', marginTop: '8px' }}>
            <li>Spraak, tekst en vertalingen verlaten <strong>nooit</strong> dit apparaat</li>
            <li>Er worden geen gesprekken opgeslagen, gelogd of doorgestuurd</li>
            <li>Gespreksinhoud verschijnt niet in logbestanden</li>
            <li>Na het sluiten van de app is alle gespreksdata verdwenen</li>
            <li>Er is geen account, login of registratie nodig</li>
            <li>De app werkt volledig offline na installatie</li>
          </ul>
          <div style={{ ...text, marginTop: '12px' }}>
            De app is actief beveiligd: toegang van buitenaf wordt geblokkeerd
            en er worden geen gespreksgegevens weggeschreven naar schijf of logs.
            De enige netwerkverbinding is het eenmalig downloaden van de
            AI-taalmodellen bij eerste gebruik. Daarna is geen internetverbinding
            meer nodig.
          </div>
          <div style={{ ...text, marginTop: '12px' }}>
            Vertaalapp slaat <strong>geen gespreksinhoud op</strong> en verwerkt
            geen persoonsgegevens in de zin van de AVG. De spraakherkenning en
            vertaling vinden uitsluitend plaats in het werkgeheugen van uw computer
            en worden niet opgeslagen op schijf.
          </div>
        </div>

        {/* Technologie */}
        <div style={sectionTitle}>Technologie</div>
        <div style={card}>
          <div style={text}>
            Vertaalapp maakt gebruik van de volgende open-source AI-modellen:
          </div>
          <ul style={{ ...text, paddingLeft: '18px', marginTop: '8px' }}>
            <li><strong>Whisper</strong> (OpenAI) — Spraakherkenning in 90+ talen</li>
            <li><strong>MarianMT</strong> (Helsinki-NLP) — Vertaalmodellen per talenpaar</li>
            <li><strong>NLLB-200</strong> (Meta) — Meertalig vertaalmodel voor 200 talen</li>
          </ul>
          <div style={{ ...textMuted, marginTop: '8px' }}>
            Alle modellen draaien lokaal. Op Apple Silicon Macs wordt gebruik
            gemaakt van MLX-optimalisatie voor snellere spraakherkenning.
          </div>
        </div>

        {/* Systeemstatus */}
        <div style={sectionTitle}>Systeemstatus</div>
        <div style={card}>
          {loading ? (
            <div style={textMuted}>Systeeminformatie laden...</div>
          ) : sysInfo ? (
            <>
              <div style={statusRow}>
                <span style={statusLabel}>Werkgeheugen (RAM)</span>
                <span style={statusValue}>
                  {sysInfo.system.ram_available_gb} GB vrij / {sysInfo.system.ram_total_gb} GB
                </span>
              </div>
              <div style={progressBarOuter}>
                <div style={{ ...progressBarFill, width: `${ramPct}%`, backgroundColor: ramColor }} />
              </div>

              <div style={{ ...statusRow, marginTop: '12px' }}>
                <span style={statusLabel}>Processor</span>
                <span style={statusValue}>
                  {sysInfo.system.cpu_count} cores ({sysInfo.system.arch})
                </span>
              </div>

              <div style={statusRow}>
                <span style={statusLabel}>Schijfruimte vrij</span>
                <span style={statusValue}>{sysInfo.system.disk_free_gb} GB</span>
              </div>

              <div style={statusRow}>
                <span style={statusLabel}>Spraakherkenning</span>
                <span style={statusValue}>
                  <span style={dotOk} />
                  {sysInfo.stt_engine}
                </span>
              </div>

              {sysInfo.cache_size_mb !== null && (
                <div style={statusRow}>
                  <span style={statusLabel}>Model-cache</span>
                  <span style={statusValue}>
                    {sysInfo.cache_size_mb > 1000
                      ? `${(sysInfo.cache_size_mb / 1024).toFixed(1)} GB`
                      : `${sysInfo.cache_size_mb} MB`}
                  </span>
                </div>
              )}

              {Object.entries(sysInfo.models).filter(([, status]) => typeof status === 'string').map(([name, status]) => (
                <div key={name} style={statusRow}>
                  <span style={statusLabel}>{name}</span>
                  <span style={statusValue}>
                    <span style={status === 'ready' ? dotOk : dotWarn} />
                    {status === 'ready' ? 'Gereed' : status === 'loading' ? 'Laden...' : status}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div style={textMuted}>
              Kan geen verbinding maken met de backend.
            </div>
          )}
        </div>

        {/* Over Manava */}
        <div style={sectionTitle}>Over Manava</div>
        <div style={card}>
          <div style={text}>
            Vertaalapp is zonder winstoogmerk ontwikkeld door{' '}
            <a href="https://www.manava.nl" target="_blank" rel="noopener noreferrer" style={link}>
              Manava
            </a>
            , een organisatie die zich richt op innovatie en technologie.
            Wij geloven dat taalbarrières geen belemmering mogen zijn voor
            goede communicatie.
          </div>
          <div style={{ ...textMuted, marginTop: '10px' }}>
            Voor vragen, feedback of samenwerkingen kunt u contact opnemen via{' '}
            <a href="https://www.manava.nl" target="_blank" rel="noopener noreferrer" style={link}>
              www.manava.nl
            </a>
          </div>
        </div>

        {/* Copyright & licentie */}
        <div style={footerSection}>
          <div style={footerLine}>
            © {new Date().getFullYear()} Manava. Zonder winstoogmerk ontwikkeld.
          </div>
          <div style={footerLine}>
            Vertaalapp maakt gebruik van open-source componenten onder hun
            respectievelijke licenties (Apache 2.0, MIT). De broncode van
            de AI-modellen is beschikbaar via HuggingFace.
          </div>
          <div style={footerLine}>
            Dit product wordt aangeboden zonder garantie. Manava is niet
            aansprakelijk voor schade voortvloeiend uit het gebruik van
            vertalingen gegenereerd door deze applicatie. Raadpleeg bij
            twijfel altijd een professionele vertaler.
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Styles ─── */

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.15)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modal: CSSProperties = {
  backgroundColor: 'var(--bg)',
  borderRadius: '28px',
  boxShadow: 'var(--shadow-extruded-hover)',
  padding: '36px 32px',
  maxWidth: '600px',
  width: '90%',
  maxHeight: '85vh',
  overflowY: 'auto',
  position: 'relative',
};

const headingStyle: CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '22px',
  fontWeight: 800,
  color: 'var(--fg)',
  letterSpacing: '-0.5px',
  marginBottom: '4px',
};

const versionStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--muted)',
  marginBottom: '24px',
};

const sectionTitle: CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--accent)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '10px',
  marginTop: '24px',
};

const card: CSSProperties = {
  backgroundColor: 'var(--bg)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-inset-sm)',
  padding: '16px 18px',
  marginBottom: '6px',
};

const text: CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.8,
  fontWeight: 400,
  color: 'var(--fg)',
  fontFamily: "'DM Sans', sans-serif",
};

const textMuted: CSSProperties = {
  ...text,
  color: 'var(--muted)',
  fontSize: '12px',
};

const insetNote: CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.7,
  fontWeight: 400,
  color: 'var(--muted)',
  fontFamily: "'DM Sans', sans-serif",
  backgroundColor: 'var(--bg)',
  boxShadow: 'var(--shadow-inset-sm)',
  borderRadius: '12px',
  padding: '12px 14px',
  marginTop: '12px',
};

const link: CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'none',
  fontWeight: 600,
};

const statusRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
};

const statusLabel: CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--muted)',
};

const statusValue: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--fg)',
};

const dotOk: CSSProperties = {
  display: 'inline-block',
  width: '7px',
  height: '7px',
  borderRadius: '9999px',
  backgroundColor: 'var(--teal)',
  marginRight: '6px',
  boxShadow: '0 0 6px rgba(56,178,172,0.5)',
};

const dotWarn: CSSProperties = {
  ...dotOk,
  backgroundColor: '#ECC94B',
  boxShadow: '0 0 6px rgba(236,201,75,0.5)',
};

const progressBarOuter: CSSProperties = {
  height: '6px',
  borderRadius: '9999px',
  backgroundColor: 'var(--bg)',
  boxShadow: 'var(--shadow-inset-sm)',
  overflow: 'hidden',
  marginTop: '4px',
};

const progressBarFill: CSSProperties = {
  height: '100%',
  borderRadius: '9999px',
  transition: 'width 0.5s ease-out',
};

const closeBtn: CSSProperties = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  width: '36px',
  height: '36px',
  borderRadius: '12px',
  border: 'none',
  backgroundColor: 'var(--bg)',
  boxShadow: 'var(--shadow-extruded-sm)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  color: 'var(--muted)',
  fontWeight: 700,
};

const footerSection: CSSProperties = {
  marginTop: '28px',
  paddingTop: '20px',
  textAlign: 'center',
  borderTop: 'none',
};

const footerLine: CSSProperties = {
  fontSize: '11px',
  lineHeight: 1.7,
  color: 'var(--muted)',
  marginBottom: '8px',
  fontFamily: "'DM Sans', sans-serif",
};
