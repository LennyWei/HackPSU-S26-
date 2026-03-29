'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/context/GameContext'
import { uploadPDF } from '@/lib/api'
import CosmicStarfield, { CosmicStarfieldHandle } from '@/components/ui/cosmic-starfield'

/* ── PALETTE ─────────────────────────────────────────────── */
const C = {
  bg:          '#0a0a0f',
  panel:       '#0d0d18',
  cyan:        '#00e5ff',
  cyanBorder:  '#007a8a',   // default zone / unselected button border
  cyanActiveBg:'#071416',   // ≈ rgba(0,229,255,0.1) over bg
  purple:      '#aa00ff',
  pink:        '#ff0088',
  gold:        '#ffd600',   // unlocked button border/text
  goldAlt:     '#a88a00',   // step-end pulse alternate
  goldBg:      '#0e0b00',   // ≈ rgba(255,214,0,0.06) over bg
  goldDim:     '#261a00',
  text:        '#b8ccd6',
  textDim:     '#2a3a44',
  lockedBorder:'#4a6a7a',   // locked button border/text
  green:       '#00ff88',
  red:         '#ff3838',
  dimBorder:   '#1a2830',
}

/* ── CLIP-PATH OCTAGONS ──────────────────────────────────── */
const OCT8 = 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)'
const OCT5 = 'polygon(5px 0%, calc(100% - 5px) 0%, 100% 5px, 100% calc(100% - 5px), calc(100% - 5px) 100%, 5px 100%, 0% calc(100% - 5px), 0% 5px)'

/* ── SPARK PARTICLES ─────────────────────────────────────── */
type Spark = {
  id: number; x: number; y: number; vx: number; vy: number
  color: string; size: number; life: number; maxLife: number
}
const SPARK_COLORS = ['#00e5ff', '#aa00ff', '#ff0088', '#ffc700', '#ffffff']

function SparkParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sparksRef = useRef<Spark[]>([])
  const frameRef  = useRef(0)
  const nextId    = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let tick = 0
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      tick++

      if (tick % 3 === 0 && sparksRef.current.length < 70) {
        const cx = canvas.width / 2
        const cy = canvas.height / 2
        const angle = Math.random() * Math.PI * 2
        const speed = 0.4 + Math.random() * 1.4
        sparksRef.current.push({
          id: nextId.current++,
          x: cx + (Math.random() - 0.5) * 60,
          y: cy + (Math.random() - 0.5) * 60,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          size: Math.random() < 0.4 ? 3 : 2,
          life: 0,
          maxLife: 100 + Math.random() * 200,
        })
      }

      sparksRef.current = sparksRef.current.filter(s => s.life < s.maxLife)
      for (const s of sparksRef.current) {
        s.x += s.vx; s.y += s.vy; s.life++
        ctx.globalAlpha = Math.pow(1 - s.life / s.maxLife, 1.4)
        ctx.fillStyle   = s.color
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size)
      }
      ctx.globalAlpha = 1
    }
    animate()

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}
    />
  )
}

