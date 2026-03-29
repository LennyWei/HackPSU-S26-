'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGame, PLAYER_MAX_HP_VALUE } from '@/context/GameContext'
import { streamQuestion, readStream } from '@/lib/api'
import { CombatProvider, useCombatContext } from '@/context/CombatContext'
import { PHASES, CombatQuestion } from '@/hooks/useCombat'
import ParallaxBackground from '@/components/ui/parallax-background'
import TwinklingStars from '@/components/ui/twinkling-stars'
import AnimatedSprite from '@/components/ui/animated-sprite'
import Particles, { ParticlesHandle } from '@/components/ui/particles'
import { useShake, ShakeStyles } from '@/hooks/useShake'

interface BossSpriteSet {
  id: string
  framePaths: string[]
  frameRate: number
  width: number
  height: number
}

type SpriteShakeIntensity = 'light' | 'medium' | 'heavy'

const SCREEN_SHAKE_INTENSITY: 'light' | 'medium' | 'heavy' = 'light'
const SPRITE_SHAKE_INTENSITY: SpriteShakeIntensity = 'medium'

function getSpriteShakeAnimation(intensity: SpriteShakeIntensity): string {
  if (intensity === 'light') return 'spriteShakeLight 0.18s ease-in-out'
  if (intensity === 'heavy') return 'spriteShakeHeavy 0.3s ease-in-out'
  return 'spriteShakeMedium 0.24s ease-in-out'
}

function getSpriteShakeDurationMs(intensity: SpriteShakeIntensity): number {
  if (intensity === 'light') return 180
  if (intensity === 'heavy') return 300
  return 240
}

// Add more boss animation sets here as you create them in /public/images.
// Example ids: 'slime-idle', 'robot-idle', 'dragon-idle'.
const BOSS_SPRITE_POOLS: BossSpriteSet[] = [
  {
    id: 'bat',
    framePaths: [
      '/images/bat/idle_0.png',
      '/images/bat/idle_1.png',
      '/images/bat/idle_2.png',
      '/images/bat/idle_3.png',
      '/images/bat/idle_4.png',
      '/images/bat/idle_5.png',
      '/images/bat/idle_6.png',
      '/images/bat/idle_7.png',
      '/images/bat/idle_8.png',
    ],
    frameRate: 100,
    width: 256 * 0.75,
    height: 256 * 0.75,
  },
  {
    id: 'golem',
    framePaths: [
      '/images/golem/golem_0.png',
      '/images/golem/golem_1.png',
      '/images/golem/golem_2.png',
      '/images/golem/golem_3.png',
    ],
    frameRate: 200,
    width: 256 * 0.75,
    height: 256 * 0.75,
  },
  {
    id: 'demon',
    framePaths: [
      '/images/demon/demon0.png',
      '/images/demon/demon1.png',
      '/images/demon/demon2.png',
      '/images/demon/demon3.png',
    ],
    frameRate: 150,
    width: 256,
    height: 256,
  }
]

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

// ─── Visual components ───────────────────────────────────────────────────────

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

const MOCK_BOSS = {
  clusterId: 'mock',
  name: 'Debug Bot',
  personality: 'robotic',
  backstory: 'A test enemy.',
  opening_monologue: 'Initiating debug sequence!',
  taunts: {},
  sprite_category: 'bat',
  max_hp: 100,
}

const MOCK_CLUSTER = {
  clusterId: 'mock',
  clusterName: 'Mock Concepts',
  concepts: [
    { id: 'c1', name: 'Arrays', summary: 'Lists of items', difficulty: 'basic' as const, related_concepts: [], has_diagram: false },
    { id: 'c2', name: 'Loops', summary: 'Repeat code', difficulty: 'basic' as const, related_concepts: [], has_diagram: false },
  ],
}

