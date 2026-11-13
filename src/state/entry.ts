import { create } from 'zustand'

/**
 * Estado de la entrada: `doorDone` es verdadero cuando el portón de bienvenida ya terminó (o no hay portón porque la persona
 * ya entró en esta sesión). Los avisos que no deben tapar el onboarding (como el periódico «MallPlay Hoy») esperan a esto.
 */
export const useEntry = create<{ doorDone: boolean; setDoorDone: (v: boolean) => void }>()((set) => ({
  doorDone: false,
  setDoorDone: (doorDone) => set({ doorDone }),
}))
