'use client'

import { useEffect, useRef } from 'react'

const PX = 3
const COLORS = ['#a8b8c4', '#a8b8c4', '#a8b8c4', '#7a9ab8', '#5a8fa8', '#4a7858', '#9a8050']
const GRID = 40

type Star = {
  x: number; y: number
  color: string; size: number
  blinkSpeed: number; blinkOffset: number; brightness: number
}

type Shooter = {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; color: string
  trail: { x: number; y: number }[]
}

type Cluster = {
  x: number; y: number; color: string
  pixels: { dx: number; dy: number }[]
  life: number; maxLife: number; phase: 'in' | 'hold' | 'out'
}

function snapPx(v: number) { return Math.round(v / PX) * PX }

export default function PixelGridBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = window.innerWidth
    let h = window.innerHeight

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width  = w
      canvas.height = h
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Stars ──
    const stars: Star[] = Array.from({ length: 220 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() > 0.88 ? PX * 2 : PX,
      blinkSpeed: Math.random() * 1.8 + 0.3,
      blinkOffset: Math.random() * Math.PI * 2,
      brightness: Math.random() * 0.45 + 0.45,
    }))

    // ── Pixel clusters (distant "planets" / nebula blobs) ──
    function makeCluster(cx: number, cy: number): Cluster {
      const shapes = [
        // small cross
        [{ dx: 0, dy: 0 }, { dx: PX, dy: 0 }, { dx: -PX, dy: 0 }, { dx: 0, dy: PX }, { dx: 0, dy: -PX }],
        // 3x3 block
        [{ dx: 0, dy: 0 }, { dx: PX, dy: 0 }, { dx: -PX, dy: 0 }, { dx: 0, dy: PX }, { dx: 0, dy: -PX },
         { dx: PX, dy: PX }, { dx: -PX, dy: PX }, { dx: PX, dy: -PX }, { dx: -PX, dy: -PX }],
        // diamond
        [{ dx: 0, dy: 0 }, { dx: PX * 2, dy: 0 }, { dx: -PX * 2, dy: 0 },
         { dx: 0, dy: PX * 2 }, { dx: 0, dy: -PX * 2 },
         { dx: PX, dy: PX }, { dx: -PX, dy: PX }, { dx: PX, dy: -PX }, { dx: -PX, dy: -PX }],
      ]
      return {
        x: snapPx(cx), y: snapPx(cy),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        pixels: shapes[Math.floor(Math.random() * shapes.length)],
        life: 0, maxLife: 220 + Math.floor(Math.random() * 160),
        phase: 'in',
      }
    }

    let clusters: Cluster[] = Array.from({ length: 6 }, () =>
      makeCluster(Math.random() * w, Math.random() * h)
    )
    // Pre-age them so they don't all appear at once
    clusters.forEach((c) => { c.life = Math.floor(Math.random() * c.maxLife) })

    // ── Shooting stars ──
    let shooters: Shooter[] = []
    let lastShot = -9999

    function spawnShooter(now: number) {
      lastShot = now
      shooters.push({
        x: snapPx(-20), y: snapPx(Math.random() * h * 0.7),
        vx: PX * (1.4 + Math.random() * 1.2),
        vy: PX * (0.3 + Math.random() * 0.5),
        life: 0, maxLife: Math.floor(w / (PX * 1.8)),
        color: Math.random() > 0.4 ? '#ffffff' : '#FFD700',
        trail: [],
      })
    }

    // ── Draw ──
    function draw(time: number) {
      ctx.clearRect(0, 0, w, h)

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += GRID) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      }
      for (let y = 0; y < h; y += GRID) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }

      const t = time * 0.001

      // Stars
      for (const s of stars) {
        const blink = (Math.sin(t * s.blinkSpeed + s.blinkOffset) + 1) / 2
        ctx.globalAlpha = s.brightness * (0.3 + blink * 0.7)
        ctx.fillStyle = s.color
        ctx.fillRect(snapPx(s.x), snapPx(s.y), s.size, s.size)
      }
      ctx.globalAlpha = 1

      // Clusters
      clusters = clusters.map((c) => {
        c.life++
        const fade = 40
        let alpha: number
        if (c.phase === 'in') {
          alpha = Math.min(c.life / fade, 1) * 0.75
          if (c.life >= fade) c.phase = 'hold'
        } else if (c.phase === 'hold') {
          alpha = 0.75
          if (c.life >= c.maxLife - fade) c.phase = 'out'
        } else {
          alpha = Math.max(0, (c.maxLife - c.life) / fade) * 0.75
        }
        if (c.life >= c.maxLife) {
          return makeCluster(Math.random() * w, Math.random() * h)
        }
        ctx.globalAlpha = alpha
        ctx.fillStyle = c.color
        for (const p of c.pixels) {
          ctx.fillRect(c.x + p.dx, c.y + p.dy, PX, PX)
        }
        ctx.globalAlpha = 1
        return c
      })

      // Shooting stars
      if (time - lastShot > 2800 + Math.random() * 3500) spawnShooter(time)
      shooters = shooters.filter((s) => s.life < s.maxLife && s.x < w + 40)
      for (const s of shooters) {
        s.trail.push({ x: s.x, y: s.y })
        if (s.trail.length > 14) s.trail.shift()
        s.x += s.vx
        s.y += s.vy
        s.life++
        for (let i = 0; i < s.trail.length; i++) {
          ctx.globalAlpha = (i / s.trail.length) * 0.85
          ctx.fillStyle = s.color
          const tx = snapPx(s.trail[i].x)
          const ty = snapPx(s.trail[i].y)
          const sz = i === s.trail.length - 1 ? PX * 2 : PX
          ctx.fillRect(tx, ty, sz, sz)
        }
        ctx.globalAlpha = 1
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
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
}
