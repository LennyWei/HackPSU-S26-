'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGame, PLAYER_MAX_HP_VALUE } from '@/context/GameContext'
import CosmicStarfield from '@/components/ui/cosmic-starfield'
import { emitSfx } from '@/lib/audio-events'

/* ── PALETTE ──────────────────────────────────────────────── */
const C = {
  bg:          '#0a0a0f',
  panel:       '#0d0d18',
  cyanBorder:  '#007a8a',
  gold:        '#ffd600',
  goldBg:      '#0e0b00',
  text:        '#b8ccd6',
  textDim:     '#2a3a44',
  lockedBorder:'#4a6a7a',
  green:       '#00ff88',
  greenBg:     '#006644',
  dimPipBg:    '#1a1a2e',
  redPipBg:    '#a03030',
  red:         '#ff3c3c',
  redBg:       '#0f0808',
  redDim:      '#2a0808',
  greenHi:     '#6ab878',
  redHi:       '#cc5555',
  cardGreen:   '#4a7858',
  cardRed:     '#8a3a30',
  accent:      '#5a8fa8',
}

/* ── CLIP-PATH CONSTANTS ─────────────────────────────────── */
const OCT8 = 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)'
const OCT4 = 'polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)'

/* ── PANEL BOX ───────────────────────────────────────────── */
function PanelBox({ children, innerStyle, borderColor }: {
  children: React.ReactNode
  innerStyle?: React.CSSProperties
  borderColor?: string
}) {
  return (
    <div style={{ background: borderColor ?? C.cyanBorder, clipPath: OCT8, padding: 2 }}>
      <div style={{ background: C.panel, clipPath: OCT8, ...innerStyle }}>
        {children}
      </div>
    </div>
  )
}

/* ── PROGRESS PIP ────────────────────────────────────────── */
function Pip({ state }: { state: 'filled' | 'fail' | 'empty' }) {
  const borderColor = state === 'filled' ? C.green : state === 'fail' ? C.red : C.lockedBorder
  const bgColor     = state === 'filled' ? C.greenBg : state === 'fail' ? C.redPipBg : C.dimPipBg
  return (
    <div style={{
      background: borderColor, clipPath: OCT4, padding: 1,
      width: 18, height: 18, flexShrink: 0,
    }}>
      <div style={{
        background: bgColor, clipPath: OCT4,
        width: '100%', height: '100%',
      }} />
    </div>
  )
}

