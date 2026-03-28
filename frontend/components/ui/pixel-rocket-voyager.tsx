'use client'

import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export default function PixelRocketCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const scene    = new THREE.Scene()
    const camera   = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 25

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mountRef.current.appendChild(renderer.domElement)

    const mouse = new THREE.Vector2(0, 0)
    const clock  = new THREE.Clock()

    // Post-processing — bloom
    const renderPass = new RenderPass(scene, camera)
    const bloomPass  = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.4, 0.3, 0.0
    )
    bloomPass.strength = 1.3
    const composer = new EffectComposer(renderer)
    composer.addPass(renderPass)
    composer.addPass(bloomPass)

    // Ambient light
    scene.add(new THREE.AmbientLight(0xffffff, 0.8))

    // ── Starfield ──
    const starGeo = new THREE.BufferGeometry()
    const verts: number[] = []
    for (let i = 0; i < 1800; i++) {
      verts.push(
        (Math.random() - 0.5) * 120,
        (Math.random() - 0.5) * 120,
        (Math.random() - 0.5) * 120,
      )
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    const starMat  = new THREE.PointsMaterial({ color: 0xaaaaff, size: 0.08 })
    scene.add(new THREE.Points(starGeo, starMat))

    // ── Pixel Rocket ──
    const px   = 0.22
    const geo  = new THREE.BoxGeometry(px, px, px * 0.5)
    const bodyMat    = new THREE.MeshStandardMaterial({ color: 0xff2244, flatShading: true, emissive: 0xff0033, emissiveIntensity: 0.25 })
    const accentMat  = new THREE.MeshStandardMaterial({ color: 0xffd700, flatShading: true, emissive: 0xffd700, emissiveIntensity: 0.5 })
    const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, flatShading: true, emissive: 0x00ffff, emissiveIntensity: 0.8 })
    const wingMat    = new THREE.MeshStandardMaterial({ color: 0xcc0033, flatShading: true, emissive: 0x880022, emissiveIntensity: 0.3 })

    const rocket = new THREE.Group()

    // Body
    const bodyShape = [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,1,1,1,0],
    ]
    bodyShape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return
        const mesh = new THREE.Mesh(geo, cell === 2 ? accentMat : bodyMat)
        mesh.position.set((c - 2) * px, (3.5 - r) * px, 0)
        rocket.add(mesh)
      })
    })

    // Wings
    const wingShape = [[-3,-2],[-4,-2],[-3,-3],[-4,-3]]
    wingShape.forEach(([x, y]) => {
      const l = new THREE.Mesh(geo, wingMat)
      l.position.set(x * px, y * px, 0)
      rocket.add(l)
      const r2 = new THREE.Mesh(geo, wingMat)
      r2.position.set(-x * px, y * px, 0)
      rocket.add(r2)
    })

    // Cockpit window
    const cw = new THREE.Mesh(geo, cockpitMat)
    cw.position.set(0, 2.5 * px, px * 0.3)
    rocket.add(cw)

    scene.add(rocket)

    // ── Rocket trail (pooled) ──
    const POOL = 250
    const trailPool: Array<THREE.Mesh & { life?: number }> = []
    let trailIdx = 0
    const trailGeo = new THREE.BoxGeometry(px * 1.2, px * 1.2, px * 0.3)
    for (let i = 0; i < POOL; i++) {
      const col  = Math.random() > 0.45 ? 0xff3300 : 0xff9900
      const mesh = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: col })) as THREE.Mesh & { life?: number }
      mesh.visible = false
      scene.add(mesh)
      trailPool.push(mesh)
    }

    // ── Floating pixel coins (gold) ──
    const coinGroup = new THREE.Group()
    const coinGeo   = new THREE.BoxGeometry(px * 0.9, px * 0.9, px * 0.3)
    const coinMat   = new THREE.MeshStandardMaterial({ color: 0xffd700, flatShading: true, emissive: 0xffd700, emissiveIntensity: 0.6 })
    for (let i = 0; i < 22; i++) {
      const coin = new THREE.Group()
      for (let p = 0; p < 12; p++) {
        const a    = (p / 12) * Math.PI * 2
        const m    = new THREE.Mesh(coinGeo, coinMat)
        m.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0)
        coin.add(m)
      }
      coin.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 20,
      )
      coinGroup.add(coin)
    }
    scene.add(coinGroup)

    const onMouse = (e: MouseEvent) => {
      mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
      mouse.y = -(e.clientY / window.innerHeight)  * 2 + 1
    }
    window.addEventListener('mousemove', onMouse)

    const target = new THREE.Vector3()
    let   animId = 0

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const delta   = clock.getDelta()
      const elapsed = clock.getElapsedTime()

      target.set(mouse.x * 14, mouse.y * 9, 0)
      rocket.position.lerp(target, 0.06)
      rocket.rotation.z =  (rocket.position.x - target.x) * 0.25
      rocket.rotation.x = -(rocket.position.y - target.y) * 0.12

      // Emit trail
      if (Math.random() > 0.25) {
        const p = trailPool[trailIdx]
        p.position.copy(rocket.position)
        p.position.y -= 0.8
        p.position.x += (Math.random() - 0.5) * 0.3
        p.scale.setScalar(1)
        p.visible = true
        p.life = 1
        trailIdx = (trailIdx + 1) % POOL
      }

      trailPool.forEach((p) => {
        if (!p.visible) return
        p.life! -= delta * 2
        p.scale.setScalar(Math.max(0, p.life!))
        if (p.life! <= 0) p.visible = false
      })

      coinGroup.children.forEach((c, i) => {
        c.rotation.z = elapsed * (i % 2 === 0 ? 0.9 : -0.7)
        c.position.y += Math.sin(elapsed * 0.5 + i) * 0.003
      })

      stars.rotation.y = elapsed * 0.005

      composer.render()
    }
    const stars = scene.children.find((c) => c instanceof THREE.Points) as THREE.Points

    animate()

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      composer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('resize', onResize)
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