/* ── UPLOAD ZONE ─────────────────────────────────────────── */
function UploadZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false)
  const [files, setFiles]       = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const pdfs  = Array.from(incoming).filter(f => f.type === 'application/pdf')
    if (!pdfs.length) return
    const names = new Set(files.map(f => f.name))
    const next  = [...files, ...pdfs.filter(f => !names.has(f.name))]
    setFiles(next)
    onFiles(next)
  }

  const remove = (name: string) => {
    const next = files.filter(f => f.name !== name)
    setFiles(next)
    onFiles(next)
  }

  const zoneBorder = dragging ? C.cyan : C.cyanBorder
  const zoneBg     = C.bg

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Drop zone ── */}
      <div
        style={{
          background: zoneBorder,
          clipPath: OCT8,
          padding: 2,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <div style={{
          background: zoneBg,
          clipPath: OCT8,
          minHeight: 94,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px',
        }}>
          <input
            ref={inputRef} type="file" accept=".pdf" multiple
            style={{ display: 'none' }}
            onChange={(e) => addFiles(e.target.files)}
          />
          <p style={{
            margin: 0,
            fontSize: 'clamp(7px, 1.6vw, 10px)',
            color: dragging ? C.cyan : C.text,
            textAlign: 'center', lineHeight: 2.4,
            fontFamily: 'var(--font-pixel), monospace',
            letterSpacing: 1,
          }}>
            {dragging ? '▼  DROP  HERE  ▼' : '▲ DROP PDF(S) HERE ▲\nor click to browse'}
          </p>
        </div>
      </div>

      {/* ── File list ── */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{
            fontSize: 'clamp(5px, 1vw, 7px)',
            color: C.cyan,
            letterSpacing: 3,
            textAlign: 'center',
            fontFamily: 'var(--font-pixel), monospace',
            marginBottom: 2,
          }}>
            -- {files.length} FILE{files.length > 1 ? 'S' : ''} LOADED --
          </div>

          {files.map((f) => (
            <div
              key={f.name}
              style={{ background: C.green, clipPath: OCT5, padding: 1 }}
            >
              <div style={{
                background: C.panel,
                clipPath: OCT5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 12px',
              }}>
                <span style={{
                  fontSize: 'clamp(7px, 1.5vw, 9px)',
                  color: C.green,
                  letterSpacing: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: '80%',
                  fontFamily: 'var(--font-mono), monospace',
                }}>
                  ► {f.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(f.name) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 'clamp(9px, 1.8vw, 12px)',
                    color: C.red,
                    fontFamily: 'var(--font-pixel), monospace',
                    padding: '2px 4px', flexShrink: 0, lineHeight: 1,
                  }}
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Hint ── */}
      <div style={{
        fontSize: 'clamp(4px, 0.85vw, 6px)',
        color: C.textDim,
        letterSpacing: 2,
        textAlign: 'center',
        fontFamily: 'var(--font-pixel), monospace',
        marginTop: 2,
      }}>
        BEST WITH 5–50 PAGES · PDF FORMAT ONLY
      </div>
    </div>
  )
}

/* ── LOADING SCREEN ──────────────────────────────────────── */
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
  const { initGame }          = useGame()
  const [visible, setVisible] = useState<string[]>([])
  const [cursorIdx, setCursorIdx] = useState(0)
  const calledRef = useRef(false)

  useEffect(() => {
    let i = 0
    const show = () => {
      if (i >= LOADING_LINES.length) return
      setVisible(prev => [...prev, LOADING_LINES[i]])
      setCursorIdx(i); i++
      if (i < LOADING_LINES.length) setTimeout(show, 1600)
    }
    setTimeout(show, 300)

    if (!calledRef.current) {
      calledRef.current = true
      uploadPDF(pdfBase64)
        .then(data => { initGame(data.bossRush, data.bosses); onReady() })
        .catch(err  => onError(err.message ?? 'Upload failed'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-pixel), monospace',
      position: 'relative', overflow: 'hidden',
    }}>
      <CosmicStarfield />
      <SparkParticles />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
      }} />
      <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', gap: 22, padding: 40 }}>
        <p style={{ margin: 0, marginBottom: 4, fontSize: 'clamp(7px, 2vw, 11px)', color: C.cyan, letterSpacing: 4 }}>
          ── LOADING ──
        </p>
        {visible.map((line, i) => (
          <p key={i} style={{
            margin: 0, fontSize: 'clamp(7px, 1.8vw, 10px)',
            color: C.text, lineHeight: 1.6,
            animation: 'fadeSlide 0.4s ease',
            fontFamily: 'var(--font-mono), monospace',
          }}>
            <span style={{ color: C.gold }}>&gt;&gt; </span>
            {line}
            {i === cursorIdx && (
              <span style={{
                display: 'inline-block', color: C.cyan, marginLeft: 3,
                animation: 'blink 0.75s step-start infinite',
              }}>█</span>
            )}
          </p>
        ))}
      </div>
    </div>
  )
}

/* ── HOME PAGE ───────────────────────────────────────────── */
type QuestionMode = 'mcq' | 'frq' | 'both'

const MODE_LABELS: Record<QuestionMode, string> = { mcq: 'MCQ', frq: 'FRQ', both: 'BOTH' }
const MODE_DESC: Record<QuestionMode, string>   = {
  mcq:  'Multiple choice only',
  frq:  'Free response only',
  both: 'Mixed questions',
}

