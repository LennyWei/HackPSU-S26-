'use client'

import { useState, useEffect } from 'react'

export interface AnimatedSpriteProps {
  framePaths: string[]          // Array of image paths in animation order
  frameRate?: number            // Milliseconds per frame (default 200ms)
  loop?: boolean                // Loop animation (default true)
  width: number                 // Display width in pixels
  height: number                // Display height in pixels
  className?: string
}

/**
 * AnimatedSprite
 * 
 * Renders an animated sprite by cycling through a series of PNG frames.
 * 
 * Usage:
 * ```tsx
 * <AnimatedSprite
 *   framePaths={[
 *     '/images/player-idle-1.png',
 *     '/images/player-idle-2.png',
 *     '/images/player-idle-3.png',
 *     '/images/player-idle-4.png',
 *   ]}
 *   width={60}
 *   height={80}
 *   frameRate={200}
 * />
 * ```
 */
export default function AnimatedSprite({
  framePaths,
  frameRate = 200,
  loop = true,
  width,
  height,
  className,
}: AnimatedSpriteProps) {
  const [currentFrame, setCurrentFrame] = useState(0)

  useEffect(() => {
    if (framePaths.length === 0) return

    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        const next = prev + 1
        if (next >= framePaths.length) {
          return loop ? 0 : prev
        }
        return next
      })
    }, frameRate)

    return () => clearInterval(interval)
  }, [framePaths.length, frameRate, loop])

  // Ensure current frame is within bounds
  const frameIndex = Math.min(currentFrame, framePaths.length - 1)
  const currentPath = framePaths[frameIndex]

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      className={className}
    >
      <img
        src={currentPath}
        alt="sprite"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  )
}
