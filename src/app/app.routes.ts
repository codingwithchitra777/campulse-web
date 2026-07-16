import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { PortfolioComponent } from './pages/portfolio/portfolio';
import { RecordTradeComponent } from './pages/record-trade/record-trade';
import { HistoryComponent } from './pages/history/history';
import { TradesComponent } from './pages/trades/trades';
import { LoginComponent } from './pages/login/login';
import { AdminComponent } from './pages/admin/admin';
import { SettingsComponent } from './pages/settings/settings';
import { AnalyticsComponent } from './pages/analytics/analytics';
import { WatchlistComponent } from './pages/watchlist/watchlist';
import { AlertsComponent } from './pages/alerts/alerts';
import { JournalComponent } from './pages/journal/journal';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'portfolio', component: PortfolioComponent, canActivate: [authGuard] },
  { 
    path: 'trades', 
    component: TradesComponent, 
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'record', pathMatch: 'full' },
      { path: 'record', component: RecordTradeComponent },
      { path: 'history', component: HistoryComponent }
    ]
  },
  { path: 'admin', component: AdminComponent, canActivate: [authGuard, adminGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [authGuard] },
  { path: 'watchlist', component: WatchlistComponent, canActivate: [authGuard] },
  { path: 'alerts', component: AlertsComponent, canActivate: [authGuard] },
  { path: 'journal', component: JournalComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
  { path: '**', redirectTo: 'dashboard' }
];
