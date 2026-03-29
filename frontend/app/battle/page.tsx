'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useGame, PLAYER_MAX_HP_VALUE } from '@/context/GameContext'
import { streamQuestion, streamAnswer, readStream, parseVerdict } from '@/lib/api'
import ParallaxBackground from '@/components/ui/parallax-background'
import TwinklingStars from '@/components/ui/twinkling-stars'
import Particles, { ParticlesHandle } from '@/components/ui/particles'
import { useShake, ShakeStyles } from '@/hooks/useShake'

/* ─── Parse MCQ choices from question text ─── */
function extractChoices(text: string): string[] | null {
  // Match patterns like "A) ...", "A. ...", "(A) ..."
  const lines = text.split('\n')
  const choiceLines = lines.filter((l) => /^\s*[（(]?[A-D][）).]\s+\S/.test(l))
  if (choiceLines.length >= 2) {
    return choiceLines.map((l) => {
      const m = l.match(/^\s*[（(]?([A-D])[）).]\s+(.+)/)
      return m ? `${m[1]}) ${m[2].trim()}` : l.trim()
    })
  }
  return null
}


/* ─── Boss pixel sprite ─── */
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
      filter: flashing
        ? 'brightness(4) saturate(0)'
        : 'drop-shadow(0 0 14px #FF333399) drop-shadow(0 0 30px #FF000044)',
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

/* ─── Player pixel sprite ─── */
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
      filter: damaged
        ? 'brightness(5) saturate(0)'
        : 'drop-shadow(0 0 10px #00f0ffaa) drop-shadow(0 0 22px #00f0ff44)',
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

