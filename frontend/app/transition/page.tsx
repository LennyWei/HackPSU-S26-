'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/context/GameContext'
import Starfield from '@/components/ui/Starfield'

/* ─── Pixel explosion animation ─── */
function PixelExplosion({ color }: { color: string }) {
  return (
    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * Math.PI * 2
        const dist = 30 + Math.random() * 30
        return (
          <div key={i} style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: 4 + Math.random() * 6,
            height: 4 + Math.random() * 6,
            backgroundColor: i % 3 === 0 ? '#FFD700' : color,
            boxShadow: `0 0 6px ${color}`,
            animation: `explode${i % 4} 0.6s ease-out forwards`,
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist}px`,
          } as React.CSSProperties} />
        )
      })}
    </div>
  )
}

/* ─── Question result card ─── */
function ResultCard({ result, index }: { result: import('@/context/GameContext').QuestionResult; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = result.correct ? '#39FF14' : '#FF0040'
  const badgeColor = result.correct ? '#39FF14' : '#FF0040'
  const badgeText = result.correct ? '✓ CORRECT' : '✗ WRONG'

  return (
    <div style={{
      border: `1px solid ${borderColor}44`,
      backgroundColor: result.correct ? '#001a00' : '#1a0000',
      padding: '12px 14px',
      position: 'relative',
      animation: `fadeIn 0.4s ease ${index * 0.1}s both`,
      cursor: 'pointer',
    }} onClick={() => setExpanded((e) => !e)}>

      {/* Badge */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        fontSize: 'clamp(4px, 1vw, 6px)',
        color: badgeColor, letterSpacing: 2,
        textShadow: `0 0 6px ${badgeColor}88`,
      }}>{badgeText}</div>

      {/* Concept + damage */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 2 }}>Q{index + 1}</span>
        <span style={{ fontSize: 'clamp(5px, 1.2vw, 7px)', color: '#FFD700', letterSpacing: 1 }}>
          {result.conceptName}
        </span>
        {result.correct
          ? <span style={{ fontSize: 'clamp(4px, 1vw, 5px)', color: '#39FF14', marginLeft: 'auto', paddingRight: 70 }}>-{result.damage} HP to boss</span>
          : <span style={{ fontSize: 'clamp(4px, 1vw, 5px)', color: '#FF0040', marginLeft: 'auto', paddingRight: 70 }}>-{result.playerDamage} HP to you</span>
        }
      </div>

      {/* Question */}
      <p style={{ margin: '0 0 6px', fontSize: 'clamp(5px, 1.3vw, 8px)', color: '#ccc', lineHeight: 1.8 }}>
        {result.question}
      </p>

      {/* Player answer */}
      <div style={{ fontSize: 'clamp(4px, 1.1vw, 7px)', color: result.correct ? '#39FF14' : '#FF6666', lineHeight: 1.6, marginBottom: expanded ? 10 : 0 }}>
        Your answer: &ldquo;{result.playerAnswer}&rdquo;
      </div>

      {/* Expandable explanation */}
      {expanded && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid ${borderColor}22`,
          animation: 'fadeIn 0.25s ease',
        }}>
          <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#9b59ff', letterSpacing: 2, marginBottom: 6 }}>
            ── EXPLANATION ──
          </div>
          <p style={{ margin: 0, fontSize: 'clamp(5px, 1.3vw, 8px)', color: '#aaa', lineHeight: 2 }}>
            {result.explanation}
          </p>
        </div>
      )}

      {/* Expand hint */}
      <div style={{ marginTop: 6, fontSize: 'clamp(3px, 0.9vw, 5px)', color: '#333', letterSpacing: 1, textAlign: 'right' }}>
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
      fontSize: 'clamp(5px, 1.3vw, 8px)', letterSpacing: 2,
      color: active ? '#000' : '#555',
      backgroundColor: active ? '#FFD700' : 'transparent',
      border: `1px solid ${active ? '#FFD700' : '#333'}`,
      padding: '8px 16px', cursor: 'pointer',
      transition: 'all 0.15s',
      flex: 1,
    }}>{label}</button>
  )
}

