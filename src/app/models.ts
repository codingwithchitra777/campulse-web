/**
 * Typed models mirroring the campulse-backend API responses.
 * Field names match the backend serializers exactly (see app/services/portfolio.py,
 * app/api/v1/endpoints/*.py in campulse-backend).
 */

export type TradeSide = 'BUY' | 'SELL';

/** A tradable market and its denominating currency (mirrors campulse-backend markets.py). */
export type MarketKind = 'CSX' | 'US' | 'GOLD_KH';
export type CurrencyCode = 'KHR' | 'USD';

/** /api/market/search item (Finnhub symbol lookup for US equities). */
export interface MarketSearchResult {
  symbol: string;
  description: string;
  type: string;
}

/** /api/market/quote/{symbol} response. */
export interface MarketQuote {
  ticker: string;
  market: string;
  price: number;
  change: number | null;
  changeDirection: 'up' | 'down' | 'equal' | null;
}

/** /api/admin/manual-prices item — an admin-set board price (local gold). */
export interface ManualPrice {
  market: string;
  symbol: string;
  price: number;
  currency: string;
  change: number;
  updatedBy: string | null;
  /** ISO datetime string. */
  updatedAt: string;
}

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
  /** Avatar URL from the provider (Google `picture` claim / Telegram `photo_url`). */
  picture?: string | null;
}

/** The Telegram Login Widget's signed user object, sent verbatim to /api/auth/telegram. */
export interface TelegramAuthPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** POST /api/auth/link/code response — a one-time code + the bot deep link to redeem it. */
export interface LinkCodeResponse {
  success: boolean;
  code: string;
  deepLink: string;
  botUsername: string;
}

/** /api/auth/links item — a Telegram account linked into this (primary) account. */
export interface LinkedAccount {
  aliasUserId: string;
  userName: string | null;
  chatId: number | null;
  /** ISO datetime string. */
  linkedAt: string;
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
  market: MarketKind;
  currency: CurrencyCode;
  /** Journal note + comma-separated tags (nullable). */
  note?: string | null;
  tags?: string | null;
}

/**
 * POST body for /api/trades[/init|/confirm].
 * `commission` is honored by the backend when provided; when omitted the
 * backend computes it as price * qty * 0.0047.
 */
export interface TradePayload {
  /** YYYY-MM-DD; omitted = today (server stamps utcnow). */
  orderDate?: string;
  ticker: string;
  side: TradeSide;
  price: number;
  qty: number;
  commission?: number;
  /** Omitted = CSX/KHR (backend default). */
  market?: MarketKind;
  currency?: CurrencyCode;
}

/**
 * PATCH body for /api/trades/{tradeId}. Only untouched BUY trades are
 * editable (side is immutable — delete + re-add to flip it).
 */
export interface TradeEditPayload {
  /** YYYY-MM-DD; omitted = keep the trade's current date. */
  orderDate?: string;
  ticker: string;
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
  market: MarketKind;
  currency: CurrencyCode;
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

/** /api/pnl/yearly — per-ticker contribution inside a year row. */
export interface YearlyPnlTicker {
  ticker: string;
  realisedPnl: number;
  sellCount: number;
}

/** /api/pnl/yearly item — realized P/L grouped by the sell trade's year. */
export interface YearlyPnl {
  year: number;
  realisedPnl: number;
  sellCount: number;
  tickers: YearlyPnlTicker[];
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

/** /api/analytics — per-currency roll-up + descriptive stats. */
export interface AnalyticsCurrency {
  currency: CurrencyCode;
  realisedPnl: number;
  unrealisedPnl: number;
  invested: number;
  value: number;
  wins: number;
  losses: number;
}

export interface AnalyticsMarket {
  market: MarketKind;
  currency: CurrencyCode;
  positions: number;
  invested: number;
}

export interface ClosedTradeSummary {
  ticker: string;
  market: MarketKind;
  currency: CurrencyCode;
  realisedPnl: number;
  /** ISO datetime string. */
  sellDate: string;
}

export interface AnalyticsTag {
  tag: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface Analytics {
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  closedTradeCount: number;
  wins: number;
  losses: number;
  winRate: number;
  avgHoldDays: number;
  bestTrade: ClosedTradeSummary | null;
  worstTrade: ClosedTradeSummary | null;
  byCurrency: AnalyticsCurrency[];
  byMarket: AnalyticsMarket[];
  byTag: AnalyticsTag[];
}

/** /api/watchlist item — a tracked symbol with a live quote. */
export interface WatchlistItem {
  market: MarketKind;
  symbol: string;
  currency: CurrencyCode;
  /** ISO datetime string. */
  addedAt: string;
  price: number | null;
  change: number | null;
  changeDirection: 'up' | 'down' | 'equal' | null;
}

/** /api/market/news/{symbol} item (Finnhub company news, US symbols only). */
export interface NewsItem {
  headline: string;
  summary: string | null;
  source: string;
  url: string;
  image: string | null;
  /** unix seconds */
  datetime: number;
  category: string | null;
}

/** /api/alerts item — a one-shot price alert delivered via linked Telegram. */
export interface PriceAlert {
  alertId: string;
  market: MarketKind;
  symbol: string;
  currency: CurrencyCode;
  targetPrice: number;
  direction: 'above' | 'below';
  active: boolean;
  /** ISO datetime string. */
  createdAt: string | null;
  triggeredAt: string | null;
}

/** Wrapped shape returned by paginated list endpoints (/api/trades, /api/admin/users, /api/admin/trades). */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
