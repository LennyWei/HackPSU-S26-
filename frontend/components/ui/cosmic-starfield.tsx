'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

const COLORS = [
  '#ff00ff', '#ff44cc', '#ff88ff', '#cc00ff', // pinks/magentas
  '#00eeff', '#44aaff', '#0066ff', '#88ccff', // cyans/blues
  '#9944ff', '#ffffff', '#ffccff',             // purple/white/pale
]

interface Streak {
  angle: number
  dist: number
  speed: number
  length: number
  color: string
  alpha: number
  pixelSize: number
}

interface Dot {
  x: number
  y: number
  alpha: number
  size: number
}

export interface CosmicStarfieldHandle {
  triggerWarp: () => void
}

function snap(v: number, px: number) {
  return Math.round(v / px) * px
}

const CosmicStarfield = forwardRef<CosmicStarfieldHandle>(function CosmicStarfield(_, ref) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const warpingRef = useRef(false)
  const warpSpeed  = useRef(1)

  useImperativeHandle(ref, () => ({
    triggerWarp: () => { warpingRef.current = true },
  }))

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    let animId: number

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const makeStreak = (w: number, h: number): Streak => {
      const maxDist = Math.sqrt(w * w + h * h) * 0.6
      return {
        angle:     Math.random() * Math.PI * 2,
        dist:      4 + Math.random() * maxDist,
        speed:     0.35 + Math.random() * 0.55,
        length:    2 + Math.floor(Math.random() * 6),
        color:     COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha:     0.35 + Math.random() * 0.65,
        pixelSize: Math.random() < 0.3 ? 4 : 2,
      }
    }

    let w = canvas.width
    let h = canvas.height

    const streaks: Streak[] = Array.from({ length: 220 }, () => makeStreak(w, h))

    const dots: Dot[] = Array.from({ length: 60 }, () => ({
      x:     Math.random() * w,
      y:     Math.random() * h,
      alpha: 0.15 + Math.random() * 0.4,
      size:  2,
    }))

    function draw() {
      w = canvas.width
      h = canvas.height
      const cx     = w / 2
      const cy     = h / 2
      const maxDist = Math.sqrt(cx * cx + cy * cy) + 60

      // Ramp up warp speed
      if (warpingRef.current) {
        warpSpeed.current = Math.min(warpSpeed.current * 1.13, 70)
      }

      // Background
      ctx.globalAlpha = 1
      ctx.fillStyle   = '#08051a'
      ctx.fillRect(0, 0, w, h)

      // Static dots
      for (const d of dots) {
        ctx.globalAlpha = d.alpha
        ctx.fillStyle   = '#ffffff'
        ctx.fillRect(snap(d.x, 2), snap(d.y, 2), d.size, d.size)
      }

      // Streaks
      for (const s of streaks) {
        s.dist += s.speed * warpSpeed.current

        if (s.dist > maxDist) {
          const fresh  = makeStreak(w, h)
          s.angle      = fresh.angle
          s.dist       = 2 + Math.random() * 8
          s.speed      = fresh.speed
          s.length     = fresh.length
          s.color      = fresh.color
          s.alpha      = fresh.alpha
          s.pixelSize  = fresh.pixelSize
        }

        const normalized = s.dist / maxDist
        // Fade in near center, full mid-way, fade out near edge
        const fadedAlpha  = s.alpha
          * Math.min(normalized * 4, 1)
          * Math.min((1 - normalized) * 4, 1)

        const px    = s.pixelSize
        const cosA  = Math.cos(s.angle)
        const sinA  = Math.sin(s.angle)
        // Warp elongates streaks
        const blockLen = s.length + Math.floor(warpSpeed.current * 0.3)

        for (let i = 0; i < blockLen; i++) {
          const d = s.dist - i * px * 1.8
          if (d < 2) continue
          const x      = snap(cx + cosA * d, px)
          const y      = snap(cy + sinA * d, px)
          const taper  = (1 - i / blockLen) * 0.9
          ctx.globalAlpha = fadedAlpha * taper
          ctx.fillStyle   = s.color
          ctx.fillRect(x, y, px, px)
        }
      }

      ctx.globalAlpha = 1
      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
})

export default CosmicStarfield
