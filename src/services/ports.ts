import type { Order, OrderStatus, Product, Promotion, SpaceClaim, Store } from '../domain/types'

// Puertos (interfaces) de persistencia. La implementación actual vive en `state/` sobre
// localStorage. Para producción se reemplazan por adaptadores Supabase con la misma forma.

export interface CatalogRepository {
  listStores(): Promise<Store[]>
  listProducts(storeId?: string): Promise<Product[]>
  upsertProduct(product: Product): Promise<void>
  deleteProduct(productId: string): Promise<void>
  upsertStore(store: Store): Promise<void>
  assignSpace(spaceId: string, storeId: string | null): Promise<void>
}

export interface PromotionRepository {
  list(): Promise<Promotion[]>
  upsert(promo: Promotion): Promise<void>
}

export interface OrderRepository {
  create(order: Order): Promise<void>
  list(): Promise<Order[]>
  updateSubOrderStatus(subOrderId: string, status: OrderStatus): Promise<void>
}

export interface ClaimRepository {
  submit(claim: SpaceClaim): Promise<void>
  list(): Promise<SpaceClaim[]>
  setStatus(claimId: string, status: SpaceClaim['status'], storeId?: string): Promise<void>
}
