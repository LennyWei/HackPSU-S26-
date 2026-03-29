'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useCombat, UseCombatReturn, CombatQuestion, InventoryItem } from '@/hooks/useCombat'

const CombatContext = createContext<UseCombatReturn | null>(null)

interface CombatProviderProps {
  questions: CombatQuestion[]
  initialInventory?: InventoryItem[]
  playerMaxHP?: number
  bossMaxHP?: number
  children: ReactNode
}

export function CombatProvider({ questions, initialInventory = [], playerMaxHP, bossMaxHP, children }: CombatProviderProps) {
  const combat = useCombat({ questions, initialInventory, playerMaxHP, bossMaxHP })
  return <CombatContext.Provider value={combat}>{children}</CombatContext.Provider>
}

export function useCombatContext(): UseCombatReturn {
  const ctx = useContext(CombatContext)
  if (!ctx) throw new Error('useCombatContext must be used inside <CombatProvider>')
  return ctx
}
