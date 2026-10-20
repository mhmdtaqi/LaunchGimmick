/**
 * ProgressBar tipis seperti gambar referensi:
 * - Header: pill status kiri (STANDBY / IN PROGRESS / COMPLETE) + persen kanan.
 * - Bar tipis rounded: track hitam, fill gradien hitam → kuning neon (#facc15)
 *   selaras tombol Trigger. Fill via transform scaleX (GPU) dengan easing
 *   sama seperti ring tombol agar timing terasa sinkron.
 * - vanishing=true (saat launch): collapse + fade dari tengah.
 */
export default function ProgressBar({ percent = 0, vanishing = false }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const ratio = clamped / 100
  const shake = (ratio * 3).toFixed(2)
  const label = clamped >= 100 ? 'COMPLETE' : clamped > 0 ? 'IN PROGRESS' : 'STANDBY'

  const cls =
    'pbar-wrap' +
    (clamped > 0 && !vanishing ? ' pbar-shake' : '') +
    (vanishing ? ' pbar-vanish' : '')

  return (
    <div className={cls} style={{ '--shake': `${shake}px` }}>
      <div className="pbar-head">
        <span className="pbar-pill">{label}</span>
        <span className="pbar-pct">{clamped}%</span>
      </div>
      <div className="pbar-track">
        <div className="pbar-fill" style={{ transform: `scaleX(${ratio.toFixed(4)})` }}>
          <span className="pbar-core" />
          <span className="pbar-tip" />
        </div>
      </div>
    </div>
  )
}