export default function BattlePage() {
  const game = useGame()
  const [questions, setQuestions] = useState<CombatQuestion[] | null>(null)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!game.currentBoss && process.env.NEXT_PUBLIC_MOCK === 'true') {
      game.initGame([MOCK_CLUSTER], [MOCK_BOSS])
      return
    }
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

  if (!game.currentBoss) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#03030a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-pixel), monospace', color: '#777', padding: 24, textAlign: 'center', lineHeight: 1.8 }}>
        <div>
          <div>Battle state not initialized yet.</div>
          <div style={{ marginTop: 8, fontSize: 'clamp(5px, 0.9vw, 7px)', color: '#555' }}>
            NEXT_PUBLIC_MOCK runtime value: {String(process.env.NEXT_PUBLIC_MOCK)}
          </div>
        </div>
      </div>
    )
  }

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
  const [bossSpriteShaking, setBossSpriteShaking] = useState(false)
  const [playerSpriteShaking, setPlayerSpriteShaking] = useState(false)
  const [dmgNums,        setDmgNums]        = useState<DmgNum[]>([])
  const [bossSpriteSet,  setBossSpriteSet]  = useState<BossSpriteSet>(BOSS_SPRITE_POOLS[0])

  const { shakeClass, triggerShake } = useShake()
  const dmgIdRef      = useRef(0)
  const bossRef       = useRef<HTMLDivElement>(null)
  const playerRef     = useRef<HTMLDivElement>(null)
  const particlesRef  = useRef<ParticlesHandle>(null)
  const revealFiredRef = useRef(false)

  useEffect(() => {
    if (BOSS_SPRITE_POOLS.length === 0) return

    const storageKey = 'last-boss-sprite-set-id'
    const prevId = typeof window !== 'undefined' ? window.sessionStorage.getItem(storageKey) : null
    const candidatePools = BOSS_SPRITE_POOLS.filter(pool => pool.id !== prevId)
    const pools = candidatePools.length > 0 ? candidatePools : BOSS_SPRITE_POOLS
    const chosen = pools[Math.floor(Math.random() * pools.length)]

    setBossSpriteSet(chosen)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(storageKey, chosen.id)
    }
  }, [game.currentBossIndex])

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
      setBossSpriteShaking(true)
      addDmg(combat.state.bossDamageOnCorrect, '#39FF14', 'boss')
      const r = bossRef.current?.getBoundingClientRect()
      if (r) particlesRef.current?.burst(r.left + r.width / 2, r.top + r.height / 2, { color: ['#39FF14', '#00f0ff', '#ffffff'], count: 36, speed: 7, gravity: 0.25, size: 5 })
      setTimeout(() => setBossFlashing(false), 300)
      setTimeout(() => setBossSpriteShaking(false), getSpriteShakeDurationMs(SPRITE_SHAKE_INTENSITY))
    } else {
      setPlayerDamaged(true)
      setPlayerSpriteShaking(true)
      addDmg(combat.state.playerDamageOnWrong, '#FF0040', 'player')
      triggerShake({ intensity: SCREEN_SHAKE_INTENSITY })
      const r = playerRef.current?.getBoundingClientRect()
      if (r) particlesRef.current?.burst(r.left + r.width / 2, r.top + r.height / 2, { color: ['#FF0040', '#ff6644', '#ffaa00'], count: 28, speed: 5, angle: -Math.PI / 2, spread: Math.PI, gravity: 0.3, size: 4 })
      setTimeout(() => setPlayerDamaged(false), 500)
      setTimeout(() => setPlayerSpriteShaking(false), getSpriteShakeDurationMs(SPRITE_SHAKE_INTENSITY))
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
  const recordedQuestionIndexRef = useRef<number | null>(null)

  const recordQuestionResult = (choiceId: string) => {
    if (!q) return
    if (recordedQuestionIndexRef.current === state.questionIndex) return
    recordedQuestionIndexRef.current = state.questionIndex

    const answerText = q.choices.find(c => c.id === choiceId)?.text ?? choiceId
    const correct = choiceId === q.correctAnswerId
    const shieldActive = state.activeEffects.some(e => e.type === 'shield')

    game.addQuestionResult({
      question: q.question_text,
      playerAnswer: answerText,
      correct,
      explanation: q.explanation,
      conceptName: q.concept,
      damage: correct ? state.bossDamageOnCorrect : 0,
      playerDamage: correct ? 0 : (shieldActive ? 0 : state.playerDamageOnWrong),
    })
  }

  const handleAnswer = (choiceId: string) => {
    if (!isActive || !q) return
    recordQuestionResult(choiceId)
    combat.submitAnswer(choiceId)
  }

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
        @keyframes spriteShakeLight {
          0%   { transform: translate(0, 0); }
          20%  { transform: translate(-2px, 0); }
          40%  { transform: translate(2px, 0); }
          60%  { transform: translate(-1px, 0); }
          80%  { transform: translate(1px, 0); }
          100% { transform: translate(0, 0); }
        }
        @keyframes spriteShakeMedium {
          0%   { transform: translate(0, 0); }
          20%  { transform: translate(-4px, 0); }
          40%  { transform: translate(4px, 0); }
          60%  { transform: translate(-3px, 0); }
          80%  { transform: translate(3px, 0); }
          100% { transform: translate(0, 0); }
        }
        @keyframes spriteShakeHeavy {
          0%   { transform: translate(0, 0); }
          20%  { transform: translate(-7px, 0); }
          40%  { transform: translate(7px, 0); }
          60%  { transform: translate(-5px, 0); }
          80%  { transform: translate(5px, 0); }
          100% { transform: translate(0, 0); }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes choicePulse { 0%,100%{box-shadow:0 0 0 transparent} 50%{box-shadow:0 0 10px #00f0ff44} }
        @keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #FF004033; }
      `}</style>

      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#03030a', fontFamily: 'var(--font-pixel), monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }} className={shakeClass}>

        {dmgNums.map(d => <DamageNumber key={d.id} dmg={d} bossRef={bossRef} playerRef={playerRef} />)}

        {/* ═══ SCENE (TOP) ═══ */}
        <div style={{ position: 'relative', zIndex: 1, height: '60vh', flexShrink: 0, overflow: 'hidden' }}>

          <ParallaxBackground layers={[{ imagePath: '/images/nebula.png', parallaxIntensity: 5 }]} zIndex={0} showOverlay backgroundColor="#03030a" position="absolute" />
          <TwinklingStars count={90} minSize={1} maxSize={2} color="#ffffff" zIndex={1} position="absolute" />
          <ParallaxBackground layers={[{ imagePath: '/images/planets.png', parallaxIntensity: 10 }]} zIndex={2} showOverlay={false} position="absolute" />

          <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.1) 2px,rgba(0,0,0,0.1) 4px)', animation: 'scanlines 0.1s linear infinite' }} />

          {/* Ground layer */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4, height: '34%', pointerEvents: 'none' }}>
            <img
              src="/images/ground.png"
              alt="ground"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center bottom',
                imageRendering: 'pixelated',
                display: 'block',
              }}
            />
          </div>

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
          <div ref={bossRef} style={{ position: 'absolute', right: '19%', bottom: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 5 }}>
            <div
              style={{
                filter: bossFlashing ? 'brightness(4) saturate(0)' : 'drop-shadow(0 0 14px #FF333399) drop-shadow(0 0 30px #FF000044)',
                transition: 'filter 0.1s',
                animation: 'bossFloat 2s ease-in-out infinite',
              }}
            >
              <div style={{ animation: bossSpriteShaking ? getSpriteShakeAnimation(SPRITE_SHAKE_INTENSITY) : 'none' }}>
                <AnimatedSprite
                  framePaths={bossSpriteSet.framePaths}
                  width={bossSpriteSet.width}
                  height={bossSpriteSet.height}
                  frameRate={bossSpriteSet.frameRate}
                />
              </div>
            </div>
            <div style={{ width: 100, height: 8, borderRadius: '50%', background: 'radial-gradient(ellipse, #1802025d 0%, transparent 70%)' }} />
          </div>

          {/* Player sprite */}
          <div ref={playerRef} style={{ position: 'absolute', left: '19%', bottom: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 5 }}>
            <div
              style={{
                filter: playerDamaged ? 'brightness(5) saturate(0)' : 'drop-shadow(0 0 10px #00f0ffaa) drop-shadow(0 0 22px #00f0ff44)',
                transition: 'filter 0.15s',
              }}
            >
              <div style={{ animation: playerSpriteShaking ? getSpriteShakeAnimation(SPRITE_SHAKE_INTENSITY) : 'none' }}>
                <AnimatedSprite
                  framePaths={[
                    '/images/player/idle-1.png',
                    '/images/player/idle-2.png',
                    '/images/player/idle-3.png',
                    '/images/player/idle-4.png',
                  ]}
                  width={256}
                  height={64}
                  frameRate={100}
                />
              </div>
            </div>
            <div style={{ width: 70, height: 6, borderRadius: '50%', background: 'radial-gradient(ellipse, #0312137b 0%, transparent 70%)' }} /> {/* subtle glow under player feet */}
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

        {/* ═══ BATTLE MENU (BOTTOM) ═══ */}
        <div style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, borderTop: '1px solid #ffffff14', backgroundColor: '#05050d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

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
                        onClick={() => handleAnswer(choice.id)}
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