/* ─── HP Bar ─── */
function HpBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, (value / max) * 100)
  const low  = pct < 30
  return (
    <div>
      <div style={{
        height: 7,
        backgroundColor: '#050505',
        border: `1px solid ${color}33`,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          backgroundColor: color,
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

/* ─── Floating damage number ─── */
interface DmgNum { id: number; value: number; color: string; side: 'boss' | 'player' }

function DamageNumber({ dmg, bossRef, playerRef }: {
  dmg: DmgNum
  bossRef: React.RefObject<HTMLDivElement | null>
  playerRef: React.RefObject<HTMLDivElement | null>
}) {
  const ref = dmg.side === 'boss' ? bossRef : playerRef
  const rect = ref.current?.getBoundingClientRect()
  if (!rect) return null
  const left = rect.left + rect.width / 2
  const top  = rect.top  - 10
  return (
    <div style={{
      position: 'fixed',
      left,
      top,
      transform: 'translateX(-50%)',
      color: dmg.color,
      fontSize: 'clamp(10px, 2vw, 16px)',
      textShadow: `0 0 14px ${dmg.color}, 0 0 28px ${dmg.color}88`,
      fontFamily: 'var(--font-pixel), monospace',
      animation: 'dmgFloat 1.2s ease-out forwards',
      pointerEvents: 'none',
      zIndex: 100,
      whiteSpace: 'nowrap',
    }}>
      {dmg.value > 0 ? `-${dmg.value}` : 'MISS'}
    </div>
  )
}

type BattlePhase = 'question' | 'answering' | 'judging' | 'result'

export default function BattlePage() {
  const router = useRouter()
  const game   = useGame()

  const [phase, setPhase]                 = useState<BattlePhase>('question')
  const [dialogue, setDialogue]           = useState('')
  const [question, setQuestion]           = useState('')
  const [choices, setChoices]             = useState<string[] | null>(null)
  const [answer, setAnswer]               = useState('')
  const [bossFlashing, setBossFlashing]   = useState(false)
  const [playerDamaged, setPlayerDamaged] = useState(false)
  const [dmgNums, setDmgNums]             = useState<DmgNum[]>([])
  const [lastCorrect, setLastCorrect]     = useState<boolean | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)

  const { shakeClass, triggerShake } = useShake()

  const dmgIdRef      = useRef(0)
  const didFetchRef   = useRef(false)
  const bossRef       = useRef<HTMLDivElement>(null)
  const playerRef     = useRef<HTMLDivElement>(null)
  const particlesRef  = useRef<ParticlesHandle>(null)

  const addDmg = (value: number, color: string, side: 'boss' | 'player') => {
    const id = dmgIdRef.current++
    setDmgNums((prev) => [...prev, { id, value, color, side }])
    setTimeout(() => setDmgNums((prev) => prev.filter((d) => d.id !== id)), 1300)
  }

  const fetchQuestion = useCallback(async () => {
    setPhase('question')
    setDialogue('')
    setQuestion('')
    setChoices(null)
    setLastCorrect(null)
    setSelectedChoice(null)
    try {
      let data: Record<string, unknown>

      if (process.env.NEXT_PUBLIC_MOCK === 'true') {
        await new Promise((r) => setTimeout(r, 800))
        const boss = game.currentBoss
        const cluster = game.currentCluster
        data = {
          dialogue: `${boss?.name ?? 'The Boss'} snarls: "Let's see if you truly understand ${cluster?.clusterName ?? 'this topic'}!"`,
          question_text: `Which of the following best describes a key concept in ${cluster?.clusterName ?? 'this topic'}?`,
          options: [
            `A) ${cluster?.concepts[0]?.name ?? 'Concept A'}`,
            `B) ${cluster?.concepts[1]?.name ?? 'Concept B'}`,
            'C) Neither of the above',
            'D) All of the above',
          ],
          correct_answer: `A) ${cluster?.concepts[0]?.name ?? 'Concept A'}`,
        }
      } else {
        const res = await streamQuestion(game)
        let full  = ''
        await readStream(res, (chunk) => { full += chunk })
        data = JSON.parse(full)
      }

      const dlg  = data.dialogue as string ?? ''
      const opts: string[] = Array.isArray(data.options) ? data.options as string[] : []
      const qText = [data.question_text as string ?? '', ...opts].filter(Boolean).join('\n')

      setDialogue(dlg)
      setQuestion(qText)
      setChoices(opts.length ? opts : extractChoices(qText))
      setPhase('answering')
    } catch {
      setDialogue('ERROR: Could not reach the enemy...')
    }
  }, [game])

  useEffect(() => {
    if (!game.currentBoss) return
    if (didFetchRef.current) return
    didFetchRef.current = true
    fetchQuestion()
  }, [game.currentBoss, router, fetchQuestion])

  const doSubmit = async (submittedAnswer: string) => {
    if (!submittedAnswer.trim() || phase !== 'answering') return
    setPhase('judging')
    setDialogue('')
    setAnswer('')

    try {
      const verdict = await (async () => {
        if (process.env.NEXT_PUBLIC_MOCK === 'true') {
          await new Promise((r) => setTimeout(r, 700))
          const isCorrect = submittedAnswer.startsWith('A)')
          setDialogue(isCorrect
            ? `${game.currentBoss?.name ?? 'Boss'}: "Impossible! You actually knew that?!"`
            : `${game.currentBoss?.name ?? 'Boss'}: "Ha! Wrong! You fall before my intellect!"`)
          return { correct: isCorrect, explanation: 'Mock explanation for this answer.', conceptName: game.currentCluster?.concepts[0]?.name ?? 'concept', damage: 30, playerDamage: 20, scoreGained: isCorrect ? 100 : 0 }
        }
        const res = await streamAnswer(submittedAnswer, question, game)
        let full  = ''
        await readStream(res, (chunk) => {
          full += chunk
          const { dialogue: d } = parseVerdict(full)
          setDialogue(d)
        })
        return parseVerdict(full).verdict
      })()

      if (!verdict) { setPhase('answering'); return }

      setLastCorrect(verdict.correct)
      game.addQuestionResult({
        question,
        playerAnswer: submittedAnswer,
        correct: verdict.correct,
        explanation: verdict.explanation,
        conceptName: verdict.conceptName,
        damage: verdict.damage,
        playerDamage: verdict.playerDamage,
      })
      game.incrementTurn()
      game.addScore(verdict.scoreGained)

      if (verdict.correct) {
        game.damageBoss(verdict.damage)
        setBossFlashing(true)
        addDmg(verdict.damage, '#39FF14', 'boss')
        const bossRect = bossRef.current?.getBoundingClientRect()
        if (bossRect) {
          particlesRef.current?.burst(
            bossRect.left + bossRect.width / 2,
            bossRect.top  + bossRect.height / 2,
            { color: ['#39FF14', '#00f0ff', '#ffffff'], count: 36, speed: 7, gravity: 0.25, size: 5 }
          )
        }
        setTimeout(() => setBossFlashing(false), 300)
      } else {
        game.damagePlayer(verdict.playerDamage)
        addDmg(verdict.playerDamage, '#FF0040', 'player')
        setPlayerDamaged(true)
        triggerShake({ intensity: 'heavy' })
        const playerRect = playerRef.current?.getBoundingClientRect()
        if (playerRect) {
          particlesRef.current?.burst(
            playerRect.left + playerRect.width / 2,
            playerRect.top  + playerRect.height / 2,
            { color: ['#FF0040', '#ff6644', '#ffaa00'], count: 28, speed: 5, angle: -Math.PI / 2, spread: Math.PI, gravity: 0.3, size: 4 }
          )
        }
        setTimeout(() => setPlayerDamaged(false), 500)
      }

      setPhase('result')

      setTimeout(() => {
        const newBossHP   = Math.max(0, game.bossHP   - (verdict.correct ? verdict.damage       : 0))
        const newPlayerHP = Math.max(0, game.playerHP - (verdict.correct ? 0 : verdict.playerDamage))

        if (newPlayerHP <= 0) {
          router.push('/result?outcome=death')
        } else if (newBossHP <= 0) {
          if (game.currentBossIndex + 1 >= game.totalBosses) {
            router.push('/result?outcome=victory')
          } else {
            game.advanceToNextBoss()
            router.push('/transition')
          }
        } else {
          didFetchRef.current = false
          fetchQuestion()
        }
      }, 3000)
    } catch {
      setDialogue('ERROR: Answer lost in the void.')
      setPhase('answering')
    }
  }

  const submitAnswer = () => doSubmit(answer)

  const pickChoice = (idx: number, choice: string) => {
    if (phase !== 'answering') return
    setSelectedChoice(idx)
    // Extract just the letter (e.g. "A) Chlorophyll" → "A")
    const letter = choice.charAt(0)
    doSubmit(letter + ') ' + choice.slice(3))
  }

  if (!game.currentBoss) return null

  const bossHPPct   = (game.bossHP   / game.currentBoss.max_hp)  * 100
  const playerHPPct = (game.playerHP / PLAYER_MAX_HP_VALUE)       * 100

  return (
    <>
      <ShakeStyles />
      <Particles ref={particlesRef} />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes bossFloat {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes hpPulse {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.45; }
        }
        @keyframes dmgFloat {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.3); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-70px) scale(0.75); }
        }
        @keyframes resultPop {
          0%   { transform: scale(0.6); opacity: 0; }
          65%  { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes scanlines {
          0%   { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0; }
        }
        @keyframes choicePulse {
          0%,100% { box-shadow: 0 0 0 transparent; }
          50%     { box-shadow: 0 0 10px #00f0ff44; }
        }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #FF004033; }
      `}</style>

      {/* Root */}
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: '#03030a',
        fontFamily: 'var(--font-pixel), monospace',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
      className={shakeClass}
    >

        <ParallaxBackground
          layers={[{ imagePath: '/images/nebula.png', parallaxIntensity: 5 }]}
          zIndex={0}
          showOverlay={true}
          backgroundColor="#03030a"
        />

        <TwinklingStars count={90} minSize={1} maxSize={2} color="#ffffff" zIndex={1} />

        <ParallaxBackground
          layers={[{ imagePath: '/images/planets.png', parallaxIntensity: 10 }]}
          zIndex={2}
          showOverlay={false}
        />

        {/* Scanlines */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.1) 2px,rgba(0,0,0,0.1) 4px)',
          animation: 'scanlines 0.1s linear infinite',
        }} />

        {/* Damage numbers layer (fixed positioning relative to sprites) */}
        {dmgNums.map((d) => (
          <DamageNumber key={d.id} dmg={d} bossRef={bossRef} playerRef={playerRef} />
        ))}

        {/* ═══════════════════════════════════════════
            ARENA — top 58vh
        ═══════════════════════════════════════════ */}
        <div style={{
          position: 'relative',
          zIndex: 4,
          height: '58vh',
          flexShrink: 0,
          overflow: 'hidden',
        }}>

          {/* Subtle ground gradient */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: '30%',
            background: 'linear-gradient(to bottom, transparent, #0a0015aa)',
            pointerEvents: 'none',
          }} />

          {/* Horizon glow */}
          <div style={{
            position: 'absolute',
            bottom: '28%',
            left: 0, right: 0,
            height: 1,
            background: 'linear-gradient(90deg, transparent, #6633ff33 25%, #9966ff55 50%, #6633ff33 75%, transparent)',
          }} />

          {/* ── BOSS HP CARD — top left ── */}
          <div style={{
            position: 'absolute',
            top: 12, left: 14,
            backgroundColor: '#060008',
            border: '1px solid #FF004033',
            padding: '9px 13px',
            width: 200,
            boxShadow: '0 0 24px #FF00401a, inset 0 0 12px #0a000a',
            zIndex: 5,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: 'clamp(5px, 0.9vw, 7px)',
                color: '#FF3333',
                letterSpacing: 2,
                textShadow: '0 0 8px #FF333388',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 120,
              }}>
                {game.currentBoss.name.toUpperCase()}
              </span>
              {bossHPPct < 30 && (
                <span style={{
                  fontSize: 'clamp(4px, 0.7vw, 5px)',
                  color: '#FFD700',
                  animation: 'blink 0.55s infinite',
                  letterSpacing: 1,
                  flexShrink: 0,
                }}>
                  LOW HP
                </span>
              )}
            </div>
            <HpBar value={game.bossHP} max={game.currentBoss.max_hp} color="#FF0040" />
          </div>

          {/* ── SCORE / BOSS / TURN — top right ── */}
          <div style={{
            position: 'absolute',
            top: 12, right: 14,
            textAlign: 'right',
            zIndex: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ fontSize: 'clamp(5px, 0.9vw, 7px)', color: '#FFD700', letterSpacing: 2, textShadow: '0 0 6px #FFD70055' }}>
              {game.score.toLocaleString()} <span style={{ color: '#443300' }}>PTS</span>
            </div>
            <div style={{ fontSize: 'clamp(4px, 0.8vw, 6px)', color: '#555', letterSpacing: 2 }}>
              BOSS <span style={{ color: '#9966ff' }}>{game.currentBossIndex + 1}</span>
              <span style={{ color: '#2a2a2a' }}>/{game.totalBosses}</span>
            </div>
            <div style={{ fontSize: 'clamp(4px, 0.8vw, 6px)', color: '#333', letterSpacing: 2 }}>
              TURN <span style={{ color: '#555' }}>{game.turn + 1}</span>
            </div>
          </div>

          {/* ── BOSS SPRITE — upper right ── */}
          <div
            ref={bossRef}
            style={{
              position: 'absolute',
              right: '12%',
              top: '10%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <BossSprite flashing={bossFlashing} />
            {/* shadow under boss */}
            <div style={{
              width: 100,
              height: 8,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, #FF333322 0%, transparent 70%)',
            }} />
          </div>

          {/* ── PLAYER SPRITE — lower left ── */}
          <div
            ref={playerRef}
            style={{
              position: 'absolute',
              left: '10%',
              bottom: '22%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <PlayerAvatar damaged={playerDamaged} />
            {/* shadow under player */}
            <div style={{
              width: 70,
              height: 6,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, #00f0ff1a 0%, transparent 70%)',
            }} />
          </div>

          {/* ── PLAYER HP CARD — bottom right of arena ── */}
          <div style={{
            position: 'absolute',
            bottom: 10, right: 14,
            backgroundColor: '#000d10',
            border: '1px solid #00f0ff28',
            padding: '9px 13px',
            width: 200,
            boxShadow: '0 0 24px #00f0ff18, inset 0 0 12px #000d10',
            zIndex: 5,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: 'clamp(5px, 0.9vw, 7px)',
                color: '#00f0ff',
                letterSpacing: 2,
                textShadow: '0 0 8px #00f0ff66',
              }}>
                PLAYER
              </span>
              {playerHPPct < 30 && (
                <span style={{
                  fontSize: 'clamp(4px, 0.7vw, 5px)',
                  color: '#FF0040',
                  animation: 'blink 0.55s infinite',
                  letterSpacing: 1,
                }}>
                  DANGER
                </span>
              )}
            </div>
            <HpBar value={game.playerHP} max={PLAYER_MAX_HP_VALUE} color="#00f0ff" />
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            BATTLE MENU — bottom 42vh
        ═══════════════════════════════════════════ */}
        <div style={{
          position: 'relative',
          zIndex: 4,
          flex: 1,
          minHeight: 0,
          borderTop: '1px solid #ffffff0a',
          backgroundColor: '#02020899',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* top accent */}
          <div style={{
            height: 2,
            flexShrink: 0,
            background: 'linear-gradient(90deg, transparent, #FF004044 25%, #9933ff55 50%, #00f0ff44 75%, transparent)',
          }} />

          {/* ── Dialogue box ── */}
          <div style={{
            padding: '10px 18px 8px',
            borderBottom: '1px solid #ffffff07',
            flexShrink: 0,
            position: 'relative',
            minHeight: 70,
          }}>
            <div style={{
              fontSize: 'clamp(4px, 0.75vw, 5px)',
              color: '#FF004044',
              letterSpacing: 3,
              marginBottom: 5,
              textTransform: 'uppercase',
            }}>
              {game.currentBoss.name}:
            </div>
            <p style={{
              margin: 0,
              fontSize: 'clamp(7px, 1.2vw, 9px)',
              color: '#cccccc',
              lineHeight: 2,
            }}>
              {phase === 'question' && !dialogue
                ? <span style={{ color: '#2a2a2a', animation: 'blink 0.8s infinite', display: 'inline-block' }}>▋</span>
                : dialogue
              }
              {dialogue && (phase === 'question' || phase === 'judging') && (
                <span style={{ animation: 'blink 0.6s infinite', color: '#FF3333', marginLeft: 2 }}>▋</span>
              )}
            </p>

            {/* Verdict badge */}
            {lastCorrect === true && (
              <div style={{
                position: 'absolute', top: 10, right: 18,
                fontSize: 'clamp(5px, 0.9vw, 7px)',
                color: '#39FF14',
                textShadow: '0 0 12px #39FF14',
                animation: 'resultPop 0.3s ease',
                letterSpacing: 2,
              }}>
                ✓ CORRECT
              </div>
            )}
            {lastCorrect === false && (
              <div style={{
                position: 'absolute', top: 10, right: 18,
                fontSize: 'clamp(5px, 0.9vw, 7px)',
                color: '#FF0040',
                textShadow: '0 0 12px #FF0040',
                animation: 'resultPop 0.3s ease',
                letterSpacing: 2,
              }}>
                ✗ WRONG
              </div>
            )}
          </div>

          {/* ── Question + Answer ── */}
          <div style={{
            flex: 1,
            minHeight: 0,
            padding: '10px 18px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 10,
            overflowY: 'auto',
          }}>

            {phase === 'question' && (
              <div style={{
                textAlign: 'center',
                fontSize: 'clamp(5px, 0.9vw, 6px)',
                color: '#2a2a2a',
                letterSpacing: 3,
                animation: 'blink 1.4s ease-in-out infinite',
              }}>
                ENEMY IS CHARGING...
              </div>
            )}

            {phase === 'judging' && (
              <div style={{
                textAlign: 'center',
                fontSize: 'clamp(5px, 0.9vw, 6px)',
                color: '#FFD700',
                letterSpacing: 3,
                textShadow: '0 0 8px #FFD70055',
              }}>
                CALCULATING DAMAGE...
              </div>
            )}

            {(phase === 'answering' || phase === 'result') && (
              <div style={{ display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'stretch', animation: 'fadeSlideUp 0.25s ease', height: '100%' }}>

                {/* ── Left: Question text ── */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <p style={{
                    margin: 0,
                    fontSize: 'clamp(6px, 1.1vw, 8px)',
                    color: '#FFD700',
                    lineHeight: 1.9,
                    textShadow: '0 0 8px #FFD70022',
                  }}>
                    {choices
                      ? question.split('\n').find(l => l.trim().length > 0 && !/^\s*[（(]?[A-D][）).]/.test(l)) ?? question
                      : question
                    }
                  </p>
                </div>

                {/* ── Divider ── */}
                {choices && (
                  <div style={{ width: 1, backgroundColor: '#ffffff0a', flexShrink: 0 }} />
                )}

                {/* ── Right: MCQ choices ── */}
                {choices && (
                  <div style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    alignContent: 'center',
                  }}>
                    {choices.map((choice, idx) => {
                      const isSelected = selectedChoice === idx
                      const isDisabled = phase !== 'answering'
                      return (
                        <button
                          key={idx}
                          onClick={() => pickChoice(idx, choice)}
                          disabled={isDisabled}
                          style={{
                            fontFamily: 'var(--font-pixel), monospace',
                            fontSize: 'clamp(6px, 1vw, 8px)',
                            letterSpacing: 1,
                            color: isSelected ? '#000' : isDisabled ? '#333' : '#00f0ff',
                            backgroundColor: isSelected
                              ? '#00f0ff'
                              : isDisabled
                                ? '#080808'
                                : '#050510',
                            border: `1px solid ${isSelected ? '#00f0ff' : isDisabled ? '#111' : '#00f0ff33'}`,
                            padding: '9px 12px',
                            textAlign: 'left',
                            cursor: isDisabled ? 'default' : 'pointer',
                            transition: 'all 0.15s',
                            lineHeight: 1.7,
                            boxShadow: isSelected
                              ? '0 0 14px #00f0ffaa'
                              : isDisabled
                                ? 'none'
                                : undefined,
                            animation: !isDisabled && !isSelected ? 'choicePulse 2s ease-in-out infinite' : 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (!isDisabled && !isSelected) {
                              const btn = e.currentTarget
                              btn.style.backgroundColor = '#00f0ff1a'
                              btn.style.borderColor = '#00f0ff66'
                              btn.style.boxShadow = '0 0 10px #00f0ff44'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isDisabled && !isSelected) {
                              const btn = e.currentTarget
                              btn.style.backgroundColor = '#050510'
                              btn.style.borderColor = '#00f0ff33'
                              btn.style.boxShadow = ''
                            }
                          }}
                        >
                          {choice}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* ── Free text input (shown when no MCQ) ── */}
                {!choices && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                      disabled={phase !== 'answering'}
                      placeholder="Type your answer..."
                      autoFocus={phase === 'answering'}
                      style={{
                        flex: 1,
                        fontFamily: 'var(--font-pixel), monospace',
                        fontSize: 'clamp(6px, 1.1vw, 8px)',
                        backgroundColor: '#000',
                        border: `1px solid ${phase === 'answering' ? '#00f0ff44' : '#111'}`,
                        color: '#fff',
                        padding: '9px 12px',
                        outline: 'none',
                        letterSpacing: 1,
                        caretColor: '#00f0ff',
                        transition: 'border-color 0.2s',
                      }}
                    />
                    <button
                      onClick={submitAnswer}
                      disabled={phase !== 'answering'}
                      style={{
                        fontFamily: 'var(--font-pixel), monospace',
                        fontSize: 'clamp(5px, 0.9vw, 7px)',
                        letterSpacing: 2,
                        color: phase === 'answering' ? '#000' : '#2a2a2a',
                        backgroundColor: phase === 'answering' ? '#FFD700' : '#0a0a0a',
                        border: 'none',
                        padding: '9px 18px',
                        cursor: phase === 'answering' ? 'pointer' : 'default',
                        boxShadow: phase === 'answering' ? '0 0 14px #FFD70066' : 'none',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                      }}
                    >
                      STRIKE
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
