'use client'

import { useReducer, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CombatChoice {
  id: string
  text: string
}

export interface WrongTaunt {
  answer: string
  taunt: string
}

export interface CombatQuestion {
  id: string
  difficulty: number        // 0–10
  question_text: string
  dialogue: string
  choices: CombatChoice[]
  correctAnswerId: string
  concept: string
  explanation: string                        // plain string (FRQ or fallback)
  explanations?: Record<string, string>      // per-choice map from backend {"A":..., "B":...}
  wrong_taunts: WrongTaunt[]
  question_type?: string    // 'free_response' or undefined/empty for MCQ
}

export type ItemRarity = 'basic' | 'rare' | 'epic' | 'legendary'

export type ItemEffect =
  // basic
  | 'eliminate_wrong'   // eliminate one random wrong answer
  | 'extend_time'       // add 20s to timer
  | 'shield'            // block next damage instance
  | 'double_damage'     // double boss damage this question
  | 'save_streak'       // preserve streak on next mistake
  | 'small_heal'        // restore 150 HP
  // rare
  | 'eliminate_two'     // eliminate two wrong answers
  | 'time_remover'      // disable the timer for this question — no timeout possible
  | 'shield_two'        // block next two damage instances
  | 'heal_medium'       // restore 300 HP
  // epic
  | 'reveal_answer'     // eliminate all wrong answers
  | 'triple_damage'     // triple boss damage this question
  | 'invincible'        // block next three damage instances
  // legendary
  | 'double_trouble'    // immediately grant two random epic items
  | 'full_restore'      // restore player to full HP immediately on use

export interface InventoryItem {
  id: string
  effect: ItemEffect
  label: string
  description: string
  rarity: ItemRarity
}

export interface ActiveEffect {
  type: string
  duration: number
}

export const PHASES = {
  LOADING:       'loading',
  ACTION_SELECT: 'action_select',   // choose attack or use item — timer not yet running
  ACTIVE:        'active',          // timer running, question visible
  ITEM_SELECT:   'item_select',     // inventory overlay (entered from ACTION_SELECT or ACTIVE)
  REVEAL:        'reveal',
  EXPLANATION:   'explanation',
  CASE_OPENING:  'case_opening',    // CS:GO-style reel animation after boss defeat
  GAME_OVER:     'game_over',
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
  correctStreak: number
  totalCorrect: number
  totalAttempted: number
  activeEffects: ActiveEffect[]
  inventory: InventoryItem[]
  eliminatedChoices: string[]
  timerDisabled: boolean                // set by time_remover — skips TICK for this question
  timerFrozen: boolean                  // true while FRQ judging is in-flight — pauses countdown
  _timeoutPending: boolean
  pendingReward:      InventoryItem | null   // item being shown in case-opening reel
  itemSelectReturnTo: Phase | null           // where CLOSE_ITEM_SELECT / USE_ITEM returns to
}

// ─── Item pool ────────────────────────────────────────────────────────────────
// Items are grouped by rarity. selectRandomItem() picks a rarity tier by
// weighted roll, then picks uniformly within that tier.
//
// Rarity distribution:
//   basic      60%  →  6 items × 10.00% each
//   rare       25%  →  4 items ×  6.25% each
//   epic       12.5%→  3 items ×  4.17% each
//   legendary   2.5%→  2 items ×  1.25% each

export const MAX_INVENTORY = 3

type ItemTemplate = Omit<InventoryItem, 'id'>

const ITEM_POOL: ItemTemplate[] = [
  // ── basic ─────────────────────────────────────────────────────────────────
  { effect: 'eliminate_wrong', label: 'Hint',          rarity: 'basic', description: 'Eliminate one random wrong answer' },
  { effect: 'extend_time',     label: 'Extra Time',    rarity: 'basic', description: 'Add 20 seconds to the timer' },
  { effect: 'shield',          label: 'Shield',        rarity: 'basic', description: 'Block the next instance of damage' },
  { effect: 'double_damage',   label: 'Power Strike',  rarity: 'basic', description: 'Double boss damage for this question' },
  { effect: 'save_streak',     label: 'Streak Guard',  rarity: 'basic', description: 'Preserve your streak on your next mistake' },
  { effect: 'small_heal',      label: 'Small Potion',  rarity: 'basic', description: 'Restore 150 HP' },

  // ── rare ──────────────────────────────────────────────────────────────────
  { effect: 'eliminate_two',   label: 'Double Hint',    rarity: 'rare',      description: 'Eliminate two random wrong answers' },
  { effect: 'time_remover',    label: 'Stopwatch',      rarity: 'rare',      description: 'Disable the timer for this question — no timeout' },
  { effect: 'shield_two',      label: 'Iron Wall',      rarity: 'rare',      description: 'Block the next two instances of damage' },
  { effect: 'heal_medium',     label: 'Medium Potion',  rarity: 'rare',      description: 'Restore 300 HP' },

  // ── epic ──────────────────────────────────────────────────────────────────
  { effect: 'reveal_answer',   label: 'Oracle',         rarity: 'epic',      description: 'Eliminate all wrong answers' },
  { effect: 'triple_damage',   label: 'Critical Strike',rarity: 'epic',      description: 'Triple boss damage for this question' },
  { effect: 'invincible',      label: 'Aegis',          rarity: 'epic',      description: 'Block the next three instances of damage' },

  // ── legendary ─────────────────────────────────────────────────────────────
  { effect: 'double_trouble',  label: 'Double Trouble', rarity: 'legendary', description: 'Immediately receive two random epic items' },
  { effect: 'full_restore',    label: 'Phoenix',        rarity: 'legendary', description: 'Restore yourself to full HP immediately' },
]

// Rarity thresholds (cumulative, checked from rarest to most common)
// legendary: 0–2.5, epic: 2.5–15, rare: 15–40, basic: 40–100
export function selectRandomItem(): InventoryItem {
  const roll = Math.random() * 100

  let rarity: ItemRarity
  if      (roll < 2.5)  rarity = 'legendary'
  else if (roll < 15)   rarity = 'epic'
  else if (roll < 40)   rarity = 'rare'
  else                  rarity = 'basic'

  const pool = ITEM_POOL.filter(item => item.rarity === rarity)
  const template = pool[Math.floor(Math.random() * pool.length)]

  return { ...template, id: `${template.effect}_${Date.now()}_${Math.random().toString(36).slice(2)}` }
}

// Picks one random epic item — used by double_trouble
function selectRandomEpicItem(): InventoryItem {
  const pool = ITEM_POOL.filter(item => item.rarity === 'epic')
  const template = pool[Math.floor(Math.random() * pool.length)]
  return { ...template, id: `${template.effect}_${Date.now()}_${Math.random().toString(36).slice(2)}` }
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

// Persistent cross-battle inventory
const INVENTORY_KEY = 'player_inventory'

export function saveItemToPlayerInventory(item: InventoryItem): boolean {
  try {
    const existing = loadPlayerInventory()
    if (existing.length >= MAX_INVENTORY) return false
    localStorage.setItem(INVENTORY_KEY, JSON.stringify([...existing, item]))
    return true
  } catch { return false }
}

export function loadPlayerInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY)
    return raw ? (JSON.parse(raw) as InventoryItem[]) : []
  } catch { return [] }
}

