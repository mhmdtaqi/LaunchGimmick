import { useEffect, useRef } from 'react'

/**
 * Video launch yang muncul SETELAH ledakan orb.
 *
 * Sifat tampilan:
 * - Satu halaman penuh (fixed inset 0) dengan background hitam.
 * - object-fit: contain => proporsi asli terjaga (tidak di-stretch),
 *   dan video tidak pernah keluar dari layar (tidak melewati layar).
 *   Sisa ruang (letterbox) berupa background hitam container.
 * - Video di-center di halaman.
 *
 * Transisi:
 * - Fade in halus dari hitam (smoothstep) di awal.
 * - Video putar sekali tanpa loop, frame terakhir tetap ditampilkan.
 * - Flash ledakan layer di atas ikut memudar supaya transisi mulus.
 */
const FADE_SEC = 1.2 // durasi fade in (detik)
const FADE_DELAY = 0.35 // jeda sebelum fade in (beri ruang flash ledakan memudar)


export default function LaunchVideo({ src = '/launch-video.mp4', onBack }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let raf = 0
    // Smoothstep: easing halus tanpa "tunjuk" di awal/akhir
    const smooth = (x) => {
      const c = Math.min(1, Math.max(0, x))
      return c * c * (3 - 2 * c)
    }
    const loop = () => {
      const d = v.duration
      if (d && Number.isFinite(d) && d > 0) {
        const t = v.currentTime
        const remain = d - t
        // fade-in: 0 -> 1 (dengan delay), tanpa fade-out
        const fadeIn = smooth((t - FADE_DELAY) / FADE_SEC)
        v.style.opacity = String(fadeIn)
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

  return (
    <div className="video-full">
      <video
        ref={videoRef}
        className="video-el"
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        style={{ opacity: 0 }}
      />
      {/* Flash ledakan memudar halus -> video terlihat mulus di bawahnya */}
      <div className="video-flash-out" aria-hidden="true" />
      {onBack}
    </div>
  )
}
