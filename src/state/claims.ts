import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SpaceClaim } from '../domain/types'
import { safeStorage } from './storage'
import { remoteEnabled } from '../remote/client'
import { uniqueId } from '../lib/ids'

interface ClaimsState {
  claims: SpaceClaim[]
  submit: (claim: Omit<SpaceClaim, 'id' | 'createdAt' | 'status'>) => SpaceClaim
  setStatus: (id: string, status: SpaceClaim['status'], storeId?: string) => void
  /** El administrador elimina una solicitud del mapa. */
  remove: (id: string) => void
  reset: () => void
}

export const useClaims = create<ClaimsState>()(
  persist(
    (set, get) => ({
      claims: [],
      submit: (input) => {
        const claim: SpaceClaim = {
          ...input,
          id: remoteEnabled() ? uniqueId('REQ') : `REQ-${String(get().claims.length + 1).padStart(3, '0')}`,
          createdAt: new Date().toISOString(),
          status: 'pending',
        }
        set((s) => ({ claims: [claim, ...s.claims] }))
        return claim
      },
      setStatus: (id, status, storeId) =>
        set((s) => ({ claims: s.claims.map((c) => (c.id === id ? { ...c, status, storeId: storeId ?? c.storeId } : c)) })),
      remove: (id) => set((s) => ({ claims: s.claims.filter((c) => c.id !== id) })),
      reset: () => set({ claims: [] }),
    }),
    { name: 'cm:claims:v1', storage: safeStorage },
  ),
)
