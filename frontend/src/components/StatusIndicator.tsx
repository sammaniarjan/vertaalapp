import type { CSSProperties } from 'react';

interface ModelDetails {
  stt?: string;
  translation?: string;
}

interface StatusIndicatorProps {
  isConnected: boolean;
  modelsReady: boolean;
  sttEngine: string;
  sttModel?: string;
  modelDetails?: ModelDetails;
  onAboutClick: () => void;
  onChangeLangs: () => void;
  onExport?: () => void;
}

export function StatusIndicator({
  isConnected,
  modelsReady,
  sttEngine,
  sttModel,
  modelDetails,
  onAboutClick,
  onChangeLangs,
  onExport,
}: StatusIndicatorProps) {
  let statusText: string;
  let dotColor: string;

  if (!isConnected) {
    statusText = 'Niet verbonden / غير متصل';
    dotColor = '#E53E3E';
  } else if (!modelsReady) {
    statusText = getLoadingText(modelDetails);
    dotColor = '#ECC94B';
  } else {
    statusText = 'Verbonden';
    dotColor = 'var(--teal)';
  }

  const barStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    padding: '14px 24px',
    backgroundColor: 'var(--bg)',
    boxShadow: '0 4px 12px rgb(163,177,198,0.4), 0 -2px 8px rgba(255,255,255,0.5)',
    userSelect: 'none',
    position: 'relative',
    zIndex: 10,
  };

  const titleStyle: CSSProperties = {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700,
    fontSize: '16px',
    color: 'var(--fg)',
    letterSpacing: '-0.5px',
  };

  const dotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '9999px',
    backgroundColor: dotColor,
    flexShrink: 0,
    boxShadow: `0 0 6px ${dotColor}88`,
    ...(isConnected && !modelsReady ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
  };

  const statusStyle: CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--muted)',
  };

  const badgeStyle: CSSProperties = {
    padding: '4px 10px',
    backgroundColor: 'var(--bg)',
    boxShadow: 'var(--shadow-inset-sm)',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--muted)',
  };

  const separatorStyle: CSSProperties = {
    width: '4px',
    height: '4px',
    borderRadius: '9999px',
    backgroundColor: 'var(--muted)',
    opacity: 0.3,
  };

  const infoBtnStyle: CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'var(--bg)',
    boxShadow: 'var(--shadow-extruded-sm)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: 'var(--accent)',
    flexShrink: 0,
    marginLeft: '4px',
  };

  const homeBtnStyle: CSSProperties = {
    ...infoBtnStyle,
    width: 'auto',
    padding: '0 12px',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--accent)',
  };

  return (
    <div style={barStyle}>
      <button style={homeBtnStyle} onClick={onChangeLangs} aria-label="Terug naar taalkeuze" title="Terug naar taalkeuze">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Talen
      </button>
      <span style={titleStyle}>Vertaalapp</span>
      <span style={separatorStyle} />
      <span style={dotStyle} />
      <span style={statusStyle}>{statusText}</span>
      {isConnected && sttEngine && modelsReady && (
        <span style={badgeStyle}>{sttEngine}{sttModel ? ` (${sttModel})` : ''}</span>
      )}
      {onExport && (
        <button style={infoBtnStyle} onClick={onExport} aria-label="Gesprek exporteren" title="Gesprek exporteren">
          ↓
        </button>
      )}
      <button style={infoBtnStyle} onClick={onAboutClick} aria-label="Over deze applicatie" title="Over">
        i
      </button>
    </div>
  );
}

function getLoadingText(details?: ModelDetails): string {
  if (!details) return 'Modellen laden...';
  if (details.stt === 'loading') return 'Spraakherkenning laden...';
  if (details.translation === 'loading') return 'Vertaalmodellen laden...';
  if (details.stt === 'error' || details.translation === 'error') return 'Fout bij laden';
  return 'Modellen laden...';
}
