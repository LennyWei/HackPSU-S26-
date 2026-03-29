'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type { BattleAudioState, SfxRequest } from '@/lib/audio-events'

type MusicMix = 'normal' | 'muffled'
type MusicTrack = 'rising-tide' | 'corruption' | 'none'

const TRACK_PATHS: Record<Exclude<MusicTrack, 'none'>, string> = {
  'rising-tide': '/sounds/music/Rising Tide.mp3',
  corruption: '/sounds/music/Corruption.mp3',
}

const MASTER_MUSIC_VOLUME = 0.05
const DRONE_PATH = '/sounds/sfx/lowDrone.wav'
const DRONE_VOLUME = 0.01
const UI_SFX_VOLUME_SCALE = 1 / 4

const AUDIO_DEBUG = typeof window !== 'undefined' && window.location.hostname === 'localhost'

function debugLog(message: string, meta?: Record<string, unknown>): void {
  if (!AUDIO_DEBUG) return
  // eslint-disable-next-line no-console
  console.info('[audio]', message, meta ?? {})
}

function debugWarn(message: string, error: unknown): void {
  if (!AUDIO_DEBUG) return
  // eslint-disable-next-line no-console
  console.warn('[audio]', message, error)
}

function clampRate(rate: number): number {
  return Math.min(3, Math.max(0.5, rate))
}

function randomRate(minRate: number, maxRate: number): number {
  if (maxRate <= minRate) return clampRate(minRate)
  return clampRate(minRate + Math.random() * (maxRate - minRate))
}

function isInteractiveElement(el: Element | null): HTMLElement | null {
  if (!el) return null
  const interactive = el.closest('button, [role="button"], a[href], input[type="button"], input[type="submit"]')
  return interactive instanceof HTMLElement ? interactive : null
}

