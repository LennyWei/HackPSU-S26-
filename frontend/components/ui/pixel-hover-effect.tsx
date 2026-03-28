'use client'

import React, { useEffect, useRef } from 'react'

interface PixelButtonProps {
  children: React.ReactNode
  color?: string
  onClick?: () => void
  className?: string
}

export default function PixelButton({
  children,
  color = '#5a8fa8',
  onClick,
  className,
}: PixelButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const styleId = `pixel-btn-style-${color.replace('#', '')}`

  useEffect(() => {
    const button = buttonRef.current
    const pixelContainer = containerRef.current
    if (!button || !pixelContainer) return

    const pixelSize = 10
    const btnWidth = button.offsetWidth
    const btnHeight = button.offsetHeight
    const cols = Math.floor(btnWidth / pixelSize)
    const rows = Math.floor(btnHeight / pixelSize)

    pixelContainer.innerHTML = ''

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const pixel = document.createElement('div')
        pixel.className = 'pbtn-pixel'
        pixel.style.left = `${col * pixelSize}px`
        pixel.style.top = `${row * pixelSize}px`
        pixel.style.transitionDelay = `${Math.random() * 0.5}s`
        pixelContainer.appendChild(pixel)
      }
    }
  }, [])

  return (
    <>
      <style id={styleId}>{`
        .pbtn-root {
          position: relative;
          min-width: 200px;
          height: 56px;
          border: 2px solid ${color};
          outline: none;
          color: ${color};
          background: transparent;
          cursor: pointer;
          font-size: clamp(8px, 2vw, 12px);
          letter-spacing: 0.2em;
          font-weight: 400;
          text-transform: uppercase;
          font-family: var(--font-pixel), monospace;
          transition: color 0.15s ease;
          padding: 0 24px;
          box-shadow: 0 0 10px ${color}44, inset 0 0 10px ${color}11;
        }
        .pbtn-root:hover {
          color: #000;
          box-shadow: 0 0 20px ${color}88;
        }
        .pbtn-label {
          position: relative;
          z-index: 10;
          pointer-events: none;
        }
        .pbtn-pixels {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          pointer-events: none;
          overflow: hidden;
        }
        .pbtn-pixel {
          position: absolute;
          width: 10px;
          height: 10px;
          background: ${color};
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .pbtn-root:hover .pbtn-pixel {
          opacity: 1;
        }
      `}</style>
      <button
        ref={buttonRef}
        className={`pbtn-root${className ? ` ${className}` : ''}`}
        onClick={onClick}
      >
        <span className="pbtn-label">{children}</span>
        <div ref={containerRef} className="pbtn-pixels" />
      </button>
    </>
  )
}
