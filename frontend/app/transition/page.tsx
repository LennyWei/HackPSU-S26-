'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/context/GameContext'
import CosmicStarfield from '@/components/ui/cosmic-starfield'

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
  redHi:       '#cc5555',
  greenHi:     '#6ab878',
  cardGreen:   '#4a7858',
  cardRed:     '#8a3a30',
}

/* ── CLIP-PATH CONSTANTS ─────────────────────────────────── */
const OCT8 = 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)'
const OCT4 = 'polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)'

/* ── PANEL BOX ───────────────────────────────────────────── */
function PanelBox({ children, innerStyle }: {
  children: React.ReactNode
  innerStyle?: React.CSSProperties
}) {
  return (
    <div style={{ background: C.cyanBorder, clipPath: OCT8, padding: 2 }}>
      <div style={{ background: C.panel, clipPath: OCT8, ...innerStyle }}>
        {children}
      </div>
    </div>
  )
}

/* ── PROGRESS PIP ────────────────────────────────────────── */
function Pip({ filled }: { filled: boolean }) {
  return (
    <div style={{
      background: filled ? C.green : C.lockedBorder,
      clipPath: OCT4, padding: 1,
      width: 18, height: 18, flexShrink: 0,
    }}>
      <div style={{
        background: filled ? C.greenBg : C.dimPipBg,
        clipPath: OCT4, width: '100%', height: '100%',
      }} />
    </div>
  )
}

/* ── PIXEL EXPLOSION ─────────────────────────────────────── */
function PixelExplosion() {
  return (
    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * Math.PI * 2
        const dist  = 30 + Math.random() * 30
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 4 + Math.random() * 6, height: 4 + Math.random() * 6,
            backgroundColor: i % 3 === 0 ? C.gold : C.redHi,
            boxShadow: `0 0 4px ${C.gold}66`,
            animation: `explode${i % 4} 0.6s ease-out forwards`,
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist}px`,
          } as React.CSSProperties} />
        )
      })}
    </div>
  )
}

/* ── RESULT CARD ─────────────────────────────────────────── */
function ResultCard({ result, index }: {
  result: import('@/context/GameContext').QuestionResult
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const correct     = result.correct
  const borderColor = correct ? C.cardGreen : C.cardRed
  const hiColor     = correct ? C.greenHi : C.redHi

  return (
    <div
      style={{
        borderLeft: `2px solid ${borderColor}`,
        backgroundColor: correct ? '#080f0a' : '#0f0808',
        padding: '12px 14px',
        cursor: 'pointer',
        animation: `fadeIn 0.4s ease ${index * 0.08}s both`,
      }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Concept + damage + badge row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2 }}>Q{index + 1}</span>
        <span style={{ fontSize: 'clamp(9px, 1vw, 11px)', color: C.gold, letterSpacing: 1 }}>
          {result.conceptName}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 'clamp(9px, 1vw, 11px)', color: hiColor, letterSpacing: 2 }}>
          {correct ? '✓' : '✗'}
        </span>
        {correct
          ? <span style={{ fontSize: 'clamp(8px, 0.9vw, 10px)', color: C.greenHi }}>-{result.damage} HP</span>
          : <span style={{ fontSize: 'clamp(8px, 0.9vw, 10px)', color: C.redHi   }}>-{result.playerDamage} HP</span>
        }
      </div>

      <p style={{ margin: '0 0 6px', fontSize: 'clamp(9px, 1.1vw, 12px)', color: C.text, lineHeight: 1.8 }}>
        {result.question}
      </p>

      <div style={{ fontSize: 'clamp(9px, 1vw, 11px)', color: hiColor, lineHeight: 1.6, marginBottom: expanded ? 10 : 0 }}>
        Your answer: &ldquo;{result.playerAnswer}&rdquo;
      </div>

      {expanded && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px solid ${borderColor}22`,
          animation: 'fadeIn 0.25s ease',
        }}>
          <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.cyanBorder, letterSpacing: 2, marginBottom: 6 }}>
            ── EXPLANATION ──
          </div>
          <p style={{ margin: 0, fontSize: 'clamp(9px, 1.1vw, 12px)', color: C.text, lineHeight: 2 }}>
            {result.explanation}
          </p>
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 'clamp(8px, 0.9vw, 10px)', color: C.textDim, letterSpacing: 1, textAlign: 'right' }}>
        {expanded ? '▲ collapse' : '▼ tap for explanation'}
      </div>
    </div>
  )
}

