import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AdminStats,
  AdminUser,
  Analytics,
  GoogleAuthResponse,
  Holding,
  NewsItem,
  PriceAlert,
  WatchlistItem,
  LinkCodeResponse,
  LinkedAccount,
  ManualPrice,
  MarketQuote,
  MarketSearchResult,
  Paginated,
  Position,
  Price,
  TopOrder,
  TopTicker,
  Trade,
  TradeEditPayload,
  TradeInitResult,
  TelegramAuthPayload,
  TradePayload,
  TradeResult,
  YearlyPnl
} from '../models';
import { API_BASE_URL } from '../app.constants';

/**
 * Pure HTTP client for the campulse-backend API.
 * Auth/session state lives in SessionService; the Authorization bearer
 * token is attached by authInterceptor (see app.config.ts).
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = API_BASE_URL;

  getPrices(): Observable<Price[]> {
    return this.http.get<Price[]>(`${this.baseUrl}/api/prices`);
  }

  getPrice(symbol: string): Observable<Price> {
    return this.http.get<Price>(`${this.baseUrl}/api/price/${symbol}`);
  }

  getTrades(ticker?: string, limit = 50, offset = 0): Observable<Paginated<Trade>> {
    return this.http.get<Paginated<Trade>>(`${this.baseUrl}/api/trades`, {
      params: { ...(ticker ? { ticker } : {}), limit, offset }
    });
  }

  addTrade(trade: TradePayload): Observable<TradeResult> {
    return this.http.post<TradeResult>(`${this.baseUrl}/api/trades`, trade);
  }

  initTrade(trade: TradePayload): Observable<TradeInitResult> {
    return this.http.post<TradeInitResult>(`${this.baseUrl}/api/trades/init`, trade);
  }

  confirmTrade(trade: TradePayload): Observable<TradeResult> {
    return this.http.post<TradeResult>(`${this.baseUrl}/api/trades/confirm`, trade);
  }

  updateTrade(tradeId: string, payload: TradeEditPayload): Observable<Trade> {
    return this.http.patch<Trade>(`${this.baseUrl}/api/trades/${tradeId}`, payload);
  }

  deleteTrade(tradeId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/api/trades/${tradeId}`);
  }

  updateJournal(tradeId: string, body: { note?: string; tags?: string }): Observable<Trade> {
    return this.http.patch<Trade>(`${this.baseUrl}/api/trades/${tradeId}/journal`, body);
  }

  getPosition(symbol: string, market?: string): Observable<Position> {
    return this.http.get<Position>(`${this.baseUrl}/api/position/${symbol}`, {
      params: market ? { market } : {}
    });
  }

  /** Finnhub symbol lookup for US equities. */
  searchSymbols(q: string): Observable<{ results: MarketSearchResult[] }> {
    return this.http.get<{ results: MarketSearchResult[] }>(`${this.baseUrl}/api/market/search`, {
      params: { q }
    });
  }

  /** Market-aware live quote (CSX feed / Finnhub / gold board). */
  getMarketQuote(symbol: string, market: string): Observable<MarketQuote> {
    return this.http.get<MarketQuote>(`${this.baseUrl}/api/market/quote/${symbol}`, {
      params: { market }
    });
  }

  getManualPrices(): Observable<{ items: ManualPrice[] }> {
    return this.http.get<{ items: ManualPrice[] }>(`${this.baseUrl}/api/admin/manual-prices`);
  }

  setManualPrice(body: { price: number; market?: string; symbol?: string; currency?: string; change?: number }) {
    return this.http.put<any>(`${this.baseUrl}/api/admin/manual-price`, body);
  }

  getPortfolio(): Observable<Holding[]> {
    return this.http.get<Holding[]>(`${this.baseUrl}/api/portfolio`);
  }

  getTopOrders(): Observable<TopOrder[]> {
    return this.http.get<TopOrder[]>(`${this.baseUrl}/api/top-orders`);
  }

  getTopTickers(): Observable<TopTicker[]> {
    return this.http.get<TopTicker[]>(`${this.baseUrl}/api/top-tickers`);
  }

  getYearlyPnl(): Observable<YearlyPnl[]> {
    return this.http.get<YearlyPnl[]>(`${this.baseUrl}/api/pnl/yearly`);
  }

  getAnalytics(): Observable<Analytics> {
    return this.http.get<Analytics>(`${this.baseUrl}/api/analytics`);
  }

  getWatchlist(): Observable<{ items: WatchlistItem[] }> {
    return this.http.get<{ items: WatchlistItem[] }>(`${this.baseUrl}/api/watchlist`);
  }

  addWatchlist(body: { symbol: string; market?: string; currency?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/watchlist`, body);
  }

  removeWatchlist(symbol: string, market: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/api/watchlist/${symbol}`, {
      params: { market }
    });
  }

  getSymbolNews(symbol: string, days = 7): Observable<{ symbol: string; news: NewsItem[] }> {
    return this.http.get<{ symbol: string; news: NewsItem[] }>(`${this.baseUrl}/api/market/news/${symbol}`, {
      params: { days }
    });
  }

  getAlerts(): Observable<{ items: PriceAlert[]; deliverable: boolean }> {
    return this.http.get<{ items: PriceAlert[]; deliverable: boolean }>(`${this.baseUrl}/api/alerts`);
  }

  createAlert(body: { symbol: string; targetPrice: number; market?: string; currency?: string; direction?: 'above' | 'below' }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/alerts`, body);
  }

  removeAlert(alertId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/api/alerts/${alertId}`);
  }

  getChartsTimeline(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/charts/timeline`);
  }

  googleLogin(credential: string): Observable<GoogleAuthResponse> {
    return this.http.post<GoogleAuthResponse>(`${this.baseUrl}/api/auth/google`, { credential });
  }

  demoLogin(userId: string, userName: string): Observable<GoogleAuthResponse> {
    return this.http.post<GoogleAuthResponse>(`${this.baseUrl}/api/auth/demo`, { userId, userName });
  }

  telegramLogin(payload: TelegramAuthPayload): Observable<GoogleAuthResponse> {
    return this.http.post<GoogleAuthResponse>(`${this.baseUrl}/api/auth/telegram`, payload);
  }

  telegramWebAppLogin(initData: string): Observable<GoogleAuthResponse> {
    return this.http.post<GoogleAuthResponse>(`${this.baseUrl}/api/auth/telegram-webapp`, { initData });
  }

  createLinkCode(): Observable<LinkCodeResponse> {
    return this.http.post<LinkCodeResponse>(`${this.baseUrl}/api/auth/link/code`, {});
  }

  getLinks(): Observable<{ success: boolean; links: LinkedAccount[] }> {
    return this.http.get<{ success: boolean; links: LinkedAccount[] }>(`${this.baseUrl}/api/auth/links`);
  }

  removeLink(aliasUserId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/api/auth/links/${aliasUserId}`);
  }

  getAllUsers(limit = 50, offset = 0): Observable<Paginated<AdminUser>> {
    return this.http.get<Paginated<AdminUser>>(`${this.baseUrl}/api/admin/users`, {
      params: { limit, offset }
    });
  }

  updateUserRole(userId: string, role: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.baseUrl}/api/admin/users/${userId}/role`, { role });
  }

  getAllTrades(limit = 50, offset = 0): Observable<Paginated<Trade>> {
    return this.http.get<Paginated<Trade>>(`${this.baseUrl}/api/admin/trades`, {
      params: { limit, offset }
    });
  }

  getAdminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.baseUrl}/api/admin/stats`);
  }
}
