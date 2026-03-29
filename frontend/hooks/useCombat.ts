'use client'

import { useReducer, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CombatChoice {
  id: string
  text: string
}

export interface CombatQuestion {
  id: string
  difficulty: number        // 0–10
  question_text: string
  dialogue: string
  choices: CombatChoice[]
  correctAnswerId: string
  concept: string
  explanation: string
}

export interface InventoryItem {
  id: string
  effect: 'eliminate_wrong' | 'double_damage' | 'extend_time' | 'shield' | 'save_streak'
  label: string
}

export interface ActiveEffect {
  type: string
  duration: number
}

export const PHASES = {
  LOADING:     'loading',
  ACTIVE:      'active',
  ITEM_SELECT: 'item_select',
  REVEAL:      'reveal',
  EXPLANATION: 'explanation',
  GAME_OVER:   'game_over',
  REWARD:      'reward',
} as const

export type Phase = typeof PHASES[keyof typeof PHASES]

export interface CombatState {
  phase: Phase
  playerHP: number
  playerMaxHP: number
  bossHP: number
  bossMaxHP: number
  currentQuestion: CombatQuestion | null
  questionIndex: number
  selectedAnswer: string | null
  isCorrect: boolean | null
  timeRemaining: number
  totalTime: number
  playerDamageOnWrong: number
  playerDamageOnTimeout: number
  bossDamageOnCorrect: number
  currency: number
  correctStreak: number
  totalCorrect: number
  totalAttempted: number
  activeEffects: ActiveEffect[]
  inventory: InventoryItem[]
  eliminatedChoices: string[]
  _timeoutPending: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

export function scaleByDifficulty(difficulty: number) {
  const t = difficulty / 10
  return {
    timeMs:              Math.round(lerp(60000, 30000, t)),
    bossDamage:          Math.round(lerp(100, 250, t)),
    playerDamageWrong:   Math.round(lerp(200, 100, t)),
    playerDamageTimeout: Math.round(lerp(150, 80, t)),
  }
}

export function calculateReward(state: CombatState) {
  const baseReward  = state.totalCorrect * 10
  const streakBonus = state.correctStreak * 5
  const speedBonus  = Math.round((state.timeRemaining / state.totalTime) * 20)
  const winBonus    = state.bossHP <= 0 ? 50 : 0
  return baseReward + streakBonus + speedBonus + winBonus
}

function clampHP(hp: number) { return Math.max(0, hp) }

function checkGameOver(state: CombatState) {
  return state.playerHP <= 0 || state.bossHP <= 0
}

function consumeEffect(state: CombatState, type: string): { state: CombatState; triggered: boolean } {
  const has = state.activeEffects.some(e => e.type === type)
  if (!has) return { state, triggered: false }
  return {
    triggered: true,
    state: { ...state, activeEffects: state.activeEffects.filter(e => e.type !== type) },
  }
}

function applyItem(state: CombatState, item: InventoryItem): CombatState {
  const withoutItem = { ...state, inventory: state.inventory.filter(i => i.id !== item.id) }
  switch (item.effect) {
    case 'eliminate_wrong': {
      if (!state.currentQuestion) return state
      const wrong = state.currentQuestion.choices
        .filter(c => c.id !== state.currentQuestion!.correctAnswerId)
        .map(c => c.id)
      const pick = [wrong[Math.floor(Math.random() * wrong.length)]]
      return { ...withoutItem, eliminatedChoices: [...state.eliminatedChoices, ...pick] }
    }
    case 'double_damage':
      return { ...withoutItem, bossDamageOnCorrect: state.bossDamageOnCorrect * 2, activeEffects: [...state.activeEffects, { type: 'double_damage', duration: 1 }] }
    case 'extend_time':
      return { ...withoutItem, timeRemaining: Math.min(state.timeRemaining + 20000, state.totalTime) }
    case 'shield':
      return { ...withoutItem, activeEffects: [...state.activeEffects, { type: 'shield', duration: 1 }] }
    case 'save_streak':
      return { ...withoutItem, activeEffects: [...state.activeEffects, { type: 'save_streak', duration: 1 }] }
    default:
      return state
  }
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'LOAD_QUESTION'; payload: { question: CombatQuestion } }
  | { type: 'SUBMIT_ANSWER'; payload: { answerId: string } }
  | { type: 'TIMEOUT' }
  | { type: 'TICK'; payload: { delta: number } }
  | { type: 'REVEAL_COMPLETE' }
  | { type: 'EXPLANATION_OK' }
  | { type: 'USE_ITEM'; payload: { item: InventoryItem } }
  | { type: 'OPEN_ITEM_SELECT' }
  | { type: 'CLOSE_ITEM_SELECT' }
  | { type: 'FORCE_GAME_OVER' }
  | { type: 'DEBUG_SET'; payload: Partial<CombatState> }

function reducer(state: CombatState, action: Action): CombatState {
  switch (action.type) {
    case 'LOAD_QUESTION': {
      const scaled = scaleByDifficulty(action.payload.question.difficulty ?? 5)
      return {
        ...state,
        phase:                 PHASES.ACTIVE,
        currentQuestion:       action.payload.question,
        selectedAnswer:        null,
        isCorrect:             null,
        eliminatedChoices:     [],
        timeRemaining:         scaled.timeMs,
        totalTime:             scaled.timeMs,
        bossDamageOnCorrect:   scaled.bossDamage,
        playerDamageOnWrong:   scaled.playerDamageWrong,
        playerDamageOnTimeout: scaled.playerDamageTimeout,
      }
    }

    case 'SUBMIT_ANSWER': {
      const isCorrect = action.payload.answerId === state.currentQuestion?.correctAnswerId
      let next: CombatState = {
        ...state,
        phase: PHASES.REVEAL,
        selectedAnswer: action.payload.answerId,
        isCorrect,
        totalAttempted: state.totalAttempted + 1,
      }
      if (isCorrect) {
        next.bossHP = clampHP(next.bossHP - next.bossDamageOnCorrect)
        next.totalCorrect = state.totalCorrect + 1
        next.correctStreak = state.correctStreak + 1
        const { state: after } = consumeEffect(next, 'double_damage')
        next = after
      } else {
        const { triggered, state: afterShield } = consumeEffect(next, 'shield')
        next = triggered ? afterShield : { ...next, playerHP: clampHP(next.playerHP - next.playerDamageOnWrong) }
        const { triggered: streakSaved, state: afterStreak } = consumeEffect(next, 'save_streak')
        next = streakSaved ? afterStreak : { ...next, correctStreak: 0 }
      }
      return next
    }

    case 'TIMEOUT': {
      let next: CombatState = { ...state, timeRemaining: state.totalTime, _timeoutPending: false }
      const { triggered, state: afterShield } = consumeEffect(next, 'shield')
      next = triggered ? afterShield : { ...next, playerHP: clampHP(next.playerHP - next.playerDamageOnTimeout) }
      return checkGameOver(next) ? { ...next, phase: PHASES.GAME_OVER } : next
    }

    case 'TICK': {
      const next = { ...state, timeRemaining: Math.max(0, state.timeRemaining - action.payload.delta) }
      return next.timeRemaining === 0 && state.phase === PHASES.ACTIVE
        ? { ...next, _timeoutPending: true }
        : next
    }

    case 'REVEAL_COMPLETE':
      return { ...state, phase: PHASES.EXPLANATION }

    case 'EXPLANATION_OK':
      if (checkGameOver(state)) {
        return { ...state, phase: PHASES.GAME_OVER, currency: state.currency + calculateReward(state) }
      }
      return { ...state, phase: PHASES.LOADING, questionIndex: state.questionIndex + 1 }

    case 'USE_ITEM':
      return state.phase !== PHASES.ACTIVE ? state : applyItem(state, action.payload.item)

    case 'OPEN_ITEM_SELECT':
      return state.phase === PHASES.ACTIVE ? { ...state, phase: PHASES.ITEM_SELECT } : state

    case 'CLOSE_ITEM_SELECT':
      return state.phase === PHASES.ITEM_SELECT ? { ...state, phase: PHASES.ACTIVE } : state

    case 'FORCE_GAME_OVER':
      return { ...state, phase: PHASES.GAME_OVER }

    case 'DEBUG_SET':
      return { ...state, ...action.payload }

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseCombatOptions {
  questions?: CombatQuestion[]
  initialInventory?: InventoryItem[]
  playerMaxHP?: number
  bossMaxHP?: number
}

export function useCombat({
  questions = [],
  initialInventory = [],
  playerMaxHP = 1000,
  bossMaxHP = 2000,
}: UseCombatOptions = {}) {
  const [state, dispatch] = useReducer(reducer, {
    phase: PHASES.LOADING,
    playerHP: playerMaxHP,
    playerMaxHP,
    bossHP: bossMaxHP,
    bossMaxHP,
    currentQuestion: null,
    questionIndex: 0,
    selectedAnswer: null,
    isCorrect: null,
    timeRemaining: 60000,
    totalTime: 60000,
    playerDamageOnWrong: 200,
    playerDamageOnTimeout: 150,
    bossDamageOnCorrect: 100,
    currency: 0,
    correctStreak: 0,
    totalCorrect: 0,
    totalAttempted: 0,
    activeEffects: [],
    inventory: initialInventory,
    eliminatedChoices: [],
    _timeoutPending: false,
  } satisfies CombatState)

  const timerRef    = useRef<number | null>(null)
  const lastTickRef = useRef<number | null>(null)

  const startTimer = useCallback(() => {
    lastTickRef.current = performance.now()
    timerRef.current = requestAnimationFrame(function tick(now) {
      dispatch({ type: 'TICK', payload: { delta: now - (lastTickRef.current ?? now) } })
      lastTickRef.current = now
      timerRef.current = requestAnimationFrame(tick)
    })
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current != null) cancelAnimationFrame(timerRef.current)
  }, [])

  useEffect(() => {
    if (state.phase === PHASES.ACTIVE) startTimer()
    else stopTimer()
    return stopTimer
  }, [state.phase, startTimer, stopTimer])

  useEffect(() => {
    if (state._timeoutPending) dispatch({ type: 'TIMEOUT' })
  }, [state._timeoutPending])

  useEffect(() => {
    if (state.phase !== PHASES.LOADING) return
    const next = questions[state.questionIndex]
    if (next) dispatch({ type: 'LOAD_QUESTION', payload: { question: next } })
    else dispatch({ type: 'FORCE_GAME_OVER' })
  }, [state.phase, state.questionIndex, questions])

  const submitAnswer    = useCallback((id: string)           => dispatch({ type: 'SUBMIT_ANSWER',   payload: { answerId: id } }), [])
  const revealComplete  = useCallback(()                      => dispatch({ type: 'REVEAL_COMPLETE' }), [])
  const explanationOK   = useCallback(()                      => dispatch({ type: 'EXPLANATION_OK' }), [])
  const useItem         = useCallback((item: InventoryItem)   => dispatch({ type: 'USE_ITEM',        payload: { item } }), [])
  const openItemSelect  = useCallback(()                      => dispatch({ type: 'OPEN_ITEM_SELECT' }), [])
  const closeItemSelect = useCallback(()                      => dispatch({ type: 'CLOSE_ITEM_SELECT' }), [])
  const debugSet        = useCallback((p: Partial<CombatState>) => {
    if (process.env.NODE_ENV === 'development') dispatch({ type: 'DEBUG_SET', payload: p })
  }, [])

  return { state, PHASES, submitAnswer, revealComplete, explanationOK, useItem, openItemSelect, closeItemSelect, debugSet }
}

export type UseCombatReturn = ReturnType<typeof useCombat>