/* ── TAB ─────────────────────────────────────────────────── */
function Tab({ label, active, onClick, variant }: {
  label: string; active: boolean; onClick: () => void; variant: 'victory' | 'review'
}) {
  const activeBorder = variant === 'victory' ? C.gold : C.cyanBorder
  const activeBg     = variant === 'victory' ? '#0f0f1a' : C.panel
  const activeText   = variant === 'victory' ? C.gold : C.text

  const borderColor = active ? activeBorder : C.lockedBorder
  const bgColor     = active ? activeBg : C.panel
  const textColor   = active ? activeText : C.lockedBorder

  return (
    <div style={{ flex: 1, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ background: borderColor, clipPath: OCT8, padding: 2, transition: 'background 0.15s' }}>
        <div style={{
          background: bgColor, clipPath: OCT8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '8px 16px', transition: 'background 0.15s',
        }}>
          <span style={{
            fontFamily: 'var(--font-pixel), monospace',
            fontSize: 'clamp(9px, 1vw, 11px)', letterSpacing: 2,
            color: textColor, transition: 'color 0.15s',
          }}>{label}</span>
        </div>
      </div>
    </div>
  )
}

/* ── GOLD BUTTON ─────────────────────────────────────────── */
function GoldButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div style={{ cursor: 'pointer' }} onClick={onClick}>
      <div style={{ background: C.gold, clipPath: OCT8, padding: 2 }}>
        <div style={{
          background: C.goldBg, clipPath: OCT8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '14px 24px',
        }}>
          <span style={{
            fontFamily: 'var(--font-pixel), monospace',
            fontSize: 'clamp(7px, 1.8vw, 10px)', letterSpacing: 3,
            color: C.gold,
          }}>{children}</span>
        </div>
      </div>
    </div>
  )
}