export default function TransitionPage() {
  const router = useRouter()
  const { currentBossIndex, totalBosses, lastBossResults, clearLastBossResults, score } = useGame()
  const [tab, setTab] = useState<'victory' | 'review'>('victory')
  const [btnHover, setBtnHover] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const prevBossIndex = currentBossIndex - 1
  const correctCount = lastBossResults.filter((r) => r.correct).length
  const totalCount = lastBossResults.length
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  // Countdown to auto-navigate when on victory tab
  useEffect(() => {
    if (tab !== 'victory') return
    setCountdown(12)
    const interval = setInterval(() => {
      setCountdown((c) => {
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
        @keyframes defeatFlash {
          0%,100%{text-shadow:0 0 10px #FFD700,0 0 30px #FFD700aa,0 0 60px #FFD70055}
          50%{text-shadow:0 0 20px #FFD700,0 0 50px #FFD700cc,0 0 90px #FFD70088}
        }
        @keyframes scanlines { 0%{background-position:0 0} 100%{background-position:0 4px} }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        ${Array.from({ length: 4 }, (_, i) => `
          @keyframes explode${i} {
            0%{transform:translate(-50%,-50%) scale(1);opacity:1}
            100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0);opacity:0}
          }
        `).join('\n')}
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #FFD70044; }
      `}</style>

      <div style={{
        minHeight: '100vh', backgroundColor: '#050505',
        fontFamily: 'var(--font-pixel), monospace',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        <Starfield />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.1) 2px,rgba(0,0,0,0.1) 4px)',
          animation: 'scanlines 0.08s linear infinite',
        }} />

        <div style={{
          position: 'relative', zIndex: 3,
          display: 'flex', flexDirection: 'column',
          maxWidth: 560, width: '100%', margin: '0 auto',
          padding: '20px 16px 40px', gap: 16,
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', paddingTop: 10 }}>
            <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 3, marginBottom: 8 }}>
              BOSS {prevBossIndex + 1} OF {totalBosses} CLEARED
            </div>
            <h1 style={{
              fontSize: 'clamp(14px, 4vw, 24px)', color: '#FFD700', letterSpacing: 4,
              animation: 'defeatFlash 1.6s ease-in-out infinite',
            }}>
              BOSS DEFEATED!
            </h1>

            {/* Explosion */}
            <div style={{ marginTop: 12 }}>
              <PixelExplosion color="#FF0040" />
            </div>

            {/* Quick stats */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12,
              fontSize: 'clamp(5px, 1.2vw, 7px)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#555', letterSpacing: 2, marginBottom: 3 }}>ACCURACY</div>
                <div style={{ color: accuracy >= 70 ? '#39FF14' : '#FF0040', textShadow: `0 0 6px currentColor` }}>{accuracy}%</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#555', letterSpacing: 2, marginBottom: 3 }}>QUESTIONS</div>
                <div style={{ color: '#FFD700' }}>{correctCount}/{totalCount}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#555', letterSpacing: 2, marginBottom: 3 }}>SCORE</div>
                <div style={{ color: '#FFD700' }}>{score.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            <Tab label="VICTORY" active={tab === 'victory'} onClick={() => setTab('victory')} />
            <Tab label={`REVIEW (${totalCount})`} active={tab === 'review'} onClick={() => setTab('review')} />
          </div>

          {/* Victory tab */}
          {tab === 'victory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeIn 0.3s ease' }}>
              <div style={{
                border: '1px solid #FFD70033', backgroundColor: '#0a0800',
                padding: '16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 'clamp(5px, 1.2vw, 7px)', color: '#555', letterSpacing: 2, marginBottom: 10 }}>BOSS RUSH PROGRESS</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  {Array.from({ length: totalBosses }, (_, i) => (
                    <div key={i} style={{
                      width: 20, height: 20,
                      backgroundColor: i < currentBossIndex ? '#39FF14' : i === prevBossIndex + 1 ? '#FF0040' : '#111',
                      boxShadow: i < currentBossIndex ? '0 0 6px #39FF1488' : 'none',
                      border: i === prevBossIndex ? '2px solid #FFD700' : '1px solid #333',
                      transition: 'all 0.3s',
                    }} />
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 'clamp(4px, 1vw, 6px)', color: '#39FF14', letterSpacing: 2 }}>
                  {currentBossIndex} / {totalBosses} BOSSES DEFEATED
                </div>
              </div>

              {/* Performance summary */}
              <div style={{ border: '1px solid #ffffff0a', backgroundColor: '#080808', padding: '14px' }}>
                <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 2, marginBottom: 10 }}>BATTLE SUMMARY</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'CORRECT HITS', value: `${correctCount}`, color: '#39FF14' },
                    { label: 'MISSED SHOTS', value: `${totalCount - correctCount}`, color: '#FF0040' },
                    { label: 'ACCURACY', value: `${accuracy}%`, color: accuracy >= 70 ? '#39FF14' : '#FF6600' },
                    { label: 'SCORE THIS ROUND', value: score.toLocaleString(), color: '#FFD700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 2 }}>{label}</span>
                      <span style={{ fontSize: 'clamp(5px, 1.2vw, 7px)', color, textShadow: `0 0 4px ${color}88` }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: 'clamp(4px, 1vw, 6px)', color: '#444', letterSpacing: 2 }}>
                CHECK THE REVIEW TAB FOR DETAILED EXPLANATIONS
              </div>

              <div style={{ textAlign: 'center', fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 1 }}>
                Auto-continuing in <span style={{ color: '#FFD700', animation: 'blink 1s step-start infinite' }}>{countdown}s</span>...
              </div>

              <button
                style={{
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: 'clamp(7px, 1.8vw, 10px)', letterSpacing: 3,
                  color: btnHover ? '#000' : '#FF0040',
                  backgroundColor: btnHover ? '#FF0040' : 'transparent',
                  border: '2px solid #FF0040', padding: '14px',
                  cursor: 'pointer', transition: 'all 0.12s ease',
                  textShadow: btnHover ? 'none' : '0 0 8px #FF0040',
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
              <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 2, marginBottom: 4 }}>
                TAP A CARD TO SEE THE IN-DEPTH EXPLANATION
              </div>

              {lastBossResults.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: 'clamp(6px, 1.5vw, 9px)', color: '#333', padding: 40 }}>
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
                  color: '#FF0040', backgroundColor: 'transparent',
                  border: '2px solid #FF0040', padding: '14px',
                  cursor: 'pointer', marginTop: 10,
                  textShadow: '0 0 8px #FF0040',
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
