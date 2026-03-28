'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/context/GameContext'
import { uploadPDF } from '@/lib/api'
import Starfield from '@/components/ui/Starfield'

/* ─────────────────────────────────────────────
   BOSS PIXEL ART
───────────────────────────────────────────── */
const BOSS_GRID = [
  [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  [0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 0, 0],
  [0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
]

function BossIcon({ active }: { active: boolean }) {
  const body = active ? '#FF3333' : '#AA0018'
  const eye = '#FFE000'
  const bodyGlow = active ? '0 0 6px #FF333399, 0 0 14px #FF333344' : '0 0 3px #AA001866'
  const eyeGlow = '0 0 5px #FFE000cc, 0 0 10px #FFE00088'
  return (
    <div style={{ lineHeight: 0, animation: 'bossFloat 2.4s ease-in-out infinite', flexShrink: 0 }}>
      {BOSS_GRID.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => (
            <div key={c} style={{
              width: 7, height: 7,
              backgroundColor: cell === 1 ? body : cell === 2 ? eye : 'transparent',
              boxShadow: cell === 1 ? bodyGlow : cell === 2 ? eyeGlow : 'none',
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   HP BAR
───────────────────────────────────────────── */
function HpBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const segments = 18
  const filled = Math.round((value / max) * segments)
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 'clamp(4px, 1.2vw, 6px)', color, letterSpacing: 2, textShadow: `0 0 5px ${color}88` }}>{label}</span>
        <span style={{ fontSize: 'clamp(4px, 1.2vw, 6px)', color: '#555', letterSpacing: 1 }}>{value}/{max}</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: segments }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 7,
            backgroundColor: i < filled ? color : '#111',
            boxShadow: i < filled ? `0 0 4px ${color}88` : 'none',
          }} />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   PIXEL CORNER
───────────────────────────────────────────── */
function PixelCorner({ pos, color }: { pos: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const isTop = pos.startsWith('t')
  const isLeft = pos.endsWith('l')
  return (
    <div style={{
      position: 'absolute',
      ...(isTop ? { top: -1 } : { bottom: -1 }),
      ...(isLeft ? { left: -1 } : { right: -1 }),
      width: 14, height: 14,
      borderTop: isTop ? `3px solid ${color}` : 'none',
      borderBottom: !isTop ? `3px solid ${color}` : 'none',
      borderLeft: isLeft ? `3px solid ${color}` : 'none',
      borderRight: !isLeft ? `3px solid ${color}` : 'none',
      pointerEvents: 'none',
    }} />
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
    if (f?.type === 'application/pdf') { setFile(f); onFile(f) }
  }

  const borderColor = file ? '#39FF14' : dragging ? '#FF0040' : '#FFD700'
  const glowColor = file ? '#39FF14' : dragging ? '#FF0040' : '#FFD700'

  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontSize: 'clamp(4px, 1.1vw, 6px)', color: '#444', letterSpacing: 2, marginBottom: 6 }}>
        ── SELECT WEAPON ─────────────────────────
      </div>
      <div
        style={{
          width: '100%', minHeight: 120,
          border: `2px solid ${borderColor}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: '20px 16px', boxSizing: 'border-box',
          transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s',
          boxShadow: `0 0 12px ${glowColor}44, inset 0 0 20px ${glowColor}0a`,
          backgroundColor: `${glowColor}06`, position: 'relative',
        }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => accept(e.target.files?.[0])} />
        <PixelCorner pos="tl" color={borderColor} />
        <PixelCorner pos="tr" color={borderColor} />
        <PixelCorner pos="bl" color={borderColor} />
        <PixelCorner pos="br" color={borderColor} />
        <p style={{
          margin: 0, fontSize: 'clamp(6px, 1.7vw, 9px)',
          color: file ? '#39FF14' : '#FFD700',
          textAlign: 'center', lineHeight: 2.4,
          fontFamily: 'var(--font-pixel), monospace',
          textShadow: file ? '0 0 6px #39FF1488' : '0 0 6px #FFD70088',
        }}>
          {file ? `► ${file.name}` : dragging ? '▼ DROP HERE ▼' : '▲ DROP PDF HERE ▲\nor click to browse'}
        </p>
        {file && (
          <div style={{ marginTop: 6, fontSize: 'clamp(4px, 1vw, 6px)', color: '#39FF14', letterSpacing: 2, textShadow: '0 0 4px #39FF1488' }}>
            SCROLL LOADED ✓
          </div>
        )}
      </div>
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

function LoadingScreen({ pdfBase64, onReady, onError }: {
  pdfBase64: string
  onReady: () => void
  onError: (msg: string) => void
}) {
  const { initGame } = useGame()
  const [visible, setVisible] = useState<string[]>([])
  const [cursorIdx, setCursorIdx] = useState(0)
  const calledRef = useRef(false)

  useEffect(() => {
    // Cycle loading messages
    let i = 0
    const show = () => {
      if (i >= LOADING_LINES.length) return
      setVisible((prev) => [...prev, LOADING_LINES[i]])
      setCursorIdx(i); i++
      if (i < LOADING_LINES.length) setTimeout(show, 1600)
    }
    setTimeout(show, 300)

    // Call API in parallel
    if (!calledRef.current) {
      calledRef.current = true
      uploadPDF(pdfBase64)
        .then((data) => {
          initGame(data.bossRush, data.bosses)
          onReady()
        })
        .catch((err) => onError(err.message ?? 'Upload failed'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#050505',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-pixel), monospace', position: 'relative', overflow: 'hidden',
    }}>
      <Starfield />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.13) 2px, rgba(0,0,0,0.13) 4px)',
      }} />
      <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', gap: 28, padding: 40 }}>
        <p style={{ margin: 0, marginBottom: 8, fontSize: 'clamp(7px, 2vw, 12px)', color: '#FF0040', textShadow: '0 0 8px #FF0040aa', letterSpacing: 3 }}>
          ── LOADING ──
        </p>
        {visible.map((line, i) => (
          <p key={i} style={{
            margin: 0, fontSize: 'clamp(7px, 1.8vw, 11px)',
            color: '#FFD700', textShadow: '0 0 8px #FFD70088',
            lineHeight: 1.6, animation: 'fadeSlide 0.4s ease',
          }}>
            <span style={{ color: '#39FF14', textShadow: '0 0 6px #39FF14aa' }}>&gt;&gt; </span>
            {line}
            {i === cursorIdx && (
              <span style={{ display: 'inline-block', color: '#FFD700', marginLeft: 3, animation: 'blink 0.75s step-start infinite' }}>█</span>
            )}
          </p>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────── */
export default function Home() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [btnHover, setBtnHover] = useState(false)
  const [score] = useState(() => Math.floor(Math.random() * 900000 + 10000))
  const [hiScore] = useState(() => Math.floor(Math.random() * 9000000 + 100000))

  const handleFile = (f: File) => {
    setFile(f)
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1]
      setPdfBase64(b64)
    }
    reader.readAsDataURL(f)
  }

  if (loading && pdfBase64) {
    return (
      <LoadingScreen
        pdfBase64={pdfBase64}
        onReady={() => router.push('/boss')}
        onError={(msg) => { setError(msg); setLoading(false) }}
      />
    )
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes titleFlicker {
          0%,19%,21%,23%,54%,56%,100% { text-shadow: 0 0 6px #FF0040, 0 0 18px #FF0040aa, 0 0 36px #FF004055; opacity: 1; }
          20%,24%,55% { opacity: 0.82; text-shadow: none; }
        }
        @keyframes titlePulse {
          0%,100% { text-shadow: 0 0 8px #FFD700, 0 0 22px #FFD700aa, 0 0 44px #FFD70044; }
          50%      { text-shadow: 0 0 16px #FFD700, 0 0 36px #FFD700cc, 0 0 66px #FFD70066; }
        }
        @keyframes bossFloat {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes insertCoin {
          0%,49%  { opacity: 1; }
          50%,99% { opacity: 0; }
          100%    { opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanlines {
          0%   { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        @keyframes screenFlicker {
          0%,96%,100% { opacity: 1; }
          97%          { opacity: 0.91; }
          98%          { opacity: 0.97; }
          99%          { opacity: 0.93; }
        }
        @keyframes btnReady {
          0%,100% { box-shadow: 0 0 10px #FF004044, 0 0 30px #FF004022; }
          50%      { box-shadow: 0 0 22px #FF0040aa, 0 0 50px #FF004055; }
        }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #FFD70044; }
      `}</style>

      <div style={{
        minHeight: '100vh', backgroundColor: '#050505',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        fontFamily: 'var(--font-pixel), monospace',
        animation: 'screenFlicker 9s ease-in-out infinite',
      }}>
        <Starfield />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
          animation: 'scanlines 0.08s linear infinite',
        }} />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.85) 100%)',
        }} />

        {/* HUD */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 6,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '10px 20px 8px',
          borderBottom: '1px solid #FFD70018',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 100%)',
        }}>
          <div>
            <div style={{ fontSize: 'clamp(4px, 0.9vw, 6px)', color: '#FF0040', letterSpacing: 3, textShadow: '0 0 4px #FF004088' }}>1UP</div>
            <div style={{ fontSize: 'clamp(6px, 1.3vw, 8px)', color: '#fff', letterSpacing: 1, marginTop: 2 }}>{String(score).padStart(6, '0')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(4px, 0.9vw, 6px)', color: '#FFD700', letterSpacing: 3, textShadow: '0 0 4px #FFD70088' }}>HI-SCORE</div>
            <div style={{ fontSize: 'clamp(6px, 1.3vw, 8px)', color: '#FFD700', letterSpacing: 1, marginTop: 2, textShadow: '0 0 6px #FFD70088' }}>{String(hiScore).padStart(7, '0')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'clamp(4px, 0.9vw, 6px)', color: '#39FF14', letterSpacing: 3, textShadow: '0 0 4px #39FF1488' }}>CREDITS</div>
            <div style={{ fontSize: 'clamp(6px, 1.3vw, 8px)', color: '#fff', letterSpacing: 1, marginTop: 2 }}>03</div>
          </div>
        </div>

        {/* Main panel */}
        <div style={{
          position: 'relative', zIndex: 3,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 14,
          padding: '52px 28px 28px',
          maxWidth: 520, width: '100%',
          animation: 'fadeIn 0.7s ease',
        }}>
          {/* Title */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 6 }}>
              {['STUDY', 'BOSS'].map((word) => (
                <h1 key={word} style={{ margin: 0, fontSize: 'clamp(13px, 3.5vw, 22px)', letterSpacing: 5, color: '#FF0040', animation: 'titleFlicker 7s linear infinite' }}>{word}</h1>
              ))}
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(18px, 5vw, 34px)', letterSpacing: 6, color: '#FFD700', animation: 'titlePulse 2.2s ease-in-out infinite' }}>BATTLE</h1>
            <p style={{ marginTop: 10, fontSize: 'clamp(5px, 1.3vw, 7px)', color: '#444', letterSpacing: 3, lineHeight: 2 }}>
              UPLOAD YOUR NOTES.{' '}
              <span style={{ color: '#FF0040', textShadow: '0 0 4px #FF004088' }}>FACE YOUR NEMESIS.</span>
            </p>
          </div>

          <div style={{ width: '100%', height: 2, background: 'linear-gradient(90deg, transparent 0%, #FF0040 20%, #FFD700 50%, #FF0040 80%, transparent 100%)', boxShadow: '0 0 8px #FFD70055' }} />

          {/* Enemy panel */}
          <div style={{
            width: '100%', padding: '14px 16px',
            border: '1px solid #FF004033', backgroundColor: '#0d0000', position: 'relative',
          }}>
            <PixelCorner pos="tl" color="#FF0040" /><PixelCorner pos="tr" color="#FF0040" />
            <PixelCorner pos="bl" color="#FF0040" /><PixelCorner pos="br" color="#FF0040" />
            <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#FF004066', letterSpacing: 3, marginBottom: 10 }}>── ENEMY ──────────────────────────</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 'clamp(7px, 1.8vw, 10px)', color: '#FF3333', letterSpacing: 2, textShadow: '0 0 6px #FF333388' }}>???_NEMESIS</div>
                <HpBar label="HP" value={999} max={999} color="#FF0040" />
                <HpBar label="MP" value={750} max={999} color="#bf00ff" />
              </div>
              <BossIcon active={!!file} />
            </div>
          </div>

          <UploadZone onFile={handleFile} />

          {error && (
            <div style={{ fontSize: 'clamp(5px, 1.3vw, 7px)', color: '#FF0040', textAlign: 'center', letterSpacing: 1 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#333', letterSpacing: 2, textAlign: 'center' }}>
            BEST WITH 5–50 PAGES · PDF FORMAT ONLY
          </div>

          <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, #FFD70033, transparent)' }} />

          {file ? (
            <button
              style={{
                fontFamily: 'var(--font-pixel), monospace',
                fontSize: 'clamp(8px, 2vw, 12px)', letterSpacing: 3,
                color: btnHover ? '#000' : '#FF0040',
                backgroundColor: btnHover ? '#FF0040' : 'transparent',
                border: '2px solid #FF0040', padding: '16px 40px', cursor: 'pointer',
                textShadow: btnHover ? 'none' : '0 0 8px #FF0040',
                transition: 'all 0.12s ease',
                animation: btnHover ? 'none' : 'btnReady 1.4s ease-in-out infinite',
              }}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              onClick={() => setLoading(true)}
            >
              ► BEGIN BATTLE ◄
            </button>
          ) : (
            <div style={{ fontSize: 'clamp(8px, 2.2vw, 13px)', color: '#FFD700', letterSpacing: 4, animation: 'insertCoin 1.1s step-start infinite', textShadow: '0 0 10px #FFD700' }}>
              ─ INSERT COIN ─
            </div>
          )}
        </div>
      </div>
    </>
  )
}
