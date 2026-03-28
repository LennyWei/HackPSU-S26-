'use client'

import { useEffect, useRef } from 'react'

interface Star {
  x: number; y: number; size: 1 | 2
  speed: number; brightness: number
  twinkleSpeed: number; twinkleOffset: number
}

export default function Starfield({ color = '255,220,120' }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let animId: number

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stars: Star[] = Array.from({ length: 130 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: (Math.random() < 0.3 ? 2 : 1) as 1 | 2,
      speed: Math.random() * 0.28 + 0.04,
      brightness: Math.random() * 0.6 + 0.4,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
    }))

    let frame = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++
      for (const s of stars) {
        s.y += s.speed
        if (s.y > canvas.height + 4) { s.y = -4; s.x = Math.random() * canvas.width }
        const alpha = s.brightness * (0.65 + 0.35 * Math.sin(frame * s.twinkleSpeed + s.twinkleOffset))
        ctx.fillStyle = `rgba(${color},${alpha * 0.7})`
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size)
      }
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [color])

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}
