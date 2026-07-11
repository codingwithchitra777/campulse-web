import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { PortfolioComponent } from './pages/portfolio/portfolio';
import { RecordTradeComponent } from './pages/record-trade/record-trade';
import { HistoryComponent } from './pages/history/history';
import { LoginComponent } from './pages/login/login';
import { AdminComponent } from './pages/admin/admin';
import { SettingsComponent } from './pages/settings/settings';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'portfolio', component: PortfolioComponent, canActivate: [authGuard] },
  { path: 'record-trade', component: RecordTradeComponent, canActivate: [authGuard] },
  { path: 'history', component: HistoryComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [authGuard, adminGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
  { path: '**', redirectTo: 'dashboard' }
];
