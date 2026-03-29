'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/context/GameContext'
import { uploadPDF } from '@/lib/api'
import PixelButton from '@/components/ui/pixel-hover-effect'
import CosmicStarfield, { CosmicStarfieldHandle } from '@/components/ui/cosmic-starfield'

/* palette */
const C = {
  bg:      '#08051a',
  panel:   '#0e1318',
  border:  '#2a3340',
  borderHi:'#4a6070',
  text:    '#a8b8c4',
  textDim: '#3a4a54',
  accent:  '#5a8fa8',   // muted steel blue
  gold:    '#9a8050',   // muted amber
  green:   '#4a7858',   // muted sage
  red:     '#8a3a30',   // muted brick
}

/* ─────────────────────────────────────────────
   PIXEL CORNER
───────────────────────────────────────────── */
function PixelCorner({ pos, color }: { pos: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const isTop  = pos.startsWith('t')
  const isLeft = pos.endsWith('l')
  return (
    <div style={{
      position: 'absolute',
      ...(isTop  ? { top: -1 }    : { bottom: -1 }),
      ...(isLeft ? { left: -1 }   : { right: -1 }),
      width: 12, height: 12,
      borderTop:    isTop    ? `2px solid ${color}` : 'none',
      borderBottom: !isTop   ? `2px solid ${color}` : 'none',
      borderLeft:   isLeft   ? `2px solid ${color}` : 'none',
      borderRight:  !isLeft  ? `2px solid ${color}` : 'none',
      pointerEvents: 'none',
    }} />
  )
}

/* ─────────────────────────────────────────────
   UPLOAD ZONE
───────────────────────────────────────────── */
function UploadZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging]   = useState(false)
  const [files, setFiles]         = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const pdfs = Array.from(incoming).filter(f => f.type === 'application/pdf')
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

  const borderColor = dragging ? C.accent : files.length > 0 ? C.green : C.border

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Drop zone */}
      <div
        style={{
          width: '100%', minHeight: 100,
          border: `2px solid ${borderColor}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: '18px 16px', boxSizing: 'border-box',
          transition: 'border-color 0.2s, background-color 0.2s',
          backgroundColor: dragging ? `${C.accent}08` : `${C.panel}`,
          position: 'relative',
        }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input
          ref={inputRef} type="file" accept=".pdf" multiple
          style={{ display: 'none' }}
          onChange={(e) => addFiles(e.target.files)}
        />
        <PixelCorner pos="tl" color={borderColor} />
        <PixelCorner pos="tr" color={borderColor} />
        <PixelCorner pos="bl" color={borderColor} />
        <PixelCorner pos="br" color={borderColor} />
        <p style={{
          margin: 0, fontSize: 'clamp(7px, 1.6vw, 10px)',
          color: dragging ? C.accent : C.text,
          textAlign: 'center', lineHeight: 2.2,
          fontFamily: 'var(--font-pixel), monospace',
        }}>
          {dragging ? '▼ DROP HERE ▼' : '▲ DROP PDF(S) HERE ▲\nor click to browse'}
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: C.textDim, letterSpacing: 2, marginBottom: 2 }}>
            ── {files.length} FILE{files.length > 1 ? 'S' : ''} LOADED
          </div>
          {files.map((f) => (
            <div key={f.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px',
              border: `1px solid ${C.border}`,
              backgroundColor: C.panel,
              position: 'relative',
            }}>
              <PixelCorner pos="tl" color={C.green} />
              <PixelCorner pos="br" color={C.green} />
              <span style={{ fontSize: 'clamp(6px, 1.4vw, 8px)', color: C.green, letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                ► {f.name}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); remove(f.name) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 'clamp(7px, 1.4vw, 9px)', color: C.red,
                  fontFamily: 'var(--font-pixel), monospace', letterSpacing: 1,
                  padding: '2px 4px', flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
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
  const { initGame }  = useGame()
  const [visible, setVisible] = useState<string[]>([])
  const [cursorIdx, setCursorIdx] = useState(0)
  const calledRef = useRef(false)

  useEffect(() => {
    let i = 0
    const show = () => {
      if (i >= LOADING_LINES.length) return
      setVisible((prev) => [...prev, LOADING_LINES[i]])
      setCursorIdx(i); i++
      if (i < LOADING_LINES.length) setTimeout(show, 1600)
    }
    setTimeout(show, 300)

    if (!calledRef.current) {
      calledRef.current = true
      uploadPDF(pdfBase64)
        .then((data) => { initGame(data.bossRush, data.bosses); onReady() })
        .catch((err)  => onError(err.message ?? 'Upload failed'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-pixel), monospace', position: 'relative', overflow: 'hidden',
    }}>
      <CosmicStarfield />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.10) 2px, rgba(0,0,0,0.10) 4px)',
      }} />
      <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', gap: 24, padding: 40 }}>
        <p style={{ margin: 0, marginBottom: 8, fontSize: 'clamp(7px, 2vw, 12px)', color: C.accent, letterSpacing: 3 }}>
          ── LOADING ──
        </p>
        {visible.map((line, i) => (
          <p key={i} style={{
            margin: 0, fontSize: 'clamp(7px, 1.8vw, 11px)',
            color: C.text, lineHeight: 1.6, animation: 'fadeSlide 0.4s ease',
          }}>
            <span style={{ color: C.gold }}>&gt;&gt; </span>
            {line}
            {i === cursorIdx && (
              <span style={{ display: 'inline-block', color: C.text, marginLeft: 3, animation: 'blink 0.75s step-start infinite' }}>█</span>
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
type QuestionMode = 'mcq' | 'frq' | 'both'

const MODE_LABELS: Record<QuestionMode, string> = {
  mcq:  'MCQ',
  frq:  'FRQ',
  both: 'BOTH',
}
const MODE_DESC: Record<QuestionMode, string> = {
  mcq:  'Multiple choice only',
  frq:  'Free response only',
  both: 'Mixed questions',
}

export default function Home() {
  const router    = useRouter()
  const cosmicRef = useRef<CosmicStarfieldHandle>(null)
  const [files, setFiles]         = useState<File[]>([])
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [warping, setWarping]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [questionMode, setQuestionMode] = useState<QuestionMode>(() => {
    if (typeof window === 'undefined') return 'mcq'
    return (localStorage.getItem('question_mode') as QuestionMode) ?? 'mcq'
  })

  const handleModeChange = (mode: QuestionMode) => {
    setQuestionMode(mode)
    localStorage.setItem('question_mode', mode)
  }

  const handleFiles = (incoming: File[]) => {
    setFiles(incoming)
    if (!incoming.length) { setPdfBase64(null); return }
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1]
      setPdfBase64(b64)
    }
    reader.readAsDataURL(incoming[0])
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
          0%,19%,21%,23%,54%,56%,100% { opacity: 1; }
          20%,24%,55% { opacity: 0.7; }
        }
        @keyframes titlePulse {
          0%,100% { opacity: 0.9; }
          50%      { opacity: 1; }
        }
        @keyframes insertCoin {
          0%,49%  { opacity: 1; }
          50%,99% { opacity: 0; }
          100%    { opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; }
      `}</style>

      <div style={{
        minHeight: '100vh', backgroundColor: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        fontFamily: 'var(--font-pixel), monospace',
      }}>
        <CosmicStarfield ref={cosmicRef} />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        }} />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.7) 100%)',
        }} />

        {/* Main panel */}
        <div style={{
          position: 'relative', zIndex: 3,
          transform: warping ? 'scale(25)' : 'scale(1)',
          opacity:   warping ? 0 : 1,
          transition: warping
            ? 'transform 0.75s cubic-bezier(0.4, 0, 1, 1), opacity 0.75s ease-in'
            : 'none',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 16,
          padding: '32px 28px',
          maxWidth: 520, width: '100%',
          animation: 'fadeIn 0.6s ease',
        }}>
          {/* Title */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 6 }}>
              {['STUDY', 'BOSS'].map((word) => (
                <h1 key={word} style={{ margin: 0, fontSize: 'clamp(13px, 3.5vw, 22px)', letterSpacing: 5, color: C.accent, animation: 'titleFlicker 7s linear infinite' }}>{word}</h1>
              ))}
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(18px, 5vw, 34px)', letterSpacing: 6, color: C.text, animation: 'titlePulse 3s ease-in-out infinite' }}>BATTLE</h1>
            <p style={{ marginTop: 10, fontSize: 'clamp(5px, 1.3vw, 7px)', color: C.textDim, letterSpacing: 3, lineHeight: 2 }}>
              UPLOAD YOUR NOTES. FACE YOUR NEMESIS.
            </p>
          </div>

          <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />

          <UploadZone onFiles={handleFiles} />

          {error && (
            <div style={{ fontSize: 'clamp(5px, 1.3vw, 7px)', color: C.red, textAlign: 'center', letterSpacing: 1 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: C.textDim, letterSpacing: 2, textAlign: 'center' }}>
            BEST WITH 5–50 PAGES · PDF FORMAT ONLY
          </div>

          <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />

          {/* Question mode selector */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: C.textDim, letterSpacing: 2 }}>
              ── QUESTION MODE
            </div>
            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
              {(['mcq', 'frq', 'both'] as QuestionMode[]).map(mode => {
                const active = questionMode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    style={{
                      flex: 1,
                      fontFamily: 'var(--font-pixel), monospace',
                      fontSize: 'clamp(6px, 1.4vw, 9px)',
                      letterSpacing: 2,
                      padding: '10px 0',
                      cursor: 'pointer',
                      border: `1px solid ${active ? C.accent : C.border}`,
                      backgroundColor: active ? `${C.accent}22` : C.panel,
                      color: active ? C.accent : C.textDim,
                      transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = C.borderHi; e.currentTarget.style.color = C.text } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim } }}
                  >
                    <span>{MODE_LABELS[mode]}</span>
                    <span style={{ fontSize: 'clamp(3px, 0.7vw, 5px)', color: active ? `${C.accent}bb` : C.textDim, letterSpacing: 1 }}>{MODE_DESC[mode]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />

          {files.length > 0 ? (
            <PixelButton color={C.accent} onClick={() => {
              cosmicRef.current?.triggerWarp()
              setWarping(true)
              setTimeout(() => setLoading(true), 750)
            }}>
              ► GO TO BATTLE ◄
            </PixelButton>
          ) : (
            <div style={{ fontSize: 'clamp(8px, 2.2vw, 13px)', color: C.gold, letterSpacing: 4, animation: 'insertCoin 1.1s step-start infinite' }}>
              ─ INSERT COIN ─
            </div>
          )}
        </div>
      </div>
    </>
  )
}
