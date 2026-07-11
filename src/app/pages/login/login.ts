import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SessionService } from '../../services/session.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import { TelegramAuthService } from '../../services/telegram-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html'
})
export class LoginComponent implements OnInit, AfterViewInit {
  private readonly session = inject(SessionService);
  private readonly googleAuth = inject(GoogleAuthService);
  private readonly telegramAuth = inject(TelegramAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private returnUrl = 'dashboard';

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || 'dashboard';

    // If already logged in, redirect away
    if (!this.session.isGuest()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  ngAfterViewInit() {
    this.googleAuth.renderButton(
      'googleBtnWall',
      { theme: 'filled_blue', size: 'large', width: 280, shape: 'pill' },
      () => this.router.navigate([this.returnUrl])
    );
    this.telegramAuth.renderButton('telegramBtnWall', () => this.router.navigate([this.returnUrl]));
  }

  loginAsDemoUser(userId: string) {
    this.googleAuth.demoLogin(userId, 'Sabay (Demo)', () => this.router.navigate([this.returnUrl]));
  }
}
