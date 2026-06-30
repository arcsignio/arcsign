interface Props {
  code: string | null;
  origin: string | null;
}

// 配對碼彈窗：顯示桌面端產生的碼 + 來源 origin。使用者把碼填回 mint 網頁。
// 純呈現——配對驗證在後端（連線層門票，不碰簽章閘）。
export function PairingDialog({ code, origin }: Props) {
  if (!code) return null;
  return (
    <div
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
          border: '1px solid #0d9488',
          maxWidth: 360,
        }}
      >
        <p style={{ color: '#94a3b8', margin: 0 }}>
          來源 <strong style={{ color: '#2dd4bf' }}>{origin ?? '(未知)'}</strong> 請求連線
        </p>
        <p style={{ color: '#e2e8f0' }}>把這組配對碼輸入網頁：</p>
        <div
          style={{
            fontSize: 32,
            letterSpacing: 4,
            color: '#2dd4bf',
            textAlign: 'center',
            fontFamily: 'monospace',
          }}
        >
          {code}
        </div>
        <p style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>
          60 秒內有效，輸錯 3 次鎖定此連線。
        </p>
      </div>
    </div>
  );
}
