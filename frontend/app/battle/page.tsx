'use client'

import {
  useState, useEffect, useRef, useMemo, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'
import { useRouter } from 'next/navigation'
import { useGame, PLAYER_MAX_HP_VALUE } from '@/context/GameContext'
import { streamQuestion, readStream, judgeAnswer } from '@/lib/api'
import { CombatProvider, useCombatContext } from '@/context/CombatContext'
import {
  PHASES, CombatQuestion, InventoryItem, ItemRarity,
  selectRandomItem, loadPlayerInventory, saveItemToPlayerInventory, MAX_INVENTORY,
} from '@/hooks/useCombat'
import ParallaxBackground from '@/components/ui/parallax-background'
import TwinklingStars from '@/components/ui/twinkling-stars'
import AnimatedSprite from '@/components/ui/animated-sprite'
import Particles, { ParticlesHandle } from '@/components/ui/particles'
import { useShake, ShakeStyles } from '@/hooks/useShake'
import { emitBattleAudioState, emitSfx } from '@/lib/audio-events'

// ─── Player animation frame sets ─────────────────────────────────────────────

const IDLE_FRAMES = [
  '/images/player/idle-1.png',
  '/images/player/idle-2.png',
  '/images/player/idle-3.png',
  '/images/player/idle-4.png',
]
const DASH_FRAMES = [
  '/images/player/player_dash_0.png',
  '/images/player/player_dash_1.png',
  '/images/player/player_dash_2.png',
  '/images/player/player_dash_3.png',
  '/images/player/player_dash_4.png',
  '/images/player/player_dash_5.png',
]
const RETURN_FRAMES = [...DASH_FRAMES].reverse()
const ATK1_FRAMES = ['/images/player/player4.png', '/images/player/player5.png']
const ATK2_FRAMES = ['/images/player/player6.png', '/images/player/player7.png']

// ─── Boss sprite configs ──────────────────────────────────────────────────────
// To add a new boss: add an entry matching its `sprite_category`.
// `attack` is optional — if absent the idle frames play at high speed during the swoop.

interface BossSpriteConfig {
  idle: string[]
  attack?: string[]   // optional dedicated attack frames
}

const BOSS_FRAMES: Record<string, BossSpriteConfig> = {
  bat: {
    idle: [
      '/images/bat/idle_0.png', '/images/bat/idle_1.png', '/images/bat/idle_2.png',
      '/images/bat/idle_3.png', '/images/bat/idle_4.png', '/images/bat/idle_5.png',
      '/images/bat/idle_6.png', '/images/bat/idle_7.png', '/images/bat/idle_8.png',
    ],
    // No dedicated attack strip yet — idle plays faster during the swoop
  },
  // ── future bosses ──────────────────────────────────────────────────────────
  // dragon: {
  //   idle:   ['/images/dragon/idle_0.png', ...],
  //   attack: ['/images/dragon/attack_0.png', ...],
  // },
}

// ─── BossSprite ───────────────────────────────────────────────────────────────

export interface BossSpriteHandle {
  triggerAttack: (playerRef: React.RefObject<HTMLDivElement | null>) => void
}

const BossSprite = forwardRef<BossSpriteHandle, {
  spriteSet: BossSpriteSet
  flashing: boolean
  isShaking: boolean
}>(({ spriteSet, flashing, isShaking }, ref) => {
  const [frameKey, setFrameKey] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [transDash, setTransDash] = useState('none')
  const selfRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    triggerAttack(playerRef) {
      const bossEl = selfRef.current
      const playerEl = playerRef.current
      if (!bossEl || !playerEl) return

      const bossRect = bossEl.getBoundingClientRect()
      const playerRect = playerEl.getBoundingClientRect()
      // Boss is right-side, player is left-side — negative X moves boss toward player
      const dashX = playerRect.right - bossRect.left + 16

      // 1. Swoop toward player
      setTransDash('transform 0.3s ease-in')
      setOffsetX(dashX)
      setFrameKey(k => k + 1) // Trigger sprite re-key to restart frames

      // 2. Return
      setTimeout(() => {
        setTransDash('transform 0.28s ease-out')
        setOffsetX(0)
      }, 360)

      // 3. Back to idle
      setTimeout(() => {
        setTransDash('none')
      }, 700)
    },
  }))

  return (
    // Outer div: horizontal swoop (translateX)
    <div ref={selfRef} style={{ transform: `translateX(${offsetX}px)`, transition: transDash }}>
      {/* Shake wrapper */}
      <div style={{ animation: isShaking ? getSpriteShakeAnimation(SPRITE_SHAKE_INTENSITY) : 'none' }}>
        {/* Inner div: vertical float + filter — kept separate to avoid transform conflicts */}
        <div style={{
          filter: flashing
            ? 'brightness(4) saturate(0)'
            : 'drop-shadow(0 0 14px #FF333399) drop-shadow(0 0 30px #FF000044)',
          transition: 'filter 0.1s',
          animation: 'bossFloat 2s ease-in-out infinite',
        }}>
          <AnimatedSprite
            key={frameKey}
            framePaths={spriteSet.framePaths}
            width={spriteSet.width}
            height={spriteSet.height}
            frameRate={spriteSet.frameRate}
          />
        </div>
      </div>
    </div>
  )
})
BossSprite.displayName = 'BossSprite'

// ─── Rarity helpers ───────────────────────────────────────────────────────────

const RARITY_COLOR: Record<ItemRarity, string> = {
  basic: '#9999aa',
  rare: '#4477ff',
  epic: '#aa44ff',
  legendary: '#FFD700',
}

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

  // explanation may be a plain string or a per-choice dict {"A":"...", "B":"..."}
  const rawExp = raw.explanation
  let explanation: string
  let explanations: Record<string, string> | undefined
  if (rawExp && typeof rawExp === 'object') {
    explanations = rawExp as Record<string, string>
    explanation = explanations[correct] ?? Object.values(explanations)[0] ?? ''
  } else {
    explanation = (rawExp as string) ?? `The correct answer is: ${correct}`
  }

  return {
    id: (raw.id as string) ?? `q_${Math.random().toString(36).slice(2)}`,
    difficulty: (raw.difficulty as number) ?? 5,
    question_text: (raw.question_text as string) ?? '',
    dialogue: (raw.dialogue as string) ?? '',
    choices,
    correctAnswerId: correct,
    concept: (raw.concept as string) ?? '',
    explanation,
    explanations,
    wrong_taunts: (raw.wrong_taunts as Array<{ answer: string; taunt: string }>) ?? [],
    question_type: (raw.question_type as string) ?? 'mcq',
  }
}

