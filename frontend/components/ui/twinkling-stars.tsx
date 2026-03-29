'use client'

import { useEffect, useState } from 'react'

interface Star {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
}

interface TwinklingStarsProps {
  count?: number
  minSize?: number
  maxSize?: number
  minDuration?: number
  maxDuration?: number
  color?: string
  zIndex?: number
  position?: 'fixed' | 'absolute'
}

/**
 * TwinklingStars Component
 *
 * Renders a field of pixelated stars with twinkling animation.
 * Perfect for space-themed backgrounds.
 *
 * @param count - Number of stars (default: 30)
 * @param minSize - Minimum star size in pixels (default: 1)
 * @param maxSize - Maximum star size in pixels (default: 3)
 * @param minDuration - Minimum twinkle duration in seconds (default: 1.5)
 * @param maxDuration - Maximum twinkle duration in seconds (default: 4)
 * @param color - Star color (default: white)
 *
 * Usage:
 * <TwinklingStars count={40} minSize={1} maxSize={2} color="#ffffff" />
 */
export default function TwinklingStars({
  count = 30,
  minSize = 1,
  maxSize = 3,
  minDuration = 1.5,
  maxDuration = 4,
  color = '#ffffff',
  zIndex = 1,
  position = 'fixed',
}: TwinklingStarsProps) {
  const [stars, setStars] = useState<Star[]>([])

  // Generate stars on mount
  useEffect(() => {
    const generated: Star[] = []
    for (let i = 0; i < count; i++) {
      generated.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * (maxSize - minSize) + minSize,
        duration: Math.random() * (maxDuration - minDuration) + minDuration,
        delay: Math.random() * 2,
      })
    }
    setStars(generated)
  }, [count, minSize, maxSize, minDuration, maxDuration])

  return (
    <div
      style={{
        position,
        inset: 0,
        zIndex,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        
        .star {
          position: absolute;
          background-color: ${color};
          border-radius: 50%;
          box-shadow: 0 0 2px ${color};
        }
      `}</style>

      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
