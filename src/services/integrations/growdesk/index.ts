import type { GrowDeskConnector, IntegrationResult } from './types'

const notConnected = async <T,>(): Promise<IntegrationResult<T>> => ({
  status: 'not_connected',
  reason: 'La integración con GrowDesk aún no está disponible en este MVP.',
})

/** Adaptador honesto: no simula sincronización. */
export const disconnectedGrowDesk: GrowDeskConnector = {
  name: 'GrowDesk (no conectado)',
  isConnected: () => false,
  syncProducts: notConnected,
  syncInventory: notConnected,
  pushOrder: notConnected,
  upsertCustomer: notConnected,
  syncPromotions: notConnected,
  fetchSales: notConnected,
  fetchReport: notConnected,
}

let active: GrowDeskConnector = disconnectedGrowDesk

export const growDesk = () => active

/** Punto de registro para un adaptador real cuando exista. */
export function registerGrowDesk(connector: GrowDeskConnector) {
  active = connector
}
