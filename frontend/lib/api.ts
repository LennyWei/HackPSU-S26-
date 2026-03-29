import type { Boss, BossCluster, GameState } from '@/context/GameContext'

export interface InitGameResponse {
  bossRush: BossCluster[]
  bosses: Boss[]
}

export interface AnswerVerdict {
  correct: boolean
  explanation: string
  conceptName: string
  damage: number
  playerDamage: number
  scoreGained: number
}

const API_BASE = process.env.NEXT_PUBLIC_FLASK_URL ?? 'http://localhost:5000'
const USE_MOCK = process.env.NEXT_PUBLIC_MOCK === 'true'
const VERDICT_OPEN = '<VERDICT>'
const VERDICT_CLOSE = '</VERDICT>'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function responseFromText(text: string): Response {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  )
}

function safeGameSnapshot(game: GameState) {
  return {
    currentBoss: game.currentBoss,
    currentCluster: game.currentCluster,
    currentBossIndex: game.currentBossIndex,
    totalBosses: game.totalBosses,
    playerHP: game.playerHP,
    bossHP: game.bossHP,
    weakSpots: game.weakSpots,
    questionsAsked: game.questionsAsked,
    turn: game.turn,
    difficulty: game.difficulty,
    score: game.score,
  }
}

function buildMockInitResponse(): InitGameResponse {
  const bossRush: BossCluster[] = [
    {
      clusterId: 'c1',
      clusterName: 'Cell Biology',
      concepts: [
        {
          id: 'c1-k1',
          name: 'Mitochondria',
          summary: 'Powerhouse organelles that generate ATP through respiration.',
          difficulty: 'basic',
          related_concepts: ['Cellular respiration', 'ATP'],
          has_diagram: false,
        },
        {
          id: 'c1-k2',
          name: 'Ribosomes',
          summary: 'Structures responsible for protein synthesis.',
          difficulty: 'basic',
          related_concepts: ['Translation', 'mRNA'],
          has_diagram: false,
        },
      ],
    },
    {
      clusterId: 'c2',
      clusterName: 'Classical Mechanics',
      concepts: [
        {
          id: 'c2-k1',
          name: 'Newton Second Law',
          summary: 'Force equals mass times acceleration.',
          difficulty: 'intermediate',
          related_concepts: ['Force', 'Mass', 'Acceleration'],
          has_diagram: false,
        },
      ],
    },
  ]

  const bosses: Boss[] = [
    {
      clusterId: 'c1',
      name: 'ATP Tyrant',
      personality: 'intense biochemist overlord',
      backstory: 'Forged in a failed lab simulation.',
      opening_monologue: 'Your notes feed my power core. Prove you understand life itself.',
      taunts: {
        hit: 'You got lucky.',
        miss: 'Back to the textbook, challenger.',
      },
      sprite_category: 'science',
      max_hp: 280,
    },
    {
      clusterId: 'c2',
      name: 'Vector Warden',
      personality: 'stoic physics sentinel',
      backstory: 'Guardian of equations and free-body diagrams.',
      opening_monologue: 'Direction matters. Magnitude matters. Precision matters.',
      taunts: {
        hit: 'Acceptable trajectory.',
        miss: 'Your vectors are collapsing.',
      },
      sprite_category: 'math',
      max_hp: 340,
    },
  ]

  return { bossRush, bosses }
}

function buildMockQuestion(game: GameState): string {
  const concept = game.currentCluster?.concepts?.[0]
  const conceptName = concept?.name ?? 'the core concept'
  return [
    `Boss: Explain ${conceptName} to survive this turn.`,
    'A) It is the process that always lowers entropy in closed systems.',
    `B) It is directly related to ${conceptName} and is central to this topic.`,
    'C) It has no measurable effect in science.',
    'D) It only applies in fictional scenarios.',
  ].join('\n')
}

function buildMockVerdict(answer: string, game: GameState): AnswerVerdict {
  const cleaned = answer.trim().toUpperCase()
  const correct = cleaned.startsWith('B)') || cleaned === 'B'
  const conceptName = game.currentCluster?.concepts?.[0]?.name ?? 'Core Concept'

  if (correct) {
    return {
      correct: true,
      explanation: 'Correct. Your answer matches the strongest concept link.',
      conceptName,
      damage: 70,
      playerDamage: 0,
      scoreGained: 120,
    }
  }

  return {
    correct: false,
    explanation: 'Not quite. Revisit how this concept is defined and applied.',
    conceptName,
    damage: 0,
    playerDamage: 45,
    scoreGained: 20,
  }
}