function buildMockQuestion(game: ReturnType<typeof useGame>, index: number): CombatQuestion {
  const cluster = game.currentCluster
  const boss = game.currentBoss
  const concept = cluster?.concepts[index % Math.max(cluster?.concepts.length ?? 1, 1)]
  const name = concept?.name ?? 'a key concept'
  return {
    id: `mock_q_${index}`,
    difficulty: 5,
    question_text: `Which statement best describes ${name}?`,
    dialogue: `${boss?.name ?? 'Boss'}: "Let's see if you truly understand ${name}!"`,
    choices: [
      { id: 'A', text: `${name} is the most important element of this topic` },
      { id: 'B', text: 'This concept has no relevance here' },
      { id: 'C', text: 'Both A and B are equally valid' },
      { id: 'D', text: 'Neither A nor B is accurate' },
    ],
    correctAnswerId: 'A',
    concept: name,
    explanation: `${name} is indeed central to ${cluster?.clusterName ?? 'this topic'}.`,
    explanations: {
      'A': `${name} is indeed central to ${cluster?.clusterName ?? 'this topic'}. This forms the core foundation.`,
      'B': `${name} is absolutely relevant. Dismissing it means missing the point completely.`,
      'C': `A is correct, but B is entirely false, so they cannot both be valid.`,
      'D': `A is accurate, making this statement incorrect.`
    },
    wrong_taunts: [
      { answer: 'B', taunt: `${name} is not irrelevant — you should study harder!` },
      { answer: 'C', taunt: `Both equally valid? Not even close, challenger.` },
      { answer: 'D', taunt: `Neither accurate? You clearly haven't read your notes.` },
    ],
  }
}

function buildMockFrqQuestion(game: ReturnType<typeof useGame>, index: number): CombatQuestion {
  const cluster = game.currentCluster
  const boss = game.currentBoss
  const concept = cluster?.concepts[index % Math.max(cluster?.concepts.length ?? 1, 1)]
  const name = concept?.name ?? 'a key concept'
  
  const prompts = [
    `Tell me, in your own words: what is the essence of ${name}?`,
    `Explain how ${name} relates to the broader system of ${cluster?.clusterName ?? 'this field'}.`,
    `Describe a scenario where ${name} would be the most critical factor to consider.`,
    `If you had to teach ${name} to a novice, what would be your first sentence?`
  ]
  const dialogues = [
    `${boss?.name ?? 'Boss'}: "Words are your only weapon now. Explain ${name} — or suffer the consequences!"`,
    `${boss?.name ?? 'Boss'}: "Do you truly understand ${name}, or are you just reciting from a scroll?"`,
    `${boss?.name ?? 'Boss'}: "The stars demand an explanation for ${name}. Speak!"`,
    `${boss?.name ?? 'Boss'}: "I have seen many fall before ${name}. Will you join them?"`
  ]

  const prompt = prompts[index % prompts.length]
  const dialogue = dialogues[index % dialogues.length]

  return {
    id: `mock_frq_${index}`,
    difficulty: 6,
    question_type: 'free_response',
    question_text: prompt,
    dialogue: dialogue,
    choices: [],
    correctAnswerId: `${name} is fundamental to ${cluster?.clusterName ?? 'the topic'}. A deep answer covers its definition and practical application.`,
    concept: name,
    explanation: `A standard definition of ${name} centers on its role in ${cluster?.clusterName ?? 'this system'}. Remember to mention its secondary effects.`,
    wrong_taunts: [],
  }
}

// ─── Visual components ────────────────────────────────────────────────────────

function HpBar({ value, max, color, height = 7, segments = false }: {
  value: number; max: number; color: string; height?: number; segments?: boolean
}) {
  const pct = Math.max(0, (value / max) * 100)
  const [chipPct, setChipPct] = useState(pct)
  const prevPctRef = useRef(pct)
  const low = pct < 30

  useEffect(() => {
    const prevPct = prevPctRef.current
    prevPctRef.current = pct

    if (pct >= prevPct) {
      setChipPct(pct)
      return
    }

    setChipPct(prevPct)
    const t = window.setTimeout(() => {
      setChipPct(pct)
    }, 160)

    return () => window.clearTimeout(t)
  }, [pct])

  // dynamic color: cyan/green → yellow → red as HP drops
  const barColor = low
    ? '#FF0040'
    : pct < 60
      ? '#FFD700'
      : color

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        height, backgroundColor: '#050505',
        border: `1px solid ${barColor}33`, overflow: 'hidden', position: 'relative',
      }}>
        {/* Delayed chip bar (Souls-like): lags briefly after taking damage. */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${chipPct}%`,
          backgroundColor: '#ff8a33',
          opacity: 0.9,
          transition: 'width 0.65s linear',
          zIndex: 1,
        }} />

        {/* Main fill */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%', width: `${pct}%`, backgroundColor: barColor,
          boxShadow: `0 0 ${low ? 14 : 6}px ${barColor}99`,
          transition: 'width 0.4s ease, background-color 0.6s ease',
          animation: low ? 'hpPulse 0.5s ease-in-out infinite' : 'none',
          zIndex: 2,
        }} />
        {/* Segment dividers */}
        {segments && Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${(i + 1) * 10}%`,
            width: 1, backgroundColor: '#00000055',
            pointerEvents: 'none',
            zIndex: 3,
          }} />
        ))}

        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: height >= 16 ? 'clamp(7px, 0.8vw, 10px)' : 'clamp(6px, 0.7vw, 9px)',
          color: '#ffffff',
          fontFamily: 'var(--font-pixel), monospace',
          letterSpacing: 1,
          textShadow: '0 0 6px #000, 0 0 10px #000',
          zIndex: 4,
          pointerEvents: 'none',
        }}>
          {Math.max(0, value)} / {max}
        </div>
      </div>
    </div>
  )
}

interface DmgNum { id: number; value: number; color: string; side: 'boss' | 'player' }

function DamageNumber({ dmg, bossRef, playerRef }: { dmg: DmgNum; bossRef: React.RefObject<HTMLDivElement | null>; playerRef: React.RefObject<HTMLDivElement | null> }) {
  const ref = dmg.side === 'boss' ? bossRef : playerRef
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
      {dmg.value > 0 ? `-${dmg.value}` : 'BLOCKED'}
    </div>
  )
}

// ─── CaseOpening ─────────────────────────────────────────────────────────────

