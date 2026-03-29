import { useReducer, useEffect, useRef, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES = {
  LOADING:     'loading',
  ACTIVE:      'active',
  ITEM_SELECT: 'item_select',
  REVEAL:      'reveal',
  EXPLANATION: 'explanation',
  GAME_OVER:   'game_over',
  REWARD:      'reward',
};

const INITIAL_STATE = {
  phase: PHASES.LOADING,

  playerHP:    1000,
  playerMaxHP: 1000,
  bossHP:      2000,
  bossMaxHP:   2000,

  currentQuestion:  null,
  questionIndex:    0,
  selectedAnswer:   null,
  isCorrect:        null,

  timeRemaining:          60000, // unit: milliseconds, so 60,000 = 60 seconds
  totalTime:              60000,
  playerDamageOnWrong:    200,
  playerDamageOnTimeout:  150,
  bossDamageOnCorrect:    100,

  currency:       0,
  correctStreak:  0,
  totalCorrect:   0,
  totalAttempted: 0,

  activeEffects:    [],
  inventory:        [],
  eliminatedChoices: [],
};

// ─── Difficulty scaling ───────────────────────────────────────────────────────
// This function takes a difficulty level (0-10) and returns scaled parameters for the combat, 
// such as time limits and damage values.

// linear interpolation: scales difficulty based on min and max.
function lerp(a, b, t) {
  const clamped = Math.max(0, Math.min(1, t));
  return a + (b - a) * clamped;
}

export function scaleByDifficulty(difficulty) {
  const t = difficulty / 10; // receives difficulty as 0-10, convert to 0.0-1.0

  return {
    timeMs:              Math.round(lerp(60000, 30000, t)),
    bossDamage:          Math.round(lerp(100, 250, t)),
    playerDamageWrong:   Math.round(lerp(200, 100, t)),
    playerDamageTimeout: Math.round(lerp(150, 80, t)),
  };
}

// ─── Reward calculation ───────────────────────────────────────────────────────
// This funciton is used for calculating the player's reward at the end of the combat, based on their performance.
// FIXME: reward is calculated after every question. Player should be able to use shop mid-round

export function calculateReward(state) {
  const baseReward   = state.totalCorrect * 10;
  const streakBonus  = state.correctStreak * 5;
  const speedBonus   = Math.round((state.timeRemaining / state.totalTime) * 20);
  const winBonus     = state.bossHP <= 0 ? 50 : 0;
  return baseReward + streakBonus + speedBonus + winBonus;
}

// ─── Item effects ─────────────────────────────────────────────────────────────

function applyItemEffect(state, item) {
  switch (item.effect) {
    case 'eliminate_wrong': {
      // eliminates one random wrong choice for the current question — adds it to eliminatedChoices array in state
      const wrongChoices = state.currentQuestion.choices
        .filter(c => c.id !== state.currentQuestion.correctAnswerId)
        .map(c => c.id);
      const randomIndex = Math.floor(Math.random() * wrongChoices.length);
      const toEliminate = [wrongChoices[randomIndex]];

      return {
        ...state,
        eliminatedChoices: [...state.eliminatedChoices, ...toEliminate],
        inventory: state.inventory.filter(i => i.id !== item.id),
      };
    }

    case 'double_damage':
      // doubles boss damage for the current question.
      // implemented by adding a temporary effect and checking for it when calculating damage on correct answer
      return {
        ...state,
        bossDamageOnCorrect: state.bossDamageOnCorrect * 2,
        activeEffects: [...state.activeEffects, { type: 'double_damage', duration: 1 }],
        inventory: state.inventory.filter(i => i.id !== item.id),
      };
    
    case 'extend_time':
      // adds 20 seconds to the timer for the current question, up to the original totalTime limit
      return {
        ...state,
        timeRemaining: Math.min(state.timeRemaining + 20000, state.totalTime),
        inventory: state.inventory.filter(i => i.id !== item.id),
      };

    case 'shield': 
      // negate next form of damage: wrong answer or timeout. 
      // Implemented by adding a temporary effect and checking for it when calculating damage on wrong answer or timeout.
      return {
        ...state,
        activeEffects: [...state.activeEffects, { type: 'shield', duration: 1 }],
        inventory: state.inventory.filter(i => i.id !== item.id),
      };

    case 'save_streak':
      // saves the current correct streak — if the player gets a question wrong, instead of resetting to 0, it resets to the saved value. 
      // Implemented by adding a temporary effect with the saved streak value, and checking for it when calculating next state on wrong answer.
      return {
        ...state,
        activeEffects: [...state.activeEffects, { type: 'save_streak', duration: 1 }],
        inventory: state.inventory.filter(i => i.id !== item.id),
      };

    default:
      return state;
  }
}

// ─── HP helpers ───────────────────────────────────────────────────────────────

function clampHP(hp) {
  // health can never go down below 0.
  return Math.max(0, hp);
}

function checkGameOver(state) {
  // checks if the game is over
  return state.playerHP <= 0 || state.bossHP <= 0;
}

function consumeOneTimeEffects(state, effectType) {
  // if a one-time effect item is active, consume it and return triggered=true. 
  // Otherwise return triggered=false and original state.
  const hasEffect = state.activeEffects.some(e => e.type === effectType);
  if (!hasEffect) return { state, triggered: false };
  return {
    triggered: true,
    state: {
      ...state,
      activeEffects: state.activeEffects.filter(e => e.type !== effectType),
    },
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function combatReducer(state, action) {
  switch (action.type) {

    case 'LOAD_QUESTION': {
      const { question } = action.payload;
      const scaled = scaleByDifficulty(question.difficulty ?? 5);
      return {
        ...state,
        phase:                  PHASES.ACTIVE,
        currentQuestion:        question,
        selectedAnswer:         null,
        isCorrect:              null,
        eliminatedChoices:      [],
        timeRemaining:          scaled.timeMs,
        totalTime:              scaled.timeMs,
        bossDamageOnCorrect:    scaled.bossDamage,
        playerDamageOnWrong:    scaled.playerDamageWrong,
        playerDamageOnTimeout:  scaled.playerDamageTimeout,
      };
    }

    case 'SUBMIT_ANSWER': {
      const { answerId } = action.payload;
      const isCorrect = answerId === state.currentQuestion.correctAnswerId;

      let next = {
        ...state,
        phase:          PHASES.REVEAL,
        selectedAnswer: answerId,
        isCorrect,
        totalAttempted: state.totalAttempted + 1,
      };

      if (isCorrect) {
        next.bossHP        = clampHP(next.bossHP - next.bossDamageOnCorrect);
        next.totalCorrect  = state.totalCorrect + 1;
        next.correctStreak = state.correctStreak + 1;
        // consume double_damage effect
        const { state: afterEffect } = consumeOneTimeEffects(next, 'double_damage');
        next = afterEffect;
      } else {
      // check for shield
      const { triggered, state: afterShield } = consumeOneTimeEffects(next, 'shield');
      if (triggered) {
        next = afterShield;
      } else {
        next.playerHP = clampHP(next.playerHP - next.playerDamageOnWrong);
      }

      // check for save_streak effect
      const { triggered: streakSaved, state: afterStreakSave } = consumeOneTimeEffects(next, 'save_streak');
      if (streakSaved) {
        next = afterStreakSave;
      } else {
        next.correctStreak = 0;
      }
      }

      return next;
    }

    case 'TIMEOUT': {
      // player takes damage but question does NOT advance — same question repeats
      let next = {
        ...state,
        timeRemaining: state.totalTime,
        _timeoutPending: false // reset flag
    };

      const { triggered, state: afterShield } = consumeOneTimeEffects(next, 'shield');
      
      // if shield is active, consume it and negate damage. Otherwise, apply timeout damage to player.
      if (triggered) {
            next = afterShield;
      } else {
            next.playerHP = clampHP(next.playerHP - next.playerDamageOnTimeout);
      }

      if (checkGameOver(next)) {
        return { ...next, phase: PHASES.GAME_OVER };
      }
      return next;
    }

    case 'TICK': {
      const next = { ...state, timeRemaining: Math.max(0, state.timeRemaining - action.payload.delta) };
      if (next.timeRemaining === 0 && state.phase === PHASES.ACTIVE) {
        // let TIMEOUT action handle the damage — this just signals the hook
        return { ...next, _timeoutPending: true };
      }
      return next;
    }

    case 'REVEAL_COMPLETE': {
      return { ...state, phase: PHASES.EXPLANATION };
    }

    case 'EXPLANATION_OK': {
      if (checkGameOver(state)) {
        const reward = calculateReward(state);
        return { ...state, phase: PHASES.GAME_OVER, currency: state.currency + reward };
      }
      return { ...state, phase: PHASES.LOADING, questionIndex: state.questionIndex + 1 };
    }

    case 'USE_ITEM': {
      if (state.phase !== PHASES.ACTIVE) return state;
      return applyItemEffect(state, action.payload.item);
    }

    case 'OPEN_ITEM_SELECT':
      return state.phase === PHASES.ACTIVE ? { ...state, phase: PHASES.ITEM_SELECT } : state;

    case 'CLOSE_ITEM_SELECT':
      return state.phase === PHASES.ITEM_SELECT ? { ...state, phase: PHASES.ACTIVE } : state;

    case 'FORCE_GAME_OVER':
      return { ...state, phase: PHASES.GAME_OVER };

    // dev/debug only
    case 'DEBUG_SET':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCombat({ questions = [], initialInventory = [] } = {}) {
  const [state, dispatch] = useReducer(combatReducer, {
    ...INITIAL_STATE,
    inventory: initialInventory,
  });

  const timerRef     = useRef(null);
  const lastTickRef  = useRef(null);

  // ── Timer ──────────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    lastTickRef.current = performance.now();
    timerRef.current = requestAnimationFrame(function tick(now) {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      dispatch({ type: 'TICK', payload: { delta } });
      timerRef.current = requestAnimationFrame(tick);
    });
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
  }, []);

  // ── Manage timer by phase ──────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase === PHASES.ACTIVE) {
      startTimer();
    } else {
      stopTimer();
    }
    return stopTimer;
  }, [state.phase, startTimer, stopTimer]);

  // ── Handle timeout pending flag ────────────────────────────────────────────

  useEffect(() => {
    if (state._timeoutPending) {
      dispatch({ type: 'TIMEOUT' });
    }
  }, [state._timeoutPending]);

  // ── Load questions when phase transitions to LOADING ──────────────────────

  useEffect(() => {
    if (state.phase === PHASES.LOADING) {
      const next = questions[state.questionIndex];
      if (next) {
        dispatch({ type: 'LOAD_QUESTION', payload: { question: next } });
      } else {
        // no more questions — treat as game over
        dispatch({ type: 'FORCE_GAME_OVER' });
      }
    }
  }, [state.phase, state.questionIndex, questions]);

  // ── Public actions ─────────────────────────────────────────────────────────

  const submitAnswer    = useCallback((answerId)  => dispatch({ type: 'SUBMIT_ANSWER',    payload: { answerId } }), []);
  const revealComplete  = useCallback(()          => dispatch({ type: 'REVEAL_COMPLETE' }), []);
  const explanationOK   = useCallback(()          => dispatch({ type: 'EXPLANATION_OK' }), []);
  const useItem         = useCallback((item)      => dispatch({ type: 'USE_ITEM',         payload: { item } }), []);
  const openItemSelect  = useCallback(()          => dispatch({ type: 'OPEN_ITEM_SELECT' }), []);
  const closeItemSelect = useCallback(()          => dispatch({ type: 'CLOSE_ITEM_SELECT' }), []);

  // debug helper — strips out in production builds if tree-shaken
  const debugSet = useCallback((partial) => {
    if (process.env.NODE_ENV === 'development') {
      dispatch({ type: 'DEBUG_SET', payload: partial });
    }
  }, []);

  return {
    state,
    PHASES,
    submitAnswer,
    revealComplete,
    explanationOK,
    useItem,
    openItemSelect,
    closeItemSelect,
    debugSet,
  };
}