/* ── PIXEL TROPHY ────────────────────────────────────────── */
const TROPHY_GRID = [
  [0,1,1,0,0,1,1,0],
  [1,2,2,1,1,2,2,1],
  [1,2,2,2,2,2,2,1],
  [0,1,2,2,2,2,1,0],
  [0,0,1,2,2,1,0,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
]
function TrophySprite() {
  return (
    <div style={{ lineHeight: 0, animation: 'floatSprite 2.5s ease-in-out infinite', filter: `drop-shadow(0 0 14px ${C.gold}bb) drop-shadow(0 0 32px ${C.gold}44)` }}>
      {TROPHY_GRID.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => (
            <div key={c} style={{ width: 24, height: 24, backgroundColor: cell === 1 ? '#7a6030' : cell === 2 ? C.gold : 'transparent', boxShadow: cell ? `0 0 3px ${C.gold}55` : 'none' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── PIXEL SKULL ─────────────────────────────────────────── */
const SKULL_GRID = [
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,2,1,1,1,2,1,1],
  [1,1,2,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1],
  [0,1,3,1,3,1,3,1,0],
  [0,0,1,1,1,1,1,0,0],
]
function SkullSprite() {
  return (
    <div style={{ lineHeight: 0, animation: 'skullPulse 1.8s ease-in-out infinite', filter: `drop-shadow(0 0 12px ${C.red}99) drop-shadow(0 0 28px ${C.red}55)` }}>
      {SKULL_GRID.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => (
            <div key={c} style={{ width: 22, height: 22, backgroundColor: cell === 1 ? C.cardRed : cell === 2 ? '#111' : cell === 3 ? C.red : 'transparent', boxShadow: cell === 1 ? `0 0 2px ${C.cardRed}66` : 'none' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── PIXEL EXPLOSION ─────────────────────────────────────── */
function PixelExplosion() {
  return (
    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * Math.PI * 2
        const dist  = 30 + Math.random() * 24
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 4 + Math.random() * 6, height: 4 + Math.random() * 6,
            backgroundColor: i % 2 === 0 ? C.red : C.gold,
            boxShadow: `0 0 4px ${C.red}88`,
            animation: `explode${i % 4} 0.6s ease-out forwards`,
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist}px`,
          } as React.CSSProperties} />
        )
      })}
    </div>
  )
}

/* ── SCORE COUNTER ───────────────────────────────────────── */
function ScoreCounter({ target }: { target: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (target === 0) return
    let start: number | null = null
    const duration = 1800
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setDisplay(Math.floor((1 - Math.pow(1 - progress, 3)) * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [target])
  return <>{display.toLocaleString()}</>
}

/* ── STAT ROW ────────────────────────────────────────────── */
function StatRow({ label, value, color, delay }: {
  label: string; value: string; color: string; delay: number
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0 7px 10px',
      borderLeft: `2px solid ${C.cyanBorder}`,
      animation: `fadeSlideUp 0.4s ease ${delay}s both`,
    }}>
      <span style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 'clamp(9px, 1vw, 11px)', color, letterSpacing: 1 }}>
        {value}
      </span>
    </div>
  )
}

/* ── CONCEPT CHIP ────────────────────────────────────────── */
function ConceptChip({ name, correct }: { name: string; correct: boolean }) {
  return (
    <div style={{
      display: 'inline-block', padding: '4px 10px', margin: '3px',
      clipPath: OCT4,
      border: `1px solid ${correct ? C.cardGreen : C.cardRed}66`,
      backgroundColor: correct ? '#0a1a0e' : '#1a0a0a',
      fontSize: 'clamp(8px, 0.85vw, 10px)',
      color: correct ? C.greenHi : C.redHi,
      letterSpacing: 1,
    }}>{name}</div>
  )
}

/* ── QUESTION CARD ───────────────────────────────────────── */
function QuestionCard({ result, idx }: {
  result: {
    question: string; playerAnswer: string; correct: boolean
    explanation: string; conceptName: string; damage: number; playerDamage: number
  }
  idx: number
}) {
  const [expanded, setExpanded] = useState(false)
  const correct    = result.correct
  const borderColor = correct ? C.cardGreen : C.cardRed
  const hiColor     = correct ? C.greenHi : C.redHi

  const lines = result.question.split('\n')
  const stem  = lines.find(l => l.trim().length > 0 && !/^\s*[（(]?[A-D][）).]/.test(l)) ?? result.question
  const opts  = lines.filter(l => /^\s*[（(]?[A-D][）).]/.test(l))

  return (
    <div style={{
      borderLeft: `2px solid ${borderColor}`,
      backgroundColor: correct ? '#080f0a' : '#0f0808',
      animation: `fadeSlideUp 0.35s ease ${Math.min(idx * 0.04, 0.6)}s both`,
    }}>
      {/* Header row */}
      <div onClick={() => setExpanded(!expanded)} style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 1, flexShrink: 0, paddingTop: 1 }}>
          #{String(idx + 1).padStart(2, '0')}
        </span>
        <span style={{ fontSize: 'clamp(10px, 1vw, 12px)', color: hiColor, flexShrink: 0, letterSpacing: 1 }}>
          {correct ? '✓' : '✗'}
        </span>
        <span style={{
          flex: 1, fontSize: 'clamp(9px, 0.95vw, 11px)', color: C.text, lineHeight: 1.8,
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: expanded ? 'normal' : 'nowrap',
        }}>
          {stem}
        </span>
        <span style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: correct ? C.cardGreen : C.cardRed, flexShrink: 0, letterSpacing: 1, paddingTop: 1 }}>
          {correct ? `-${result.damage}` : `+${result.playerDamage}`}
        </span>
        <span style={{ fontSize: 'clamp(9px, 0.9vw, 11px)', color: C.textDim, flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${borderColor}22`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opts.length > 0 && (
            <div style={{ paddingTop: 10 }}>
              <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2, marginBottom: 6 }}>CHOICES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {opts.map((opt, i) => {
                  const letter   = opt.trim().charAt(0)
                  const answered = result.playerAnswer.trim().toUpperCase().startsWith(letter)
                  return (
                    <div key={i} style={{
                      fontSize: 'clamp(9px, 0.95vw, 11px)', color: answered ? hiColor : C.textDim,
                      letterSpacing: 1, lineHeight: 1.8, paddingLeft: 8,
                      borderLeft: answered ? `2px solid ${hiColor}` : `2px solid transparent`,
                    }}>
                      {opt.trim()}
                      {answered && <span style={{ marginLeft: 8, fontSize: 'clamp(7px, 0.8vw, 9px)', color: hiColor }}> ← YOUR ANSWER</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {opts.length === 0 && (
            <div style={{ paddingTop: 10 }}>
              <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2, marginBottom: 4 }}>YOUR ANSWER</div>
              <div style={{ fontSize: 'clamp(9px, 0.95vw, 11px)', color: hiColor, lineHeight: 1.8, letterSpacing: 1 }}>
                {result.playerAnswer}
              </div>
            </div>
          )}

          {result.explanation && (
            <div>
              <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2, marginBottom: 4 }}>EXPLANATION</div>
              <div style={{ fontSize: 'clamp(9px, 0.95vw, 11px)', color: C.text, lineHeight: 2, letterSpacing: 0.5 }}>
                {result.explanation}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.textDim}33`, paddingTop: 8 }}>
            <span style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2 }}>CONCEPT</span>
            <span style={{ fontSize: 'clamp(9px, 0.95vw, 11px)', color: C.cyanBorder, letterSpacing: 1 }}>
              {result.conceptName}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── TAB ─────────────────────────────────────────────────── */
function OutcomeTab({ label, active, onClick, outcomeBorder, outcomeBg, outcomeText }: {
  label: string; active: boolean; onClick: () => void
  outcomeBorder: string; outcomeBg: string; outcomeText: string
}) {
  const borderColor = active ? outcomeBorder : C.lockedBorder
  const bgColor     = active ? outcomeBg : C.panel
  const textColor   = active ? outcomeText : C.lockedBorder
  return (
    <div style={{ flex: 1, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ background: borderColor, clipPath: OCT8, padding: 2, transition: 'background 0.15s' }}>
        <div style={{ background: bgColor, clipPath: OCT8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 16px', transition: 'background 0.15s' }}>
          <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(9px, 1vw, 11px)', letterSpacing: 2, color: textColor, transition: 'color 0.15s' }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}

function ReviewTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const borderColor = active ? C.cyanBorder : C.lockedBorder
  const bgColor     = active ? C.panel : C.panel
  const textColor   = active ? C.text : C.lockedBorder
  return (
    <div style={{ flex: 1, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ background: borderColor, clipPath: OCT8, padding: 2, transition: 'background 0.15s' }}>
        <div style={{ background: bgColor, clipPath: OCT8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 16px' }}>
          <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(9px, 1vw, 11px)', letterSpacing: 2, color: textColor }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── ACTION BUTTON ───────────────────────────────────────── */
function ActionButton({ onClick, borderColor, bgColor, textColor, children }: {
  onClick: () => void; borderColor: string; bgColor: string; textColor: string; children: React.ReactNode
}) {
  return (
    <div style={{ cursor: 'pointer', width: '100%' }} onClick={onClick}>
      <div style={{ background: borderColor, clipPath: OCT8, padding: 2 }}>
        <div style={{ background: bgColor, clipPath: OCT8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 24px' }}>
          <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(7px, 1.5vw, 10px)', letterSpacing: 4, color: textColor }}>
            {children}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── MAIN CONTENT ────────────────────────────────────────── */
function ResultContent() {
  const router  = useRouter()
  const params  = useSearchParams()
  const outcome = params.get('outcome') ?? 'death'
  const isVictory = outcome === 'victory'

  const {
    currentBoss, currentBossIndex, score,
    lastBossResults, weakSpots, totalBosses,
    playerHP, resetGame,
  } = useGame()

  const [tab, setTab] = useState<'main' | 'review'>('main')

  useEffect(() => {
    emitSfx({ name: 'lowboom.wav', volume: 0.62, minRate: 0.95, maxRate: 1.05 })
  }, [])

  const correct   = lastBossResults.filter(r => r.correct).length
  const wrong     = lastBossResults.filter(r => !r.correct).length
  const accuracy  = lastBossResults.length > 0 ? Math.round((correct / lastBossResults.length) * 100) : 0

  const allCorrectConcepts = lastBossResults.filter(r => r.correct).map(r => r.conceptName)
  const allWrongConcepts   = lastBossResults.filter(r => !r.correct).map(r => r.conceptName)
  const uniqueWrong        = [...new Set(allWrongConcepts)]
  const uniqueMastered     = [...new Set(allCorrectConcepts.filter(c => !allWrongConcepts.includes(c)))]

  const bossesDefeated = isVictory ? totalBosses : currentBossIndex
  const tryAgain = () => { resetGame(); router.push('/') }

  // Per-outcome tab/button colors
  const outcomeBorder = isVictory ? C.gold : C.red
  const outcomeBg     = isVictory ? '#0f0f1a' : '#0f0a0a'
  const outcomeText   = isVictory ? C.gold : C.red
  const btnBg         = isVictory ? C.goldBg : C.redBg

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes floatSprite   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes skullPulse    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px) scale(1.03)} }
        @keyframes defeatFlash   {
          0%,100% { text-shadow: 0 0 10px ${C.red}cc, 0 0 24px ${C.red}88; }
          50%      { text-shadow: 0 0 20px ${C.red}, 0 0 40px ${C.red}aa; }
        }
        @keyframes explode0 { from{transform:translate(-50%,-50%) scale(1);opacity:1} to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0);opacity:0} }
        @keyframes explode1 { from{transform:translate(-50%,-50%) scale(1);opacity:1} to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0);opacity:0} }
        @keyframes explode2 { from{transform:translate(-50%,-50%) scale(1);opacity:1} to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0);opacity:0} }
        @keyframes explode3 { from{transform:translate(-50%,-50%) scale(1);opacity:1} to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0);opacity:0} }
        @keyframes titleReveal   { 0%{opacity:0;transform:scale(0.6) translateY(16px)} 65%{transform:scale(1.05) translateY(0)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes titlePulse    { 0%,100%{opacity:0.9} 50%{opacity:1} }
        @keyframes fadeSlideUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scoreReveal   { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }
        @keyframes deathShake    { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-10px)} 30%{transform:translateX(10px)} 45%{transform:translateX(-6px)} 60%{transform:translateX(6px)} 75%{transform:translateX(-3px)} 90%{transform:translateX(3px)} }
        @keyframes fadeIn        { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.cyanBorder}; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
      `}</style>

      <div style={{
        minHeight: '100vh', backgroundColor: C.bg,
        fontFamily: 'var(--font-pixel), monospace',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
        animation: !isVictory ? 'deathShake 0.6s ease 0.2s' : 'none',
      }}>
        <CosmicStarfield />

        {/* CRT scanlines */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
        }} />
        {/* Vignette */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.72) 100%)',
        }} />

        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: 720, width: '100%', margin: '0 auto',
          padding: '16px 24px 28px', gap: 12,
        }}>

          {/* ── Sprite + Title ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 10 }}>
            {isVictory ? <TrophySprite /> : <SkullSprite />}
            <div style={{ textAlign: 'center' }}>
              {isVictory ? (
                <>
                  <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 34px)', color: C.gold, letterSpacing: 4, animation: 'titleReveal 0.65s cubic-bezier(0.175,0.885,0.32,1.275) both, titlePulse 3s ease-in-out 0.65s infinite' }}>
                    VICTORY!
                  </h1>
                  <div style={{ marginTop: 10, fontSize: 'clamp(9px, 1vw, 11px)', color: C.green, letterSpacing: 4, animation: 'floatSprite 2.2s ease-in-out infinite' }}>
                    ★ THE GAUNTLET IS YOURS ★
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, letterSpacing: 4, marginBottom: 10 }}>
                    {currentBoss ? `FALLEN TO ${currentBoss.name.toUpperCase()}` : 'THE GAUNTLET CLAIMS ANOTHER'}
                  </div>
                  <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 34px)', color: C.red, letterSpacing: 4, animation: 'titleReveal 0.55s cubic-bezier(0.175,0.885,0.32,1.275) both, defeatFlash 1.8s ease-in-out 0.55s infinite' }}>
                    GAME OVER
                  </h1>
                  <div style={{ marginTop: 14 }}><PixelExplosion /></div>
                  <div style={{ marginTop: -50, fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, letterSpacing: 3 }}>
                    {bossesDefeated > 0
                      ? `YOU CLEARED ${bossesDefeated} STAGE${bossesDefeated !== 1 ? 'S' : ''}`
                      : 'STUDY HARDER AND TRY AGAIN'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, transparent, ${outcomeBorder}66, transparent)` }} />

          {/* ── Score quick stats ── */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 28, fontSize: 'clamp(9px, 1.1vw, 12px)', animation: 'scoreReveal 0.5s ease 0.4s both' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.textDim, letterSpacing: 2, marginBottom: 3 }}>SCORE</div>
              <div style={{ color: C.gold }}><ScoreCounter target={score} /></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.textDim, letterSpacing: 2, marginBottom: 3 }}>ACCURACY</div>
              <div style={{ color: accuracy >= 70 ? C.greenHi : C.redHi }}>{accuracy}%</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.textDim, letterSpacing: 2, marginBottom: 3 }}>QUESTIONS</div>
              <div style={{ color: C.gold }}>{correct}/{lastBossResults.length}</div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 6, width: '100%', animation: 'fadeSlideUp 0.4s ease 0.5s both' }}>
            <OutcomeTab
              label={isVictory ? 'VICTORY' : 'DEFEAT'}
              active={tab === 'main'}
              onClick={() => setTab('main')}
              outcomeBorder={outcomeBorder} outcomeBg={outcomeBg} outcomeText={outcomeText}
            />
            <ReviewTab
              label={`REVIEW (${lastBossResults.length})`}
              active={tab === 'review'}
              onClick={() => setTab('review')}
            />
          </div>

          {/* ── Main tab ── */}
          {tab === 'main' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', animation: 'fadeIn 0.3s ease' }}>

              {/* Battle stats */}
              <PanelBox innerStyle={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2, marginBottom: 10 }}>── BATTLE STATS ──</div>
                <StatRow label="ACCURACY"       value={`${accuracy}%`}                                       color={accuracy >= 70 ? C.greenHi : accuracy >= 40 ? C.gold : C.redHi} delay={0} />
                <StatRow label="TOTAL ROUNDS"   value={String(lastBossResults.length)}                       color={C.accent}   delay={0.05} />
                <StatRow label="CORRECT"        value={`${correct} / ${lastBossResults.length}`}             color={C.greenHi}  delay={0.10} />
                <StatRow label="MISSED"         value={`${wrong} / ${lastBossResults.length}`}               color={C.redHi}    delay={0.15} />
                <StatRow label="STAGES CLEARED" value={`${bossesDefeated} / ${totalBosses}`}                color={C.gold}     delay={0.20} />
                <StatRow label="HP REMAINING"   value={`${Math.max(0, playerHP)} / ${PLAYER_MAX_HP_VALUE}`} color={playerHP < PLAYER_MAX_HP_VALUE * 0.3 ? C.redHi : C.accent} delay={0.25} />
              </PanelBox>

              {/* Progress tracker */}
              <PanelBox
                innerStyle={{ padding: '14px 16px', textAlign: 'center' }}
                borderColor={isVictory ? C.green : C.red}
              >
                <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2, marginBottom: 10 }}>
                  BOSS RUSH PROGRESS
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                  {Array.from({ length: totalBosses }, (_, i) => {
                    const pipState = isVictory
                      ? 'filled'
                      : i < bossesDefeated
                        ? 'filled'
                        : i === bossesDefeated
                          ? 'fail'
                          : 'empty'
                    return <Pip key={i} state={pipState} />
                  })}
                </div>
                <div style={{
                  marginTop: 10, fontSize: 'clamp(9px, 1vw, 11px)',
                  color: isVictory ? C.green : C.red,
                  letterSpacing: 2,
                }}>
                  {bossesDefeated} / {totalBosses} BOSSES DEFEATED
                </div>
              </PanelBox>

              {/* Concept mastery */}
              {(uniqueMastered.length > 0 || uniqueWrong.length > 0) && (
                <PanelBox innerStyle={{ padding: '14px 16px' }}>
                  {uniqueMastered.length > 0 && (
                    <div style={{ marginBottom: uniqueWrong.length > 0 ? 12 : 0 }}>
                      <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.greenHi, letterSpacing: 2, marginBottom: 8 }}>── MASTERED ──</div>
                      <div>{uniqueMastered.map((c, i) => <ConceptChip key={i} name={c} correct={true} />)}</div>
                    </div>
                  )}
                  {uniqueWrong.length > 0 && (
                    <div>
                      <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.redHi, letterSpacing: 2, marginBottom: 8 }}>
                        {isVictory ? '── REVISIT THESE ──' : '── STUDY BEFORE NEXT RUN ──'}
                      </div>
                      <div>{uniqueWrong.map((c, i) => <ConceptChip key={i} name={c} correct={false} />)}</div>
                    </div>
                  )}
                  {weakSpots.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.textDim}33`, fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, lineHeight: 2, letterSpacing: 1 }}>
                      <span style={{ color: C.gold, letterSpacing: 2 }}>IDENTIFIED WEAK SPOTS: </span>
                      {weakSpots.join(' · ')}
                    </div>
                  )}
                </PanelBox>
              )}

              <ActionButton
                onClick={tryAgain}
                borderColor={outcomeBorder}
                bgColor={btnBg}
                textColor={outcomeText}
              >
                ► TRY AGAIN ◄
              </ActionButton>
            </div>
          )}

          {/* ── Review tab ── */}
          {tab === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, letterSpacing: 2, marginBottom: 4 }}>
                TAP A CARD TO SEE THE IN-DEPTH EXPLANATION
              </div>

              {lastBossResults.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: 'clamp(11px, 1.4vw, 13px)', color: C.textDim, padding: 40 }}>
                  NO QUESTIONS ON RECORD
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {lastBossResults.map((r, i) => (
                    <QuestionCard key={i} result={r} idx={i} />
                  ))}
                </div>
              )}

              <ActionButton
                onClick={tryAgain}
                borderColor={outcomeBorder}
                bgColor={btnBg}
                textColor={outcomeText}
              >
                ► TRY AGAIN ◄
              </ActionButton>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
        <CosmicStarfield />
      </div>
    }>
      <ResultContent />
    </Suspense>
  )
}
