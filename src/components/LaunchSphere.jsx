import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Sparkles } from '@react-three/drei'

const WAVE_MAX = 18
const WAVES_PER_APPROVE = 2

/**
 * Orb hitam transparan + rim neon kuning + wave signal pemancar.
 * - Inti: hitam transparan (opacity ~0.42).
 * - Rim: fresnel kuning di tepi.
 * - Waves: 3 cincin per 1 approved (0 approve = tidak ada, cap 18).
 *   Makin penuh progress: makin banyak cincin, makin cepat, makin liar.
 * - Ringan untuk Intel HD 4000: torus low-seg, additive, tanpa postprocessing.
 */
export default function LaunchSphere({ ratio = 0, approvedCount = 0, launching = false }) {
  const sphereRef = useRef()
  const rimRef = useRef()
  const groupRef = useRef()
  const wavesRef = useRef([])
  const haloRef = useRef()
  const lightARef = useRef()
  const lightBRef = useRef()

  const baseSpeed = 0.25
  const speedMultiplier = 2.5

  // Siklus neon lambat: kuning #facc15 <-> biru tosca #22d3ee (~12 detik)
  const NEON_YELLOW = useMemo(() => new THREE.Color('#facc15'), [])
  const NEON_TOSCA = useMemo(() => new THREE.Color('#22d3ee'), [])
  const NEON_WHITE = useMemo(() => new THREE.Color('#ffffff'), [])
  const cycleColor = useMemo(() => new THREE.Color('#facc15'), [])
  const CYCLE_SEC = 12.0

  // Tekstur bayangan blob (radial gradient) — dibuat sekali via canvas 2D.
  const shadowTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128)
    g.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
    g.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(c)
    return t
  }, [])

  // Material fresnel untuk garis neon di tepi (BackSide + Additive).
  const rimMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(launching ? '#ffffff' : '#facc15') },
          uIntensity: { value: 1.4 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);
            vec3 col = uColor * fres * uIntensity;
            gl_FragColor = vec4(col, fres);
          }
        `,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  )

  useFrame((state, delta) => {
    const speed = baseSpeed + ratio * speedMultiplier + (launching ? 6 : 0)
    if (sphereRef.current) {
      sphereRef.current.rotation.y += delta * speed
      sphereRef.current.rotation.x += delta * speed * 0.35
    }
    if (rimRef.current) {
      rimRef.current.rotation.y -= delta * speed * 0.6
      rimRef.current.rotation.x -= delta * speed * 0.2
    }
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.12
      if (launching) {
        const s = 1 + Math.sin(state.clock.elapsedTime * 18) * 0.06 + state.clock.elapsedTime % 1 * 0.02
        groupRef.current.scale.setScalar(Math.min(s, 1.6))
      } else {
        groupRef.current.scale.setScalar(1 + ratio * 0.18)
      }
    }
    // Rim: kunci kuning, intensitas naik mengikuti progress + pulse halus
    const target = launching ? new THREE.Color('#ffffff') : new THREE.Color('#facc15')
    rimMat.uniforms.uColor.value.lerp(target, 0.12)
    const pulse = 1.35 + ratio * 0.9 + Math.sin(state.clock.elapsedTime * 2.2) * 0.15
    rimMat.uniforms.uIntensity.value = launching ? 2.2 : pulse

    // Wave signal: 2 cincin per 1 approved (0 = tidak ada), cap WAVE_MAX
    const t = state.clock.elapsedTime
    const visibleCount = launching
      ? WAVE_MAX
      : Math.min(WAVE_MAX, Math.max(0, Math.floor(approvedCount) * WAVES_PER_APPROVE))
    const cycleDur = launching ? 0.55 : 2.3 - ratio * 1.5 // 2.3s (0%) -> 0.8s (100%)
    const wild = launching ? 1 : ratio
    for (let i = 0; i < WAVE_MAX; i += 1) {
      const m = wavesRef.current[i]
      if (!m) continue
      if (i >= visibleCount) {
        m.visible = false
        continue
      }
      m.visible = true
      const phase = (t / cycleDur + i / visibleCount) % 1
      // Mengembang dari permukaan orb ke luar
      m.scale.setScalar(1.04 + phase * (1.35 + wild * 0.95))
      // Fade kuadratik agar ekor halus
      const fade = (1 - phase) * (1 - phase)
      m.material.opacity = fade * (0.3 + wild * 0.55 + (launching ? 0.25 : 0))
      // Liar: goyang posisi + tilt acak per cincin, makin besar saat penuh
      m.position.y = Math.sin(t * (1.2 + wild * 3.5) + i * 1.7) * wild * 0.32
      m.position.x = Math.cos(t * (0.9 + wild * 2.8) + i * 2.3) * wild * 0.18
      m.rotation.x = Math.PI / 2 + Math.sin(t * 0.8 + i * 2.1) * wild * 0.6
      m.rotation.y = Math.cos(t * 0.6 + i * 1.3) * wild * 0.6
      m.rotation.z += delta * (0.25 + wild * 1.4) * (i % 2 === 0 ? 1 : -1)
    }
  })

  const liquidDistort = 0.28 + ratio * 0.12
  const liquidSpeed = 1.6 + ratio * 2.2

  return (
    <>
      <group ref={groupRef}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 6]} intensity={1.2} color="#ffffff" />
        <pointLight position={[5, 5, 5]} intensity={1.2} color="#fde047" />
        <pointLight position={[-5, -3, -4]} intensity={1.0} color="#facc15" />

        {/* Inti hitam transparan */}
        <mesh ref={sphereRef}>
          <sphereGeometry args={[1.5, 48, 48]} />
          <MeshDistortMaterial
            color="#060609"
            emissive="#000000"
            emissiveIntensity={0.25}
            roughness={0.08}
            metalness={0.3}
            distort={liquidDistort}
            speed={liquidSpeed}
            transparent
            opacity={0.42}
          />
        </mesh>

        {/* Garis neon kuning di tepi — fresnel BackSide */}
        <mesh ref={rimRef} scale={1.045}>
          <sphereGeometry args={[1.5, 48, 48]} />
          <primitive object={rimMat} attach="material" />
        </mesh>

        {/* Halo kuning tipis di luar rim */}
        <mesh scale={1.14}>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshBasicMaterial
            color={launching ? '#ffffff' : '#facc15'}
            transparent
            opacity={0.07 + ratio * 0.05}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Wave signal neon: cincin mengembang dari orb */}
        {Array.from({ length: WAVE_MAX }).map((_, i) => (
          <mesh
            key={i}
            ref={(el) => {
              wavesRef.current[i] = el
            }}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[1.5, 0.02, 8, 64]} />
            <meshBasicMaterial
              color={launching ? '#ffffff' : '#facc15'}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}

        {/* Partikel kuning selaras rim */}
        <Sparkles
          count={120}
          scale={[7, 7, 7]}
          size={3}
          speed={0.35 + ratio * 0.8}
          color={launching ? '#ffffff' : '#fde047'}
          opacity={0.85}
        />
      </group>

      <mesh rotation-x={-Math.PI / 2} position={[0, -2.4, 0]}>
        <planeGeometry args={[4.4, 4.4]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
    </>
  )
}