'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/context/GameContext'
import Starfield from '@/components/ui/Starfield'
import Particles, { ParticlesHandle } from '@/components/ui/particles'
import { emitSfx } from '@/lib/audio-events'

/* ─── Boss sprite grids by category ─── */
const SPRITES: Record<string, number[][]> = {
  math: [
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,1,2,2,2,2,1,0,0],
    [0,1,2,1,2,2,1,2,1,0],
    [1,2,2,2,2,2,2,2,2,1],
    [1,2,1,2,1,1,2,1,2,1],
    [1,2,2,2,2,2,2,2,2,1],
    [0,1,2,1,2,2,1,2,1,0],
    [0,0,1,2,2,2,2,1,0,0],
    [0,0,0,1,1,1,1,0,0,0],
  ],
  history: [
    [0,1,1,1,1,1,1,1,1,0],
    [1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,0,0,1,1,2,1],
    [1,2,1,2,0,0,2,1,2,1],
    [1,2,1,1,0,0,1,1,2,1],
    [1,2,2,2,1,1,2,2,2,1],
    [1,1,2,2,2,2,2,2,1,1],
    [0,1,1,2,2,2,2,1,1,0],
    [0,0,1,1,1,1,1,1,0,0],
  ],
  science: [
    [0,0,1,1,0,0,1,1,0,0],
    [0,1,2,2,1,1,2,2,1,0],
    [1,2,1,2,2,2,2,1,2,1],
    [1,2,2,1,2,2,1,2,2,1],
    [1,1,2,2,2,2,2,2,1,1],
    [0,1,2,1,2,2,1,2,1,0],
    [0,1,1,2,2,2,2,1,1,0],
    [0,0,1,1,2,2,1,1,0,0],
    [0,0,0,1,1,1,1,0,0,0],
  ],
  default: [
    [0,0,1,0,0,0,0,1,0,0],
    [0,1,1,1,0,0,1,1,1,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,0],
    [1,1,2,2,1,1,2,2,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,0,0,1,1,0,0,1,1],
    [0,1,1,1,1,1,1,1,1,0],
    [0,1,2,1,2,2,1,2,1,0],
    [0,0,1,0,1,1,0,1,0,0],
  ],
}

const SPRITE_COLORS: Record<string, [string, string]> = {
  math:     ['#9b59ff', '#00ffff'],
  history:  ['#FFD700', '#FF6600'],
  science:  ['#00ff88', '#00ffff'],
  default:  ['#FF3333', '#FFE000'],
}