function CaseOpening({ item, inventoryFull, onCollect }: {
  item: InventoryItem
  inventoryFull: boolean
  onCollect: () => void
}) {
  const ITEM_W = 88, ITEM_GAP = 8, ITEM_FULL = ITEM_W + ITEM_GAP
  const CONTAINER_W = 580, WINNER_IDX = 42, TOTAL = 58

  const reel = useMemo<InventoryItem[]>(() => {
    const arr: InventoryItem[] = []
    for (let i = 0; i < TOTAL; i++) arr.push(i === WINNER_IDX ? item : selectRandomItem())
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reelRef = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = reelRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = 'translateX(0px)'
    void el.offsetHeight
    const finalX = -(WINNER_IDX * ITEM_FULL - CONTAINER_W / 2 + ITEM_FULL / 2)
    const t1 = setTimeout(() => {
      el.style.transition = `transform 5.5s cubic-bezier(0.08, 0.82, 0.17, 1.0)`
      el.style.transform = `translateX(${finalX}px)`
    }, 200)
    const t2 = setTimeout(() => setRevealed(true), 6000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const wc = RARITY_COLOR[item.rarity]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      backgroundColor: '#03030af8',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 28, fontFamily: 'var(--font-pixel), monospace',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(12px, 2vw, 18px)', color: '#39FF14', letterSpacing: 4, textShadow: '0 0 20px #39FF1477', marginBottom: 6 }}>BOSS DEFEATED!</div>
        <div style={{ fontSize: 'clamp(5px, 0.9vw, 7px)', color: '#444', letterSpacing: 4 }}>ITEM DROP — SPIN TO WIN</div>
      </div>

      <div style={{ position: 'relative', width: CONTAINER_W, overflow: 'hidden', border: '1px solid #ffffff0f', backgroundColor: '#06060e' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '18%', background: 'linear-gradient(to right, #06060e, transparent)', zIndex: 3, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '18%', background: 'linear-gradient(to left, #06060e, transparent)', zIndex: 3, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: '#FFD700', transform: 'translateX(-50%)', zIndex: 4, boxShadow: '0 0 10px #FFD700, 0 0 20px #FFD70055' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, width: 0, height: 0, transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '9px solid #FFD700', zIndex: 5 }} />
        <div style={{ position: 'absolute', left: '50%', bottom: 0, width: 0, height: 0, transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '9px solid #FFD700', zIndex: 5 }} />
        <div ref={reelRef} style={{ display: 'flex', gap: ITEM_GAP, padding: '10px 0', willChange: 'transform' }}>
          {reel.map((ri, i) => {
            const c = RARITY_COLOR[ri.rarity], win = i === WINNER_IDX
            return (
              <div key={i} style={{
                flexShrink: 0, width: ITEM_W,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 5, padding: '8px 4px',
                border: `1px solid ${c}${win && revealed ? 'cc' : '28'}`,
                backgroundColor: `${c}${win && revealed ? '18' : '08'}`,
                transition: 'all 0.5s ease',
                boxShadow: win && revealed ? `0 0 18px ${c}88` : 'none',
              }}>
                <img src={`/images/item_icons/${encodeURIComponent(ri.label)}.png`} alt={ri.label} style={{ width: 40, height: 40, imageRendering: 'pixelated', opacity: win && revealed ? 1 : 0.4 }} />
                <div style={{ fontSize: 5, color: c, textAlign: 'center', letterSpacing: 1, opacity: win && revealed ? 1 : 0.4 }}>{ri.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {revealed && (
        <div style={{ animation: 'fadeSlideUp 0.4s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'center', border: `1px solid ${wc}44`, backgroundColor: `${wc}0d`, padding: '16px 36px', boxShadow: `0 0 24px ${wc}22` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 8 }}>
              <img src={`/images/item_icons/${encodeURIComponent(item.label)}.png`} alt={item.label} style={{ width: 36, height: 36, imageRendering: 'pixelated', filter: `drop-shadow(0 0 8px ${wc})` }} />
              <div style={{ fontSize: 'clamp(8px, 1.4vw, 11px)', color: wc, letterSpacing: 3, textShadow: `0 0 10px ${wc}` }}>{item.label.toUpperCase()}</div>
            </div>
            <div style={{ fontSize: 'clamp(5px, 0.9vw, 7px)', color: '#777', letterSpacing: 1, marginBottom: 6 }}>{item.description}</div>
            <div style={{ fontSize: 'clamp(4px, 0.7vw, 5px)', color: `${wc}99`, letterSpacing: 3, textTransform: 'uppercase' }}>{item.rarity}</div>
          </div>
          {inventoryFull ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 'clamp(5px, 0.9vw, 6px)', color: '#FF0040', letterSpacing: 2 }}>INVENTORY FULL ({MAX_INVENTORY}/{MAX_INVENTORY}) — ITEM LOST</div>
              <button onClick={onCollect} style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(5px, 0.9vw, 7px)', letterSpacing: 3, color: '#555', backgroundColor: '#0a0a0a', border: '1px solid #222', padding: '10px 30px', cursor: 'pointer' }}>DISMISS</button>
            </div>
          ) : (
            <button
              onClick={() => {
                emitSfx({ name: 'pickupitem.wav', volume: 0.42, minRate: 0.95, maxRate: 1.05 })
                onCollect()
              }}
              style={{ fontFamily: 'var(--font-pixel), monospace', fontSize: 'clamp(6px, 1vw, 8px)', letterSpacing: 3, color: '#39FF14', backgroundColor: '#001800', border: '1px solid #39FF1466', padding: '10px 30px', cursor: 'pointer', textShadow: '0 0 8px #39FF1488', boxShadow: '0 0 14px #39FF1422', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#003300'; e.currentTarget.style.borderColor = '#39FF14' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#001800'; e.currentTarget.style.borderColor = '#39FF1466' }}
            >COLLECT ITEM</button>
          )}
        </div>
      )}
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
    { id: 'c2', name: 'Loops', summary: 'Repeat code', difficulty: 'basic' as const, related_concepts: [], has_diagram: false },
  ],
}

export default function BattlePage() {
  const game = useGame()
  const [questions, setQuestions] = useState<CombatQuestion[] | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [savedInventory] = useState<InventoryItem[]>(() => typeof window !== 'undefined' ? loadPlayerInventory() : [])

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
        const qMode = typeof window !== 'undefined'
          ? (localStorage.getItem('question_mode') ?? 'mcq')
          : 'mcq'
        await new Promise(r => setTimeout(r, 700))
        if (!cancelled) setQuestions(Array.from({ length: N }, (_, i) => {
          const useFrq = qMode === 'frq' || (qMode === 'both' && Math.random() < 0.5)
          if (useFrq) return buildMockFrqQuestion(game, i)
          return buildMockQuestion(game, i)
        }))
        return
      }
      const questionMode = typeof window !== 'undefined'
        ? (localStorage.getItem('question_mode') ?? 'mcq')
        : 'mcq'
      const qs: CombatQuestion[] = []
      for (let i = 0; i < N; i++) {
        try {
          const res = await streamQuestion(game, questionMode)
          let full = ''
          await readStream(res, chunk => { full += chunk })
          qs.push(adaptQuestion(JSON.parse(full) as Record<string, unknown>))
        } catch { if (qs.length >= 3) break }
      }
      if (cancelled) return
      if (qs.length === 0) setFetchError(true); else setQuestions(qs)
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
    <CombatProvider questions={questions} initialInventory={savedInventory} playerMaxHP={PLAYER_MAX_HP_VALUE} bossMaxHP={game.currentBoss.max_hp}>
      <BattleUI />
    </CombatProvider>
  )
}

// ─── BattleUI ─────────────────────────────────────────────────────────────────

function BattleUI() {
  const router = useRouter()
  const game = useGame()
  const combat = useCombatContext()

  // ── Visual FX state ──
  const [bossFlashing, setBossFlashing] = useState(false)
  const [playerDamaged, setPlayerDamaged] = useState(false)
  const [bossSpriteShaking, setBossSpriteShaking] = useState(false)
  const [playerSpriteShaking, setPlayerSpriteShaking] = useState(false)
  const [dmgNums, setDmgNums] = useState<DmgNum[]>([])
  const [bossSpriteSet, setBossSpriteSet] = useState<BossSpriteSet>(BOSS_SPRITE_POOLS[0])
  const { shakeClass, triggerShake } = useShake()
  const dmgIdRef = useRef(0)

  // ── Refs ──
  const bossRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<ParticlesHandle>(null)
  const bossAnimRef = useRef<BossSpriteHandle>(null)
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

  useEffect(() => {
    emitBattleAudioState({
      phase: combat.state.phase,
      hasPendingReward: !!combat.state.pendingReward,
    })
  }, [combat.state.phase, combat.state.pendingReward])

  useEffect(() => {
    return () => {
      emitBattleAudioState(null)
    }
  }, [])


  // ── Player animation ──
  const [playerFrames, setPlayerFrames] = useState(IDLE_FRAMES)
  const [playerFrameKey, setPlayerFrameKey] = useState(0)
  const [playerFrameRate, setPlayerFrameRate] = useState(100)
  const [playerX, setPlayerX] = useState(0)
  const [playerTransStyle, setPlayerTransStyle] = useState('none')
  const [playerFlipped, setPlayerFlipped] = useState(false)
  const attackVariantRef = useRef<1 | 2>(1)

  // ── Item slot hover ──
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null)

  // ── Free-response state ──
  const [frqText, setFrqText] = useState('')
  const [judgingFrq, setJudgingFrq] = useState(false)
  const [frqResult, setFrqResult] = useState<{ explanation: string; bossDialogue: string } | null>(null)

  // ── Per-choice accordion open state ──
  const [openExps, setOpenExps] = useState<string[]>([])

  // ── Timeout damage detection ──
  const prevPlayerHPRef = useRef<number | null>(null)

  const setAnim = useCallback((frames: string[], rate: number) => {
    setPlayerFrames(frames)
    setPlayerFrameRate(rate)
    setPlayerFrameKey(k => k + 1)
  }, [])

  const playPlayerAttackSfx = useCallback(() => {
    const combo = Math.max(0, Math.min(10, combat.state.correctStreak ?? 0))
    const comboPitch = 0.6 + (combo / 10) * 2

    // Initial dash in: higher-pitched whoosh.
    emitSfx({ name: 'Whoosh.wav', volume: 0.52, minRate: 1.05, maxRate: 1.2 })
    // Hit moment.
    window.setTimeout(() => {
      emitSfx({ name: 'hit1.wav', volume: 0.52, minRate: 0.8, maxRate: 1.2 })
      emitSfx({ name: 'crunch.wav', volume: 0.44, minRate: 0.8, maxRate: 1.2 })
      emitSfx({ name: 'comboSound.mp3', volume: 0.29, minRate: comboPitch, maxRate: comboPitch })
    }, 360)
    // Movement back: slightly delayed, lower-pitched whoosh.
    window.setTimeout(() => {
      emitSfx({ name: 'Whoosh.wav', volume: 0.46, minRate: 0.7, maxRate: 0.9 })
    }, 440)
  }, [combat.state.correctStreak])

  const playBossAttackSfx = useCallback(() => {
    // Boss attack set has a globally lower pitch profile.
    emitSfx({ name: 'Whoosh.wav', volume: 0.48, minRate: 0.78, maxRate: 0.98 })
    window.setTimeout(() => {
      emitSfx({ name: 'hit1.wav', volume: 0.5, minRate: 0.72, maxRate: 0.92 })
      emitSfx({ name: 'crunch.wav', volume: 0.42, minRate: 0.68, maxRate: 0.88 })
    }, 300)
    window.setTimeout(() => {
      emitSfx({ name: 'Whoosh.wav', volume: 0.42, minRate: 0.62, maxRate: 0.82 })
    }, 380)
  }, [])

  const triggerPlayerAttack = useCallback(() => {
    const bossEl = bossRef.current
    const playerEl = playerRef.current
    if (!bossEl || !playerEl) return
    const bossRect = bossEl.getBoundingClientRect()
    const playerRect = playerEl.getBoundingClientRect()
    const dashX = bossRect.left + bossRect.width * 0.2 - playerRect.right
    const v = attackVariantRef.current
    attackVariantRef.current = v === 1 ? 2 : 1

    playPlayerAttackSfx()

    setAnim(DASH_FRAMES, 55)
    setPlayerFlipped(false)
    setPlayerTransStyle('transform 0.35s ease-in')
    setPlayerX(dashX)
    setTimeout(() => setAnim(v === 1 ? ATK1_FRAMES : ATK2_FRAMES, 80), 360)
    setTimeout(() => { setAnim(RETURN_FRAMES, 55); setPlayerFlipped(true); setPlayerTransStyle('transform 0.25s ease-out'); setPlayerX(0) }, 600)
    setTimeout(() => { setAnim(IDLE_FRAMES, 100); setPlayerFlipped(false); setPlayerTransStyle('none') }, 870)
  }, [playPlayerAttackSfx, setAnim])

  const addDmg = useCallback((value: number, color: string, side: 'boss' | 'player') => {
    const id = dmgIdRef.current++
    setDmgNums(prev => [...prev, { id, value, color, side }])
    setTimeout(() => setDmgNums(prev => prev.filter(d => d.id !== id)), 1300)
  }, [])

  // ── REVEAL effect ──
  useEffect(() => {
    if (combat.state.phase !== PHASES.REVEAL) { revealFiredRef.current = false; return }
    if (revealFiredRef.current) return
    revealFiredRef.current = true

    if (combat.state.isCorrect) {
      emitSfx({ name: 'zoom beep.wav', volume: 0.5, minRate: 0.95, maxRate: 1.08 })
      // Player dashes to boss
      triggerPlayerAttack()
      // Boss impact at arrival (~360ms)
      setTimeout(() => {
        setBossFlashing(true)
        setBossSpriteShaking(true)
        addDmg(combat.state.bossDamageOnCorrect, '#39FF14', 'boss')
        const r = bossRef.current?.getBoundingClientRect()
        if (r) particlesRef.current?.burst(r.left + r.width / 2, r.top + r.height / 2, { color: ['#39FF14', '#00f0ff', '#ffffff'], count: 36, speed: 7, gravity: 0.25, size: 5 })
        setTimeout(() => setBossFlashing(false), 300)
      }, 360)
      setTimeout(() => setBossSpriteShaking(false), getSpriteShakeDurationMs(SPRITE_SHAKE_INTENSITY))
    } else {
      emitSfx({ name: 'wrong.wav', volume: 0.52, minRate: 0.95, maxRate: 1.05 })
      playBossAttackSfx()
      // Boss swoops at player
      bossAnimRef.current?.triggerAttack(playerRef)
      // Player damage effects at boss arrival (~300ms)
      setTimeout(() => {
        setPlayerDamaged(true)
        setPlayerSpriteShaking(true)
        addDmg(combat.state.playerDamageOnWrong, '#FF0040', 'player')
        triggerShake({ intensity: SCREEN_SHAKE_INTENSITY })
        const r = playerRef.current?.getBoundingClientRect()
        if (r) particlesRef.current?.burst(r.left + r.width / 2, r.top + r.height / 2, { color: ['#FF0040', '#ff6644', '#ffaa00'], count: 28, speed: 5, angle: -Math.PI / 2, spread: Math.PI, gravity: 0.3, size: 4 })
        setTimeout(() => setPlayerDamaged(false), 500)
      }, 300)
      setTimeout(() => setPlayerSpriteShaking(false), getSpriteShakeDurationMs(SPRITE_SHAKE_INTENSITY))
    }

    const t = setTimeout(() => combat.revealComplete(), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat.state.phase, playBossAttackSfx, triggerPlayerAttack])

  // ── Timeout damage detection: boss swoops when timer runs out ──
  useEffect(() => {
    const prev = prevPlayerHPRef.current
    prevPlayerHPRef.current = combat.state.playerHP
    if (prev === null) return
    // HP decreased while question is unanswered = timeout hit
    if (combat.state.playerHP < prev && combat.state.phase === PHASES.ACTIVE && combat.state.selectedAnswer === null) {
      playBossAttackSfx()
      bossAnimRef.current?.triggerAttack(playerRef)
      const dmg = prev - combat.state.playerHP
      if (dmg > 0) {
        setTimeout(() => {
          setPlayerDamaged(true)
          triggerShake({ intensity: 'medium' })
          addDmg(dmg, '#FF6600', 'player')
          setTimeout(() => setPlayerDamaged(false), 500)
        }, 300)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat.state.playerHP, playBossAttackSfx])

  // ── GAME_OVER: navigate ──
  useEffect(() => {
    if (combat.state.phase !== PHASES.GAME_OVER) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    game.addScore((combat.state as any).currency ?? 0)
    if (combat.state.bossHP <= 0) {
      if (game.currentBossIndex + 1 >= game.totalBosses) router.push('/result?outcome=victory')
      else { game.advanceToNextBoss(); router.push('/transition') }
    } else {
      router.push('/result?outcome=death')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat.state.phase])

  // ── Reset FRQ state + accordion when question changes ──
  useEffect(() => {
    setFrqText('')
    setFrqResult(null)
    setOpenExps([])
  }, [combat.state.questionIndex])

  if (!game.currentBoss) return null

  const { state } = combat
  const q = state.currentQuestion
  const choices = q?.choices.filter(c => !state.eliminatedChoices.includes(c.id)) ?? []
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

  const handleFrqSubmit = async () => {
    if (!isActive || !q || !frqText.trim() || judgingFrq) return
    setJudgingFrq(true)
    combat.pauseTimer()  // freeze countdown while Gemini grades the answer
    try {
      const result = await judgeAnswer(frqText, q.question_text, q.correctAnswerId, game)
      setFrqResult({ explanation: result.explanation, bossDialogue: result.boss_dialogue })
      if (recordedQuestionIndexRef.current !== state.questionIndex) {
        recordedQuestionIndexRef.current = state.questionIndex
        const shieldActive = state.activeEffects.some(e => e.type === 'shield')
        game.addQuestionResult({
          question: q.question_text, playerAnswer: frqText, correct: result.is_correct,
          explanation: result.explanation, conceptName: q.concept,
          damage: result.is_correct ? state.bossDamageOnCorrect : 0,
          playerDamage: result.is_correct ? 0 : (shieldActive ? 0 : state.playerDamageOnWrong),
        })
      }
      combat.submitFreeResponse(result.is_correct)
    } catch {
      setFrqResult({ explanation: q.explanation, bossDialogue: q.dialogue })
      combat.submitFreeResponse(false)
    } finally {
      setJudgingFrq(false)
      combat.resumeTimer()  // always unfreeze — LOAD_QUESTION also resets it
    }
  }

  const isActive = state.phase === PHASES.ACTIVE
  const isReveal = state.phase === PHASES.REVEAL
  const isExplanation = state.phase === PHASES.EXPLANATION
  const isLoading = state.phase === PHASES.LOADING

  const bossHPPct = (state.bossHP / state.bossMaxHP) * 100
  const playerHPPct = (state.playerHP / state.playerMaxHP) * 100
  const timerPct = state.totalTime > 0 ? (state.timeRemaining / state.totalTime) * 100 : 0
  const timerLow = timerPct < 25

  const isFrq = q?.question_type === 'free_response'

  const wrongTaunt = ((isReveal || isExplanation) && !state.isCorrect && state.selectedAnswer && !isFrq)
    ? q?.wrong_taunts.find(t => t.answer === state.selectedAnswer)?.taunt : undefined

  const dialogue = (isFrq && frqResult?.bossDialogue && (isReveal || isExplanation))
    ? frqResult.bossDialogue
    : (wrongTaunt ?? q?.dialogue ?? '')
  const explanationText = (isFrq && frqResult?.explanation) ? frqResult.explanation : q?.explanation

  const inventorySlots = state.inventory.slice(0, MAX_INVENTORY)

  return (
    <>
      <ShakeStyles />
      <Particles ref={particlesRef} />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes bossFloat   { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
        @keyframes hpPulse     { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes dmgFloat    { 0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.3)} 100%{opacity:0;transform:translateX(-50%) translateY(-70px) scale(0.75)} }
        @keyframes resultPop   { 0%{transform:scale(0.6);opacity:0} 65%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
        @keyframes scanlines   { 0%{background-position:0 0} 100%{background-position:0 100%} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown   { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
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
        @keyframes blink       { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes choicePulse { 0%,100%{box-shadow:0 0 0 transparent} 50%{box-shadow:0 0 10px #00f0ff44} }
        @keyframes timerPulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slotPulse   { 0%,100%{opacity:1} 50%{opacity:0.65} }
        @keyframes timerBgPulse { 0%,100%{background-color:rgba(255,0,40,0.02)} 50%{background-color:rgba(255,0,40,0.07)} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #FF004033; }
      `}</style>

      {/* Case-opening overlay */}
      {state.phase === PHASES.CASE_OPENING && state.pendingReward && (
        <CaseOpening
          item={state.pendingReward}
          inventoryFull={loadPlayerInventory().length >= MAX_INVENTORY}
          onCollect={() => { saveItemToPlayerInventory(state.pendingReward!); combat.caseComplete() }}
        />
      )}

      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#03030a', fontFamily: 'var(--font-pixel), monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }} className={shakeClass}>

        {dmgNums.map(d => <DamageNumber key={d.id} dmg={d} bossRef={bossRef} playerRef={playerRef} />)}

        {/* ═══ SCENE ═══ */}
        <div style={{ position: 'relative', zIndex: 1, height: '60vh', flexShrink: 0, overflow: 'hidden' }}>

          <ParallaxBackground layers={[{ imagePath: '/images/nebula.png', parallaxIntensity: 5 }]} zIndex={0} showOverlay backgroundColor="#03030a" position="absolute" />
          <TwinklingStars count={90} minSize={1} maxSize={2} color="#ffffff" zIndex={1} position="absolute" />
          <ParallaxBackground layers={[{ imagePath: '/images/planets.png', parallaxIntensity: 10 }]} zIndex={2} showOverlay={false} position="absolute" />
          <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%', animation: 'scanlines 10s linear infinite' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4, height: '34%', pointerEvents: 'none' }}>
            <img src="/images/ground.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center bottom', imageRendering: 'pixelated', display: 'block' }} />
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to bottom, transparent, #0a0015aa)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '28%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, #6633ff33 25%, #9966ff55 50%, #6633ff33 75%, transparent)' }} />

          {/* ── Player HP — top left (Elden Ring style) ── */}
          <div style={{
            position: 'absolute', top: 14, left: 14, zIndex: 5,
            width: 220,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{
                fontSize: 'clamp(8px, 1vw, 11px)', color: '#00f0ff',
                letterSpacing: 2, textShadow: '0 0 8px #00f0ff66',
                fontFamily: 'var(--font-pixel), monospace',
              }}>PLAYER</span>
              {playerHPPct < 30 && (
                <span style={{
                  fontSize: 'clamp(7px, 0.8vw, 9px)', color: '#FF0040',
                  animation: 'blink 0.55s infinite', letterSpacing: 1,
                  fontFamily: 'var(--font-pixel), monospace',
                }}>DANGER</span>
              )}
            </div>
            <HpBar value={state.playerHP} max={state.playerMaxHP} color="#00f0ff" height={14} segments />
          </div>

          {/* Score — top right */}
          <div style={{ position: 'absolute', top: 10, right: 14, textAlign: 'right', zIndex: 5, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 'clamp(7px, 1.1vw, 10px)', color: '#ffffff', letterSpacing: 2, textShadow: '0 0 8px #000000cc' }}>{game.score.toLocaleString()} <span style={{ color: '#ffffff' }}>PTS</span></div>
            <div style={{ fontSize: 'clamp(6px, 1vw, 9px)', color: '#ffffff', letterSpacing: 2, textShadow: '0 0 8px #000000cc' }}>BOSS <span style={{ color: '#ffffff' }}>{game.currentBossIndex + 1}</span><span style={{ color: '#ffffff' }}>/{game.totalBosses}</span></div>
            <div style={{ fontSize: 'clamp(6px, 1vw, 9px)', color: '#ffffff', letterSpacing: 2, textShadow: '0 0 8px #000000cc' }}>STREAK <span style={{ color: '#ffffff' }}>{state.correctStreak}</span></div>
          </div>

          {/* Boss sprite — unified component handling idle, swoop, and shake */}
          <div ref={bossRef} style={{ position: 'absolute', right: '19%', bottom: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 5 }}>
            <BossSprite
              ref={bossAnimRef}
              spriteSet={bossSpriteSet}
              flashing={bossFlashing}
              isShaking={bossSpriteShaking}
            />
            <div style={{ width: 100, height: 8, borderRadius: '50%', background: 'radial-gradient(ellipse, #1802025d 0%, transparent 70%)' }} />
          </div>

          {/* Player sprite */}
          <div
            ref={playerRef}
            style={{
              position: 'absolute', left: '19%', bottom: '20%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 5,
              transform: `translateX(${playerX}px)`,
              transition: playerTransStyle,
            }}
          >
            <div style={{
              filter: playerDamaged ? 'brightness(5) saturate(0)' : 'drop-shadow(0 0 10px #00f0ffaa) drop-shadow(0 0 22px #00f0ff44)',
              transform: playerFlipped ? 'scaleX(-1)' : 'none',
              transition: 'filter 0.15s',
            }}>
              <AnimatedSprite key={playerFrameKey} framePaths={playerFrames} width={256} height={64} frameRate={playerFrameRate} />
            </div>
            <div style={{ width: 70, height: 6, borderRadius: '50%', background: 'radial-gradient(ellipse, #0312137b 0%, transparent 70%)' }} />
          </div>

          {/* Item slots — bottom-left */}
          <div style={{ position: 'absolute', bottom: 10, left: 14, display: 'flex', gap: 6, zIndex: 5 }}>
            {Array.from({ length: MAX_INVENTORY }).map((_, slotIdx) => {
              const item = inventorySlots[slotIdx]
              const MCQ_ONLY_EFFECTS = ['eliminate_wrong', 'eliminate_two', 'reveal_answer']
              const isMcqOnly = !!item && MCQ_ONLY_EFFECTS.includes(item.effect)
              const canUse = isActive && !!item && !(isFrq && isMcqOnly)
              const isHover = hoveredSlot === slotIdx
              const c = item ? RARITY_COLOR[item.rarity] : '#222'
              return (
                <div
                  key={slotIdx}
                  onMouseEnter={() => setHoveredSlot(slotIdx)}
                  onMouseLeave={() => setHoveredSlot(null)}
                  onClick={() => {
                    if (!canUse) return
                    emitSfx({ name: 'useItem.wav', volume: 0.4, minRate: 0.96, maxRate: 1.06 })
                    combat.useItem(item)
                  }}
                  style={{
                    position: 'relative',
                    width: 46, height: 46,
                    border: item ? `1px solid ${c}${isHover ? 'bb' : '44'}` : '1px dashed #1c1c1c',
                    backgroundColor: item ? `${c}${isHover ? '20' : '0c'}` : '#0a0a0a',
                    cursor: canUse ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.12s',
                    boxShadow: canUse && isHover ? `0 0 14px ${c}55` : 'none',
                    opacity: item && !isActive ? 0.45 : 1,
                    animation: canUse ? 'slotPulse 2s ease-in-out infinite' : 'none',
                  }}
                >
                  {item
                    ? <img src={`/images/item_icons/${encodeURIComponent(item.label)}.png`} alt={item.label} style={{ width: 34, height: 34, imageRendering: 'pixelated' }} />
                    : <div style={{ width: 20, height: 20, border: '1px dashed #1c1c1c', opacity: 0.3 }} />
                  }
                  <div style={{ position: 'absolute', bottom: 2, right: 3, fontSize: 4, color: item ? `${c}77` : '#1c1c1c', fontFamily: 'var(--font-pixel), monospace' }}>{slotIdx + 1}</div>

                  {/* Tooltip */}
                  {item && isHover && (
                    <div style={{
                      position: 'absolute', bottom: '115%', left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#08080f', border: `1px solid ${c}44`,
                      padding: '7px 10px', width: 130, zIndex: 20,
                      pointerEvents: 'none',
                      boxShadow: `0 0 16px #00000099, 0 0 6px ${c}22`,
                    }}>
                      <div style={{ fontSize: 6, color: c, letterSpacing: 1, marginBottom: 4 }}>{item.label.toUpperCase()}</div>
                      <div style={{ fontSize: 5, color: '#666', lineHeight: 1.5 }}>{item.description}</div>
                      <div style={{ fontSize: 4, color: `${c}77`, marginTop: 4, letterSpacing: 2, textTransform: 'uppercase' }}>{item.rarity}</div>
                      {!isActive && <div style={{ fontSize: 4, color: '#FF004077', marginTop: 3 }}>ACTIVE ONLY</div>}
                      {isFrq && isMcqOnly && <div style={{ fontSize: 4, color: '#FF990077', marginTop: 3 }}>MCQ ONLY</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Boss HP — bottom center of scene (Elden Ring style) ── */}
          <div style={{
            position: 'absolute', bottom: 14, left: '50%',
            transform: 'translateX(-50%)',
            width: '55%', zIndex: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{
                fontSize: 'clamp(9px, 1.1vw, 13px)', color: '#FF3333',
                letterSpacing: 3, textShadow: '0 0 10px #FF333388',
                fontFamily: 'var(--font-pixel), monospace',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%',
              }}>{game.currentBoss.name.toUpperCase()}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {bossHPPct < 30 && (
                  <span style={{
                    fontSize: 'clamp(7px, 0.8vw, 9px)', color: '#FFD700',
                    animation: 'blink 0.55s infinite', letterSpacing: 1,
                    fontFamily: 'var(--font-pixel), monospace',
                  }}>ENRAGED</span>
                )}
              </div>
            </div>
            <HpBar value={state.bossHP} max={state.bossMaxHP} color="#FF0040" height={18} segments />
          </div>
        </div>

        {/* ═══ BATTLE MENU ═══ */}
        <div style={{
          position: 'relative', zIndex: 2, flex: 1, minHeight: 0,
          borderTop: '2px solid #00f0ff44',
          boxShadow: '0 -4px 16px #00f0ff18',
          backgroundColor: timerLow ? undefined : '#05050d',
          animation: timerLow ? 'timerBgPulse 0.8s ease-in-out infinite' : 'none',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* Timer bar — redesigned for visibility */}
          <div style={{ padding: '4px 20px 0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 'clamp(6px, 0.8vw, 8px)', color: timerLow ? '#FF0040' : '#00f0ff', letterSpacing: 2, fontFamily: 'var(--font-pixel), monospace' }}>TIME</div>
            <div style={{ flex: 1, height: 6, backgroundColor: '#0a0a0d', border: '1px solid #ffffff11', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: isExplanation ? '0%' : `${timerPct}%`,
                backgroundColor: timerLow ? '#FF0040' : '#00f0ff',
                boxShadow: `0 0 10px ${timerLow ? '#FF0040aa' : '#00f0ff88'}`,
                transition: isExplanation ? 'width 0.4s ease' : 'none',
                animation: !isExplanation && timerLow ? 'timerPulse 0.4s ease-in-out infinite' : 'none',
              }} />
            </div>
            <div style={{ 
              fontSize: 'clamp(7px, 0.9vw, 9px)', 
              color: timerLow ? '#FF0040' : '#00f0ff', 
              width: 30, textAlign: 'right',
              fontFamily: 'var(--font-pixel), monospace' 
            }}>
              {Math.ceil(state.timeRemaining / 1000)}s
            </div>
          </div>

          <div style={{ height: 2, flexShrink: 0, background: 'linear-gradient(90deg, transparent, #FF004044 25%, #9933ff55 50%, #00f0ff44 75%, transparent)' }} />

          {/* Dialogue */}
          <div style={{ padding: '16px 20px', flexShrink: 0, minHeight: 60, display: 'flex', alignItems: 'center', position: 'relative' }}>
            <p style={{
              margin: 0,
              fontSize: 'clamp(14px, 1.6vw, 18px)',
              color: (isReveal && !state.isCorrect) ? '#FF4400' : '#dddddd',
              lineHeight: 1.6,
              fontFamily: 'var(--font-mono), monospace'
            }}>
              {isLoading ? <span style={{ color: '#2a2a2a', animation: 'blink 0.8s infinite' }}>▋</span> : dialogue}
              {isActive && <span style={{ animation: 'blink 0.6s infinite', color: '#FF3333', marginLeft: 6 }}>▋</span>}
            </p>
            {(isReveal || isExplanation) && state.isCorrect === true && <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 'clamp(10px, 1.2vw, 14px)', color: '#39FF14', fontFamily: 'var(--font-pixel), monospace', animation: 'resultPop 0.3s ease', letterSpacing: 1 }}>CORRECT</div>}
            {(isReveal || isExplanation) && state.isCorrect === false && <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 'clamp(10px, 1.2vw, 14px)', color: '#FF0040', fontFamily: 'var(--font-pixel), monospace', animation: 'resultPop 0.3s ease', letterSpacing: 1 }}>WRONG</div>}
          </div>

          {/* Splitted Content area */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: 20, padding: '0 20px 20px 20px', overflow: 'hidden' }}>
            
            {(isActive || isReveal || isExplanation) && q ? (
              <>
                {/* LEFT SIDE: Question scroll */}
                <div className="pixel-corners" style={{
                  flex: 1, minHeight: 0,
                  border: '2px solid #FFD700',
                  backgroundColor: '#0a0a05',
                  padding: '20px',
                  display: 'flex', flexDirection: 'column',
                  overflowY: 'auto'
                }}>
                  <p style={{ margin: 0, fontSize: 'clamp(14px, 1.8vw, 20px)', color: '#FFD700', lineHeight: 1.8, fontFamily: 'var(--font-mono), monospace' }}>
                    {q.question_text}
                  </p>
                </div>

                {/* RIGHT SIDE: Answers area */}
                <div style={{
                  flex: 1, minHeight: 0,
                  display: 'flex', flexDirection: 'column', gap: 16
                }}>
                  {isFrq ? (
                    /* FRQ Variant */
                    <>
                      <div className="pixel-corners" style={{
                        flex: 1, minHeight: 0,
                        border: '2px solid #8A2BE2',
                        backgroundColor: '#100515',
                        padding: '16px',
                        display: 'flex', flexDirection: 'column',
                        position: 'relative'
                      }}>
                        <textarea
                          value={frqText}
                          onChange={e => setFrqText(e.target.value)}
                          disabled={!isActive || judgingFrq}
                          placeholder={judgingFrq ? "JUDGING..." : "TYPE YOUR INCANTATION..."}
                          style={{
                            flex: 1,
                            background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                            color: '#eebbff',
                            fontFamily: 'var(--font-mono), monospace',
                            fontSize: 'clamp(14px, 1.6vw, 18px)', lineHeight: 1.6
                          }}
                        />
                        <div style={{ width: '100%', height: 8, backgroundColor: '#220033', marginTop: 12, border: '1px solid #8A2BE2' }}>
                           <div style={{ height: '100%', width: `${Math.min(100, (frqText.trim().length / 50) * 100)}%`, backgroundColor: '#8A2BE2', transition: 'width 0.2s' }} />
                        </div>
                      </div>
                      
                      {/* FRQ Action Row */}
                      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                        <button 
                          className="pixel-corners"
                          onClick={() => setFrqText('')}
                          disabled={!isActive || judgingFrq || !frqText}
                          style={{
                            flex: 1, padding: '14px',
                            backgroundColor: '#1a0005', border: '2px solid #FF0040', color: '#FF0040',
                            fontFamily: 'var(--font-pixel), monospace', fontSize: '10px',
                            cursor: (!isActive || judgingFrq || !frqText) ? 'default' : 'pointer'
                          }}
                        >ERASE</button>
                        <button
                          className="pixel-corners retro-hover-purple"
                          onClick={handleFrqSubmit}
                          disabled={!isActive || judgingFrq || !frqText.trim()}
                          style={{
                            flex: 2, padding: '14px',
                            backgroundColor: '#100515', border: '2px solid #8A2BE2', color: '#8A2BE2',
                            fontFamily: 'var(--font-pixel), monospace', fontSize: '10px',
                            cursor: (!isActive || judgingFrq || !frqText.trim()) ? 'default' : 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >SUBMIT SCROLL ►</button>
                      </div>
                    </>
                  ) : (
                    /* MCQ Variant */
                    <>
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                        {choices.map((choice, i) => {
                          const isSel = state.selectedAnswer === choice.id
                          const isCorr = choice.id === q.correctAnswerId
                          const isDis = !isActive
                          const hasExp = !!(isExplanation && q.explanations && q.explanations[choice.id])
                          const isOpen = openExps.includes(choice.id)

                          let bg = '#050510', border = '#00f0ff33', color = '#00f0ff', badgeBg = '#00f0ff11'
                          if (isReveal || isExplanation) {
                            if (isCorr) { bg = '#002010'; border = '#39FF14'; color = '#39FF14'; badgeBg = '#39FF1433' }
                            else if (isSel) { bg = '#200005'; border = '#FF0040'; color = '#FF0040'; badgeBg = '#FF004033' }
                            else { bg = '#080808'; border = '#333333'; color = '#666666'; badgeBg = '#222222' }
                          } else if (isSel) {
                            bg = '#201500'; border = '#FFD700'; color = '#FFD700'; badgeBg = '#FFD70033'
                          }

                          return (
                            <div key={choice.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%', minHeight: 0 }}>
                              <button
                                className={`pixel-corners ${isActive && !isSel ? 'retro-hover-cyan' : ''}`}
                                onClick={() => combat.selectAnswer(choice.id)}
                                disabled={isDis}
                                data-sfx-press="angelichum.wav"
                                data-sfx-volume="0.5"
                                data-sfx-min-rate="0.9"
                                data-sfx-max-rate="1.1"
                                style={{
                                  flex: 1,
                                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                  backgroundColor: bg, border: `2px solid ${border}`, color,
                                  padding: '12px', cursor: isDis ? 'default' : 'pointer',
                                  fontFamily: 'var(--font-mono), monospace',
                                  fontSize: 'clamp(12px, 1.4vw, 16px)', textAlign: 'left',
                                  lineHeight: 1.5, transition: 'all 0.15s',
                                  overflowY: 'auto'
                                }}
                              >
                                <div style={{ 
                                  padding: '4px 8px', backgroundColor: badgeBg, 
                                  fontFamily: 'var(--font-pixel), monospace', fontSize: '10px', 
                                  marginBottom: 8, letterSpacing: 1 
                                }}>
                                  [{['A','B','C','D'][i]}]
                                </div>
                                {choice.text}
                              </button>
                              {/* The WHY dropdown */}
                              {hasExp && (
                                <div className="pixel-corners" style={{ border: `2px solid ${border}`, backgroundColor: bg, marginTop: -4, flexShrink: 0 }}>
                                  <button
                                    onClick={() => setOpenExps(prev =>
                                      prev.includes(choice.id)
                                        ? prev.filter(id => id !== choice.id)
                                        : [...prev, choice.id]
                                    )}
                                    style={{
                                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                      padding: '8px 12px', background: 'none', border: 'none',
                                      cursor: 'pointer', fontFamily: 'var(--font-pixel), monospace', color
                                    }}
                                  >
                                    <span style={{ fontSize: '8px', letterSpacing: 1 }}>WHY?</span>
                                    <span style={{ fontSize: '8px' }}>{isOpen ? '▲' : '▼'}</span>
                                  </button>
                                  {isOpen && (
                                    <div style={{ padding: '0 12px 12px 12px', fontSize: 'clamp(10px, 1.1vw, 13px)', color: '#99bbbb', lineHeight: 1.6, fontFamily: 'var(--font-mono), monospace' }}>
                                      {q.explanations![choice.id]}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* MCQ Action Row */}
                      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                        <button 
                          className="pixel-corners"
                          onClick={() => combat.selectAnswer('')}
                          disabled={!isActive || !state.selectedAnswer}
                          style={{
                            flex: 1, padding: '14px',
                            backgroundColor: '#1a0005', border: '2px solid #FF0040', color: '#FF0040',
                            fontFamily: 'var(--font-pixel), monospace', fontSize: '10px',
                            cursor: (!isActive || !state.selectedAnswer) ? 'default' : 'pointer'
                          }}
                        >CLEAR</button>
                        {(isExplanation) ? (
                          <button
                            className="pixel-corners retro-hover-cyan"
                            onClick={() => combat.explanationOK()}
                            style={{
                              flex: 2, padding: '14px',
                              backgroundColor: '#001a1a', border: '2px solid #00f0ff', color: '#00f0ff',
                              fontFamily: 'var(--font-pixel), monospace', fontSize: '10px',
                              cursor: 'pointer'
                            }}
                          >NEXT ►</button>
                        ) : (
                          <button
                            className="pixel-corners retro-hover-gold"
                            onClick={() => state.selectedAnswer && combat.submitAnswer(state.selectedAnswer)}
                            disabled={!isActive || !state.selectedAnswer}
                            style={{
                              flex: 2, padding: '14px',
                              backgroundColor: '#1a1800', border: '2px solid #FFD700', color: '#FFD700',
                              fontFamily: 'var(--font-pixel), monospace', fontSize: '10px',
                              cursor: (!isActive || !state.selectedAnswer) ? 'default' : 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >CAST ANSWER ►</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(9px, 1.1vw, 12px)', color: '#2a2a2a', letterSpacing: 3, animation: 'blink 1.4s ease-in-out infinite', fontFamily: 'var(--font-pixel), monospace' }}>
                ENEMY IS CHARGING...
              </div>
            )}
        </div>
      </div>
    </div>

      <style>{`
        .pixel-corners {
          clip-path: polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px);
        }
        .retro-hover-cyan:hover:not(:disabled) {
          background-color: #00f0ff1a !important;
          border-color: #00f0ff !important;
        }
        .retro-hover-gold:hover:not(:disabled) {
          background-color: #302a00 !important;
          border-color: #FFD700 !important;
        }
        .retro-hover-purple:hover:not(:disabled) {
          background-color: #2a1535 !important;
          border-color: #8A2BE2 !important;
        }
      `}</style>
    </>
  )
}