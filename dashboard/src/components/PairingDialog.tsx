interface Props {
  code: string | null;
  origin: string | null;
  onClose: () => void;
}

// 配對碼彈窗：顯示桌面端產生的碼 + 來源 origin。使用者把碼填回 mint 網頁。
// 純呈現——配對驗證在後端（連線層門票，不碰簽章閘）。
export function PairingDialog({ code, origin, onClose }: Props) {
  if (!code) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#0f172a',
          padding: 24,
          borderRadius: 12,
          border: '1px solid var(--brand)',
          maxWidth: 360,
        }}
      >
        <p style={{ color: 'var(--text-tertiary)', margin: 0 }}>
          來源 <strong style={{ color: 'var(--brand-accent)' }}>{origin ?? '(未知)'}</strong> 請求連線
        </p>
        <p style={{ color: 'var(--border-default)' }}>把這組配對碼輸入網頁：</p>
        <div
          style={{
            fontSize: 32,
            letterSpacing: 4,
            color: 'var(--brand-accent)',
            textAlign: 'center',
            fontFamily: 'monospace',
          }}
        >
          {code}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 12 }}>
          60 秒內有效，輸錯 3 次鎖定此連線。
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '8px 0',
            background: 'var(--brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          關閉
        </button>
      </div>
    </div>
  );
}
