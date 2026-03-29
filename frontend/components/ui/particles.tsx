'use client'

import { useRef, useImperativeHandle, forwardRef, useEffect } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number; color: string
  gravity: number
  shape: 'circle' | 'square'
}

export interface BurstOptions {
  /** Single color or array of colors picked at random per particle */
  color?: string | string[]
  count?: number
  speed?: number
  /** Angular spread in radians. Default: full circle (2π) */
  spread?: number
  /** Base angle in radians. Default: upward (−π/2) */
  angle?: number
  gravity?: number
  size?: number
  /** Lifetime in frames (~60fps). Default: 50 */
  life?: number
  shape?: 'circle' | 'square' | 'mixed'
}

export interface ParticlesHandle {
  burst: (x: number, y: number, opts?: BurstOptions) => void
}

const Particles = forwardRef<ParticlesHandle>(function Particles(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.current = particles.current.filter((p) => p.life > 0)

      for (const p of particles.current) {
        p.x  += p.vx
        p.y  += p.vy
        p.vy += p.gravity
        p.vx *= 0.96
        p.life--

        const t     = p.life / p.maxLife          // 1 → 0
        const alpha = t < 0.3 ? t / 0.3 : 1       // fade out last 30%
        const r     = p.size * (0.4 + t * 0.6)    // shrink over time

        ctx.globalAlpha = alpha
        ctx.fillStyle   = p.color

        if (p.shape === 'square') {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate((1 - t) * Math.PI * 2)
          ctx.fillRect(-r, -r, r * 2, r * 2)
          ctx.restore()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1
      rafRef.current  = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    burst(x, y, opts: BurstOptions = {}) {
      const {
        color   = '#ffffff',
        count   = 28,
        speed   = 6,
        spread  = Math.PI * 2,
        angle   = -Math.PI / 2,
        gravity = 0.2,
        size    = 4,
        life    = 52,
        shape   = 'mixed',
      } = opts

      const colors = Array.isArray(color) ? color : [color]

      for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * spread
        const s = speed * (0.4 + Math.random() * 0.9)
        const particleShape: 'circle' | 'square' =
          shape === 'mixed'
            ? Math.random() < 0.5 ? 'circle' : 'square'
            : shape

        particles.current.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life, maxLife: life,
          size: size * (0.5 + Math.random() * 0.8),
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity,
          shape: particleShape,
        })
      }
    },
  }))

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
})

export default Particles
