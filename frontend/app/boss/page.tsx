'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/context/GameContext'
import Starfield from '@/components/ui/Starfield'

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
  const glow = `0 0 8px ${body}99, 0 0 18px ${body}44`
  const eyeGlow = `0 0 6px ${eye}cc`

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
              boxShadow: cell === 1 ? glow : cell === 2 ? eyeGlow : 'none',
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
    <div style={{ width: '100%', height: 12, backgroundColor: '#111', position: 'relative', border: `1px solid ${color}44` }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}88`,
        transition: 'width 1.2s ease',
      }} />
    </div>
  )
}

/* ─── Typewriter ─── */
function Typewriter({ text, speed = 35, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const tick = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { clearInterval(tick); onDone?.() }
    }, speed)
    return () => clearInterval(tick)
  }, [text, speed, onDone])
  return <span>{displayed}<span style={{ animation: 'blink 0.7s step-start infinite' }}>▌</span></span>
}

/* ─── Letter-by-letter title ─── */
function LetterReveal({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2 }}>
      {text.split('').map((ch, i) => (
        <span key={i} style={{
          color, fontSize: 'clamp(10px, 2.5vw, 16px)', letterSpacing: 1,
          textShadow: `0 0 10px ${color}`,
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
  const [btnHover, setBtnHover] = useState(false)

  useEffect(() => {
    if (!currentBoss) return
    const t1 = setTimeout(() => setPhase('name'), 900)
    const t2 = setTimeout(() => setPhase('hp'), 1800)
    const t3 = setTimeout(() => setPhase('monologue'), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [currentBoss, router])

  if (!currentBoss) return null

  const category = currentBoss.sprite_category ?? 'default'
  const [bodyColor] = SPRITE_COLORS[category] ?? SPRITE_COLORS.default

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
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 12px ${bodyColor}44; }
          50%      { box-shadow: 0 0 30px ${bodyColor}aa; }
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
          fontSize: 'clamp(5px, 1.2vw, 7px)', color: '#555', letterSpacing: 2,
        }}>
          BOSS {currentBossIndex + 1} OF {totalBosses}
        </div>

        <div style={{
          position: 'relative', zIndex: 3,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 20,
          maxWidth: 500, width: '100%', padding: '20px 24px',
        }}>

          {/* WARNING header */}
          <div style={{ fontSize: 'clamp(8px, 2vw, 12px)', color: '#FF0040', letterSpacing: 6, textShadow: '0 0 10px #FF004088', animation: 'fadeIn 0.4s ease' }}>
            !! WARNING !!
          </div>

          {/* Boss sprite */}
          <BossSprite category={category} entered={phase !== 'entering'} />

          {/* Name */}
          {(phase === 'name' || phase === 'hp' || phase === 'monologue' || phase === 'ready') && (
            <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
              <div style={{ fontSize: 'clamp(5px, 1.2vw, 7px)', color: '#555', letterSpacing: 3, marginBottom: 8 }}>ENEMY APPROACHING</div>
              <LetterReveal text={currentBoss.name} color={bodyColor} />
            </div>
          )}

          {/* HP bar */}
          {(phase === 'hp' || phase === 'monologue' || phase === 'ready') && (
            <div style={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#FF0040', letterSpacing: 2 }}>HP</span>
                <span style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: '#555' }}>{currentBoss.max_hp}/{currentBoss.max_hp}</span>
              </div>
              <HpBar value={currentBoss.max_hp} max={currentBoss.max_hp} color="#FF0040" />
            </div>
          )}

          {/* Opening monologue */}
          {(phase === 'monologue' || phase === 'ready') && (
            <div style={{
              width: '100%', padding: '14px 16px',
              border: `1px solid ${bodyColor}44`,
              backgroundColor: '#0a0a0a',
              animation: 'fadeIn 0.5s ease',
              position: 'relative',
            }}>
              <div style={{ fontSize: 'clamp(4px, 1vw, 6px)', color: bodyColor, letterSpacing: 2, marginBottom: 8, opacity: 0.6 }}>
                {currentBoss.name.toUpperCase()} SAYS:
              </div>
              <p style={{ margin: 0, fontSize: 'clamp(6px, 1.5vw, 9px)', color: '#ccc', lineHeight: 2.2 }}>
                {phase === 'monologue'
                  ? <Typewriter text={currentBoss.opening_monologue} onDone={() => setPhase('ready')} />
                  : currentBoss.opening_monologue
                }
              </p>
            </div>
          )}

          {/* CTA */}
          {phase === 'ready' && (
            <button
              style={{
                fontFamily: 'var(--font-pixel), monospace',
                fontSize: 'clamp(7px, 1.8vw, 10px)', letterSpacing: 3,
                color: btnHover ? '#000' : bodyColor,
                backgroundColor: btnHover ? bodyColor : 'transparent',
                border: `2px solid ${bodyColor}`,
                padding: '14px 32px', cursor: 'pointer',
                textShadow: btnHover ? 'none' : `0 0 8px ${bodyColor}`,
                transition: 'all 0.12s ease',
                animation: 'fadeIn 0.4s ease, pulseGlow 1.6s ease-in-out infinite',
              }}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              onClick={() => router.push('/battle')}
            >
              ► PREPARE FOR BATTLE ◄
            </button>
          )}
        </div>
      </div>
    </>
  )
}
