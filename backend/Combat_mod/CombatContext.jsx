import { createContext, useContext } from 'react';
import { useCombat } from './useCombat';

const CombatContext = createContext(null);

export function CombatProvider({ questions, initialInventory, children }) {
  const combat = useCombat({ questions, initialInventory });
  return (
    <CombatContext.Provider value={combat}>
      {children}
    </CombatContext.Provider>
  );
}

// convenience hook — throw if used outside provider
export function useCombatContext() {
  const ctx = useContext(CombatContext);
  if (!ctx) throw new Error('useCombatContext must be used inside <CombatProvider>');
  return ctx;
}