// Key used by the reward page to read what was earned
const REWARD_KEY = 'combat_pending_reward'

// Called on win — writes the reward item so the reward page can read it
function saveRewardToStorage(item: InventoryItem): void {
  try {
    localStorage.setItem(REWARD_KEY, JSON.stringify(item))
  } catch {
    // localStorage unavailable (SSR, private browsing) — silently ignore
  }
}

// Called by the reward page to read and clear the stored reward
export function claimStoredReward(): InventoryItem | null {
  try {
    const raw = localStorage.getItem(REWARD_KEY)
    if (!raw) return null
    localStorage.removeItem(REWARD_KEY)
    return JSON.parse(raw) as InventoryItem
  } catch {
    return null
  }
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

function clampHP(hp: number) { return Math.max(0, hp) }

function checkGameOver(state: CombatState) {
  return state.playerHP <= 0 || state.bossHP <= 0
}

// Consumes ONE instance of effectType from activeEffects (not all of them).
// This allows stacked effects (e.g. two shields from iron_wall) to each block separately.
function consumeEffect(state: CombatState, type: string): { state: CombatState; triggered: boolean } {
  const index = state.activeEffects.findIndex(e => e.type === type)
  if (index === -1) return { state, triggered: false }
  return {
    triggered: true,
    state: {
      ...state,
      activeEffects: [
        ...state.activeEffects.slice(0, index),
        ...state.activeEffects.slice(index + 1),
      ],
    },
  }
}

function applyItem(state: CombatState, item: InventoryItem): CombatState {
  const withoutItem: CombatState = { ...state, inventory: state.inventory.filter(i => i.id !== item.id) }

  switch (item.effect) {

    // ── basic ───────────────────────────────────────────────────────────────

    case 'eliminate_wrong': {
      if (!state.currentQuestion) return state
      const wrong = state.currentQuestion.choices
        .filter(c => c.id !== state.currentQuestion!.correctAnswerId)
        .map(c => c.id)
      const pick = wrong[Math.floor(Math.random() * wrong.length)]
      return { ...withoutItem, eliminatedChoices: [...state.eliminatedChoices, pick] }
    }

    case 'extend_time':
      return { ...withoutItem, timeRemaining: Math.min(state.timeRemaining + 20000, state.totalTime) }

    case 'shield':
      return { ...withoutItem, activeEffects: [...state.activeEffects, { type: 'shield', duration: 1 }] }

    case 'double_damage':
      return {
        ...withoutItem,
        bossDamageOnCorrect: state.bossDamageOnCorrect * 2,
        activeEffects: [...state.activeEffects, { type: 'double_damage', duration: 1 }],
      }

    case 'save_streak':
      return { ...withoutItem, activeEffects: [...state.activeEffects, { type: 'save_streak', duration: 1 }] }

    case 'small_heal':
      return { ...withoutItem, playerHP: Math.min(state.playerHP + 150, state.playerMaxHP) }

    // ── rare ────────────────────────────────────────────────────────────────

    case 'eliminate_two': {
      if (!state.currentQuestion) return state
      const wrong = state.currentQuestion.choices
        .filter(c => c.id !== state.currentQuestion!.correctAnswerId)
        .map(c => c.id)
      // shuffle and take two
      const shuffled = wrong.sort(() => Math.random() - 0.5).slice(0, 2)
      return { ...withoutItem, eliminatedChoices: [...state.eliminatedChoices, ...shuffled] }
    }

    case 'time_remover':
      // disables TICK for this question — timer freezes, timeout can never fire
      return { ...withoutItem, timerDisabled: true }

    case 'shield_two':
      // adds two shield charges — each blocks one damage instance separately
      return {
        ...withoutItem,
        activeEffects: [
          ...state.activeEffects,
          { type: 'shield', duration: 1 },
          { type: 'shield', duration: 1 },
        ],
      }

    case 'heal_medium':
      return { ...withoutItem, playerHP: Math.min(state.playerHP + 300, state.playerMaxHP) }

    // ── epic ────────────────────────────────────────────────────────────────

    case 'reveal_answer': {
      if (!state.currentQuestion) return state
      const allWrong = state.currentQuestion.choices
        .filter(c => c.id !== state.currentQuestion!.correctAnswerId)
        .map(c => c.id)
      return { ...withoutItem, eliminatedChoices: [...state.eliminatedChoices, ...allWrong] }
    }

    case 'triple_damage':
      return {
        ...withoutItem,
        bossDamageOnCorrect: state.bossDamageOnCorrect * 3,
        activeEffects: [...state.activeEffects, { type: 'triple_damage', duration: 1 }],
      }

    case 'invincible':
      // adds three shield charges — blocks wrong answer, timeout, and one more
      return {
        ...withoutItem,
        activeEffects: [
          ...state.activeEffects,
          { type: 'shield', duration: 1 },
          { type: 'shield', duration: 1 },
          { type: 'shield', duration: 1 },
        ],
      }

    // ── legendary ───────────────────────────────────────────────────────────

    case 'double_trouble': {
      const epicA = selectRandomEpicItem()
      const epicB = selectRandomEpicItem()
      const slots  = MAX_INVENTORY - withoutItem.inventory.length
      const toAdd  = [epicA, epicB].slice(0, Math.max(0, slots))
      return { ...withoutItem, inventory: [...withoutItem.inventory, ...toAdd] }
    }

    case 'full_restore':
      // applies immediately
      return { ...withoutItem, playerHP: state.playerMaxHP }

    default:
      return state
  }
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'LOAD_QUESTION'; payload: { question: CombatQuestion } }
  | { type: 'SUBMIT_ANSWER'; payload: { answerId: string } }
  | { type: 'SUBMIT_FREE_RESPONSE'; payload: { isCorrect: boolean } }
  | { type: 'TIMEOUT' }
  | { type: 'TICK'; payload: { delta: number } }
  | { type: 'REVEAL_COMPLETE' }
  | { type: 'EXPLANATION_OK' }
  | { type: 'USE_ITEM'; payload: { item: InventoryItem } }
  | { type: 'OPEN_ITEM_SELECT' }
  | { type: 'CLOSE_ITEM_SELECT' }
  | { type: 'SELECT_ATTACK' }
  | { type: 'CASE_COMPLETE' }
  | { type: 'FORCE_GAME_OVER' }
  | { type: 'FREEZE_TIMER' }
  | { type: 'UNFREEZE_TIMER' }
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
        timerDisabled:         false,   // reset each question — time_remover only lasts one question
        timerFrozen:           false,   // reset each question — unfreeze after any previous FRQ judging
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
        phase:          PHASES.REVEAL,
        selectedAnswer: action.payload.answerId,
        isCorrect,
        totalAttempted: state.totalAttempted + 1,
      }

      if (isCorrect) {
        next.bossHP       = clampHP(next.bossHP - next.bossDamageOnCorrect)
        next.totalCorrect = state.totalCorrect + 1
        next.correctStreak = state.correctStreak + 1
        // consume damage multiplier markers (value already applied on item use)
        const { state: after1 } = consumeEffect(next, 'double_damage')
        next = after1
        const { state: after2 } = consumeEffect(next, 'triple_damage')
        next = after2
      } else {
        // shield check
        const { triggered, state: afterShield } = consumeEffect(next, 'shield')
        next = triggered ? afterShield : { ...next, playerHP: clampHP(next.playerHP - next.playerDamageOnWrong) }
        // streak check
        const { triggered: streakSaved, state: afterStreak } = consumeEffect(next, 'save_streak')
        next = streakSaved ? afterStreak : { ...next, correctStreak: 0 }
      }

      return next
    }

    case 'SUBMIT_FREE_RESPONSE': {
      const isCorrect = action.payload.isCorrect
      let next: CombatState = {
        ...state,
        phase:          PHASES.REVEAL,
        selectedAnswer: '__frq__',
        isCorrect,
        totalAttempted: state.totalAttempted + 1,
      }
      if (isCorrect) {
        next.bossHP        = clampHP(next.bossHP - next.bossDamageOnCorrect)
        next.totalCorrect  = state.totalCorrect + 1
        next.correctStreak = state.correctStreak + 1
        const { state: after1 } = consumeEffect(next, 'double_damage')
        next = after1
        const { state: after2 } = consumeEffect(next, 'triple_damage')
        next = after2
      } else {
        const { triggered, state: afterShield } = consumeEffect(next, 'shield')
        next = triggered ? afterShield : { ...next, playerHP: clampHP(next.playerHP - next.playerDamageOnWrong) }
        const { triggered: streakSaved, state: afterStreak } = consumeEffect(next, 'save_streak')
        next = streakSaved ? afterStreak : { ...next, correctStreak: 0 }
      }
      return next
    }

    case 'TIMEOUT': {
      // does NOT reset streak — timeout is not a wrong answer
      let next: CombatState = { ...state, timeRemaining: state.totalTime, _timeoutPending: false }
      const { triggered, state: afterShield } = consumeEffect(next, 'shield')
      next = triggered ? afterShield : { ...next, playerHP: clampHP(next.playerHP - next.playerDamageOnTimeout) }
      return checkGameOver(next) ? { ...next, phase: PHASES.GAME_OVER } : next
    }

    case 'TICK': {
      // if time_remover is active, freeze the timer entirely — no countdown, no timeout
      if (state.timerDisabled || state.timerFrozen) return state
      const next = { ...state, timeRemaining: Math.max(0, state.timeRemaining - action.payload.delta) }
      return next.timeRemaining === 0 && state.phase === PHASES.ACTIVE
        ? { ...next, _timeoutPending: true }
        : next
    }

    case 'REVEAL_COMPLETE':
      return { ...state, phase: PHASES.EXPLANATION }

    case 'EXPLANATION_OK': {
      if (checkGameOver(state)) {
        const playerWon = state.bossHP <= 0
        if (playerWon) {
          // roll item and enter case-opening reel — CASE_COMPLETE saves it and moves to GAME_OVER
          const reward = selectRandomItem()
          return { ...state, phase: PHASES.CASE_OPENING, pendingReward: reward }
        }
        return { ...state, phase: PHASES.GAME_OVER }
      }
      return { ...state, phase: PHASES.LOADING, questionIndex: state.questionIndex + 1 }
    }

    case 'USE_ITEM':
      return state.phase !== PHASES.ACTIVE ? state : applyItem(state, action.payload.item)

    case 'OPEN_ITEM_SELECT':
      if (state.phase !== PHASES.ACTIVE && state.phase !== PHASES.ACTION_SELECT) return state
      return { ...state, phase: PHASES.ITEM_SELECT, itemSelectReturnTo: state.phase }

    case 'CLOSE_ITEM_SELECT':
      if (state.phase !== PHASES.ITEM_SELECT) return state
      return { ...state, phase: state.itemSelectReturnTo ?? PHASES.ACTIVE, itemSelectReturnTo: null }

    case 'SELECT_ATTACK':
      return state.phase === PHASES.ACTION_SELECT ? { ...state, phase: PHASES.ACTIVE } : state

    case 'CASE_COMPLETE':
      return { ...state, phase: PHASES.GAME_OVER, pendingReward: null }

    case 'FORCE_GAME_OVER':
      return { ...state, phase: PHASES.GAME_OVER }

    case 'FREEZE_TIMER':
      return { ...state, timerFrozen: true }

    case 'UNFREEZE_TIMER':
      return { ...state, timerFrozen: false }

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
    phase:                 PHASES.LOADING,
    playerHP:              playerMaxHP,
    playerMaxHP,
    bossHP:                bossMaxHP,
    bossMaxHP,
    currentQuestion:       null,
    questionIndex:         0,
    selectedAnswer:        null,
    isCorrect:             null,
    timeRemaining:         60000,
    totalTime:             60000,
    playerDamageOnWrong:   200,
    playerDamageOnTimeout: 150,
    bossDamageOnCorrect:   100,
    correctStreak:         0,
    totalCorrect:          0,
    totalAttempted:        0,
    activeEffects:         [],
    inventory:             initialInventory,
    eliminatedChoices:     [],
    timerDisabled:         false,
    timerFrozen:           false,
    _timeoutPending:       false,
    pendingReward:         null,
    itemSelectReturnTo:    null,
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
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(state.inventory))
    } catch {
      // ignore private mode / storage failure
    }
  }, [state.inventory])

  useEffect(() => {
    if (state.phase !== PHASES.LOADING) return
    const next = questions[state.questionIndex]
    if (next) dispatch({ type: 'LOAD_QUESTION', payload: { question: next } })
    else dispatch({ type: 'FORCE_GAME_OVER' })
  }, [state.phase, state.questionIndex, questions])

  const submitAnswer         = useCallback((id: string)             => dispatch({ type: 'SUBMIT_ANSWER',        payload: { answerId: id } }), [])
  const submitFreeResponse   = useCallback((isCorrect: boolean)    => dispatch({ type: 'SUBMIT_FREE_RESPONSE', payload: { isCorrect } }), [])
  const revealComplete  = useCallback(()                        => dispatch({ type: 'REVEAL_COMPLETE' }), [])
  const explanationOK   = useCallback(()                        => dispatch({ type: 'EXPLANATION_OK' }), [])
  const useItem         = useCallback((item: InventoryItem)     => dispatch({ type: 'USE_ITEM',        payload: { item } }), [])
  const openItemSelect  = useCallback(()                        => dispatch({ type: 'OPEN_ITEM_SELECT' }), [])
  const closeItemSelect = useCallback(()                        => dispatch({ type: 'CLOSE_ITEM_SELECT' }), [])
  const selectAttack    = useCallback(()                        => dispatch({ type: 'SELECT_ATTACK' }), [])
  const caseComplete    = useCallback(()                        => dispatch({ type: 'CASE_COMPLETE' }), [])
  const pauseTimer      = useCallback(()                        => dispatch({ type: 'FREEZE_TIMER' }), [])
  const resumeTimer     = useCallback(()                        => dispatch({ type: 'UNFREEZE_TIMER' }), [])
  const debugSet        = useCallback((p: Partial<CombatState>) => {
    if (process.env.NODE_ENV === 'development') dispatch({ type: 'DEBUG_SET', payload: p })
  }, [])

  return {
    state,
    PHASES,
    submitAnswer,
    submitFreeResponse,
    revealComplete,
    explanationOK,
    useItem,
    openItemSelect,
    closeItemSelect,
    selectAttack,
    caseComplete,
    pauseTimer,
    resumeTimer,
    debugSet,
  }
}

export type UseCombatReturn = ReturnType<typeof useCombat>
