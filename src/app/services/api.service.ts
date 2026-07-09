import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AdminStats,
  AdminUser,
  GoogleAuthResponse,
  Holding,
  Position,
  Price,
  TopOrder,
  TopTicker,
  Trade,
  TradeInitResult,
  TradePayload,
  TradeResult
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

  getTrades(ticker?: string): Observable<Trade[]> {
    return this.http.get<Trade[]>(`${this.baseUrl}/api/trades`, {
      params: ticker ? { ticker } : {}
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

  getPosition(symbol: string): Observable<Position> {
    return this.http.get<Position>(`${this.baseUrl}/api/position/${symbol}`);
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

  googleLogin(credential: string): Observable<GoogleAuthResponse> {
    return this.http.post<GoogleAuthResponse>(`${this.baseUrl}/api/auth/google`, { credential });
  }

  demoLogin(userId: string, userName: string): Observable<GoogleAuthResponse> {
    return this.http.post<GoogleAuthResponse>(`${this.baseUrl}/api/auth/demo`, { userId, userName });
  }

  getAllUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.baseUrl}/api/admin/users`);
  }

  updateUserRole(userId: string, role: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.baseUrl}/api/admin/users/${userId}/role`, { role });
  }

  getAllTrades(): Observable<Trade[]> {
    return this.http.get<Trade[]>(`${this.baseUrl}/api/admin/trades`);
  }

  getAdminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.baseUrl}/api/admin/stats`);
  }
}
