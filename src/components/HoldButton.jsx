import { useEffect, useRef, useState } from 'react'

const HOLD_MS = 3000
const RELEASE_MS = 380

/**
 * Tombol hold-to-approve: tahan 3 detik untuk approve.
 * - Fill vertikal via transform scaleY (GPU) + ring via stroke-dashoffset.
 * - Lepas sebelum penuh -> drain halus ke 0 (bukan snap).
 * - Penuh -> pop halus + transisi ke approved (crossfade konten).
 */
export default function HoldButton({ approved = false, onApprove, disabled = false }) {
  const [progress, setProgress] = useState(0) // 0..1 (display, dihaluskan via rAF)
  const [holding, setHolding] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [completing, setCompleting] = useState(false)
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const releaseFromRef = useRef(0)
  const releaseStartRef = useRef(0)
  const doneRef = useRef(false)
  const progressRef = useRef(0)

  const stopRaf = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  const setP = (p) => {
    progressRef.current = p
    setProgress(p)
  }

  // Drain halus saat dilepas sebelum penuh
  const animateRelease = () => {
    releaseFromRef.current = progressRef.current
    releaseStartRef.current = performance.now()
    setReleasing(true)
    const step = (now) => {
      const t = Math.min(1, (now - releaseStartRef.current) / RELEASE_MS)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setP(Math.max(0, releaseFromRef.current * (1 - eased)))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setP(0)
        setReleasing(false)
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  const cancel = () => {
    if (doneRef.current || completing) return
    if (!holding && !releasing) return
    stopRaf()
    setHolding(false)
    if (progressRef.current > 0.001) {
      animateRelease()
    } else {
      setP(0)
      setReleasing(false)
    }
  }

  const tick = () => {
    const elapsed = Date.now() - startRef.current
    // Target eksak agar timing ring + fill sinkron 3 detik (smoothing via CSS 80ms)
    const target = Math.min(1, elapsed / HOLD_MS)
    setP(target)
    if (target >= 1) {
      doneRef.current = true
      setHolding(false)
      setCompleting(true)
      // Beri waktu pop 480ms sebelum approve agar transisi terlihat smooth
      setTimeout(() => {
        onApprove?.()
      }, 180)
      setTimeout(() => setCompleting(false), 650)
      rafRef.current = null
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const start = (e) => {
    if (approved || disabled || doneRef.current || completing) return
    e.preventDefault()
    stopRaf()
    doneRef.current = false
    startRef.current = Date.now()
    setReleasing(false)
    setHolding(true)
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (approved) {
      stopRaf()
      setHolding(false)
      setReleasing(false)
      setP(1)
      doneRef.current = true
    } else {
      setP(0)
      doneRef.current = false
      setCompleting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved])

  useEffect(() => stopRaf, [])

  const R = 88
  const C = 2 * Math.PI * R

  return (
    <div
      className={`hold-wrap ${holding ? 'holding' : ''} ${releasing ? 'releasing' : ''} ${
        completing ? 'completing' : ''
      } ${approved ? 'approved' : ''}`}
      style={{ '--p': progress.toFixed(4) }}
    >
      <div className="hold-glow" />
      <button
        className="hold-btn"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        disabled={approved || disabled}
        aria-label={approved ? 'Already Approved' : 'Tahan 3 detik untuk approve'}
      >
        {/* fill vertikal via transform (GPU) */}
        <span className="hold-fill" />
        <span className="hold-sheen" />
        {/* konten crossfade */}
        <span className="hold-content">
          <span className={`hold-state hold-idle-state ${approved ? 'is-hidden' : ''}`}>
            <span className="hold-title">HOLD</span>
            <span className="hold-sub">{Math.round(progress * 100)}%</span>
          </span>
          <span className={`hold-state hold-done-state ${approved ? 'is-visible' : ''}`}>
            <span className="hold-check">✓</span>
            <span className="hold-label">Already Approved</span>
          </span>
        </span>
        {/* progress ring */}
        <svg className="hold-ring" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={R} className="ring-bg" />
          <circle
            cx="100"
            cy="100"
            r={R}
            className="ring-fg"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
          />
        </svg>
      </button>
      {!approved && <p className="hold-hint">Tahan tombol 3 detik</p>}
    </div>
  )
}