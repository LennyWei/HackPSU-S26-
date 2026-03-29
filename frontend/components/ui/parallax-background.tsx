'use client'

import { useState, useEffect, useRef } from 'react'

export interface ParallaxLayer {
  imagePath: string
  parallaxIntensity: number
}

interface ParallaxBackgroundProps {
  layers: ParallaxLayer[]
  zIndex?: number
  showOverlay?: boolean
  backgroundColor?: string
  pixelated?: boolean
}
/**
 * ParallaxBackground Component
 *
 * Renders a PNG background image with mouse-based parallax effect.
 * The image shifts slightly as the user moves their mouse, creating
 * a sense of depth and interactivity.
 *
 * @param layers - Layer list for parallax rendering. Later layers render on top.
 * @param zIndex - Optional stacking order for this parallax canvas.
 * @param showOverlay - Adds subtle dark tint to improve foreground contrast.
 *
 * Image Requirements:
 * - Size should be ~15-20% larger than viewport (e.g., 1500x900 for 1280x800)
 * - Must be PNG with transparent areas or solid background
 * - Aspect ratio should match your app's typical viewport
 *
 * Usage:
 * <ParallaxBackground layers={[{ imagePath: '/images/space-bg.png', parallaxIntensity: 20 }]} />
 */
export default function ParallaxBackground({
  layers,
  zIndex = 0,
  showOverlay = false,
  backgroundColor = 'transparent',
  pixelated = true,
}: ParallaxBackgroundProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse position to -50% to +50% range
      const normalizedX = (e.clientX / window.innerWidth - 0.5) * 2
      const normalizedY = (e.clientY / window.innerHeight - 0.5) * 2
      setMousePos({ x: normalizedX, y: normalizedY })
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])


  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        overflow: 'hidden',
        backgroundColor,
      }}
    >

      {/* Render each layer with its own parallax offset */}
      {layers.map((layer, idx) => {
        const offsetX = mousePos.x * layer.parallaxIntensity
        const offsetY = mousePos.y * layer.parallaxIntensity

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              inset: -50,
              backgroundImage: `url(${layer.imagePath})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              transform: `translate(${offsetX}px, ${offsetY}px)`,
              transition: 'transform 0.05s linear',
              willChange: 'transform',
              imageRendering: pixelated ? 'pixelated' : 'auto',
            }}
          />
        )
      })}
      {showOverlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}
    </div>
  )
}
