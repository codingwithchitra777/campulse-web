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
      {
        path: 'history',
        loadComponent: () => import('./pages/history/history').then(m => m.HistoryComponent)
      }
    ]
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent),
    canActivate: [authGuard, adminGuard]
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
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