const ALL_MODES: QuestionMode[] = ['mcq', 'frq', 'both']

export default function Home() {
  const router    = useRouter()
  const cosmicRef = useRef<CosmicStarfieldHandle>(null)

  const [files, setFiles]         = useState<File[]>([])
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [warping, setWarping]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [questionMode, setQuestionMode] = useState<QuestionMode | null>(null)

  useEffect(() => {
    // Sync from localStorage after hydration — but don't default to anything
    const saved = localStorage.getItem('question_mode') as QuestionMode | null
    if (saved && ALL_MODES.includes(saved)) setQuestionMode(saved)
  }, [])

  useEffect(() => {
    // Clear stale session data but preserve question_mode
    const savedMode = localStorage.getItem('question_mode')
    localStorage.clear()
    if (savedMode) localStorage.setItem('question_mode', savedMode)
  }, [])

  const handleModeChange = (mode: QuestionMode) => {
    setQuestionMode(mode)
    localStorage.setItem('question_mode', mode)
  }

  const handleFiles = (incoming: File[]) => {
    setFiles(incoming)
    if (!incoming.length) { setPdfBase64(null); return }
    const reader = new FileReader()
    reader.onload = () => { setPdfBase64((reader.result as string).split(',')[1]) }
    reader.readAsDataURL(incoming[0])
  }

  if (loading && pdfBase64) {
    return (
      <LoadingScreen
        pdfBase64={pdfBase64}
        onReady={() => router.push('/boss')}
        onError={msg => { setError(msg); setLoading(false) }}
      />
    )
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes titleFlicker {
          0%,19%,21%,23%,54%,56%,100% { opacity: 1; }
          20%,24%,55% { opacity: 0.6; }
        }
        @keyframes titlePulse {
          0%,100% { opacity: 0.88; text-shadow: 0 0 8px ${C.cyan}44; }
          50%      { opacity: 1;    text-shadow: 0 0 20px ${C.cyan}88; }
        }
        @keyframes insertCoin {
          0%,49%  { opacity: 1; }
          50%,99% { opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes battleBorderPulse {
          0%   { background: ${C.gold}; }
          50%  { background: ${C.goldAlt}; }
          100% { background: ${C.gold}; }
        }
        @keyframes battleTextPulse {
          0%   { color: ${C.gold}; }
          50%  { color: ${C.goldAlt}; }
          100% { color: ${C.gold}; }
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.dimBorder}; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        backgroundColor: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        fontFamily: 'var(--font-pixel), monospace',
      }}>
        <CosmicStarfield ref={cosmicRef} />

        {/* CRT scanlines */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
        }} />
        {/* Vignette */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, transparent 44%, rgba(0,0,0,0.74) 100%)',
        }} />

        {/* ── MAIN PANEL ── */}
        <div style={{
          position: 'relative', zIndex: 3,
          transform: warping ? 'scale(25)' : 'scale(1)',
          opacity:   warping ? 0 : 1,
          transition: warping
            ? 'transform 0.75s cubic-bezier(0.4,0,1,1), opacity 0.75s ease-in'
            : 'none',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 22,
          padding: '44px 40px',
          maxWidth: 680, width: '100%',
          animation: 'fadeIn 0.55s ease',
        }}>

          {/* ── TITLE ── */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <h1 style={{
              margin: 0,
              marginBottom: 8,
              fontSize: 'clamp(22px, 5.5vw, 42px)',
              letterSpacing: 6, color: C.cyan,
              animation: 'titleFlicker 7s linear infinite',
              fontFamily: 'var(--font-pixel), monospace',
            }}>BRAIN BRAWL</h1>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 4 }}>
              {['STUDY', 'BOSS', 'BATTLE'].map(word => (
                <span key={word} style={{
                  fontSize: 'clamp(10px, 2.4vw, 16px)',
                  letterSpacing: 4, color: C.text,
                  animation: 'titlePulse 3s ease-in-out infinite',
                  fontFamily: 'var(--font-pixel), monospace',
                }}>{word}</span>
              ))}
            </div>
            <p style={{
              marginTop: 10,
              fontSize: 'clamp(5px, 1.2vw, 7px)',
              color: C.textDim, letterSpacing: 3, lineHeight: 2,
              fontFamily: 'var(--font-pixel), monospace',
            }}>
              UPLOAD YOUR NOTES. FACE YOUR NEMESIS.
            </p>
          </div>

          <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, transparent, ${C.dimBorder}, transparent)` }} />

          {/* ── UPLOAD ZONE ── */}
          <UploadZone onFiles={handleFiles} />

          {error && (
            <div style={{
              fontSize: 'clamp(5px, 1.2vw, 7px)',
              color: C.red, textAlign: 'center', letterSpacing: 1,
              fontFamily: 'var(--font-pixel), monospace',
            }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, transparent, ${C.dimBorder}, transparent)` }} />

          {/* ── QUESTION MODE ── */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontSize: 'clamp(4px, 0.9vw, 6px)',
              color: C.textDim, letterSpacing: 2,
              fontFamily: 'var(--font-pixel), monospace',
            }}>
              ── QUESTION MODE
            </div>
            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
              {ALL_MODES.map(mode => {
                const active = questionMode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    style={{
                      flex: 1, cursor: 'pointer',
                      border: 'none', padding: 0,
                      background: 'transparent',
                    }}
                  >
                    {/* border layer */}
                    <div style={{
                      background: active ? C.cyan : '#2a6a7a',
                      clipPath: OCT8, padding: 2,
                      transition: 'background 0.15s',
                    }}>
                      {/* content */}
                      <div style={{
                        background: active ? C.cyanActiveBg : '#0d1e24',
                        clipPath: OCT8,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 5,
                        padding: '10px 4px 9px',
                        transition: 'background 0.15s',
                      }}>
                        <span style={{
                          fontSize: 'clamp(10px, 1.8vw, 13px)',
                          color: active ? C.cyan : '#7ecede',
                          fontFamily: 'var(--font-pixel), monospace',
                          letterSpacing: 2,
                          transition: 'color 0.15s',
                        }}>
                          {MODE_LABELS[mode]}
                        </span>
                        <span style={{
                          fontSize: 'clamp(9px, 1.2vw, 11px)',
                          color: active ? `${C.cyan}bb` : '#5a9aaa',
                          fontFamily: 'var(--font-mono), monospace',
                          letterSpacing: 0,
                          textAlign: 'center',
                          lineHeight: 1.6,
                          transition: 'color 0.15s',
                        }}>
                          {MODE_DESC[mode]}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, transparent, ${C.dimBorder}, transparent)` }} />

          {/* ── START BUTTON ── */}
          {files.length > 0 ? (
            <div
              style={{ cursor: 'pointer', width: '100%' }}
              onClick={() => {
                cosmicRef.current?.triggerWarp()
                setWarping(true)
                setTimeout(() => setLoading(true), 750)
              }}
            >
              {/* border layer — step-end pulse between gold and dark gold */}
              <div style={{
                clipPath: OCT8, padding: 2,
                animation: 'battleBorderPulse 0.9s step-end infinite',
              }}>
                <div style={{
                  background: C.goldBg,
                  clipPath: OCT8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '14px 24px',
                }}>
                  <span style={{
                    fontSize: 'clamp(8px, 2vw, 12px)',
                    letterSpacing: 4,
                    fontFamily: 'var(--font-pixel), monospace',
                    animation: 'battleTextPulse 0.9s step-end infinite',
                  }}>
                    ► BEGIN BATTLE ◄
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', cursor: 'not-allowed' }}>
              <div style={{ background: C.lockedBorder, clipPath: OCT8, padding: 2, opacity: 0.55 }}>
                <div style={{
                  background: C.panel,
                  clipPath: OCT8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '14px 24px',
                }}>
                  <span style={{
                    fontSize: 'clamp(8px, 2vw, 12px)',
                    letterSpacing: 4,
                    color: C.lockedBorder,
                    fontFamily: 'var(--font-pixel), monospace',
                  }}>
                    ► BEGIN BATTLE ◄
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
