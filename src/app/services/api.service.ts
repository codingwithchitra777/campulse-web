import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'https://campulse-backend.fastapicloud.dev';
  
  // Active User ID signal - allows mock switcher in header to trigger reactive reloading
  // Active User ID signal - allows mock switcher in header to trigger reactive reloading
  readonly activeUserId = signal<string>('u001');

  // Google authentication profile signal
  readonly googleProfile = signal<any | null>(null);

  constructor(private http: HttpClient) {
    // Automatically restore cached session on instantiation
    const cachedProfile = localStorage.getItem('google_profile');
    if (cachedProfile) {
      try {
        const profile = JSON.parse(cachedProfile);
        this.googleProfile.set(profile);
        this.activeUserId.set(profile.userId);
      } catch (e) {
        localStorage.removeItem('google_profile');
        this.activeUserId.set('guest');
      }
    } else {
      this.activeUserId.set('guest');
    }
  }

  isGuest(): boolean {
    return this.googleProfile() === null;
  }

  logout() {
    localStorage.removeItem('google_profile');
    this.googleProfile.set(null);
    this.activeUserId.set('guest');
  }

  loginAsDemo(userId: string, name: string) {
    const profile = { userId, name, email: `${userId}@demo.com` };
    localStorage.setItem('google_profile', JSON.stringify(profile));
    this.googleProfile.set(profile);
    this.activeUserId.set(userId);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-User-Id': this.activeUserId()
    });
  }

  getPrices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/prices`);
  }

  getPrice(symbol: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/price/${symbol}`);
  }

  getTrades(ticker?: string): Observable<any[]> {
    const url = ticker ? `${this.baseUrl}/api/trades?ticker=${ticker}` : `${this.baseUrl}/api/trades`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  addTrade(trade: { ticker: string; side: string; price: number; qty: number }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/trades`, trade, { headers: this.getHeaders() });
  }

  initTrade(trade: { ticker: string; side: string; price: number; qty: number }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/trades/init`, trade, { headers: this.getHeaders() });
  }

  confirmTrade(trade: { ticker: string; side: string; price: number; qty: number }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/trades/confirm`, trade, { headers: this.getHeaders() });
  }

  getPosition(symbol: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/position/${symbol}`, { headers: this.getHeaders() });
  }

  getPortfolio(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/portfolio`, { headers: this.getHeaders() });
  }

  getTopOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/top-orders`, { headers: this.getHeaders() });
  }

  getTopTickers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/top-tickers`, { headers: this.getHeaders() });
  }

  getChartUrl(symbol: string): string {
    return `${this.baseUrl}/api/chart/${symbol}?userId=${this.activeUserId()}`;
  }

  googleLogin(credential: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/auth/google`, { credential });
  }
}
