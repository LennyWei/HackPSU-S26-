'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGame, PLAYER_MAX_HP_VALUE } from '@/context/GameContext'
import { streamQuestion, readStream } from '@/lib/api'
import { CombatProvider, useCombatContext } from '@/context/CombatContext'
import { PHASES, CombatQuestion } from '@/hooks/useCombat'
import ParallaxBackground from '@/components/ui/parallax-background'
import TwinklingStars from '@/components/ui/twinkling-stars'
import Particles, { ParticlesHandle } from '@/components/ui/particles'
import { useShake, ShakeStyles } from '@/hooks/useShake'

// ─── Question adapter ─────────────────────────────────────────────────────────

function adaptQuestion(raw: Record<string, unknown>): CombatQuestion {
  const options = (raw.options as Array<{ id: string; text: string }>) ?? []
  const choices = options.map(opt => ({ id: opt.id, text: opt.text }))
  const correct = (raw.correct_answer as string) ?? ''
  return {
    id:              (raw.id as string) ?? `q_${Math.random().toString(36).slice(2)}`,
    difficulty:      (raw.difficulty as number) ?? 5,
    question_text:   (raw.question_text as string) ?? '',
    dialogue:        (raw.dialogue as string) ?? '',
    choices,
    correctAnswerId: correct,
    concept:         (raw.concept as string) ?? '',
    explanation:     (raw.explanation as string) ?? `The correct answer is: ${correct}`,
    wrong_taunts:    (raw.wrong_taunts as Array<{ answer: string; taunt: string }>) ?? [],
  }
}

function buildMockQuestion(game: ReturnType<typeof useGame>, index: number): CombatQuestion {
  const cluster = game.currentCluster
  const boss    = game.currentBoss
  const concept = cluster?.concepts[index % Math.max(cluster?.concepts.length ?? 1, 1)]
  const name    = concept?.name ?? 'a key concept'
  return {
    id:              `mock_q_${index}`,
    difficulty:      5,
    question_text:   `Which statement best describes ${name}?`,
    dialogue:        `${boss?.name ?? 'Boss'}: "Let's see if you truly understand ${name}!"`,
    choices: [
      { id: 'A', text: `${name} is the most important element of this topic` },
      { id: 'B', text: 'This concept has no relevance here' },
      { id: 'C', text: 'Both A and B are equally valid' },
      { id: 'D', text: 'Neither A nor B is accurate' },
    ],
    correctAnswerId: 'A',
    concept:         name,
    explanation:     `${name} is indeed central to ${cluster?.clusterName ?? 'this topic'}.`,
    wrong_taunts: [
      { answer: 'B', taunt: `${name} is not irrelevant — you should study harder!` },
      { answer: 'C', taunt: `Both equally valid? Not even close, challenger.` },
      { answer: 'D', taunt: `Neither accurate? You clearly haven't read your notes.` },
    ],
  }
}

// ─── Visual components (unchanged) ───────────────────────────────────────────

const BOSS_GRID = [
  [0,0,0,1,1,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,2,2,1,1,2,2,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,1,1,1,1,1,1,1,1,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,0,0,1,1,0,0,1,1,0],
  [0,1,2,0,0,1,1,0,0,2,1,0],
  [0,0,1,0,0,0,0,0,0,1,0,0],
]