/* ── PAGE ────────────────────────────────────────────────── */
export default function TransitionPage() {
  const router = useRouter()
  const { currentBossIndex, totalBosses, lastBossResults, clearLastBossResults, score } = useGame()
  const [tab, setTab]           = useState<'victory' | 'review'>('victory')
  const [countdown, setCountdown] = useState(0)

  const prevBossIndex = currentBossIndex - 1
  const correctCount  = lastBossResults.filter(r => r.correct).length
  const totalCount    = lastBossResults.length
  const accuracy      = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  useEffect(() => {
    if (tab !== 'victory') return
    setCountdown(12)
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval)
          clearLastBossResults()
          router.push('/boss')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const goNext = () => {
    clearLastBossResults()
    router.push('/boss')
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes titlePulse { 0%,100%{opacity:0.9} 50%{opacity:1} }
        @keyframes scanlines { 0%{background-position:0 0} 100%{background-position:0 4px} }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        ${Array.from({ length: 4 }, (_, i) => `
          @keyframes explode${i} {
            0%  {transform:translate(-50%,-50%) scale(1);opacity:1}
            100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0);opacity:0}
          }
        `).join('\n')}
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.cyanBorder}; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
      `}</style>

      <div style={{
        minHeight: '100vh', backgroundColor: C.bg,
        fontFamily: 'var(--font-pixel), monospace',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
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
          display: 'flex', flexDirection: 'column',
          maxWidth: 720, width: '100%', margin: '0 auto',
          padding: '16px 24px 28px', gap: 12,
        }}>

          {/* ── Header ── */}
          <div style={{ textAlign: 'center', paddingTop: 10 }}>
            <div style={{ fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, letterSpacing: 3, marginBottom: 8 }}>
              BOSS {prevBossIndex + 1} OF {totalBosses} CLEARED
            </div>
            <h1 style={{
              fontSize: 'clamp(20px, 4vw, 34px)', color: C.gold, letterSpacing: 4,
              animation: 'titlePulse 2s ease-in-out infinite',
            }}>
              BOSS DEFEATED!
            </h1>

            <div style={{ marginTop: 12 }}>
              <PixelExplosion />
            </div>

            {/* Quick stats */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 28, marginTop: 12,
              fontSize: 'clamp(9px, 1.1vw, 12px)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: C.textDim, letterSpacing: 2, marginBottom: 3 }}>ACCURACY</div>
                <div style={{ color: accuracy >= 70 ? C.greenHi : C.redHi }}>{accuracy}%</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: C.textDim, letterSpacing: 2, marginBottom: 3 }}>QUESTIONS</div>
                <div style={{ color: C.gold }}>{correctCount}/{totalCount}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: C.textDim, letterSpacing: 2, marginBottom: 3 }}>SCORE</div>
                <div style={{ color: C.gold }}>{score.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, transparent, ${C.gold}66, transparent)` }} />

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 6 }}>
            <Tab label="VICTORY"                  variant="victory" active={tab === 'victory'} onClick={() => setTab('victory')} />
            <Tab label={`REVIEW (${totalCount})`} variant="review"  active={tab === 'review'}  onClick={() => setTab('review')} />
          </div>

          {/* ── Victory tab ── */}
          {tab === 'victory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeIn 0.3s ease' }}>

              {/* Progress tracker */}
              <PanelBox innerStyle={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2, marginBottom: 10 }}>
                  BOSS RUSH PROGRESS
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                  {Array.from({ length: totalBosses }, (_, i) => (
                    <Pip key={i} filled={i < currentBossIndex} />
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 'clamp(9px, 1vw, 11px)', color: C.green, letterSpacing: 2 }}>
                  {currentBossIndex} / {totalBosses} BOSSES DEFEATED
                </div>
              </PanelBox>

              {/* Battle summary */}
              <PanelBox innerStyle={{ padding: '14px' }}>
                <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2, marginBottom: 10 }}>
                  ── BATTLE SUMMARY ──
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'CORRECT HITS',    value: `${correctCount}`,                 color: C.greenHi },
                    { label: 'MISSED SHOTS',     value: `${totalCount - correctCount}`,    color: C.redHi },
                    { label: 'ACCURACY',         value: `${accuracy}%`,                   color: accuracy >= 70 ? C.greenHi : C.gold },
                    { label: 'SCORE THIS ROUND', value: score.toLocaleString(),            color: C.gold },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '7px 0 7px 10px',
                      borderLeft: `2px solid ${C.cyanBorder}`,
                    }}>
                      <span style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2 }}>{label}</span>
                      <span style={{ fontSize: 'clamp(9px, 1vw, 11px)', color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </PanelBox>

              <div style={{ textAlign: 'center', fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, letterSpacing: 2 }}>
                CHECK THE REVIEW TAB FOR DETAILED EXPLANATIONS
              </div>

              <div style={{ textAlign: 'center', fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, letterSpacing: 1 }}>
                Auto-continuing in{' '}
                <span style={{ color: C.gold, animation: 'blink 1s step-start infinite' }}>{countdown}s</span>
                ...
              </div>

              <GoldButton onClick={goNext}>► NEXT CHALLENGER ◄</GoldButton>
            </div>
          )}

          {/* ── Review tab ── */}
          {tab === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeIn 0.3s ease' }}>
              <div style={{ fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, letterSpacing: 2, marginBottom: 4 }}>
                TAP A CARD TO SEE THE IN-DEPTH EXPLANATION
              </div>

              {lastBossResults.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: 'clamp(11px, 1.4vw, 13px)', color: C.textDim, padding: 40 }}>
                  NO QUESTIONS ON RECORD
                </div>
              ) : (
                lastBossResults.map((result, i) => (
                  <ResultCard key={i} result={result} index={i} />
                ))
              )}

              <GoldButton onClick={goNext}>► NEXT CHALLENGER ◄</GoldButton>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