export default function GlobalMusicController() {
  const pathname = usePathname()
  const pathnameRef = useRef<string | null>(pathname)

  const trackRef = useRef<MusicTrack>('none')
  const battleStateRef = useRef<BattleAudioState | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const droneRef = useRef<HTMLAudioElement | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const dryGainRef = useRef<GainNode | null>(null)
  const muffledGainRef = useRef<GainNode | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const lowpassRef = useRef<BiquadFilterNode | null>(null)

  const hoverTargetRef = useRef<HTMLElement | null>(null)
  const lastHoverPlayAtRef = useRef(0)
  const initializedRef = useRef(false)
  const initialTrackCuePlayedRef = useRef(false)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const resolveMusicState = (): { track: MusicTrack; mix: MusicMix } => {
    const activePath = pathnameRef.current
    if (!activePath) return { track: 'none', mix: 'muffled' }
    if (activePath.startsWith('/result')) return { track: 'none', mix: 'muffled' }
    if (activePath === '/') return { track: 'rising-tide', mix: 'normal' }
    if (activePath.startsWith('/boss')) return { track: 'corruption', mix: 'muffled' }
    if (activePath.startsWith('/battle')) {
      const battleState = battleStateRef.current
      const caseOpening = battleState?.phase === 'case_opening' && battleState?.hasPendingReward
      const isLoading = battleState?.phase === 'loading'
      const shouldMuffle = caseOpening || isLoading
      return { track: 'corruption', mix: shouldMuffle ? 'muffled' : 'normal' }
    }
    if (activePath.startsWith('/transition')) return { track: 'corruption', mix: 'muffled' }
    return { track: 'rising-tide', mix: 'muffled' }
  }

  const playSfx = (request: SfxRequest) => {
    if (!request.name) return
    const audio = new Audio(`/sounds/sfx/${request.name}`)
    const minRate = request.minRate ?? 1
    const maxRate = request.maxRate ?? minRate
    audio.playbackRate = randomRate(minRate, maxRate)
    audio.volume = request.volume ?? 0.6
    void audio.play().catch(() => {
      // Ignore gesture-gated failures; next interaction will retry.
    })
  }

  useEffect(() => {
    const syncDrone = () => {
      const activePath = pathnameRef.current
      if (!activePath) return

      if (!droneRef.current) {
        const drone = new Audio(DRONE_PATH)
        drone.loop = true
        drone.preload = 'auto'
        drone.volume = DRONE_VOLUME
        droneRef.current = drone
      }

      const drone = droneRef.current
      if (!drone) return

      const shouldPlayDrone = activePath.startsWith('/battle')
      if (shouldPlayDrone) {
        void drone.play().catch((error: unknown) => {
          debugWarn('drone play blocked; waiting for next user gesture', error)
        })
      } else {
        drone.pause()
        drone.currentTime = 0
      }
    }

    const applyMix = (mix: MusicMix, immediate = false) => {
      const ctx = contextRef.current
      const dryGain = dryGainRef.current
      const muffledGain = muffledGainRef.current
      const lowpass = lowpassRef.current
      if (!ctx || !dryGain || !muffledGain || !lowpass) return

      const now = ctx.currentTime
      const fade = immediate ? 0.01 : 0.35

      dryGain.gain.cancelScheduledValues(now)
      muffledGain.gain.cancelScheduledValues(now)

      if (mix === 'normal') {
        lowpass.frequency.setTargetAtTime(18000, now, fade)
        dryGain.gain.setTargetAtTime(1, now, fade)
        muffledGain.gain.setTargetAtTime(0, now, fade)
      } else {
        lowpass.frequency.setTargetAtTime(650, now, fade)
        dryGain.gain.setTargetAtTime(0.05, now, fade)
        muffledGain.gain.setTargetAtTime(0.95, now, fade)
      }
    }

    const stopTrack = (immediate = false) => {
      const audio = audioRef.current
      const ctx = contextRef.current
      const masterGain = masterGainRef.current
      if (!audio || !ctx || !masterGain) return

      const now = ctx.currentTime
      const fade = immediate ? 0.01 : 0.2
      masterGain.gain.cancelScheduledValues(now)
      masterGain.gain.setTargetAtTime(0, now, fade)

      window.setTimeout(() => {
        audio.pause()
        audio.currentTime = 0
      }, immediate ? 10 : 220)
    }

    const startTrack = async (track: Exclude<MusicTrack, 'none'>, immediate = false) => {
      const audio = audioRef.current
      const ctx = contextRef.current
      const masterGain = masterGainRef.current
      if (!audio || !ctx || !masterGain) return

      const nextPath = TRACK_PATHS[track]
      const shouldSwap = !audio.src.endsWith(encodeURI(nextPath))
      if (shouldSwap) {
        audio.pause()
        audio.src = nextPath
        audio.currentTime = 0
        audio.load()
      }

      const now = ctx.currentTime
      const fade = immediate ? 0.01 : 0.2
      masterGain.gain.cancelScheduledValues(now)
      masterGain.gain.setValueAtTime(0, now)
      masterGain.gain.setTargetAtTime(MASTER_MUSIC_VOLUME, now, fade)

      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      if (audio.paused) {
        await audio.play()
      }

      if (track === 'rising-tide' && !initialTrackCuePlayedRef.current) {
        initialTrackCuePlayedRef.current = true
        playSfx({ name: 'lowboom.wav', volume: 0.62, minRate: 0.95, maxRate: 1.05 })
      }
    }

    const syncMusic = async (immediate = false) => {
      const { track, mix } = resolveMusicState()
      const nextTrackChanged = track !== trackRef.current

      if (track === 'none') {
        trackRef.current = 'none'
        stopTrack(immediate)
        syncDrone()
        return
      }

      // Retry start whenever the element is paused (autoplay block or route swap),
      // not only when the logical track name changes.
      const shouldStart = nextTrackChanged || !!audioRef.current?.paused
      if (shouldStart) {
        await startTrack(track, nextTrackChanged ? true : immediate)
      }

      trackRef.current = track

      applyMix(mix, immediate)
      syncDrone()
    }

    const ensureStarted = async () => {
      try {
        if (!audioRef.current) {
          const audio = new Audio(TRACK_PATHS['rising-tide'])
          audio.loop = true
          audio.preload = 'auto'
          audioRef.current = audio
        }

        if (!initializedRef.current) {
          const ctx = new AudioContext()
          contextRef.current = ctx

          const source = ctx.createMediaElementSource(audioRef.current)

          const dryGain = ctx.createGain()
          const muffledGain = ctx.createGain()
          const masterGain = ctx.createGain()
          const lowpass = ctx.createBiquadFilter()

          dryGainRef.current = dryGain
          muffledGainRef.current = muffledGain
          masterGainRef.current = masterGain
          lowpassRef.current = lowpass

          lowpass.type = 'lowpass'
          lowpass.Q.value = 0.7

          masterGain.gain.value = 0
          dryGain.gain.value = 0
          muffledGain.gain.value = 1

          source.connect(dryGain)
          dryGain.connect(masterGain)

          source.connect(lowpass)
          lowpass.connect(muffledGain)
          muffledGain.connect(masterGain)

          masterGain.connect(ctx.destination)

          initializedRef.current = true
          debugLog('audio graph initialized')
        }
        await syncMusic(true)
        debugLog('ensureStarted complete', {
          pathname: pathnameRef.current,
          contextState: contextRef.current?.state,
          track: trackRef.current,
          paused: audioRef.current?.paused,
          src: audioRef.current?.src,
        })
      } catch (error) {
        // Keep this visible in dev; it is usually autoplay policy related.
        debugWarn('ensureStarted failed', error)
      }
    }

    const onUserGesture = () => {
      debugLog('user gesture detected, retrying audio start')
      void ensureStarted()
    }

    const onBattleState = (event: Event) => {
      const customEvent = event as CustomEvent<BattleAudioState | null>
      battleStateRef.current = customEvent.detail
      void syncMusic(false)
    }

    const onSfx = (event: Event) => {
      const customEvent = event as CustomEvent<SfxRequest>
      playSfx(customEvent.detail)
    }

    const onPointerOver = (event: PointerEvent) => {
      const target = isInteractiveElement(event.target as Element)
      if (!target) return

      const from = isInteractiveElement(event.relatedTarget as Element)
      if (from === target) return

      const now = performance.now()
      if (hoverTargetRef.current === target && now - lastHoverPlayAtRef.current < 70) return

      hoverTargetRef.current = target
      lastHoverPlayAtRef.current = now
      playSfx({ name: 'hover.wav', volume: 0.45 * UI_SFX_VOLUME_SCALE, minRate: 0.9, maxRate: 1.1 })
    }

    const onPointerUp = (event: PointerEvent) => {
      const target = isInteractiveElement(event.target as Element)
      if (!target) return

      const customPress = target.dataset.sfxPress
      const customVolume = target.dataset.sfxVolume ? Number(target.dataset.sfxVolume) : undefined
      const customMinRate = target.dataset.sfxMinRate ? Number(target.dataset.sfxMinRate) : undefined
      const customMaxRate = target.dataset.sfxMaxRate ? Number(target.dataset.sfxMaxRate) : undefined

      if (customPress) {
        playSfx({
          name: customPress,
          volume: (customVolume ?? 0.6) * UI_SFX_VOLUME_SCALE,
          minRate: customMinRate,
          maxRate: customMaxRate,
        })
        return
      }

      playSfx({ name: 'press.wav', volume: 0.55 * UI_SFX_VOLUME_SCALE, minRate: 0.6, maxRate: 0.8 })
    }

    window.addEventListener('pointerdown', onUserGesture)
    window.addEventListener('keydown', onUserGesture)
    window.addEventListener('app:battle-audio-state', onBattleState as EventListener)
    window.addEventListener('app:sfx', onSfx as EventListener)
    window.addEventListener('pointerover', onPointerOver, true)
    window.addEventListener('pointerup', onPointerUp, true)

    // Initial autoplay may be blocked by browser policy. We intentionally
    // wait for the first user gesture to call ensureStarted().

    return () => {
      window.removeEventListener('pointerdown', onUserGesture)
      window.removeEventListener('keydown', onUserGesture)
      window.removeEventListener('app:battle-audio-state', onBattleState as EventListener)
      window.removeEventListener('app:sfx', onSfx as EventListener)
      window.removeEventListener('pointerover', onPointerOver, true)
      window.removeEventListener('pointerup', onPointerUp, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const ctx = contextRef.current
    const audio = audioRef.current
    const dryGain = dryGainRef.current
    const muffledGain = muffledGainRef.current
    const lowpass = lowpassRef.current
    const masterGain = masterGainRef.current
    if (!ctx || !audio || !dryGain || !muffledGain || !lowpass || !masterGain) return

    const { track, mix } = resolveMusicState()
    const trackChanged = track !== trackRef.current

    const now = ctx.currentTime
    const fade = 0.35

    dryGain.gain.cancelScheduledValues(now)
    muffledGain.gain.cancelScheduledValues(now)
    masterGain.gain.cancelScheduledValues(now)
    masterGain.gain.setTargetAtTime(MASTER_MUSIC_VOLUME, now, fade)

    if (mix === 'normal') {
      lowpass.frequency.setTargetAtTime(18000, now, fade)
      dryGain.gain.setTargetAtTime(1, now, fade)
      muffledGain.gain.setTargetAtTime(0, now, fade)
    } else {
      lowpass.frequency.setTargetAtTime(650, now, fade)
      dryGain.gain.setTargetAtTime(0.05, now, fade)
      muffledGain.gain.setTargetAtTime(0.95, now, fade)
    }

    if (track === 'none') {
      trackRef.current = 'none'
      masterGain.gain.cancelScheduledValues(now)
      masterGain.gain.setTargetAtTime(0, now, 0.2)
      if (droneRef.current) {
        droneRef.current.pause()
        droneRef.current.currentTime = 0
      }
      window.setTimeout(() => {
        audio.pause()
        audio.currentTime = 0
      }, 220)
      return
    }

    // Route updates should restart playback if the current element is paused,
    // even when the route resolves to the same track.
    if (trackChanged || audio.paused) {
      audio.pause()
      audio.src = TRACK_PATHS[track]
      audio.currentTime = 0
      audio.load()

      const restart = async () => {
        if (ctx.state === 'suspended') {
          await ctx.resume()
        }
        await audio.play()
      }

      void restart().catch((error) => {
        debugWarn('route track restart blocked; waiting for next user gesture', error)
      })

      trackRef.current = track

      masterGain.gain.cancelScheduledValues(now)
      masterGain.gain.setValueAtTime(0, now)
      masterGain.gain.setTargetAtTime(MASTER_MUSIC_VOLUME, now, 0.2)

      debugLog('track switched', {
        pathname,
        track,
        mix,
        contextState: ctx.state,
        src: audio.src,
      })
      return
    }

    trackRef.current = track

    if (droneRef.current) {
      const shouldPlayDrone = pathname.startsWith('/battle')
      if (shouldPlayDrone) {
        void droneRef.current.play().catch(() => {
          // Wait for user gesture if needed.
        })
      } else {
        droneRef.current.pause()
        droneRef.current.currentTime = 0
      }
    }

    debugLog('mix updated', {
      pathname,
      track,
      mix,
      contextState: ctx.state,
      paused: audio.paused,
    })
  }, [pathname])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      if (droneRef.current) {
        droneRef.current.pause()
        droneRef.current.src = ''
      }
      if (contextRef.current && contextRef.current.state !== 'closed') {
        void contextRef.current.close()
      }
    }
  }, [])

  return null
}
