/**
 * Typed models mirroring the campulse-backend API responses.
 * Field names match the backend serializers exactly (see app/services/portfolio.py,
 * app/api/v1/endpoints/*.py in campulse-backend).
 */

export type TradeSide = 'BUY' | 'SELL';

/** /api/auth/google and /api/auth/demo response. */
export interface GoogleAuthResponse {
  success: boolean;
  token: string;
  userId: string;
  userName: string;
  email: string | null;
  role: string;
}

/** Profile persisted in localStorage and held in SessionService. */
export interface GoogleProfile {
  userId: string;
  name: string;
  email: string | null;
  token: string;
  role: string;
}

/** /api/prices item — note snake_case: comes straight from the CSX pricing service. */
export interface Price {
  ticker: string;
  price: number;
  change: number | null;
  change_direction: 'up' | 'down' | 'equal' | null;
}

/** /api/trades item. */
export interface Trade {
  tradeId: string;
  userId: string;
  seq: number;
  ticker: string;
  side: TradeSide;
  price: number;
  qty: number;
  commission: number;
  /** ISO datetime string. */
  orderDate: string;
}

/**
 * POST body for /api/trades[/init|/confirm].
 * `commission` is honored by the backend when provided; when omitted the
 * backend computes it as price * qty * 0.0047.
 */
export interface TradePayload {
  ticker: string;
  side: TradeSide;
  price: number;
  qty: number;
  commission?: number;
}

/** LIFO allocation produced when a SELL is matched against BUY lots. */
export interface Allocation {
  allocId: string;
  userId: string;
  ticker: string;
  sellTradeId: string;
  buyTradeId: string;
  qtyAllocated: number;
  buyPrice: number;
  buyCommission: number;
  buyQty: number;
  sellPrice: number;
  sellCommission: number;
  sellQty: number;
  realisedPnl: number;
  /** ISO datetime string. */
  createdAt: string;
}

/** POST /api/trades and /api/trades/confirm response. */
export interface TradeResult {
  success: boolean;
  trade: Trade;
  allocations: Allocation[];
  realisedPnl: number;
  warning: string | null;
}

/** POST /api/trades/init response — LIFO sell simulation before confirming. */
export interface TradeInitResult {
  success: boolean;
  valid: boolean;
  validationError: string | null;
  simulatedPnl: number;
  isLoss: boolean;
  simulatedLossAmount: number;
  existingQty: number;
}

/** /api/portfolio item. */
export interface Holding {
  ticker: string;
  lastPrice: number | null;
  remainingQty: number;
  soldPercent: number;
  avgCostRemaining: number | null;
  realisedPnl: number;
  unrealisedPnl: number;
  totalPnl: number;
  unrealisedPnlPercent?: number | null;
  totalPnlPercent?: number | null;
}

/** Holding with a guaranteed P/L %: backend-provided, or derived client-side. */
export interface HoldingView extends Holding {
  totalPnlPercent: number;
}

/** Open BUY lot inside a position (/api/position remainingLots). */
export interface RemainingLot {
  seq: number;
  tradeId: string;
  price: number;
  qtyOriginal: number;
  qtyOpen: number;
  commission: number;
  /** ISO datetime string. */
  orderDate: string;
}

export interface PositionBuy {
  seq: number;
  qtyOriginal: number;
  price: number;
  qtyOpen: number;
}

export interface PositionMatch {
  buySeq: number | string;
  qty: number;
  price: number;
}

export interface PositionSell {
  seq: number;
  qty: number;
  price: number;
  pnl: number;
  matched: PositionMatch[];
}

/** /api/position/{symbol} response. */
export interface Position {
  ticker: string;
  totalBoughtQty: number;
  totalSoldQty: number;
  remainingQty: number;
  soldPercent: number;
  realisedPnl: number;
  buys: PositionBuy[];
  sells: PositionSell[];
  remainingLots: RemainingLot[];
}

/** /api/top-tickers item. */
export interface TopTicker {
  ticker: string;
  realisedPnl: number;
}

/** /api/top-orders item — trade fields are null if the buy trade was not found. */
export interface TopOrder {
  buyTradeId: string;
  seq: number | null;
  ticker: string | null;
  buyPrice: number | null;
  realisedPnl: number;
}

/** /api/admin/users item. */
export interface AdminUser {
  userId: string;
  userName: string;
  /** ISO datetime string. */
  registerDate: string;
  role: string;
}

/** /api/admin/stats response. */
export interface AdminStats {
  totalUsers: number;
  totalTrades: number;
  totalRealisedPnl: number;
}

/** Wrapped shape returned by paginated list endpoints (/api/trades, /api/admin/users, /api/admin/trades). */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
