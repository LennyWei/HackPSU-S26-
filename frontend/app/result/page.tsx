'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGame, PLAYER_MAX_HP_VALUE } from '@/context/GameContext'
import Starfield from '@/components/ui/Starfield'

/* ─── Scanline overlay ─── */
function Scanlines() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
      backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.12) 2px,rgba(0,0,0,0.12) 4px)',
    }} />
  )
}

/* ─── Big pixel text with glow ─── */
function GlowText({ text, color, size = 'clamp(18px,5vw,36px)' }: { text: string; color: string; size?: string }) {
  return (
    <h1 style={{
      margin: 0, fontSize: size, color,
      letterSpacing: 5, lineHeight: 1.4,
      textShadow: `0 0 10px ${color}, 0 0 30px ${color}aa, 0 0 60px ${color}44`,
      animation: 'titlePulse 2s ease-in-out infinite',
    }}>{text}</h1>
  )
}

/* ─── Concept chip ─── */
function ConceptChip({ name, correct }: { name: string; correct: boolean }) {
  return (
    <div style={{
      display: 'inline-block',
      padding: '4px 10px',
      border: `1px solid ${correct ? '#39FF14' : '#FF0040'}44`,
      backgroundColor: correct ? '#001a00' : '#1a0000',
      fontSize: 'clamp(4px, 1vw, 6px)',
      color: correct ? '#39FF14' : '#FF6666',
      letterSpacing: 1,
      margin: 3,
    }}>{name}</div>
  )
}

