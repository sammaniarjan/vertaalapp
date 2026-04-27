import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { LanguageInfo } from '../types/messages';
import { InfoPage } from './InfoPage';

const API_BASE = 'http://127.0.0.1:8001';

interface WhisperModelInfo {
  name: string;
  label: string;
  description: string;
  size_mb: number;
  ram_gb: number;
  downloaded: boolean;
}

interface LanguageSetupProps {
  onReady: (source: string, target: string) => void;
}

export function LanguageSetup({ onReady }: LanguageSetupProps) {
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'intro' | 'privacy' | 'models' | 'languages' | 'info'>('intro');
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [micRequesting, setMicRequesting] = useState(false);
  const [whisperModels, setWhisperModels] = useState<WhisperModelInfo[]>([]);
  const [whisperModel, setWhisperModel] = useState<string>('small');

  // Check of microfoon al eerder is toegestaan
  useEffect(() => {
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (result.state === 'granted') {
          setMicGranted(true);
        }
      })
      .catch(() => {});
  }, []);

  const requestMic = async () => {
    setMicRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicGranted(true);
    } catch {
      setMicGranted(false);
    } finally {
      setMicRequesting(false);
    }
  };

  const fetchLanguages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/languages`);
      const data = await res.json();
      setLanguages(data.languages);
      if (data.active_pair && !selectedSource && !selectedTarget) {
        setSelectedSource(data.active_pair[0]);
        setSelectedTarget(data.active_pair[1]);
      }
    } catch {
      // retry via poll
    } finally {
      setLoading(false);
    }
  }, [selectedSource, selectedTarget]);

  useEffect(() => {
    fetchLanguages();
    const interval = setInterval(fetchLanguages, 2000);
    return () => clearInterval(interval);
  }, [fetchLanguages]);

  // Fetch beschikbare Whisper modellen
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stt/models`);
        const data = await res.json();
        setWhisperModels(data.models);
        setWhisperModel(data.active);
      } catch {
        // retry via language poll
      }
    };
    fetchModels();
  }, []);

  const downloadLang = async (code: string) => {
    await fetch(`${API_BASE}/api/languages/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang_code: code }),
    });
  };

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const startSession = async () => {
    if (!selectedSource || !selectedTarget) return;
    const srcLang = languages.find((l) => l.code === selectedSource);
    const tgtLang = languages.find((l) => l.code === selectedTarget);
    if (!srcLang?.installed || !tgtLang?.installed) return;

    setStarting(true);
    setStartError('');
    try {
      // Stel het gekozen Whisper model in
      await fetch(`${API_BASE}/api/stt/set-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: whisperModel }),
      });

      const res = await fetch(`${API_BASE}/api/languages/set-pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: selectedSource, target: selectedTarget }),
      });
      const data = await res.json();
      if (data.status === 'error') {
        setStartError(data.message || 'Modellen konden niet worden geladen');
        return;
      }
      onReady(selectedSource, selectedTarget);
    } catch (err) {
      setStartError('Kan geen verbinding maken met de backend');
      console.error('set-pair failed:', err);
    } finally {
      setStarting(false);
    }
  };

  const sourceReady = languages.find((l) => l.code === selectedSource)?.installed;
  const targetReady = languages.find((l) => l.code === selectedTarget)?.installed;
  const canStart = selectedSource && selectedTarget && selectedSource !== selectedTarget && sourceReady && targetReady;

  if (loading) {
    return (
      <div style={page}>
        <div style={heading}>Vertaalapp</div>
        <div style={subtext}>Verbinden met backend...</div>
      </div>
    );
  }

  /* ─── Stap 1: Intro — Wat is Vertaalapp ─── */
  if (step === 'intro') {
    return (
      <div style={{ ...page, justifyContent: 'center' }}>
        <div style={onboardingCard}>
          <div style={{ ...heading, fontSize: '36px', marginBottom: '10px' }}>Vertaalapp</div>
          <div style={onboardingSub}>
            Real-time spraakvertaling tussen twee talen
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px', textAlign: 'left' }}>
            <div style={obFeature}>
              <span style={obIcon}>🎙️</span>
              <div>
                <div style={obFeatureTitle}>Gesprek in twee talen</div>
                <div style={obFeatureDesc}>
                  Twee personen praten elk in hun eigen taal. De app luistert, herkent
                  de spraak en vertaalt in real-time. Het scherm is verdeeld in twee
                  helften — één voor elke spreker.
                </div>
              </div>
            </div>
          </div>

          <button
            style={onboardingBtn}
            onClick={() => setStep('privacy')}
          >
            Volgende
          </button>
        </div>
      </div>
    );
  }

  /* ─── Stap 2: Privacy — Volledig lokaal & privacykeuze ─── */
  if (step === 'privacy') {
    return (
      <div style={{ ...page, justifyContent: 'center' }}>
        <div style={onboardingCard}>
          <div style={{ ...heading, fontSize: '30px', marginBottom: '10px' }}>Bewust gebouwd voor privacy</div>
          <div style={onboardingSub}>
            Alle verwerking draait lokaal op dit apparaat
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px', textAlign: 'left' }}>
            <div style={obFeature}>
              <span style={obIcon}>🔒</span>
              <div>
                <div style={obFeatureTitle}>Geen cloud, geen data-opslag</div>
                <div style={obFeatureDesc}>
                  Spraak, tekst en vertalingen verlaten nooit dit apparaat.
                  Er worden geen gesprekken opgeslagen of gelogd.
                  Na het sluiten van de app is alle gespreksdata verdwenen.
                </div>
              </div>
            </div>
            <div style={obFeature}>
              <span style={obIcon}>🛡️</span>
              <div>
                <div style={obFeatureTitle}>Actief beschermd</div>
                <div style={obFeatureDesc}>
                  De app blokkeert actief toegang van buitenaf. Gespreksinhoud
                  verschijnt niet in logbestanden. Er is geen account of login nodig.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
            <button
              style={onboardingBtnSecondary}
              onClick={() => setStep('intro')}
            >
              Terug
            </button>
            <button
              style={onboardingBtn}
              onClick={() => setStep('models')}
            >
              Volgende
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Stap 3: Models — Taalmodellen + microfoon ─── */
  if (step === 'models') {
    return (
      <div style={{ ...page, justifyContent: 'center' }}>
        <div style={onboardingCard}>
          <div style={{ ...heading, fontSize: '30px', marginBottom: '10px' }}>Taalmodellen</div>
          <div style={onboardingSub}>
            Eenmalig downloaden, daarna volledig offline
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px', textAlign: 'left' }}>
            <div style={obFeature}>
              <span style={obIcon}>📦</span>
              <div>
                <div style={obFeatureTitle}>Hoe werkt het</div>
                <div style={obFeatureDesc}>
                  Op het volgende scherm kiest u twee talen en downloadt u de
                  bijbehorende AI-modellen. Dit is de enige keer dat een internetverbinding
                  nodig is. Daarna werkt alles offline.
                </div>
              </div>
            </div>
          </div>

          {/* Microfoon toestemming */}
          <div style={obMicSection}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--fg)', marginBottom: '10px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Microfoontoegang
            </div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '18px', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
              De app heeft uw microfoon nodig om spraak te kunnen herkennen. Uw stem wordt niet opgeslagen.
            </div>

            {micGranted === null && (
              <button style={onboardingBtn} onClick={requestMic} disabled={micRequesting}>
                {micRequesting ? 'Toestemming vragen...' : 'Microfoon toestaan'}
              </button>
            )}
            {micGranted === true && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <span style={{ color: 'var(--teal)', fontSize: '20px' }}>✓</span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--teal)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Microfoon gereed
                </span>
              </div>
            )}
            {micGranted === false && (
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#E53E3E', lineHeight: 1.6 }}>
                Microfoon geweigerd. Sta toegang toe via Systeeminstellingen → Privacy → Microfoon,
                en herstart de app.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
            <button
              style={onboardingBtnSecondary}
              onClick={() => setStep('privacy')}
            >
              Terug
            </button>
            <button
              style={onboardingBtn}
              onClick={() => setStep('languages')}
            >
              Aan de slag
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── InfoPage (geopend vanuit taalselectie-header) ─── */
  if (step === 'info') {
    return (
      <InfoPage
        onBack={() => setStep('languages')}
      />
    );
  }

  /* ─── Stap 3: Taalselectie ─── */
  return (
    <div style={page}>
      {/* Header */}
      <div style={introCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '10px' }}>
          <button
            style={navBtnStyle}
            onClick={() => setStep('models')}
            title="Terug naar vorige stap"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={heading}>Vertaalapp</div>
          <button
            style={infoBtnStyle}
            onClick={() => setStep('info')}
            aria-label="Over deze applicatie"
            title="Over deze applicatie, privacy & meer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Info
          </button>
        </div>
        <div style={stepsRow}>
          <StepBadge n={1} text="Kies links en rechts een taal" />
          <StepBadge n={2} text="Download de taalmodellen" />
          <StepBadge n={3} text="Start het gesprek" />
        </div>
        <div style={privacyNote}>
          Alle verwerking gebeurt lokaal op dit apparaat — er wordt geen data verstuurd.
        </div>
        {micGranted === false && (
          <div style={{ ...privacyNote, color: '#E53E3E', marginTop: '8px' }}>
            Microfoon niet beschikbaar. Geef toestemming via Systeeminstellingen → Privacy → Microfoon.
          </div>
        )}
      </div>

      {/* Split language selection */}
      <div style={splitContainer}>
        {/* Left speaker */}
        <div style={column}>
          <div style={columnHeader}>
            <span style={{ ...columnDot, backgroundColor: 'var(--accent)' }} />
            <span style={columnTitle}>Spreker links</span>
            <span style={kbdBadge}>A</span>
          </div>
          <div style={langGrid}>
            {languages.map((lang) => (
              <LanguageCard
                key={lang.code}
                lang={lang}
                accent="var(--accent)"
                selected={selectedSource === lang.code}
                disabled={lang.code === selectedTarget}
                onSelect={() => setSelectedSource(s => s === lang.code ? '' : lang.code)}
                onDownload={() => downloadLang(lang.code)}
              />
            ))}
          </div>
        </div>

        {/* Center divider with arrow */}
        <div style={divider}>
          <div style={dividerLine} />
          <div style={dividerArrow}>⇄</div>
          <div style={dividerLine} />
        </div>

        {/* Right speaker */}
        <div style={column}>
          <div style={columnHeader}>
            <span style={{ ...columnDot, backgroundColor: 'var(--teal)' }} />
            <span style={columnTitle}>Spreker rechts</span>
            <span style={{ ...kbdBadge, color: 'var(--teal)' }}>L</span>
          </div>
          <div style={langGrid}>
            {languages.map((lang) => (
              <LanguageCard
                key={lang.code}
                lang={lang}
                accent="var(--teal)"
                selected={selectedTarget === lang.code}
                disabled={lang.code === selectedSource}
                onSelect={() => setSelectedTarget(s => s === lang.code ? '' : lang.code)}
                onDownload={() => downloadLang(lang.code)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Whisper model keuze */}
      {whisperModels.length > 0 && (
        <div style={modelSelectorContainer}>
          <div style={modelSelectorLabel}>Spraakherkenning</div>
          <div style={modelSelectorRow}>
            {whisperModels.map((m) => {
              const isActive = whisperModel === m.name;
              return (
                <button
                  key={m.name}
                  style={modelCard(isActive)}
                  onClick={() => setWhisperModel(m.name)}
                >
                  <div style={modelCardTitle}>{m.label}</div>
                  <div style={modelCardDesc}>{m.description}</div>
                  {!m.downloaded && m.name !== 'small' && (
                    <div style={modelCardDownload}>~{Math.round(m.size_mb / 1000 * 10) / 10} GB download</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Start button */}
      <button
        style={startBtn(!!canStart && !starting)}
        disabled={!canStart || starting}
        onClick={startSession}
      >
        {starting ? 'Modellen laden...' : canStart ? 'Start vertaalsessie' : 'Selecteer en download twee talen'}
      </button>

      {startError && (
        <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#E53E3E' }}>
          {startError}
        </div>
      )}

      <div style={footerNote}>
        Modellen worden lokaal opgeslagen (~300 MB per taal, ~600 MB voor NLLB-talen). Na het downloaden werkt alles offline.
      </div>
    </div>
  );
}

/* Step badge */
function StepBadge({ n, text }: { n: number; text: string }) {
  return (
    <div style={stepItem}>
      <span style={stepNumber}>{n}</span>
      <span style={stepText}>{text}</span>
    </div>
  );
}

/* Quality indicator — 3 dots, filled based on quality level */
function QualityDots({ quality }: { quality: string }) {
  const filled = quality === 'high' ? 3 : quality === 'good' ? 2 : 1;
  return (
    <span style={{ display: 'inline-flex', gap: '2px', marginLeft: '2px' }}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '9999px',
            backgroundColor: i <= filled ? 'var(--teal)' : 'var(--muted)',
            opacity: i <= filled ? 0.8 : 0.2,
          }}
        />
      ))}
    </span>
  );
}

/* Language card */
function LanguageCard({
  lang,
  accent,
  selected,
  disabled,
  onSelect,
  onDownload,
}: {
  lang: LanguageInfo;
  accent: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDownload: () => void;
}) {
  const isDownloading = lang.downloading;
  const isInstalled = lang.installed;

  const card: CSSProperties = {
    backgroundColor: 'var(--bg)',
    borderRadius: '14px',
    padding: '12px 14px',
    boxShadow: selected
      ? 'var(--shadow-inset)'
      : disabled
        ? 'var(--shadow-extruded-sm)'
        : 'var(--shadow-extruded-sm)',
    cursor: disabled ? 'default' : isInstalled ? 'pointer' : 'default',
    opacity: disabled ? 0.35 : 1,
    transition: 'all 0.2s ease-out',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    outline: selected ? `2px solid ${accent}` : 'none',
    outlineOffset: '-2px',
  };

  const flagStyle: CSSProperties = {
    fontSize: '22px',
    lineHeight: 1,
    flexShrink: 0,
  };

  const infoCol: CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const nameStyle: CSSProperties = {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--fg)',
    lineHeight: 1.3,
  };

  const nativeStyle: CSSProperties = {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--muted)',
    lineHeight: 1.3,
  };

  const statusCol: CSSProperties = {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  };

  const dot: CSSProperties = {
    width: '7px',
    height: '7px',
    borderRadius: '9999px',
    backgroundColor: 'var(--teal)',
    boxShadow: '0 0 4px rgba(56,178,172,0.4)',
  };

  const dlBtn: CSSProperties = {
    padding: '4px 10px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--bg)',
    boxShadow: 'var(--shadow-extruded-sm)',
    fontSize: '10px',
    fontWeight: 700,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: accent,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const progressOuter: CSSProperties = {
    width: '48px',
    height: '4px',
    borderRadius: '9999px',
    backgroundColor: 'var(--bg)',
    boxShadow: 'var(--shadow-inset-sm)',
    overflow: 'hidden',
  };

  const progressInner: CSSProperties = {
    height: '100%',
    width: `${lang.progress}%`,
    borderRadius: '9999px',
    backgroundColor: accent,
    transition: 'width 0.5s ease-out',
  };

  return (
    <div
      style={card}
      onClick={() => {
        if (!disabled && isInstalled) onSelect();
      }}
    >
      <span style={flagStyle}>{lang.flag}</span>
      <div style={infoCol}>
        <div style={nameStyle}>{lang.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={nativeStyle}>{lang.native_name}</span>
          <QualityDots quality={lang.quality} />
        </div>
      </div>
      <div style={statusCol}>
        {lang.error ? (
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#E53E3E' }}>Fout</span>
        ) : isDownloading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: accent }}>{lang.progress}%</span>
            <div style={progressOuter}>
              <div style={progressInner} />
            </div>
          </div>
        ) : isInstalled ? (
          selected ? (
            <span style={{ fontSize: '10px', fontWeight: 700, color: accent }}>Actief</span>
          ) : (
            <span style={dot} />
          )
        ) : (
          <button
            style={dlBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
          >
            Download
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Shared styles ─── */

const page: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  height: '100vh',
  backgroundColor: 'var(--bg)',
  padding: '32px 24px 24px',
  overflow: 'hidden',
};

const introCard: CSSProperties = {
  backgroundColor: 'var(--bg)',
  borderRadius: '24px',
  boxShadow: 'var(--shadow-extruded)',
  padding: '28px 32px 24px',
  maxWidth: '680px',
  width: '100%',
  textAlign: 'center',
  marginBottom: '24px',
  flexShrink: 0,
};

const heading: CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '24px',
  fontWeight: 800,
  color: 'var(--fg)',
  letterSpacing: '-0.5px',
  marginBottom: '0',
};

const navBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: 'var(--bg)',
  boxShadow: 'var(--shadow-extruded-sm)',
  cursor: 'pointer',
  color: 'var(--muted)',
  flexShrink: 0,
};

const infoBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: 'var(--bg)',
  boxShadow: 'var(--shadow-extruded-sm)',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 700,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: 'var(--accent)',
  flexShrink: 0,
};

const subtext: CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--muted)',
};

const stepsRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '24px',
  marginBottom: '16px',
  flexWrap: 'wrap',
};

const stepItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const stepNumber: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '22px',
  borderRadius: '8px',
  backgroundColor: 'var(--bg)',
  boxShadow: 'var(--shadow-inset-sm)',
  fontSize: '11px',
  fontWeight: 700,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: 'var(--accent)',
  flexShrink: 0,
};

const stepText: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--fg)',
  fontFamily: "'DM Sans', sans-serif",
};

const privacyNote: CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--teal)',
  fontFamily: "'DM Sans', sans-serif",
};

const splitContainer: CSSProperties = {
  display: 'flex',
  flex: 1,
  width: '100%',
  maxWidth: '900px',
  gap: '0',
  overflow: 'hidden',
  minHeight: 0,
};

const column: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 0,
};

const columnHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 16px',
  flexShrink: 0,
};

const columnDot: CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '9999px',
  opacity: 0.6,
};

const columnTitle: CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--fg)',
  letterSpacing: '-0.3px',
};

const kbdBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '22px',
  borderRadius: '7px',
  backgroundColor: 'var(--bg)',
  boxShadow: 'var(--shadow-inset-sm)',
  fontSize: '11px',
  fontWeight: 700,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: 'var(--accent)',
};

const langGrid: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '4px 16px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const divider: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 8px',
  flexShrink: 0,
};

const dividerLine: CSSProperties = {
  width: '2px',
  flex: 1,
  backgroundColor: 'var(--bg)',
  boxShadow: 'var(--shadow-inset-sm)',
  borderRadius: '9999px',
};

const dividerArrow: CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '12px',
  backgroundColor: 'var(--bg)',
  boxShadow: 'var(--shadow-extruded-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  color: 'var(--muted)',
  fontWeight: 700,
  margin: '12px 0',
  flexShrink: 0,
};

const startBtn = (enabled: boolean): CSSProperties => ({
  marginTop: '20px',
  padding: '16px 44px',
  borderRadius: '16px',
  border: 'none',
  backgroundColor: enabled ? 'var(--accent)' : 'var(--bg)',
  color: enabled ? '#fff' : 'var(--muted)',
  boxShadow: enabled ? 'var(--shadow-extruded)' : 'var(--shadow-extruded-sm)',
  cursor: enabled ? 'pointer' : 'not-allowed',
  opacity: enabled ? 1 : 0.5,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '-0.3px',
  transition: 'all 0.2s ease-out',
  flexShrink: 0,
});

const footerNote: CSSProperties = {
  marginTop: '12px',
  marginBottom: '8px',
  fontSize: '11px',
  color: 'var(--muted)',
  textAlign: 'center',
  maxWidth: '400px',
  lineHeight: 1.5,
  flexShrink: 0,
};


const modelSelectorContainer: CSSProperties = {
  marginTop: '16px',
  width: '100%',
  maxWidth: '480px',
  flexShrink: 0,
};

const modelSelectorLabel: CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--muted)',
  textAlign: 'center',
  marginBottom: '8px',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const modelSelectorRow: CSSProperties = {
  display: 'flex',
  gap: '10px',
  justifyContent: 'center',
};

const modelCard = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '12px 14px',
  borderRadius: '14px',
  border: 'none',
  backgroundColor: 'var(--bg)',
  boxShadow: active ? 'var(--shadow-inset)' : 'var(--shadow-extruded-sm)',
  outline: active ? '2px solid var(--accent)' : 'none',
  outlineOffset: '-2px',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.2s ease-out',
});

const modelCardTitle: CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--fg)',
  marginBottom: '4px',
};

const modelCardDesc: CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '10px',
  fontWeight: 400,
  color: 'var(--muted)',
  lineHeight: 1.5,
};

const modelCardDownload: CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '9px',
  fontWeight: 600,
  color: 'var(--accent)',
  marginTop: '4px',
};

/* ─── Onboarding-specific styles (larger for readability) ─── */

const onboardingCard: CSSProperties = {
  backgroundColor: 'var(--bg)',
  borderRadius: '28px',
  boxShadow: 'var(--shadow-extruded)',
  padding: '48px 44px 40px',
  maxWidth: '620px',
  width: '100%',
  textAlign: 'center',
};

const onboardingSub: CSSProperties = {
  fontSize: '16px',
  fontWeight: 500,
  color: 'var(--muted)',
  marginBottom: '32px',
  fontFamily: "'DM Sans', sans-serif",
};

const obFeature: CSSProperties = {
  display: 'flex',
  gap: '16px',
  alignItems: 'flex-start',
  backgroundColor: 'var(--bg)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-inset-sm)',
  padding: '18px 20px',
};

const obIcon: CSSProperties = {
  fontSize: '26px',
  flexShrink: 0,
  lineHeight: 1,
  marginTop: '2px',
};

const obFeatureTitle: CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--fg)',
  marginBottom: '6px',
};

const obFeatureDesc: CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '14px',
  fontWeight: 400,
  color: 'var(--muted)',
  lineHeight: 1.7,
};

const obMicSection: CSSProperties = {
  backgroundColor: 'var(--bg)',
  borderRadius: '18px',
  boxShadow: 'var(--shadow-extruded-sm)',
  padding: '24px 28px',
  textAlign: 'center',
  marginBottom: '16px',
};

const onboardingBtn: CSSProperties = {
  padding: '14px 36px',
  borderRadius: '14px',
  border: 'none',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  boxShadow: 'var(--shadow-extruded-sm)',
  cursor: 'pointer',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '-0.3px',
  transition: 'all 0.2s ease-out',
};

const onboardingBtnSecondary: CSSProperties = {
  padding: '14px 36px',
  borderRadius: '14px',
  border: 'none',
  backgroundColor: 'var(--bg)',
  color: 'var(--accent)',
  boxShadow: 'var(--shadow-extruded-sm)',
  cursor: 'pointer',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '-0.3px',
  transition: 'all 0.2s ease-out',
};

