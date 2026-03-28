'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface Concept {
  id: string
  name: string
  summary: string
  difficulty: 'basic' | 'intermediate' | 'advanced'
  related_concepts: string[]
  has_diagram: boolean
}

export interface BossCluster {
  clusterId: string
  clusterName: string
  concepts: Concept[]
}

export interface Boss {
  clusterId: string
  name: string
  personality: string
  backstory: string
  opening_monologue: string
  taunts: Record<string, string>
  sprite_category: string
  max_hp: number
}

export interface QuestionResult {
  question: string
  playerAnswer: string
  correct: boolean
  explanation: string
  conceptName: string
  damage: number
  playerDamage: number
}

export interface GameState {
  bossRush: BossCluster[]
  bosses: Boss[]
  totalBosses: number
  currentBossIndex: number
  currentBoss: Boss | null
  currentCluster: BossCluster | null
  playerHP: number
  bossHP: number
  weakSpots: string[]
  questionsAsked: string[]
  turn: number
  difficulty: 'easy' | 'normal' | 'hard'
  score: number
  lastBossResults: QuestionResult[]

  initGame: (bossRush: BossCluster[], bosses: Boss[]) => void
  advanceToNextBoss: () => void
  damagePlayer: (amount: number) => void
  damageBoss: (amount: number) => void
  addWeakSpot: (conceptId: string) => void
  addQuestionAsked: (conceptId: string) => void
  addQuestionResult: (result: QuestionResult) => void
  clearLastBossResults: () => void
  incrementTurn: () => void
  addScore: (points: number) => void
  resetGame: () => void
}

const GameContext = createContext<GameState | null>(null)

const PLAYER_MAX_HP = 300

export function GameProvider({ children }: { children: ReactNode }) {
  const [bossRush, setBossRush] = useState<BossCluster[]>([])
  const [bosses, setBosses] = useState<Boss[]>([])
  const [currentBossIndex, setCurrentBossIndex] = useState(0)
  const [playerHP, setPlayerHP] = useState(PLAYER_MAX_HP)
  const [bossHP, setBossHP] = useState(0)
  const [weakSpots, setWeakSpots] = useState<string[]>([])
  const [questionsAsked, setQuestionsAsked] = useState<string[]>([])
  const [turn, setTurn] = useState(0)
  const [difficulty] = useState<'easy' | 'normal' | 'hard'>('normal')
  const [score, setScore] = useState(0)
  const [lastBossResults, setLastBossResults] = useState<QuestionResult[]>([])

  // Auto-init with mock data so all pages work on direct navigation in mock mode
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MOCK !== 'true' || bosses.length > 0) return
    const MOCK_BOSS_RUSH: BossCluster[] = [
      { clusterId: 'c1', clusterName: 'Photosynthesis', concepts: [
        { id: 'p1', name: 'Light Reactions', summary: 'Convert light to ATP', difficulty: 'basic', related_concepts: [], has_diagram: false },
        { id: 'p2', name: 'Calvin Cycle', summary: 'Fixes CO2 into sugar', difficulty: 'intermediate', related_concepts: [], has_diagram: false },
      ]},
      { clusterId: 'c2', clusterName: "Newton's Laws", concepts: [
        { id: 'n1', name: 'Inertia', summary: 'Objects resist changes in motion', difficulty: 'basic', related_concepts: [], has_diagram: false },
        { id: 'n2', name: 'F = ma', summary: 'Force equals mass times acceleration', difficulty: 'intermediate', related_concepts: [], has_diagram: false },
      ]},
      { clusterId: 'c3', clusterName: 'World War II', concepts: [
        { id: 'w1', name: 'D-Day', summary: 'Allied invasion of Normandy, June 1944', difficulty: 'intermediate', related_concepts: [], has_diagram: false },
      ]},
    ]
    const MOCK_BOSSES: Boss[] = [
      { clusterId: 'c1', name: 'Chlorophyll Rex', personality: 'smug plant overlord', backstory: 'A mutant chloroplast.', opening_monologue: 'You dare challenge me? I have been converting sunlight into pure power for millennia!', taunts: {}, sprite_category: 'science', max_hp: 300 },
      { clusterId: 'c2', name: 'Sir Isaac Nightmare', personality: 'pompous physicist ghost', backstory: 'The vengeful spirit of a failed physicist.', opening_monologue: 'What goes up must come down — and so shall your grade!', taunts: {}, sprite_category: 'math', max_hp: 350 },
      { clusterId: 'c3', name: 'Kaiser Von Memorex', personality: 'dramatic historian warlord', backstory: 'An ancient general who lost every battle.', opening_monologue: 'History is written by the victors — and today, I am the victor!', taunts: {}, sprite_category: 'history', max_hp: 400 },
    ]
    setBossRush(MOCK_BOSS_RUSH)
    setBosses(MOCK_BOSSES)
    setBossHP(MOCK_BOSSES[0].max_hp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentBoss = bosses[currentBossIndex] ?? null
  const currentCluster = bossRush[currentBossIndex] ?? null
  const totalBosses = bosses.length

  const initGame = (newBossRush: BossCluster[], newBosses: Boss[]) => {
    setBossRush(newBossRush)
    setBosses(newBosses)
    setCurrentBossIndex(0)
    setPlayerHP(PLAYER_MAX_HP)
    setBossHP(newBosses[0]?.max_hp ?? 0)
    setWeakSpots([])
    setQuestionsAsked([])
    setTurn(0)
    setScore(0)
    setLastBossResults([])
  }

  const advanceToNextBoss = () => {
    const nextIdx = currentBossIndex + 1
    setCurrentBossIndex(nextIdx)
    setBossHP(bosses[nextIdx]?.max_hp ?? 0)
    setWeakSpots([])
    setQuestionsAsked([])
    setTurn(0)
  }

  const damagePlayer = (amount: number) =>
    setPlayerHP((hp) => Math.max(0, hp - amount))

  const damageBoss = (amount: number) =>
    setBossHP((hp) => Math.max(0, hp - amount))

  const addWeakSpot = (conceptId: string) =>
    setWeakSpots((ws) => [...ws, conceptId])

  const addQuestionAsked = (conceptId: string) =>
    setQuestionsAsked((qa) => [...qa, conceptId])

  const addQuestionResult = (result: QuestionResult) =>
    setLastBossResults((prev) => [...prev, result])

  const clearLastBossResults = () => setLastBossResults([])

  const incrementTurn = () => setTurn((t) => t + 1)

  const addScore = (points: number) => setScore((s) => s + points)

  const resetGame = () => {
    setBossRush([])
    setBosses([])
    setCurrentBossIndex(0)
    setPlayerHP(PLAYER_MAX_HP)
    setBossHP(0)
    setWeakSpots([])
    setQuestionsAsked([])
    setTurn(0)
    setScore(0)
    setLastBossResults([])
  }

  return (
    <GameContext.Provider value={{
      bossRush, bosses, totalBosses,
      currentBossIndex, currentBoss, currentCluster,
      playerHP, bossHP, weakSpots, questionsAsked,
      turn, difficulty, score, lastBossResults,
      initGame, advanceToNextBoss,
      damagePlayer, damageBoss,
      addWeakSpot, addQuestionAsked,
      addQuestionResult, clearLastBossResults,
      incrementTurn, addScore, resetGame,
    }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used inside GameProvider')
  return ctx
}

export const PLAYER_MAX_HP_VALUE = PLAYER_MAX_HP
