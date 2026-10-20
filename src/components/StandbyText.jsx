/**
 * Teks backdrop "STANDBY" 3D — di belakang bar, di depan orb.
 * - Setiap HURUF bergetar sendiri-sendiri (stagger delay per huruf
 *   sehingga tercipta gelombang getar menyapu kata).
 * - Gaya getar huruf (letterQuake: goyangan rotasi 0.7s) dibedakan
 *   dari bar (barShake: jitter translasi cepat 0.45s).
 * - Amplitudo translasi diskala dari percent via --shake (diwariskan
 *   parent → tiap huruf). vanishing: collapse + fade dari tengah.
 */
const WORD = 'STANDBY'

export default function StandbyText({ percent = 0, vanishing = false }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const ratio = clamped / 100
  // Amplitudo getar: 0px (kosong) → 5px (penuh)
  const shake = (ratio * 5).toFixed(2)
  const live = clamped > 0 && !vanishing
  const cls =
    'standby-text' +
    (live ? ' letters-live' : '') +
    (vanishing ? ' bar-vanish' : '')

  return (
    <div className={cls} style={{ '--shake': `${shake}px` }} aria-hidden="true">
      {WORD.split('').map((ch, i) => (
        <span
          key={i}
          className="st-letter"
          // Delay 1: letterQuake (0.09s/huruf), Delay 2: shimmer (0.25s/huruf)
          style={{ animationDelay: `${(i * 0.09).toFixed(2)}s, ${(i * 0.25).toFixed(2)}s` }}
        >
          {ch}
        </span>
      ))}
    </div>
  )
}