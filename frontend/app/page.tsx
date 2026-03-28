'use client'

import { useState, useEffect, useRef, CSSProperties } from 'react'

/* ─────────────────────────────────────────────
   STAR FIELD
───────────────────────────────────────────── */
interface Star {
  x: number
  y: number
  size: 1 | 2
  speed: number
  brightness: number
  twinkleSpeed: number
  twinkleOffset: number
}

function StarField() {
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
      size: Math.random() < 0.3 ? 2 : 1,
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
        if (s.y > canvas.height + 4) {
          s.y = -4
          s.x = Math.random() * canvas.width
        }
        const alpha =
          s.brightness *
          (0.65 + 0.35 * Math.sin(frame * s.twinkleSpeed + s.twinkleOffset))
        ctx.fillStyle = `rgba(180,240,255,${alpha})`
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size)
      }
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
}

/* ─────────────────────────────────────────────
   PIXEL ART SPACESHIP
───────────────────────────────────────────── */
const SHIP_GRID = [
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
]

function SpaceshipIcon({ success }: { success: boolean }) {
  const color = success ? '#39ff14' : '#00f0ff'
  const shadow = success
    ? '0 0 8px #39ff14, 0 0 16px #39ff1480'
    : '0 0 6px #00f0ff80'

  return (
    <div style={{ marginBottom: 14, lineHeight: 0 }}>
      {SHIP_GRID.map((row, r) => (
        <div key={r} style={{ display: 'flex', justifyContent: 'center' }}>
          {row.map((cell, c) => (
            <div
              key={c}
              style={{
                width: 6,
                height: 6,
                backgroundColor: cell ? color : 'transparent',
                boxShadow: cell ? shadow : 'none',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   UPLOAD ZONE
───────────────────────────────────────────── */
function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = (f: File | undefined) => {
    if (f?.type === 'application/pdf') {
      setFile(f)
      onFile(f)
    }
  }

  const borderColor = file ? '#39ff14' : dragging ? '#bf00ff' : '#00f0ff'
  const glowColor = file ? '#39ff14' : dragging ? '#bf00ff' : '#00f0ff'

  const zoneStyle: CSSProperties = {
    width: '100%',
    minHeight: 190,
    border: `2px dashed ${borderColor}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: '28px 20px',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s',
    boxShadow: `0 0 14px ${glowColor}44, inset 0 0 24px ${glowColor}0a`,
    backgroundColor: `${glowColor}08`,
  }

  return (
    <div
      style={zoneStyle}
      onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]) }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <SpaceshipIcon success={!!file} />
      <p style={{
        margin: 0,
        fontSize: 'clamp(7px, 1.8vw, 10px)',
        color: file ? '#39ff14' : '#00f0ff',
        textAlign: 'center',
        lineHeight: 2.4,
        fontFamily: 'var(--font-pixel), monospace',
        whiteSpace: 'pre-wrap',
        textShadow: file ? '0 0 6px #39ff1488' : '0 0 6px #00f0ff88',
      }}>
        {file
          ? file.name
          : dragging
          ? 'Release to upload!'
          : 'Drop your PDF here\nor click to upload'}
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────
   LOADING SCREEN
───────────────────────────────────────────── */
const LOADING_LINES = [
  'Reading your notes...',
  'Identifying weaknesses...',
  'Building your nemesis...',
  'Preparing for battle...',
]

function LoadingScreen() {
  const [visible, setVisible] = useState<string[]>([])
  const [cursorIdx, setCursorIdx] = useState(0)

  useEffect(() => {
    let i = 0
    const show = () => {
      if (i >= LOADING_LINES.length) return
      setVisible((prev) => [...prev, LOADING_LINES[i]])
      setCursorIdx(i)
      i++
      if (i < LOADING_LINES.length) setTimeout(show, 1500)
    }
    const t = setTimeout(show, 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-pixel), monospace',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: 40 }}>
          {visible.map((line, i) => (
            <p key={i} style={{
              margin: 0,
              fontSize: 'clamp(8px, 2vw, 13px)',
              color: '#00f0ff',
              textShadow: '0 0 8px #00f0ffaa',
              lineHeight: 1.6,
              animation: 'fadeSlide 0.4s ease',
            }}>
              <span style={{ color: '#39ff14', textShadow: '0 0 6px #39ff14aa' }}>&gt; </span>
              {line}
              {i === cursorIdx && (
                <span style={{
                  display: 'inline-block',
                  color: '#00f0ff',
                  marginLeft: 3,
                  animation: 'blink 0.75s step-start infinite',
                }}>_</span>
              )}
            </p>
          ))}
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────── */
export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [btnHover, setBtnHover] = useState(false)

  if (loading) return <LoadingScreen />

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes titlePulse {
          0%, 100% { text-shadow: 0 0 8px #00f0ff, 0 0 20px #00f0ffaa, 0 0 40px #00f0ff44; }
          50%       { text-shadow: 0 0 14px #00f0ff, 0 0 32px #00f0ffcc, 0 0 60px #00f0ff66; }
        }
        @keyframes accentPulse {
          0%, 100% { text-shadow: 0 0 8px #bf00ff, 0 0 20px #bf00ffaa, 0 0 40px #bf00ff44; }
          50%       { text-shadow: 0 0 14px #bf00ff, 0 0 32px #bf00ffcc, 0 0 60px #bf00ff66; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #00f0ff44; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-pixel), monospace',
      }}>
        <StarField />

        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          padding: '40px 24px',
          maxWidth: 560,
          width: '100%',
          animation: 'fadeIn 0.7s ease',
        }}>

          {/* ── Logo ── */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['STUDY', 'BOSS', 'BATTLE'].map((word) => (
              <h1
                key={word}
                style={{
                  margin: 0,
                  fontSize: 'clamp(16px, 4.5vw, 30px)',
                  letterSpacing: 3,
                  color: word === 'BOSS' ? '#bf00ff' : '#00f0ff',
                  animation: word === 'BOSS' ? 'accentPulse 2.5s ease-in-out infinite' : 'titlePulse 2.5s ease-in-out infinite',
                  animationDelay: word === 'BATTLE' ? '0.4s' : '0s',
                }}
              >
                {word}
              </h1>
            ))}
          </div>

          {/* ── Tagline ── */}
          <p style={{
            fontSize: 'clamp(6px, 1.6vw, 9px)',
            color: '#888',
            textAlign: 'center',
            lineHeight: 2.4,
            letterSpacing: 1,
          }}>
            Upload your notes.{' '}
            <span style={{ color: '#00f0ff', textShadow: '0 0 6px #00f0ff88' }}>
              Face your nemesis.
            </span>
          </p>

          {/* ── Upload Zone ── */}
          <UploadZone onFile={setFile} />

          {/* ── Warning ── */}
          <p style={{
            fontSize: 'clamp(5px, 1.4vw, 7px)',
            color: '#444',
            textAlign: 'center',
            letterSpacing: 1,
          }}>
            Best with 5–50 pages
          </p>

          {/* ── Begin Battle ── */}
          {file && (
            <button
              style={{
                fontFamily: 'var(--font-pixel), monospace',
                fontSize: 'clamp(8px, 2vw, 11px)',
                letterSpacing: 2,
                color: btnHover ? '#000' : '#bf00ff',
                backgroundColor: btnHover ? '#bf00ff' : 'transparent',
                border: '2px solid #bf00ff',
                padding: '14px 32px',
                cursor: 'pointer',
                textShadow: btnHover ? 'none' : '0 0 8px #bf00ff',
                boxShadow: btnHover
                  ? '0 0 30px #bf00ffaa'
                  : '0 0 12px #bf00ff44',
                transition: 'all 0.15s ease',
                animation: 'fadeIn 0.4s ease',
                marginTop: 4,
              }}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              onClick={() => setLoading(true)}
            >
              &gt; BEGIN BATTLE &lt;
            </button>
          )}
        </div>
      </div>
    </>
  )
}