function ResultContent() {
  const router = useRouter()
  const params = useSearchParams()
  const outcome = params.get('outcome') ?? 'death'
  const isVictory = outcome === 'victory'

  const { currentBoss, score, turn, lastBossResults, weakSpots, totalBosses, resetGame } = useGame()
  const [btnHover, setBtnHover] = useState(false)

  // Collect all unique concept results across the whole run
  const allCorrect = lastBossResults.filter((r) => r.correct).map((r) => r.conceptName)
  const allWrong = lastBossResults.filter((r) => !r.correct).map((r) => r.conceptName)
  const uniqueWrong = [...new Set(allWrong)]
  const uniqueCorrect = [...new Set(allCorrect.filter((c) => !allWrong.includes(c)))]

  const tryAgain = () => {
    resetGame()
    router.push('/')
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes titlePulse {
          0%,100%{filter:brightness(1)}
          50%{filter:brightness(1.3)}
        }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatUp { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes scanlines { 0%{background-position:0 0} 100%{background-position:0 4px} }
        @keyframes deathShake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-8px)}
          30%{transform:translateX(8px)}
          45%{transform:translateX(-5px)}
          60%{transform:translateX(5px)}
          75%{transform:translateX(-3px)}
          90%{transform:translateX(3px)}
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #FFD70044; }
      `}</style>

      <div style={{
        minHeight: '100vh', backgroundColor: '#050505',
        fontFamily: 'var(--font-pixel), monospace',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
        animation: !isVictory ? 'deathShake 0.6s ease 0.3s' : 'none',
      }}>
        <Starfield color={isVictory ? '255,220,50' : '255,60,60'} />
        <Scanlines />

        <div style={{
          position: 'relative', zIndex: 3,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 560, width: '100%', margin: '0 auto',
          padding: '32px 16px 60px', gap: 20,
        }}>

          {/* Outcome header */}
          <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
            {isVictory ? (
              <>
                <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 4, marginBottom: 12 }}>
                  ALL {totalBosses} BOSSES DEFEATED
                </div>
                <GlowText text="GAUNTLET" color="#FFD700" />
                <GlowText text="CLEARED!" color="#39FF14" />
                <div style={{ marginTop: 14, fontSize: 'clamp(5px, 1.2vw, 7px)', color: '#39FF14', animation: 'floatUp 2s ease-in-out infinite' }}>
                  ★ ★ ★ VICTORY ★ ★ ★
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 4, marginBottom: 12 }}>
                  {currentBoss ? `DEFEATED BY ${currentBoss.name.toUpperCase()}` : 'DEFEATED'}
                </div>
                <GlowText text="DEFEATED" color="#FF0040" />
                <div style={{ marginTop: 12, fontSize: 'clamp(5px, 1.2vw, 7px)', color: '#FF0040', opacity: 0.7 }}>
                  YOUR JOURNEY ENDS HERE
                </div>
              </>
            )}
          </div>

          {/* Divider */}
          <div style={{
            width: '100%', height: 2,
            background: `linear-gradient(90deg, transparent, ${isVictory ? '#FFD700' : '#FF0040'}, transparent)`,
          }} />

          {/* Stats panel */}
          <div style={{
            width: '100%', border: '1px solid #ffffff0a',
            backgroundColor: '#080808', padding: '16px',
            animation: 'fadeIn 0.5s ease 0.2s both',
          }}>
            <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 2, marginBottom: 12 }}>── FINAL STATS ──</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'FINAL SCORE', value: score.toLocaleString(), color: '#FFD700' },
                { label: 'TOTAL TURNS', value: String(turn), color: '#00f0ff' },
                { label: 'BOSSES DEFEATED', value: `${isVictory ? totalBosses : (useGame as unknown as { currentBossIndex: number }).currentBossIndex ?? 0}/${totalBosses}`, color: '#39FF14' },
                { label: 'ACCURACY', value: lastBossResults.length > 0 ? `${Math.round((lastBossResults.filter(r => r.correct).length / lastBossResults.length) * 100)}%` : 'N/A', color: '#9b59ff' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555', letterSpacing: 2 }}>{label}</span>
                  <span style={{ fontSize: 'clamp(5px, 1.2vw, 7px)', color, textShadow: `0 0 4px ${color}88` }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Concepts mastered (victory) */}
          {isVictory && uniqueCorrect.length > 0 && (
            <div style={{ width: '100%', animation: 'fadeIn 0.5s ease 0.3s both' }}>
              <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#39FF14', letterSpacing: 2, marginBottom: 8 }}>
                ── CONCEPTS MASTERED ──
              </div>
              <div>{uniqueCorrect.map((c, i) => <ConceptChip key={i} name={c} correct={true} />)}</div>
            </div>
          )}

          {/* Weak spots (always if any wrong) */}
          {uniqueWrong.length > 0 && (
            <div style={{ width: '100%', animation: 'fadeIn 0.5s ease 0.4s both' }}>
              <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#FF0040', letterSpacing: 2, marginBottom: 8 }}>
                {isVictory ? '── STILL NEEDS WORK ──' : '── STUDY THESE BEFORE YOUR NEXT ATTEMPT ──'}
              </div>
              <div>{uniqueWrong.map((c, i) => <ConceptChip key={i} name={c} correct={false} />)}</div>
            </div>
          )}

          {/* If weak spots from game context (from boss taunts) */}
          {weakSpots.length > 0 && (
            <div style={{ width: '100%', animation: 'fadeIn 0.5s ease 0.5s both' }}>
              <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#FF6600', letterSpacing: 2, marginBottom: 8 }}>── IDENTIFIED WEAK SPOTS ──</div>
              <div style={{ fontSize: 'clamp(5px, 1.2vw, 7px)', color: '#FF8844', lineHeight: 2 }}>
                {weakSpots.join(', ')}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 10, animation: 'fadeIn 0.5s ease 0.6s both' }}>
            <button
              style={{
                fontFamily: 'var(--font-pixel), monospace',
                fontSize: 'clamp(7px, 1.8vw, 10px)', letterSpacing: 3,
                color: btnHover ? '#000' : '#FFD700',
                backgroundColor: btnHover ? '#FFD700' : 'transparent',
                border: '2px solid #FFD700', padding: '16px',
                cursor: 'pointer', transition: 'all 0.12s ease',
                textShadow: btnHover ? 'none' : '0 0 8px #FFD700',
              }}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              onClick={tryAgain}
            >
              ► TRY AGAIN ◄
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#050505' }} />}>
      <ResultContent />
    </Suspense>
  )
}
