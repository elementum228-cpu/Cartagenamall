import type { Customer, Order, Product, Promotion } from '../../../domain/types'

// Contrato para la integración FUTURA con GrowDesk (software de gestión del comerciante).
// Hoy no existe ninguna conexión: el adaptador por defecto responde `not_connected` y la UI lo
// muestra así. Cuando exista la API, se implementa esta interfaz y se registra en `index.ts`.

export type IntegrationResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'not_connected'; reason: string }
  | { status: 'error'; reason: string }

export interface InventoryLevel {
  productId: string
  key: string
  quantity: number
}

export interface SalesSummary {
  storeId: string
  from: string
  to: string
  orders: number
  grossCOP: number
}

export interface GrowDeskConnector {
  readonly name: string
  isConnected(storeId: string): boolean
  syncProducts(storeId: string): Promise<IntegrationResult<Product[]>>
  syncInventory(storeId: string): Promise<IntegrationResult<InventoryLevel[]>>
  pushOrder(storeId: string, order: Order): Promise<IntegrationResult<{ externalId: string }>>
  upsertCustomer(storeId: string, customer: Customer): Promise<IntegrationResult<{ externalId: string }>>
  syncPromotions(storeId: string): Promise<IntegrationResult<Promotion[]>>
  fetchSales(storeId: string, from: string, to: string): Promise<IntegrationResult<SalesSummary>>
  fetchReport(storeId: string, report: 'inventory' | 'sales' | 'customers'): Promise<IntegrationResult<Blob>>
}