function BossSprite({ category, entered }: { category: string; entered: boolean }) {
  const grid = SPRITES[category] ?? SPRITES.default
  const [body, eye] = SPRITE_COLORS[category] ?? SPRITE_COLORS.default

  return (
    <div style={{
      lineHeight: 0,
      animation: entered ? 'bossFloat 2.4s ease-in-out infinite' : 'bossEnter 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
      opacity: entered ? 1 : 0,
    }}>
      {grid.map((row, r) => (
        <div key={r} style={{ display: 'flex', justifyContent: 'center' }}>
          {row.map((cell, c) => (
            <div key={c} style={{
              width: 10, height: 10,
              backgroundColor: cell === 1 ? body : cell === 2 ? eye : 'transparent',
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ─── HP bar ─── */
function HpBar({ value, max, color }: { value: number; max: number; color: string }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setDisplayed(value), 600)
    return () => clearTimeout(t)
  }, [value])
  const pct = (displayed / max) * 100
  return (
    <div style={{ width: '100%', height: 14, backgroundColor: '#05050b', position: 'relative', border: `2px solid ${color}` }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        backgroundColor: color,
        transition: 'width 1.2s ease',
      }} />
    </div>
  )
}

/* ─── Typewriter ─── */
function Typewriter({ text, speed = 35, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('')
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    setDisplayed('')
    let i = 0
    const tick = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { clearInterval(tick); onDoneRef.current?.() }
    }, speed)
    return () => clearInterval(tick)
  }, [text, speed])
  return <span>{displayed}<span style={{ animation: 'blink 0.7s step-start infinite' }}>▌</span></span>
}

/* ─── Letter-by-letter title ─── */
function LetterReveal({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2 }}>
      {text.split('').map((ch, i) => (
        <span key={i} style={{
          color, fontSize: 'clamp(10px, 2.5vw, 16px)', letterSpacing: 1,
          animation: `letterPop 0.05s ease ${i * 60}ms both`,
          display: 'inline-block',
        }}>{ch === ' ' ? '\u00a0' : ch}</span>
      ))}
    </div>
  )
}

export default function BossPage() {
  const router = useRouter()
  const { currentBoss, currentBossIndex, totalBosses } = useGame()
  const [phase, setPhase] = useState<'entering' | 'name' | 'hp' | 'monologue' | 'ready'>('entering')
  const revealSfxPlayedRef = useRef(false)
  const particlesRef = useRef<ParticlesHandle>(null)

  useEffect(() => {
    if (!currentBoss) return
    if (!revealSfxPlayedRef.current) {
      revealSfxPlayedRef.current = true
      emitSfx({ name: 'bossreveal sound.wav', volume: 0.5 })
    }
    const t1 = setTimeout(() => setPhase('name'), 900)
    const t2 = setTimeout(() => setPhase('hp'), 1800)
    const t3 = setTimeout(() => setPhase('monologue'), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [currentBoss, router])

  useEffect(() => {
    return () => {
      revealSfxPlayedRef.current = false
    }
  }, [])

  const category = currentBoss?.sprite_category ?? 'default'
  const [bodyColor] = SPRITE_COLORS[category] ?? SPRITE_COLORS.default

  useEffect(() => {
    const emitSparks = () => {
      particlesRef.current?.burst(window.innerWidth / 2, window.innerHeight / 2, {
        color: [bodyColor, '#ffffff', '#88ccff'],
        count: 16,
        speed: 4,
        spread: Math.PI * 2,
        gravity: 0,
        size: 3,
        life: 40,
        shape: 'square',
      })
    }
    emitSparks()
    const interval = window.setInterval(emitSparks, 900)
    return () => window.clearInterval(interval)
  }, [bodyColor])

  if (!currentBoss) return null

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes bossEnter {
          from { opacity: 0; transform: translateY(-60px) scale(0.7); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bossFloat {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes letterPop {
          from { opacity: 0; transform: scale(0.4) translateY(-8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanlines {
          0%   { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        .pixel-corners {
          clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
        }
        .retro-hover-cyan:hover:not(:disabled) {
          background-color: #00f0ff1a !important;
          border-color: #00f0ff !important;
        }
        .retro-hover-gold:hover:not(:disabled) {
          background-color: ${bodyColor}22 !important;
          border-color: ${bodyColor} !important;
          color: #000 !important;
        }
        .retro-hover-purple:hover:not(:disabled) {
          background-color: #2a1535 !important;
          border-color: #8A2BE2 !important;
        }
      `}</style>

      <div style={{
        minHeight: '100vh', backgroundColor: '#050505',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        fontFamily: 'var(--font-pixel), monospace',
      }}>
        <Starfield />
        <Particles ref={particlesRef} zIndex={1} />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
          animation: 'scanlines 0.08s linear infinite',
        }} />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.9) 100%)',
        }} />

        {/* Progress indicator */}
        <div style={{
          position: 'fixed', top: 16, right: 20, zIndex: 10,
          fontSize: 'clamp(7px, 1.5vw, 10px)', color: '#555', letterSpacing: 2,
        }}>
          BOSS {currentBossIndex + 1} OF {totalBosses}
        </div>

        <div style={{
          position: 'relative', zIndex: 3,
          width: '100%', maxWidth: 760, padding: '24px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          <div className="pixel-corners" style={{
            border: `2px solid ${bodyColor}`,
            backgroundColor: '#07080f',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(14px, 4vw, 26px)', letterSpacing: 4, color: '#FF0040' }}>
                  !! WARNING !!
                </span>
                <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(8px, 2vw, 14px)', letterSpacing: 3, color: '#aaa' }}>
                  BOSS APPROACHING
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(7px, 1.4vw, 10px)', letterSpacing: 2, color: '#ccc' }}>
                {currentBossIndex + 1} / {totalBosses}
              </span>
            </div>

            <div className="pixel-corners" style={{
              border: `2px solid ${bodyColor}`,
              backgroundColor: '#05050b',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(phase !== 'entering') && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(8px, 1.7vw, 12px)', letterSpacing: 2, color: '#999', marginBottom: 10 }}>
                      ENEMY APPROACHING
                    </div>
                    <LetterReveal text={currentBoss.name} color={bodyColor} />
                  </div>
                )}

                {(phase === 'hp' || phase === 'monologue' || phase === 'ready') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(7px, 1.3vw, 10px)', letterSpacing: 2, color: '#ccc' }}>
                      <span>HP</span>
                      <span>{currentBoss.max_hp}/{currentBoss.max_hp}</span>
                    </div>
                    <HpBar value={currentBoss.max_hp} max={currentBoss.max_hp} color={bodyColor} />
                  </div>
                )}

                {(phase === 'monologue' || phase === 'ready') && (
                  <div className="pixel-corners" style={{
                    border: `2px solid ${bodyColor}`,
                    backgroundColor: '#03040b',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}>
                    <span style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(9px, 1.9vw, 14px)', letterSpacing: 2, color: bodyColor }}>
                      DIALOGUE
                    </span>
                    <p style={{ margin: 0, fontFamily: 'var(--font-mono), monospace', fontSize: 'clamp(10px, 1.8vw, 14px)', color: '#ccc', lineHeight: 1.75 }}>
                      {phase === 'monologue'
                        ? <Typewriter text={currentBoss.opening_monologue} onDone={() => setPhase('ready')} />
                        : currentBoss.opening_monologue
                      }
                    </p>
                  </div>
                )}
              </div>

            </div>

            {(phase === 'hp' || phase === 'monologue' || phase === 'ready') && (
              <button
                className="pixel-corners"
                onClick={() => {
                  emitSfx({ name: 'riser.wav', volume: 0.105 })
                  window.setTimeout(() => router.push('/battle'), 110)
                }}
                style={{
                  width: '100%',
                  padding: '16px 0',
                  backgroundColor: 'transparent',
                  border: `2px solid ${bodyColor}`,
                  color: bodyColor,
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: 'clamp(8px, 1.7vw, 11px)',
                  letterSpacing: 3,
                  cursor: 'pointer',
                }}
              >
                ► BATTLE ◄
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
