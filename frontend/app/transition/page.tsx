'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/context/GameContext'
import CosmicStarfield from '@/components/ui/cosmic-starfield'

/* ── Lobby-matching palette ── */
const C = {
  bg:       '#08051a',
  panel:    '#0e0c1e',
  border:   '#2a2a40',
  borderHi: '#4a4a70',
  text:     '#a8b8c4',
  textDim:  '#3a4a54',
  accent:   '#5a8fa8',
  gold:     '#9a8050',
  green:    '#4a7858',
  red:      '#8a3a30',
  greenHi:  '#6ab878',
  redHi:    '#cc5555',
}

/* ─── Pixel explosion animation ─── */
function PixelExplosion() {
  return (
    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * Math.PI * 2
        const dist  = 30 + Math.random() * 30
        return (
          <div key={i} style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: 4 + Math.random() * 6,
            height: 4 + Math.random() * 6,
            backgroundColor: i % 3 === 0 ? C.gold : C.red,
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

/* ─── Pixel corner accent ─── */
function PixelCorner({ pos, color }: { pos: 'tl'|'tr'|'bl'|'br'; color: string }) {
  const isTop  = pos.startsWith('t')
  const isLeft = pos.endsWith('l')
  return (
    <div style={{
      position: 'absolute',
      ...(isTop  ? { top: -1 }    : { bottom: -1 }),
      ...(isLeft ? { left: -1 }   : { right: -1 }),
      width: 10, height: 10,
      borderTop:    isTop  ? `2px solid ${color}` : 'none',
      borderBottom: !isTop ? `2px solid ${color}` : 'none',
      borderLeft:   isLeft ? `2px solid ${color}` : 'none',
      borderRight:  !isLeft ? `2px solid ${color}` : 'none',
      pointerEvents: 'none',
    }} />
  )
}

/* ─── Question result card ─── */
function ResultCard({ result, index }: { result: import('@/context/GameContext').QuestionResult; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const correct     = result.correct
  const borderColor = correct ? C.green : C.red
  const hiColor     = correct ? C.greenHi : C.redHi

  return (
    <div
      style={{
        position: 'relative',
        border: `1px solid ${borderColor}44`,
        backgroundColor: correct ? '#080f0a' : '#0f0808',
        padding: '12px 14px',
        cursor: 'pointer',
        animation: `fadeIn 0.4s ease ${index * 0.08}s both`,
      }}
      onClick={() => setExpanded(e => !e)}
    >
      <PixelCorner pos="tl" color={`${borderColor}66`} />
      <PixelCorner pos="br" color={`${borderColor}66`} />

      {/* Badge */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        fontSize: 'clamp(9px, 1vw, 11px)',
        color: hiColor, letterSpacing: 2,
      }}>
        {correct ? '✓ CORRECT' : '✗ WRONG'}
      </div>

      {/* Concept + damage */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2 }}>Q{index + 1}</span>
        <span style={{ fontSize: 'clamp(9px, 1vw, 11px)', color: C.gold, letterSpacing: 1 }}>
          {result.conceptName}
        </span>
        {correct
          ? <span style={{ fontSize: 'clamp(8px, 0.9vw, 10px)', color: C.greenHi, marginLeft: 'auto', paddingRight: 70 }}>-{result.damage} HP to boss</span>
          : <span style={{ fontSize: 'clamp(8px, 0.9vw, 10px)', color: C.redHi,   marginLeft: 'auto', paddingRight: 70 }}>-{result.playerDamage} HP to you</span>
        }
      </div>

      {/* Question */}
      <p style={{ margin: '0 0 6px', fontSize: 'clamp(9px, 1.1vw, 12px)', color: C.text, lineHeight: 1.8 }}>
        {result.question}
      </p>

      {/* Player answer */}
      <div style={{ fontSize: 'clamp(9px, 1vw, 11px)', color: hiColor, lineHeight: 1.6, marginBottom: expanded ? 10 : 0 }}>
        Your answer: &ldquo;{result.playerAnswer}&rdquo;
      </div>

      {/* Expandable explanation */}
      {expanded && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px solid ${borderColor}22`,
          animation: 'fadeIn 0.25s ease',
        }}>
          <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.accent, letterSpacing: 2, marginBottom: 6 }}>
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

/* ─── Tab button ─── */
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: 'var(--font-pixel), monospace',
      fontSize: 'clamp(9px, 1vw, 11px)', letterSpacing: 2,
      color: active ? C.bg : C.textDim,
      backgroundColor: active ? C.gold : 'transparent',
      border: `1px solid ${active ? C.gold : C.border}`,
      padding: '8px 16px', cursor: 'pointer',
      transition: 'all 0.15s',
      flex: 1,
    }}>{label}</button>
  )
}

export default function TransitionPage() {
  const router = useRouter()
  const { currentBossIndex, totalBosses, lastBossResults, clearLastBossResults, score } = useGame()
  const [tab, setTab]         = useState<'victory' | 'review'>('victory')
  const [btnHover, setBtnHover] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const prevBossIndex  = currentBossIndex - 1
  const correctCount   = lastBossResults.filter(r => r.correct).length
  const totalCount     = lastBossResults.length
  const accuracy       = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

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
            0%{transform:translate(-50%,-50%) scale(1);opacity:1}
            100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0);opacity:0}
          }
        `).join('\n')}
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
      `}</style>

      <div style={{
        minHeight: '100vh', backgroundColor: C.bg,
        fontFamily: 'var(--font-pixel), monospace',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        <CosmicStarfield />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.10) 2px,rgba(0,0,0,0.10) 4px)',
          animation: 'scanlines 0.1s linear infinite',
        }} />
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

          {/* Header */}
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

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            <Tab label="VICTORY"            active={tab === 'victory'} onClick={() => setTab('victory')} />
            <Tab label={`REVIEW (${totalCount})`} active={tab === 'review'}  onClick={() => setTab('review')} />
          </div>

          {/* Victory tab */}
          {tab === 'victory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeIn 0.3s ease' }}>

              {/* Progress tracker */}
              <div style={{
                position: 'relative',
                border: `1px solid ${C.border}`,
                backgroundColor: C.panel, padding: '16px', textAlign: 'center',
              }}>
                <PixelCorner pos="tl" color={C.borderHi} />
                <PixelCorner pos="br" color={C.borderHi} />
                <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2, marginBottom: 10 }}>
                  BOSS RUSH PROGRESS
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  {Array.from({ length: totalBosses }, (_, i) => (
                    <div key={i} style={{
                      width: 24, height: 24,
                      backgroundColor: i < currentBossIndex ? C.green : i === prevBossIndex + 1 ? C.red : '#0e0c1e',
                      boxShadow: i < currentBossIndex ? `0 0 4px ${C.green}66` : 'none',
                      border: i === prevBossIndex ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
                      transition: 'all 0.3s',
                    }} />
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 'clamp(9px, 1vw, 11px)', color: C.greenHi, letterSpacing: 2 }}>
                  {currentBossIndex} / {totalBosses} BOSSES DEFEATED
                </div>
              </div>

              {/* Battle summary */}
              <div style={{
                position: 'relative',
                border: `1px solid ${C.border}`,
                backgroundColor: C.panel, padding: '14px',
              }}>
                <PixelCorner pos="tl" color={C.borderHi} />
                <PixelCorner pos="br" color={C.borderHi} />
                <div style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2, marginBottom: 10 }}>
                  ── BATTLE SUMMARY ──
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'CORRECT HITS',     value: `${correctCount}`,           color: C.greenHi },
                    { label: 'MISSED SHOTS',      value: `${totalCount - correctCount}`, color: C.redHi },
                    { label: 'ACCURACY',          value: `${accuracy}%`,              color: accuracy >= 70 ? C.greenHi : C.gold },
                    { label: 'SCORE THIS ROUND',  value: score.toLocaleString(),       color: C.gold },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 'clamp(8px, 0.85vw, 10px)', color: C.textDim, letterSpacing: 2 }}>{label}</span>
                      <span style={{ fontSize: 'clamp(9px, 1vw, 11px)', color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, letterSpacing: 2 }}>
                CHECK THE REVIEW TAB FOR DETAILED EXPLANATIONS
              </div>

              <div style={{ textAlign: 'center', fontSize: 'clamp(9px, 1vw, 11px)', color: C.textDim, letterSpacing: 1 }}>
                Auto-continuing in{' '}
                <span style={{ color: C.gold, animation: 'blink 1s step-start infinite' }}>{countdown}s</span>
                ...
              </div>

              <button
                style={{
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: 'clamp(7px, 1.8vw, 10px)', letterSpacing: 3,
                  color: btnHover ? C.bg : C.accent,
                  backgroundColor: btnHover ? C.accent : 'transparent',
                  border: `2px solid ${C.accent}`, padding: '14px',
                  cursor: 'pointer', transition: 'all 0.12s ease',
                }}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                onClick={goNext}
              >
                ► NEXT CHALLENGER ◄
              </button>
            </div>
          )}

          {/* Review tab */}
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

              <button
                style={{
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: 'clamp(7px, 1.8vw, 10px)', letterSpacing: 3,
                  color: C.accent, backgroundColor: 'transparent',
                  border: `2px solid ${C.accent}`, padding: '14px',
                  cursor: 'pointer', marginTop: 10,
                }}
                onClick={goNext}
              >
                ► NEXT CHALLENGER ◄
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
