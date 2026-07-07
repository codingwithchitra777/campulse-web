import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly apiService = inject(ApiService);
  private router = inject(Router);

  constructor() {
    // Automatically initialize Google button in the header whenever auth state changes
    effect(() => {
      this.apiService.googleProfile();
      this.initializeGoogleSignIn();
    });
  }

  ngOnInit() {
    // Initialization handled dynamically in GSI effect
  }

  initializeGoogleSignIn() {
    setTimeout(() => {
      try {
        const google = (window as any).google;
        if (google && google.accounts && google.accounts.id) {
          google.accounts.id.initialize({
            client_id: '1048965896991-dirq98278c5cj312k2o0kq3f307e2krf.apps.googleusercontent.com',
            callback: (response: any) => this.handleGoogleSignIn(response.credential)
          });

          // Render button in header (if visible)
          const btnEl = document.getElementById('googleBtn');
          if (btnEl) {
            google.accounts.id.renderButton(btnEl, {
              type: 'standard',
              shape: 'rectangular',
              theme: 'dark',
              text: 'signin_with',
              size: 'medium',
              logo_alignment: 'left'
            });
          }
        } else {
          setTimeout(() => this.initializeGoogleSignIn(), 300);
        }
      } catch (err) {
        console.error('Failed to initialize Google Sign-In in header:', err);
      }
    }, 100);
  }

  handleGoogleSignIn(credential: string) {
    this.apiService.googleLogin(credential).subscribe({
      next: (res) => {
        const profile = {
          userId: res.userId,
          name: res.userName,
          email: res.email
        };
        localStorage.setItem('google_profile', JSON.stringify(profile));
        this.apiService.googleProfile.set(profile);
        this.apiService.activeUserId.set(res.userId);
        
        // Refresh active page state
        window.location.reload();
      },
      error: (err) => {
        console.error('Google Sign-In failed', err);
        const errMsg = err.error?.detail || err.error?.error || 'Invalid credentials';
        alert('Google Authentication Failed: ' + errMsg);
      }
    });
  }

  logoutGoogle() {
    this.apiService.logout();
    this.router.navigate(['/dashboard']).then(() => {
      window.location.reload();
    });
  }

  refreshActivePage() {
    const currentUrl = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate([currentUrl]);
    });
  }
}
