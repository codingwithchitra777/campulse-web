import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html'
})
export class LoginComponent implements OnInit, AfterViewInit {
  readonly apiService = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private returnUrl = 'dashboard';

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || 'dashboard';
    
    // If already logged in, redirect away
    if (!this.apiService.isGuest()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  ngAfterViewInit() {
    this.initializeGoogleSignIn();
  }

  initializeGoogleSignIn() {
    setTimeout(() => {
      try {
        const google = (window as any).google;
        if (google && google.accounts && google.accounts.id) {
          google.accounts.id.initialize({
            client_id: '1048965896991-dirq98278c5cj312k2o0kq3f307e2krf.apps.googleusercontent.com',
            callback: (response: any) => this.handleCredentialResponse(response)
          });

          const btnEl = document.getElementById('googleBtnWall');
          if (btnEl) {
            google.accounts.id.renderButton(btnEl, {
              theme: 'filled_blue',
              size: 'large',
              width: 280,
              shape: 'pill'
            });
          }
        }
      } catch (e) {
        console.warn('Google Sign-in init error on login page:', e);
      }
    }, 100);
  }

  handleCredentialResponse(response: any) {
    this.apiService.googleLogin(response.credential).subscribe({
      next: (res) => {
        if (res && res.success) {
          const profile = {
            userId: res.userId,
            name: res.userName,
            email: res.email
          };
          localStorage.setItem('google_profile', JSON.stringify(profile));
          this.apiService.googleProfile.set(profile);
          this.apiService.activeUserId.set(res.userId);
          
          this.router.navigate([this.returnUrl]);
        }
      },
      error: (err) => console.error('Google Auth failed:', err)
    });
  }

  loginAsDemoUser(userId: string) {
    this.apiService.loginAsDemo(userId, 'Sabay (Demo)');
    this.router.navigate([this.returnUrl]);
  }
}
