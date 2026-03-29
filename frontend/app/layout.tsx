import type { Metadata } from 'next'
import { Press_Start_2P, Share_Tech_Mono } from 'next/font/google'
import { GameProvider } from '@/context/GameContext'
import GlobalMusicController from '@/components/audio/global-music-controller'

const pressStart = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixel',
})

const shareTech = Share_Tech_Mono({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Brain Brawl',
  description: 'Upload your notes. Face your nemesis.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pressStart.variable} ${shareTech.variable}`}>
      <body style={{ margin: 0, background: '#050505' }}>
        <GameProvider>
          <GlobalMusicController />
          {children}
        </GameProvider>
      </body>
    </html>
  )
}