function buildVerdictPayloadText(verdict: AnswerVerdict): string {
  const dialogue = verdict.correct
    ? 'Boss: Impressive. Your understanding cuts deep.'
    : 'Boss: Weak answer. Feel the recoil of uncertainty.'

  return `${dialogue}\n${VERDICT_OPEN}${JSON.stringify(verdict)}${VERDICT_CLOSE}`
}

export async function uploadPDF(pdfBase64: string): Promise<InitGameResponse> {
  if (USE_MOCK) {
    await sleep(700)
    return buildMockInitResponse()
  }

  try {
    const res = await fetch(`${API_BASE}/lobby/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: pdfBase64 }),
    })

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`)
    }

    const data = (await res.json()) as Partial<InitGameResponse>
    if (!Array.isArray(data.bossRush) || !Array.isArray(data.bosses)) {
      throw new Error('Backend returned invalid game payload')
    }

    return { bossRush: data.bossRush, bosses: data.bosses }
  } catch (err) {
    throw err
  }
}

export async function streamQuestion(game: GameState, questionMode = 'mcq'): Promise<Response> {
  if (USE_MOCK) {
    await sleep(350)
    return responseFromText(buildMockQuestion(game))
  }

  try {
    const res = await fetch(`${API_BASE}/battle/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: safeGameSnapshot(game), question_mode: questionMode }),
    })

    if (!res.ok) {
      throw new Error(`Question request failed with status ${res.status}`)
    }

    return res
  } catch {
    return responseFromText(buildMockQuestion(game))
  }
}

export interface JudgeResult {
  is_correct: boolean
  explanation: string
  boss_dialogue: string
}

export async function judgeAnswer(
  playerAnswer: string,
  questionText: string,
  modelAnswer: string,
  game: GameState,
): Promise<JudgeResult> {
  if (USE_MOCK) {
    await sleep(600)
    const correct = playerAnswer.trim().length > 20
    return {
      is_correct: correct,
      explanation: correct
        ? 'Good answer — you covered the key points.'
        : 'Your answer missed the core concepts. Review your notes.',
      boss_dialogue: correct
        ? 'Hmm. Impressive. You actually know your material.'
        : 'Pathetic. That answer belongs in a trash compactor.',
    }
  }

  const res = await fetch(`${API_BASE}/battle/judge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_answer: playerAnswer,
      question_text: questionText,
      model_answer:  modelAnswer,
      game:          safeGameSnapshot(game),
    }),
  })
  if (!res.ok) throw new Error(`Judge request failed with status ${res.status}`)
  return res.json() as Promise<JudgeResult>
}

export async function streamAnswer(answer: string, question: string, game: GameState): Promise<Response> {
  if (USE_MOCK) {
    await sleep(450)
    const verdict = buildMockVerdict(answer, game)
    return responseFromText(buildVerdictPayloadText(verdict))
  }

  try {
    const res = await fetch(`${API_BASE}/battle/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer,
        question,
        game: safeGameSnapshot(game),
      }),
    })

    if (!res.ok) {
      throw new Error(`Answer request failed with status ${res.status}`)
    }

    return res
  } catch {
    const verdict = buildMockVerdict(answer, game)
    return responseFromText(buildVerdictPayloadText(verdict))
  }
}

export async function readStream(
  response: Response,
  onChunk: (chunk: string) => void
): Promise<void> {
  if (!response.body) {
    const fallbackText = await response.text()
    if (fallbackText) onChunk(fallbackText)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      onChunk(decoder.decode(value, { stream: true }))
    }
    const tail = decoder.decode()
    if (tail) onChunk(tail)
  } finally {
    reader.releaseLock()
  }
}

export function parseVerdict(text: string): {
  dialogue: string
  verdict: AnswerVerdict | null
} {
  const start = text.lastIndexOf(VERDICT_OPEN)
  const end = text.lastIndexOf(VERDICT_CLOSE)

  if (start === -1 || end === -1 || end <= start) {
    return { dialogue: text.trim(), verdict: null }
  }

  const dialogue = (text.slice(0, start) + text.slice(end + VERDICT_CLOSE.length)).trim()
  const jsonText = text.slice(start + VERDICT_OPEN.length, end).trim()

  try {
    const parsed = JSON.parse(jsonText) as Partial<AnswerVerdict>
    if (
      typeof parsed.correct === 'boolean' &&
      typeof parsed.explanation === 'string' &&
      typeof parsed.conceptName === 'string' &&
      typeof parsed.damage === 'number' &&
      typeof parsed.playerDamage === 'number' &&
      typeof parsed.scoreGained === 'number'
    ) {
      return { dialogue, verdict: parsed as AnswerVerdict }
    }
  } catch {
    // Fall through to null verdict.
  }

  return { dialogue, verdict: null }
}
