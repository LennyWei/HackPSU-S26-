'use client'

export interface SfxRequest {
  name: string
  volume?: number
  minRate?: number
  maxRate?: number
}

export interface BattleAudioState {
  phase: string
  hasPendingReward: boolean
}

export function emitSfx(request: SfxRequest): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<SfxRequest>('app:sfx', { detail: request }))
}

export function emitBattleAudioState(state: BattleAudioState | null): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<BattleAudioState | null>('app:battle-audio-state', { detail: state }))
}
