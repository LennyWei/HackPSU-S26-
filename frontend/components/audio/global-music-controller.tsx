'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

type MusicMode = 'combat' | 'muffled'

const TRACK_PATH = '/musics/combat.mp3'

export default function GlobalMusicController() {
  const pathname = usePathname()

  const modeRef = useRef<MusicMode>('muffled')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const dryGainRef = useRef<GainNode | null>(null)
  const muffledGainRef = useRef<GainNode | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const lowpassRef = useRef<BiquadFilterNode | null>(null)
  const initializedRef = useRef(false)

  const currentMode: MusicMode = pathname?.startsWith('/battle') ? 'combat' : 'muffled'
  modeRef.current = currentMode

  useEffect(() => {
    const applyMode = (mode: MusicMode, immediate = false) => {
      const ctx = contextRef.current
      const dryGain = dryGainRef.current
      const muffledGain = muffledGainRef.current
      const lowpass = lowpassRef.current
      if (!ctx || !dryGain || !muffledGain || !lowpass) return

      const now = ctx.currentTime
      const fade = immediate ? 0.01 : 0.35

      dryGain.gain.cancelScheduledValues(now)
      muffledGain.gain.cancelScheduledValues(now)

      if (mode === 'combat') {
        lowpass.frequency.setTargetAtTime(18000, now, fade)
        dryGain.gain.setTargetAtTime(1, now, fade)
        muffledGain.gain.setTargetAtTime(0, now, fade)
      } else {
        lowpass.frequency.setTargetAtTime(650, now, fade)
        dryGain.gain.setTargetAtTime(0.05, now, fade)
        muffledGain.gain.setTargetAtTime(0.95, now, fade)
      }
    }

    const ensureStarted = async () => {
      try {
        if (!audioRef.current) {
          const audio = new Audio(TRACK_PATH)
          audio.loop = true
          audio.preload = 'auto'
          audioRef.current = audio
        }

        if (!initializedRef.current) {
          const ctx = new AudioContext()
          contextRef.current = ctx

          const source = ctx.createMediaElementSource(audioRef.current)
          sourceRef.current = source

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

          masterGain.gain.value = 0.4
          dryGain.gain.value = 0
          muffledGain.gain.value = 1

          source.connect(dryGain)
          dryGain.connect(masterGain)

          source.connect(lowpass)
          lowpass.connect(muffledGain)
          muffledGain.connect(masterGain)

          masterGain.connect(ctx.destination)

          initializedRef.current = true
          applyMode(modeRef.current, true)
        }

        if (contextRef.current?.state === 'suspended') {
          await contextRef.current.resume()
        }

        if (audioRef.current?.paused) {
          await audioRef.current.play()
        }
      } catch {
        // Ignore autoplay-related errors until the next user gesture.
      }
    }

    const onUserGesture = () => {
      void ensureStarted()
    }

    window.addEventListener('pointerdown', onUserGesture)
    window.addEventListener('keydown', onUserGesture)

    void ensureStarted()

    return () => {
      window.removeEventListener('pointerdown', onUserGesture)
      window.removeEventListener('keydown', onUserGesture)
    }
  }, [])

  useEffect(() => {
    const ctx = contextRef.current
    const dryGain = dryGainRef.current
    const muffledGain = muffledGainRef.current
    const lowpass = lowpassRef.current
    if (!ctx || !dryGain || !muffledGain || !lowpass) return

    const now = ctx.currentTime
    const fade = 0.35

    dryGain.gain.cancelScheduledValues(now)
    muffledGain.gain.cancelScheduledValues(now)

    if (currentMode === 'combat') {
      lowpass.frequency.setTargetAtTime(18000, now, fade)
      dryGain.gain.setTargetAtTime(1, now, fade)
      muffledGain.gain.setTargetAtTime(0, now, fade)
    } else {
      lowpass.frequency.setTargetAtTime(650, now, fade)
      dryGain.gain.setTargetAtTime(0.05, now, fade)
      muffledGain.gain.setTargetAtTime(0.95, now, fade)
    }
  }, [currentMode])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      if (contextRef.current && contextRef.current.state !== 'closed') {
        void contextRef.current.close()
      }
    }
  }, [])

  return null
}
