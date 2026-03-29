'use client'

import { useState, useCallback, useRef } from 'react'

export interface ShakeOptions {
  /** Duration in ms. Default: 520 */
  duration?: number
  /** One of the preset intensities. Default: 'medium' */
  intensity?: 'light' | 'medium' | 'heavy'
}

const INTENSITY_CLASS = {
  light:  'shake-light',
  medium: 'shake-medium',
  heavy:  'shake-heavy',
}

/**
 * Returns `{ shakeClass, triggerShake }`.
 * Apply `shakeClass` to any element's className to shake it.
 * Mount `<ShakeStyles />` once anywhere in your tree.
 *
 * @example
 * const { shakeClass, triggerShake } = useShake()
 * triggerShake({ intensity: 'heavy' })
 * <div className={shakeClass} style={{ ... }}>
 */
export function useShake() {
  const [shakeClass, setShakeClass] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerShake = useCallback((opts: ShakeOptions = {}) => {
    const { duration = 520, intensity = 'medium' } = opts

    if (timerRef.current) clearTimeout(timerRef.current)
    setShakeClass('')
    requestAnimationFrame(() => {
      setShakeClass(INTENSITY_CLASS[intensity])
      timerRef.current = setTimeout(() => setShakeClass(''), duration)
    })
  }, [])

  return { shakeClass, triggerShake }
}

/**
 * Drop-in <style> tag with all shake keyframes.
 * Mount once in your root layout or page.
 */
export function ShakeStyles() {
  return (
    <style>{`
      @keyframes _shake-light {
        0%,100% { transform: translate(0,0) rotate(0deg); }
        15%     { transform: translate(-4px,-2px) rotate(-0.4deg); }
        30%     { transform: translate(4px, 2px) rotate( 0.4deg); }
        45%     { transform: translate(-3px, 1px) rotate(-0.2deg); }
        60%     { transform: translate(3px,-1px) rotate( 0.2deg); }
        75%     { transform: translate(-2px, 1px); }
        90%     { transform: translate(1px,-1px); }
      }
      @keyframes _shake-medium {
        0%,100% { transform: translate(0,0) rotate(0deg); }
        10%     { transform: translate(-10px,-4px) rotate(-1deg); }
        20%     { transform: translate( 10px, 4px) rotate( 1deg); }
        30%     { transform: translate(-8px,  2px) rotate(-0.6deg); }
        40%     { transform: translate( 8px, -2px) rotate( 0.6deg); }
        50%     { transform: translate(-5px,  3px) rotate(-0.3deg); }
        60%     { transform: translate( 5px, -3px) rotate( 0.3deg); }
        70%     { transform: translate(-3px,  1px); }
        85%     { transform: translate( 2px, -1px); }
      }
      @keyframes _shake-heavy {
        0%,100% { transform: translate(0,0) rotate(0deg); }
        8%      { transform: translate(-16px,-6px) rotate(-1.5deg); }
        16%     { transform: translate( 16px, 6px) rotate( 1.5deg); }
        24%     { transform: translate(-12px,  4px) rotate(-1deg); }
        32%     { transform: translate( 12px, -4px) rotate( 1deg); }
        40%     { transform: translate(-8px,  5px) rotate(-0.6deg); }
        50%     { transform: translate( 8px, -5px) rotate( 0.6deg); }
        60%     { transform: translate(-5px,  3px) rotate(-0.3deg); }
        70%     { transform: translate( 5px, -2px); }
        82%     { transform: translate(-3px,  1px); }
        92%     { transform: translate( 2px, -1px); }
      }
      .shake-light  { animation: _shake-light  0.5s ease both; }
      .shake-medium { animation: _shake-medium 0.52s ease both; }
      .shake-heavy  { animation: _shake-heavy  0.58s ease both; }
    `}</style>
  )
}
