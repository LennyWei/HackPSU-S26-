'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGame, PLAYER_MAX_HP_VALUE } from '@/context/GameContext'
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

/* ─── Pixel trophy sprite ─── */
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
    <div style={{
      lineHeight: 0,
      animation: 'floatSprite 2.5s ease-in-out infinite',
      filter: `drop-shadow(0 0 14px ${C.gold}bb) drop-shadow(0 0 32px ${C.gold}44)`,
    }}>
      {TROPHY_GRID.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => (
            <div key={c} style={{
              width: 16, height: 16,
              backgroundColor: cell === 1 ? '#7a6030' : cell === 2 ? C.gold : 'transparent',
              boxShadow: cell ? `0 0 3px ${C.gold}55` : 'none',
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ─── Pixel skull sprite ─── */
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
    <div style={{
      lineHeight: 0,
      animation: 'skullPulse 1.8s ease-in-out infinite',
      filter: `drop-shadow(0 0 12px ${C.redHi}99) drop-shadow(0 0 28px ${C.red}55)`,
    }}>
      {SKULL_GRID.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => (
            <div key={c} style={{
              width: 14, height: 14,
              backgroundColor:
                cell === 1 ? C.red :
                cell === 2 ? '#111' :
                cell === 3 ? C.redHi :
                'transparent',
              boxShadow: cell === 1 ? `0 0 2px ${C.red}66` : 'none',
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ─── Pixel explosion effect for defeat visuals ─── */
function PixelExplosion() {
  return (
    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * Math.PI * 2
        const dist  = 30 + Math.random() * 24
        return (
          <div key={i} style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: 4 + Math.random() * 6,
            height: 4 + Math.random() * 6,
            backgroundColor: i % 2 === 0 ? C.redHi : C.gold,
            boxShadow: `0 0 4px ${C.redHi}88`,
            animation: `explode${i % 4} 0.6s ease-out forwards`,
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist}px`,
          } as React.CSSProperties} />
        )
      })}
    </div>
  )
}

/* ─── Animated score counter ─── */
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

/* ─── Stat row ─── */
function StatRow({ label, value, color, delay }: {
  label: string; value: string; color: string; delay: number
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: `1px solid ${C.border}`,
      animation: `fadeSlideUp 0.4s ease ${delay}s both`,
    }}>
      <span style={{ fontSize: 'clamp(4px, 0.85vw, 6px)', color: C.textDim, letterSpacing: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 'clamp(5px, 1.1vw, 7px)', color, letterSpacing: 1 }}>
        {value}
      </span>
    </div>
  )
}

/* ─── Concept chip ─── */
function ConceptChip({ name, correct }: { name: string; correct: boolean }) {
  return (
    <div style={{
      display: 'inline-block', padding: '4px 10px', margin: '3px',
      border: `1px solid ${correct ? C.green : C.red}66`,
      backgroundColor: correct ? '#0a1a0e' : '#1a0a0a',
      fontSize: 'clamp(4px, 0.8vw, 5px)',
      color: correct ? C.greenHi : C.redHi,
      letterSpacing: 1,
    }}>{name}</div>
  )
}

/* ─── Detailed question card ─── */
function QuestionCard({ result, idx }: {
  result: {
    question: string; playerAnswer: string; correct: boolean
    explanation: string; conceptName: string; damage: number; playerDamage: number
  }
  idx: number
}) {
  const [expanded, setExpanded] = useState(false)
  const correct = result.correct
  const borderColor = correct ? C.green : C.red
  const hiColor     = correct ? C.greenHi : C.redHi

  // Separate stem from MCQ options
  const lines = result.question.split('\n')
  const stem  = lines.find(l => l.trim().length > 0 && !/^\s*[（(]?[A-D][）).]/.test(l)) ?? result.question
  const opts  = lines.filter(l => /^\s*[（(]?[A-D][）).]/.test(l))

  return (
    <div style={{
      position: 'relative',
      border: `1px solid ${borderColor}33`,
      backgroundColor: correct ? '#080f0a' : '#0f0808',
      animation: `fadeSlideUp 0.35s ease ${Math.min(idx * 0.04, 0.6)}s both`,
    }}>
      <PixelCorner pos="tl" color={`${borderColor}66`} />
      <PixelCorner pos="br" color={`${borderColor}66`} />

      {/* Header row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px', cursor: 'pointer',
        }}
      >
        {/* Round number */}
        <span style={{
          fontSize: 'clamp(4px, 0.8vw, 5px)', color: C.textDim,
          letterSpacing: 1, flexShrink: 0, paddingTop: 1,
        }}>
          #{String(idx + 1).padStart(2, '0')}
        </span>

        {/* Result badge */}
        <span style={{
          fontSize: 'clamp(5px, 1vw, 7px)', color: hiColor,
          flexShrink: 0, letterSpacing: 1,
        }}>
          {correct ? '✓' : '✗'}
        </span>

        {/* Question stem */}
        <span style={{
          flex: 1, fontSize: 'clamp(5px, 1vw, 7px)', color: C.text,
          lineHeight: 1.8,
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: expanded ? 'normal' : 'nowrap',
        }}>
          {stem}
        </span>

        {/* Damage tag */}
        <span style={{
          fontSize: 'clamp(4px, 0.8vw, 5px)',
          color: correct ? C.green : C.red,
          flexShrink: 0, letterSpacing: 1,
          paddingTop: 1,
        }}>
          {correct ? `-${result.damage}` : `+${result.playerDamage}`}
        </span>

        {/* Expand chevron */}
        <span style={{
          fontSize: 'clamp(4px, 0.8vw, 5px)', color: C.textDim,
          flexShrink: 0, transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'none',
        }}>▾</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: '0 12px 12px',
          borderTop: `1px solid ${borderColor}22`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* MCQ options if any */}
          {opts.length > 0 && (
            <div style={{ paddingTop: 10 }}>
              <div style={{
                fontSize: 'clamp(3px, 0.7vw, 5px)', color: C.textDim,
                letterSpacing: 2, marginBottom: 6,
              }}>CHOICES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {opts.map((opt, i) => {
                  const letter = opt.trim().charAt(0)
                  const answered = result.playerAnswer.trim().toUpperCase().startsWith(letter)
                  return (
                    <div key={i} style={{
                      fontSize: 'clamp(5px, 1vw, 6px)',
                      color: answered ? hiColor : C.textDim,
                      letterSpacing: 1, lineHeight: 1.8,
                      paddingLeft: 8,
                      borderLeft: answered ? `2px solid ${hiColor}` : `2px solid transparent`,
                    }}>
                      {opt.trim()}
                      {answered && (
                        <span style={{ marginLeft: 8, fontSize: 'clamp(3px, 0.7vw, 4px)', color: hiColor }}>
                          ← YOUR ANSWER
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Free-text answer (if no MCQ) */}
          {opts.length === 0 && (
            <div style={{ paddingTop: 10 }}>
              <div style={{
                fontSize: 'clamp(3px, 0.7vw, 5px)', color: C.textDim,
                letterSpacing: 2, marginBottom: 4,
              }}>YOUR ANSWER</div>
              <div style={{
                fontSize: 'clamp(5px, 1vw, 7px)', color: hiColor,
                lineHeight: 1.8, letterSpacing: 1,
              }}>
                {result.playerAnswer}
              </div>
            </div>
          )}

          {/* Explanation */}
          {result.explanation && (
            <div>
              <div style={{
                fontSize: 'clamp(3px, 0.7vw, 5px)', color: C.textDim,
                letterSpacing: 2, marginBottom: 4,
              }}>EXPLANATION</div>
              <div style={{
                fontSize: 'clamp(5px, 1vw, 7px)', color: C.text,
                lineHeight: 2, letterSpacing: 0.5,
              }}>
                {result.explanation}
              </div>
            </div>
          )}

          {/* Concept tag */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            borderTop: `1px solid ${C.border}`, paddingTop: 8,
          }}>
            <span style={{ fontSize: 'clamp(3px, 0.7vw, 5px)', color: C.textDim, letterSpacing: 2 }}>
              CONCEPT
            </span>
            <span style={{
              fontSize: 'clamp(4px, 0.85vw, 6px)', color: C.accent,
              letterSpacing: 1,
            }}>
              {result.conceptName}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Tab button (shared) ─── */
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: 'var(--font-pixel), monospace',
      fontSize: 'clamp(5px, 1.3vw, 8px)', letterSpacing: 2,
      color: active ? C.bg : C.textDim,
      backgroundColor: active ? C.gold : 'transparent',
      border: `1px solid ${active ? C.gold : C.border}`,
      padding: '8px 16px', cursor: 'pointer',
      transition: 'all 0.15s', flex: 1,
    }}>{label}</button>
  )
}

/* ─── Main content ─── */
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

  const [btnHover, setBtnHover] = useState(false)
  const [tab, setTab] = useState<'main' | 'review'>('main')

  const correct   = lastBossResults.filter(r => r.correct).length
  const wrong     = lastBossResults.filter(r => !r.correct).length
  const accuracy  = lastBossResults.length > 0 ? Math.round((correct / lastBossResults.length) * 100) : 0

  const allCorrectConcepts = lastBossResults.filter(r => r.correct).map(r => r.conceptName)
  const allWrongConcepts   = lastBossResults.filter(r => !r.correct).map(r => r.conceptName)
  const uniqueWrong        = [...new Set(allWrongConcepts)]
  const uniqueMastered     = [...new Set(allCorrectConcepts.filter(c => !allWrongConcepts.includes(c)))]

  const bossesDefeated = isVictory ? totalBosses : currentBossIndex
  const tryAgain = () => { resetGame(); router.push('/') }
  const accentColor = isVictory ? C.gold : C.redHi

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes floatSprite {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes skullPulse {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-6px) scale(1.03); }
        }
        @keyframes defeatFlash {
          0%,100% { text-shadow: 0 0 10px rgba(204,85,85,0.8), 0 0 24px rgba(255,102,102,0.55); }
          50%      { text-shadow: 0 0 20px rgba(255,102,102,1), 0 0 40px rgba(255,136,136,0.7); }
        }
        @keyframes explode0 { from{transform:translate(-50%,-50%) scale(1); opacity:1} to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0); opacity:0} }
        @keyframes explode1 { from{transform:translate(-50%,-50%) scale(1); opacity:1} to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0); opacity:0} }
        @keyframes explode2 { from{transform:translate(-50%,-50%) scale(1); opacity:1} to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0); opacity:0} }
        @keyframes explode3 { from{transform:translate(-50%,-50%) scale(1); opacity:1} to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0); opacity:0} }
        @keyframes titleReveal {
          0%   { opacity: 0; transform: scale(0.6) translateY(16px); }
          65%  { transform: scale(1.05) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes titlePulse {
          0%,100% { opacity: 0.9; }
          50%      { opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scoreReveal {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes deathShake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-10px)} 30%{transform:translateX(10px)}
          45%{transform:translateX(-6px)}  60%{transform:translateX(6px)}
          75%{transform:translateX(-3px)}  90%{transform:translateX(3px)}
        }
        @keyframes scanlines {
          0%   { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; }
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
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: 560, width: '100%', margin: '0 auto',
          padding: '20px 16px 40px', gap: 16,
        }}>

          {/* ── Sprite + Title ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 10 }}>
            {isVictory ? <TrophySprite /> : <SkullSprite />}

            <div style={{ textAlign: 'center' }}>
              {isVictory ? (
                <>

                  <h1 style={{
                    margin: 0, fontSize: 'clamp(14px, 4vw, 24px)', color: C.gold, letterSpacing: 4,
                    animation: 'titleReveal 0.65s cubic-bezier(0.175,0.885,0.32,1.275) both, titlePulse 3s ease-in-out 0.65s infinite',
                  }}>VICTORY!</h1>
                  <div style={{ marginTop: 10, fontSize: 'clamp(4px, 0.9vw, 6px)', color: C.greenHi, letterSpacing: 4, animation: 'floatSprite 2.2s ease-in-out infinite' }}>
                    ★ THE GAUNTLET IS YOURS ★
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 'clamp(4px, 0.85vw, 6px)', color: C.textDim, letterSpacing: 4, marginBottom: 10 }}>
                    {currentBoss ? `FALLEN TO ${currentBoss.name.toUpperCase()}` : 'THE GAUNTLET CLAIMS ANOTHER'}
                  </div>
                  <h1 style={{
                    margin: 0, fontSize: 'clamp(14px, 4vw, 24px)', color: C.redHi, letterSpacing: 4,
                    animation: 'titleReveal 0.55s cubic-bezier(0.175,0.885,0.32,1.275) both, defeatFlash 1.8s ease-in-out 0.55s infinite',
                  }}>GAME OVER</h1>
                  <div style={{ marginTop: 14 }}>
                    <PixelExplosion />
                  </div>
                  <div style={{ marginTop: -50, fontSize: 'clamp(4px, 0.9vw, 6px)', color: C.textDim, letterSpacing: 3 }}>
                    {bossesDefeated > 0
                      ? `YOU CLEARED ${bossesDefeated} STAGE${bossesDefeated !== 1 ? 'S' : ''}`
                      : 'STUDY HARDER AND TRY AGAIN'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}66, transparent)` }} />

          {/* ── Score quick stats ── */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, fontSize: 'clamp(5px, 1.2vw, 7px)', animation: 'scoreReveal 0.5s ease 0.4s both' }}>
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
          <div style={{ display: 'flex', gap: 4, width: '100%', animation: 'fadeSlideUp 0.4s ease 0.5s both' }}>
            <Tab label={isVictory ? 'VICTORY' : 'DEFEAT'}         active={tab === 'main'}   onClick={() => setTab('main')} />
            <Tab label={`REVIEW (${lastBossResults.length})`}      active={tab === 'review'} onClick={() => setTab('review')} />
          </div>

          {/* ── Main tab ── */}
          {tab === 'main' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', animation: 'fadeIn 0.3s ease' }}>

              {/* Battle stats */}
              <div style={{ position: 'relative', border: `1px solid ${C.border}`, backgroundColor: C.panel, padding: '14px 16px' }}>
                <PixelCorner pos="tl" color={C.borderHi} />
                <PixelCorner pos="br" color={C.borderHi} />
                <div style={{ fontSize: 'clamp(4px, 0.8vw, 5px)', color: C.textDim, letterSpacing: 2, marginBottom: 10 }}>── BATTLE STATS ──</div>
                <StatRow label="ACCURACY"       value={`${accuracy}%`}                                        color={accuracy >= 70 ? C.greenHi : accuracy >= 40 ? C.gold : C.redHi} delay={0} />
                <StatRow label="TOTAL ROUNDS"   value={String(lastBossResults.length)}                        color={C.accent}   delay={0.05} />
                <StatRow label="CORRECT"        value={`${correct} / ${lastBossResults.length}`}              color={C.greenHi}  delay={0.10} />
                <StatRow label="MISSED"         value={`${wrong} / ${lastBossResults.length}`}                color={C.redHi}    delay={0.15} />
                <StatRow label="STAGES CLEARED" value={`${bossesDefeated} / ${totalBosses}`}                 color={C.gold}     delay={0.20} />
                <StatRow label="HP REMAINING"   value={`${Math.max(0, playerHP)} / ${PLAYER_MAX_HP_VALUE}`}  color={playerHP < PLAYER_MAX_HP_VALUE * 0.3 ? C.redHi : C.accent} delay={0.25} />
              </div>

              {/* Progress tracker */}
              <div style={{ position: 'relative', border: `1px solid ${C.border}`, backgroundColor: C.panel, padding: '14px 16px', textAlign: 'center' }}>
                <PixelCorner pos="tl" color={C.borderHi} />
                <PixelCorner pos="br" color={C.borderHi} />
                <div style={{ fontSize: 'clamp(4px, 0.8vw, 5px)', color: C.textDim, letterSpacing: 2, marginBottom: 10 }}>BOSS RUSH PROGRESS</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  {Array.from({ length: totalBosses }, (_, i) => (
                    <div key={i} style={{
                      width: 20, height: 20,
                      backgroundColor: i < bossesDefeated ? C.green : i === bossesDefeated && !isVictory ? C.red : C.panel,
                      boxShadow: i < bossesDefeated ? `0 0 4px ${C.green}66` : 'none',
                      border: i === bossesDefeated && !isVictory ? `2px solid ${C.redHi}` : `1px solid ${C.border}`,
                      transition: 'all 0.3s',
                    }} />
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 'clamp(4px, 1vw, 6px)', color: isVictory ? C.greenHi : C.textDim, letterSpacing: 2 }}>
                  {bossesDefeated} / {totalBosses} BOSSES DEFEATED
                </div>
              </div>

              {/* Concept mastery */}
              {(uniqueMastered.length > 0 || uniqueWrong.length > 0) && (
                <div style={{ position: 'relative', border: `1px solid ${C.border}`, backgroundColor: C.panel, padding: '14px 16px' }}>
                  <PixelCorner pos="tl" color={C.borderHi} />
                  <PixelCorner pos="br" color={C.borderHi} />

                  {uniqueMastered.length > 0 && (
                    <div style={{ marginBottom: uniqueWrong.length > 0 ? 12 : 0 }}>
                      <div style={{ fontSize: 'clamp(4px, 0.8vw, 5px)', color: C.greenHi, letterSpacing: 2, marginBottom: 8 }}>── MASTERED ──</div>
                      <div>{uniqueMastered.map((c, i) => <ConceptChip key={i} name={c} correct={true} />)}</div>
                    </div>
                  )}

                  {uniqueWrong.length > 0 && (
                    <div>
                      <div style={{ fontSize: 'clamp(4px, 0.8vw, 5px)', color: C.redHi, letterSpacing: 2, marginBottom: 8 }}>
                        {isVictory ? '── REVISIT THESE ──' : '── STUDY BEFORE NEXT RUN ──'}
                      </div>
                      <div>{uniqueWrong.map((c, i) => <ConceptChip key={i} name={c} correct={false} />)}</div>
                    </div>
                  )}

                  {weakSpots.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, fontSize: 'clamp(4px, 0.85vw, 6px)', color: C.textDim, lineHeight: 2, letterSpacing: 1 }}>
                      <span style={{ color: C.gold, letterSpacing: 2 }}>IDENTIFIED WEAK SPOTS: </span>
                      {weakSpots.join(' · ')}
                    </div>
                  )}
                </div>
              )}

              <button
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                onClick={tryAgain}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: 'clamp(7px, 1.5vw, 10px)', letterSpacing: 4,
                  color: btnHover ? C.bg : C.accent,
                  backgroundColor: btnHover ? C.accent : 'transparent',
                  border: `2px solid ${C.accent}`,
                  padding: '16px', cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                ► TRY AGAIN ◄
              </button>
            </div>
          )}

          {/* ── Review tab ── */}
          {tab === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: C.textDim, letterSpacing: 2, marginBottom: 4 }}>
                TAP A CARD TO SEE THE IN-DEPTH EXPLANATION
              </div>

              {lastBossResults.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: 'clamp(6px, 1.5vw, 9px)', color: C.textDim, padding: 40 }}>
                  NO QUESTIONS ON RECORD
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {lastBossResults.map((r, i) => (
                    <QuestionCard key={i} result={r} idx={i} />
                  ))}
                </div>
              )}

              <button
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                onClick={tryAgain}
                style={{
                  width: '100%', marginTop: 6,
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: 'clamp(7px, 1.5vw, 10px)', letterSpacing: 4,
                  color: btnHover ? C.bg : C.accent,
                  backgroundColor: btnHover ? C.accent : 'transparent',
                  border: `2px solid ${C.accent}`,
                  padding: '16px', cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                ► TRY AGAIN ◄
              </button>
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
      <div style={{ minHeight: '100vh', backgroundColor: '#08051a' }}>
        <CosmicStarfield />
      </div>
    }>
      <ResultContent />
    </Suspense>
  )
}