function BossSprite({ flashing }: { flashing: boolean }) {
  const body = flashing ? '#ffffff' : '#FF3333'
  const eye  = flashing ? '#ffffff' : '#FFE000'
  return (
    <div style={{
      lineHeight: 0,
      animation: 'bossFloat 2s ease-in-out infinite',
      filter: flashing ? 'brightness(4) saturate(0)' : 'drop-shadow(0 0 14px #FF333399) drop-shadow(0 0 30px #FF000044)',
      transition: 'filter 0.1s',
    }}>
      {BOSS_GRID.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => (
            <div key={c} style={{
              width: 14, height: 14,
              backgroundColor: cell === 1 ? body : cell === 2 ? eye : 'transparent',
              boxShadow: cell ? `0 0 4px ${body}55` : 'none',
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

const PLAYER_GRID = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,2,2,2,1,0],
  [0,1,2,1,1,2,1,0],
  [0,1,2,2,2,2,1,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,3,3,1,1,0],
  [1,1,0,3,3,0,1,1],
  [1,0,0,1,1,0,0,1],
]

function PlayerAvatar({ damaged }: { damaged: boolean }) {
  return (
    <div style={{
      lineHeight: 0,
      filter: damaged ? 'brightness(5) saturate(0)' : 'drop-shadow(0 0 10px #00f0ffaa) drop-shadow(0 0 22px #00f0ff44)',
      transition: 'filter 0.15s',
    }}>
      {PLAYER_GRID.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => (
            <div key={c} style={{
              width: 11, height: 11,
              backgroundColor: cell === 1 ? '#00f0ff' : cell === 2 ? '#ffffff' : cell === 3 ? '#FFD700' : 'transparent',
              boxShadow: cell ? '0 0 3px #00f0ff55' : 'none',
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function HpBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, (value / max) * 100)
  const low = pct < 30
  return (
    <div>
      <div style={{ height: 7, backgroundColor: '#050505', border: `1px solid ${color}33`, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', width: `${pct}%`, backgroundColor: color,
          boxShadow: `0 0 ${low ? 12 : 5}px ${color}`,
          transition: 'width 0.4s ease',
          animation: low ? 'hpPulse 0.5s ease-in-out infinite' : 'none',
        }} />
      </div>
      <div style={{ textAlign: 'right', marginTop: 2 }}>
        <span style={{ fontSize: 'clamp(4px, 0.7vw, 5px)', color: '#444', fontFamily: 'var(--font-pixel), monospace' }}>
          {Math.max(0, value)}<span style={{ color: '#222' }}>/{max}</span>
        </span>
      </div>
    </div>
  )
}

interface DmgNum { id: number; value: number; color: string; side: 'boss' | 'player' }

function DamageNumber({ dmg, bossRef, playerRef }: { dmg: DmgNum; bossRef: React.RefObject<HTMLDivElement | null>; playerRef: React.RefObject<HTMLDivElement | null> }) {
  const ref  = dmg.side === 'boss' ? bossRef : playerRef
  const rect = ref.current?.getBoundingClientRect()
  if (!rect) return null
  return (
    <div style={{
      position: 'fixed', left: rect.left + rect.width / 2, top: rect.top - 10,
      transform: 'translateX(-50%)', color: dmg.color,
      fontSize: 'clamp(10px, 2vw, 16px)',
      textShadow: `0 0 14px ${dmg.color}, 0 0 28px ${dmg.color}88`,
      fontFamily: 'var(--font-pixel), monospace',
      animation: 'dmgFloat 1.2s ease-out forwards',
      pointerEvents: 'none', zIndex: 100, whiteSpace: 'nowrap',
    }}>
      {dmg.value > 0 ? `-${dmg.value}` : 'MISS'}
    </div>
  )
}

// ─── Outer page: pre-fetch questions, wrap with CombatProvider ────────────────

export default function BattlePage() {
  const game = useGame()
  const [questions, setQuestions] = useState<CombatQuestion[] | null>(null)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!game.currentBoss) return
    let cancelled = false

    async function load() {
      const N = 6

      if (process.env.NEXT_PUBLIC_MOCK === 'true') {
        await new Promise(r => setTimeout(r, 700))
        if (!cancelled) setQuestions(Array.from({ length: N }, (_, i) => buildMockQuestion(game, i)))
        return
      }

      const qs: CombatQuestion[] = []
      for (let i = 0; i < N; i++) {
        try {
          const res = await streamQuestion(game)
          let full  = ''
          await readStream(res, chunk => { full += chunk })
          qs.push(adaptQuestion(JSON.parse(full) as Record<string, unknown>))
        } catch {
          if (qs.length >= 3) break
        }
      }

      if (cancelled) return
      if (qs.length === 0) setFetchError(true)
      else setQuestions(qs)
    }

    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentBoss])

  if (!game.currentBoss) return null

  if (fetchError) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#03030a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-pixel), monospace', color: '#FF0040' }}>
        ERROR: Could not load battle questions.
      </div>
    )
  }

  if (!questions) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#03030a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-pixel), monospace', color: '#444', letterSpacing: 3, fontSize: 'clamp(6px, 1.2vw, 8px)', animation: 'pulse 1s ease-in-out infinite' }}>
        PREPARING BATTLE...
      </div>
    )
  }

  return (
    <CombatProvider
      questions={questions}
      playerMaxHP={PLAYER_MAX_HP_VALUE}
      bossMaxHP={game.currentBoss.max_hp}
    >
      <BattleUI />
    </CombatProvider>
  )
}

// ─── Inner component: all combat logic via useCombatContext ───────────────────

function BattleUI() {
  const router  = useRouter()
  const game    = useGame()
  const combat  = useCombatContext()

  const [bossFlashing,   setBossFlashing]   = useState(false)
  const [playerDamaged,  setPlayerDamaged]  = useState(false)
  const [dmgNums,        setDmgNums]        = useState<DmgNum[]>([])

  const { shakeClass, triggerShake } = useShake()
  const dmgIdRef      = useRef(0)
  const bossRef       = useRef<HTMLDivElement>(null)
  const playerRef     = useRef<HTMLDivElement>(null)
  const particlesRef  = useRef<ParticlesHandle>(null)
  const revealFiredRef = useRef(false)

  const addDmg = (value: number, color: string, side: 'boss' | 'player') => {
    const id = dmgIdRef.current++
    setDmgNums(prev => [...prev, { id, value, color, side }])
    setTimeout(() => setDmgNums(prev => prev.filter(d => d.id !== id)), 1300)
  }

  // REVEAL: trigger effects then advance
  useEffect(() => {
    if (combat.state.phase !== PHASES.REVEAL) { revealFiredRef.current = false; return }
    if (revealFiredRef.current) return
    revealFiredRef.current = true

    if (combat.state.isCorrect) {
      setBossFlashing(true)
      addDmg(combat.state.bossDamageOnCorrect, '#39FF14', 'boss')
      const r = bossRef.current?.getBoundingClientRect()
      if (r) particlesRef.current?.burst(r.left + r.width / 2, r.top + r.height / 2, { color: ['#39FF14', '#00f0ff', '#ffffff'], count: 36, speed: 7, gravity: 0.25, size: 5 })
      setTimeout(() => setBossFlashing(false), 300)
    } else {
      setPlayerDamaged(true)
      addDmg(combat.state.playerDamageOnWrong, '#FF0040', 'player')
      triggerShake({ intensity: 'heavy' })
      const r = playerRef.current?.getBoundingClientRect()
      if (r) particlesRef.current?.burst(r.left + r.width / 2, r.top + r.height / 2, { color: ['#FF0040', '#ff6644', '#ffaa00'], count: 28, speed: 5, angle: -Math.PI / 2, spread: Math.PI, gravity: 0.3, size: 4 })
      setTimeout(() => setPlayerDamaged(false), 500)
    }

    const t = setTimeout(() => combat.revealComplete(), 1500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat.state.phase])

  // EXPLANATION: auto-advance after 4s
  useEffect(() => {
    if (combat.state.phase !== PHASES.EXPLANATION) return
    const t = setTimeout(() => combat.explanationOK(), 4000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat.state.phase])

  // GAME_OVER: navigate
  useEffect(() => {
    if (combat.state.phase !== PHASES.GAME_OVER) return
    game.addScore(combat.state.currency)
    if (combat.state.bossHP <= 0) {
      if (game.currentBossIndex + 1 >= game.totalBosses) {
        router.push('/result?outcome=victory')
      } else {
        game.advanceToNextBoss()
        router.push('/transition')
      }
    } else {
      router.push('/result?outcome=death')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat.state.phase])

  if (!game.currentBoss) return null

  const { state } = combat
  const q         = state.currentQuestion
  const choices   = q?.choices.filter(c => !state.eliminatedChoices.includes(c.id)) ?? []

  const isActive      = state.phase === PHASES.ACTIVE
  const isReveal      = state.phase === PHASES.REVEAL
  const isExplanation = state.phase === PHASES.EXPLANATION
  const isLoading     = state.phase === PHASES.LOADING

  const bossHPPct   = (state.bossHP   / state.bossMaxHP)   * 100
  const playerHPPct = (state.playerHP / state.playerMaxHP) * 100
  const timerPct    = state.totalTime > 0 ? (state.timeRemaining / state.totalTime) * 100 : 0
  const timerLow    = timerPct < 25

  // dialogue text varies by phase
  const wrongTaunt = (isReveal && !state.isCorrect && state.selectedAnswer)
    ? q?.wrong_taunts.find(t => t.answer === state.selectedAnswer)?.taunt
    : undefined

  const dialogue = isExplanation
    ? (q?.explanation ?? '')
    : (wrongTaunt ?? q?.dialogue ?? '')

  return (
    <>
      <ShakeStyles />
      <Particles ref={particlesRef} />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes bossFloat { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
        @keyframes hpPulse   { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes dmgFloat  { 0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.3)} 100%{opacity:0;transform:translateX(-50%) translateY(-70px) scale(0.75)} }
        @keyframes resultPop { 0%{transform:scale(0.6);opacity:0} 65%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
        @keyframes scanlines { 0%{background-position:0 0} 100%{background-position:0 4px} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes choicePulse { 0%,100%{box-shadow:0 0 0 transparent} 50%{box-shadow:0 0 10px #00f0ff44} }
        @keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #FF004033; }
      `}</style>

      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#03030a', fontFamily: 'var(--font-pixel), monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }} className={shakeClass}>

        <ParallaxBackground layers={[{ imagePath: '/images/nebula.png', parallaxIntensity: 5 }]} zIndex={0} showOverlay backgroundColor="#03030a" />
        <TwinklingStars count={90} minSize={1} maxSize={2} color="#ffffff" zIndex={1} />
        <ParallaxBackground layers={[{ imagePath: '/images/planets.png', parallaxIntensity: 10 }]} zIndex={2} showOverlay={false} />

        <div style={{ position: 'fixed', inset: 0, zIndex: 3, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.1) 2px,rgba(0,0,0,0.1) 4px)', animation: 'scanlines 0.1s linear infinite' }} />

        {dmgNums.map(d => <DamageNumber key={d.id} dmg={d} bossRef={bossRef} playerRef={playerRef} />)}

        {/* ═══ ARENA ═══ */}
        <div style={{ position: 'relative', zIndex: 4, height: '58vh', flexShrink: 0, overflow: 'hidden' }}>

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to bottom, transparent, #0a0015aa)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '28%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, #6633ff33 25%, #9966ff55 50%, #6633ff33 75%, transparent)' }} />

          {/* Boss HP card */}
          <div style={{ position: 'absolute', top: 12, left: 14, backgroundColor: '#060008', border: '1px solid #FF004033', padding: '9px 13px', width: 200, boxShadow: '0 0 24px #FF00401a, inset 0 0 12px #0a000a', zIndex: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 'clamp(5px, 0.9vw, 7px)', color: '#FF3333', letterSpacing: 2, textShadow: '0 0 8px #FF333388', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                {game.currentBoss.name.toUpperCase()}
              </span>
              {bossHPPct < 30 && <span style={{ fontSize: 'clamp(4px, 0.7vw, 5px)', color: '#FFD700', animation: 'blink 0.55s infinite', letterSpacing: 1, flexShrink: 0 }}>LOW HP</span>}
            </div>
            <HpBar value={state.bossHP} max={state.bossMaxHP} color="#FF0040" />
          </div>

          {/* Score / turn */}
          <div style={{ position: 'absolute', top: 12, right: 14, textAlign: 'right', zIndex: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 'clamp(5px, 0.9vw, 7px)', color: '#FFD700', letterSpacing: 2, textShadow: '0 0 6px #FFD70055' }}>
              {game.score.toLocaleString()} <span style={{ color: '#443300' }}>PTS</span>
            </div>
            <div style={{ fontSize: 'clamp(4px, 0.8vw, 6px)', color: '#555', letterSpacing: 2 }}>
              BOSS <span style={{ color: '#9966ff' }}>{game.currentBossIndex + 1}</span><span style={{ color: '#2a2a2a' }}>/{game.totalBosses}</span>
            </div>
            <div style={{ fontSize: 'clamp(4px, 0.8vw, 6px)', color: '#333', letterSpacing: 2 }}>
              STREAK <span style={{ color: state.correctStreak > 0 ? '#FFD700' : '#555' }}>{state.correctStreak}</span>
            </div>
          </div>

          {/* Boss sprite */}
          <div ref={bossRef} style={{ position: 'absolute', right: '12%', top: '10%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <BossSprite flashing={bossFlashing} />
            <div style={{ width: 100, height: 8, borderRadius: '50%', background: 'radial-gradient(ellipse, #FF333322 0%, transparent 70%)' }} />
          </div>

          {/* Player sprite */}
          <div ref={playerRef} style={{ position: 'absolute', left: '10%', bottom: '22%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <PlayerAvatar damaged={playerDamaged} />
            <div style={{ width: 70, height: 6, borderRadius: '50%', background: 'radial-gradient(ellipse, #00f0ff1a 0%, transparent 70%)' }} />
          </div>

          {/* Player HP card */}
          <div style={{ position: 'absolute', bottom: 10, right: 14, backgroundColor: '#000d10', border: '1px solid #00f0ff28', padding: '9px 13px', width: 200, boxShadow: '0 0 24px #00f0ff18, inset 0 0 12px #000d10', zIndex: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 'clamp(5px, 0.9vw, 7px)', color: '#00f0ff', letterSpacing: 2, textShadow: '0 0 8px #00f0ff66' }}>PLAYER</span>
              {playerHPPct < 30 && <span style={{ fontSize: 'clamp(4px, 0.7vw, 5px)', color: '#FF0040', animation: 'blink 0.55s infinite', letterSpacing: 1 }}>DANGER</span>}
            </div>
            <HpBar value={state.playerHP} max={state.playerMaxHP} color="#00f0ff" />
          </div>
        </div>

        {/* ═══ BATTLE MENU ═══ */}
        <div style={{ position: 'relative', zIndex: 4, flex: 1, minHeight: 0, borderTop: '1px solid #ffffff0a', backgroundColor: '#02020899', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Timer bar */}
          <div style={{ height: 3, flexShrink: 0, backgroundColor: '#0a0a0a' }}>
            <div style={{
              height: '100%',
              width: `${timerPct}%`,
              backgroundColor: timerLow ? '#FF0040' : '#00f0ff',
              boxShadow: `0 0 8px ${timerLow ? '#FF004099' : '#00f0ff66'}`,
              transition: 'width 0.1s linear, background-color 0.3s',
              animation: timerLow ? 'timerPulse 0.4s ease-in-out infinite' : 'none',
            }} />
          </div>

          <div style={{ height: 2, flexShrink: 0, background: 'linear-gradient(90deg, transparent, #FF004044 25%, #9933ff55 50%, #00f0ff44 75%, transparent)' }} />

          {/* Dialogue */}
          <div style={{ padding: '10px 18px 8px', borderBottom: '1px solid #ffffff07', flexShrink: 0, position: 'relative', minHeight: 70 }}>
            <div style={{ fontSize: 'clamp(4px, 0.75vw, 5px)', color: isExplanation ? '#00f0ff44' : '#FF004044', letterSpacing: 3, marginBottom: 5, textTransform: 'uppercase' }}>
              {isExplanation ? 'EXPLANATION:' : `${game.currentBoss.name}:`}
            </div>
            <p style={{ margin: 0, fontSize: 'clamp(7px, 1.2vw, 9px)', color: isExplanation ? '#aacccc' : '#cccccc', lineHeight: 2 }}>
              {isLoading
                ? <span style={{ color: '#2a2a2a', animation: 'blink 0.8s infinite', display: 'inline-block' }}>▋</span>
                : dialogue
              }
              {(isActive) && <span style={{ animation: 'blink 0.6s infinite', color: '#FF3333', marginLeft: 2 }}>▋</span>}
            </p>

            {/* Verdict badge */}
            {isReveal && state.isCorrect === true && (
              <div style={{ position: 'absolute', top: 10, right: 18, fontSize: 'clamp(5px, 0.9vw, 7px)', color: '#39FF14', textShadow: '0 0 12px #39FF14', animation: 'resultPop 0.3s ease', letterSpacing: 2 }}>✓ CORRECT</div>
            )}
            {isReveal && state.isCorrect === false && (
              <div style={{ position: 'absolute', top: 10, right: 18, fontSize: 'clamp(5px, 0.9vw, 7px)', color: '#FF0040', textShadow: '0 0 12px #FF0040', animation: 'resultPop 0.3s ease', letterSpacing: 2 }}>✗ WRONG</div>
            )}
          </div>

          {/* Question + choices */}
          <div style={{ flex: 1, minHeight: 0, padding: '10px 18px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, overflowY: 'auto' }}>

            {isLoading && (
              <div style={{ textAlign: 'center', fontSize: 'clamp(5px, 0.9vw, 6px)', color: '#2a2a2a', letterSpacing: 3, animation: 'blink 1.4s ease-in-out infinite' }}>
                ENEMY IS CHARGING...
              </div>
            )}

            {isExplanation && (
              <div style={{ textAlign: 'center', fontSize: 'clamp(5px, 0.9vw, 6px)', color: '#444', letterSpacing: 2 }}>
                NEXT QUESTION IN 4S...
              </div>
            )}

            {(isActive || isReveal) && q && (
              <div style={{ display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'stretch', animation: 'fadeSlideUp 0.25s ease', height: '100%' }}>

                {/* Question text */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: 'clamp(6px, 1.1vw, 8px)', color: '#FFD700', lineHeight: 1.9, textShadow: '0 0 8px #FFD70022' }}>
                    {q.question_text}
                  </p>
                </div>

                <div style={{ width: 1, backgroundColor: '#ffffff0a', flexShrink: 0 }} />

                {/* MCQ choices */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignContent: 'center' }}>
                  {choices.map(choice => {
                    const isSelected  = state.selectedAnswer === choice.id
                    const isCorrectId = choice.id === q.correctAnswerId
                    const isDisabled  = !isActive

                    let bg     = '#050510'
                    let border = '#00f0ff33'
                    let color  = '#00f0ff'

                    if (isReveal) {
                      if (isCorrectId)       { bg = '#003310'; border = '#39FF14'; color = '#39FF14' }
                      else if (isSelected)   { bg = '#200005'; border = '#FF0040'; color = '#FF0040' }
                      else                   { bg = '#080808'; border = '#111';    color = '#333' }
                    } else if (isDisabled) {
                      bg = '#080808'; border = '#111'; color = '#333'
                    }

                    return (
                      <button
                        key={choice.id}
                        onClick={() => isActive && combat.submitAnswer(choice.id)}
                        disabled={isDisabled}
                        style={{
                          fontFamily: 'var(--font-pixel), monospace',
                          fontSize: 'clamp(6px, 1vw, 8px)',
                          letterSpacing: 1,
                          color, backgroundColor: bg,
                          border: `1px solid ${border}`,
                          padding: '9px 12px',
                          textAlign: 'left',
                          cursor: isDisabled ? 'default' : 'pointer',
                          transition: 'all 0.15s',
                          lineHeight: 1.7,
                          animation: isActive ? 'choicePulse 2s ease-in-out infinite' : 'none',
                        }}
                        onMouseEnter={e => { if (isActive) { e.currentTarget.style.backgroundColor = '#00f0ff1a'; e.currentTarget.style.borderColor = '#00f0ff66' } }}
                        onMouseLeave={e => { if (isActive) { e.currentTarget.style.backgroundColor = bg; e.currentTarget.style.borderColor = border } }}
                      >
                        {choice.id}) {choice.text}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
