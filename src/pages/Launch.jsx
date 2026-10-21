import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import LaunchSphere from '../components/LaunchSphere'
import LaunchVideo from '../components/LaunchVideo'
import ProgressBar from '../components/ProgressBar'

import StandbyText from '../components/StandbyText'
import { useLaunch } from '../hooks/useLaunch'

/**
 * Menyesuaikan jarak kamera agar orb memenuhi layar dengan proporsional:
 * - Landscape (proyektor): orb ~65% tinggi layar.
 * - Portrait (HP): kamera mundur proporsional agar orb tidak terpotong kiri-kanan.
 */
function CameraRig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const dist = aspect >= 1 ? 5.6 : 5.6 / Math.max(0.5, aspect)
    camera.position.set(0, 0, dist)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

/**
 * Halaman publik / — ditampilkan di proyektor.
 * - Sphere standby + cincin + water bar (tanpa teks di bar).
 * - Saat 100% / isLaunched: animasi flash cepat lalu video full screen.
 */
export default function Launch() {
  const { ratio, percent, isLaunched, totalApproved } = useLaunch()
  const navigate = useNavigate()
  const [phase, setPhase] = useState('standby') // standby | launching | video
  const timerRef = useRef(null)

  // Fade-in di awal + fade-out di akhir background video (proporsional, via rAF).
  // Opacity dihitung kontinu dari currentTime agar loop menghitam smooth.
  const bgVideoRef = useRef(null)
  const bgFadeRef = useRef(null)
  const FADE_SEC = 1.2
  const BG_BASE = 0.38

  useEffect(() => {
    const v = bgVideoRef.current
    const f = bgFadeRef.current
    if (!v) return
    let raf = 0
    const smooth = (x) => {
      const c = Math.min(1, Math.max(0, x))
      return c * c * (3 - 2 * c)
    }
    const loop = () => {
      const d = v.duration
      if (d && Number.isFinite(d) && d > 0) {
        const t = v.currentTime
        const remain = d - t
        // fade-in: 0 -> 1 selama FADE_SEC pertama; fade-out: 1 -> 0 selama FADE_SEC terakhir
        const factor = Math.min(smooth(t / FADE_SEC), smooth(remain / FADE_SEC))
        v.style.opacity = String(BG_BASE * factor)
        if (f) f.style.opacity = String(1 - factor)
      }
      raf = requestAnimationFrame(loop)
    }
    const onPlaying = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }
    v.addEventListener('playing', onPlaying)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      v.removeEventListener('playing', onPlaying)
    }
  }, [])

  // Pindah ke phase 'launching' saat isLaunched true
  useEffect(() => {
    if (isLaunched && phase === 'standby') {
      setPhase('launching')
    }
  }, [isLaunched, phase])

  // Timer: setelah ~1.6 detik di phase 'launching', masuk ke phase 'video'
  useEffect(() => {
    if (phase === 'launching') {
      timerRef.current = setTimeout(() => setPhase('video'), 1600)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase])

  if (phase === 'video') {
    return (
      <LaunchVideo src="/launch-video.mp4" />
    )
  }

  return (
    <div className="launch-page">

      {phase === 'launching' && <div className="launch-flash" />}

      {/* Background video: fade-in 0->penuh di 1.2s pertama, fade-out penuh->0 di 1.2s terakhir */}
      <video
        ref={bgVideoRef}
        className="bg-video"
        src="/video.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{ opacity: 0 }}
      />
      <div ref={bgFadeRef} className="bg-fade" style={{ opacity: 1 }} aria-hidden="true" />
      <div className="bg-scrim" aria-hidden="true" />

      {/* Teks STANDBY raksasa di tengah page, di belakang bar */}
      <StandbyText percent={percent} vanishing={phase === 'launching'} />

      {/* Klik-ganda di area stage untuk ke halaman login (pengganti link yang dihapus) */}
      <div className="launch-stage" onDoubleClick={() => navigate('/login')}>
        {/* Canvas fullscreen penuh stage: orb besar memenuhi layar */}
        <div className="orb-frame">
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5.6], fov: 50 }} gl={{ antialias: true, alpha: true }}>
            <CameraRig />
            <Suspense fallback={null}>
              <LaunchSphere ratio={ratio} approvedCount={totalApproved} launching={phase === 'launching'} />
            </Suspense>
          </Canvas>
        </div>
        {/* Bar tepat di tengah orb, di depan canvas */}
        <div className="bar-overlay">
          <ProgressBar percent={percent} vanishing={phase === 'launching'} />
        </div>
      </div>
    </div>
  )
}