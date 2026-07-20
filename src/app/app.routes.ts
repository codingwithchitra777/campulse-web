import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

/**
 * Every page is lazy-loaded (`loadComponent`) so the initial bundle carries only
 * the app shell — heavy per-page deps (chart.js on dashboard/portfolio) load on
 * navigation. Guards stay eager: they must run before the chunk is fetched.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent)
  },
  {
    path: 'portfolio',
    loadComponent: () => import('./pages/portfolio/portfolio').then(m => m.PortfolioComponent),
    canActivate: [authGuard]
  },
  {
    path: 'trades',
    loadComponent: () => import('./pages/trades/trades').then(m => m.TradesComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'record', pathMatch: 'full' },
      {
        path: 'record',
        loadComponent: () => import('./pages/record-trade/record-trade').then(m => m.RecordTradeComponent)
      },
      // History moved to the top-level /history route (Tools group); keep old links working.
      { path: 'history', redirectTo: '/history' }
    ]
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/history/history').then(m => m.HistoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/admin/admin-users/admin-users').then(m => m.AdminUsersComponent)
      },
      {
        path: 'trades',
        loadComponent: () => import('./pages/admin/admin-trades/admin-trades').then(m => m.AdminTradesComponent)
      },
      {
        path: 'corporate-actions',
        loadComponent: () => import('./pages/admin/admin-corp-actions/admin-corp-actions').then(m => m.AdminCorpActionsComponent)
      },
      {
        path: 'market-events',
        loadComponent: () => import('./pages/admin/admin-market-events/admin-market-events').then(m => m.AdminMarketEventsComponent)
      },
      {
        path: 'exchange-rates',
        loadComponent: () => import('./pages/admin/admin-exchange-rates/admin-exchange-rates').then(m => m.AdminExchangeRatesComponent)
      }
    ]
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'analytics',
    loadComponent: () => import('./pages/analytics/analytics').then(m => m.AnalyticsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'watchlist',
    loadComponent: () => import('./pages/watchlist/watchlist').then(m => m.WatchlistComponent),
    canActivate: [authGuard]
  },
  {
    path: 'alerts',
    loadComponent: () => import('./pages/alerts/alerts').then(m => m.AlertsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'market-calendar',
    loadComponent: () => import('./pages/market-calendar/market-calendar').then(m => m.MarketCalendarComponent),
    canActivate: [authGuard]
  },
  {
    path: 'journal',
    loadComponent: () => import('./pages/journal/journal').then(m => m.JournalComponent),
    canActivate: [authGuard]
  },
  {
    path: 'ai-coach',
    loadComponent: () => import('./pages/ai-coach/ai-coach').then(m => m.AiCoachComponent),
    canActivate: [authGuard]
  },
  {
    path: 'loans',
    loadComponent: () => import('./pages/loans/loans').then(m => m.LoansComponent),
    canActivate: [authGuard]
  },
  {
    // Public on purpose: pure client-side tool, useful to guests too.
    path: 'loan-calculator',
    loadComponent: () => import('./pages/loan-calculator/loan-calculator').then(m => m.LoanCalculatorComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
