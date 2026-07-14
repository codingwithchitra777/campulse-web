import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { App } from './app';
import { SessionService } from './services/session.service';

@Component({ template: '' })
class DummyPage {}

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.body.classList.remove('light');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: DummyPage },
          { path: 'dashboard', component: DummyPage },
          { path: 'login', component: DummyPage },
          { path: 'settings', component: DummyPage },
        ]),
        // No HTTP loader needed: with no translations loaded the pipe renders
        // the key itself, which is all these DOM assertions rely on.
        provideTranslateService({ fallbackLang: 'en' }),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
    document.body.classList.remove('light');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the sidebar logo', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('CamPulse');
  });

  it('sidebar toggle collapses and restores the sidebar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const sidebar = compiled.querySelector<HTMLElement>('.sidebar')!;
    const toggleBtn = compiled.querySelector<HTMLButtonElement>('.sidebar-toggle-btn')!;

    expect(sidebar.classList.contains('collapsed')).toBe(false);

    toggleBtn.click();
    await fixture.whenStable();
    expect(sidebar.classList.contains('collapsed')).toBe(true);
    expect(localStorage.getItem('sidebar_collapsed')).toBe('1');

    toggleBtn.click();
    await fixture.whenStable();
    expect(sidebar.classList.contains('collapsed')).toBe(false);
  });

  it('theme toggle applies the light class to <body> and back', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const themeBtn = compiled.querySelector<HTMLButtonElement>('.theme-toggle-btn')!;

    expect(document.body.classList.contains('light')).toBe(false);

    themeBtn.click();
    await fixture.whenStable();
    expect(document.body.classList.contains('light')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('light');

    themeBtn.click();
    await fixture.whenStable();
    expect(document.body.classList.contains('light')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('sign out from the profile dropdown clears the session', async () => {
    localStorage.setItem(
      'google_profile',
      JSON.stringify({ userId: 'u-test', name: 'Chitra Sem', email: 'c@x.com' })
    );

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const session = TestBed.inject(SessionService);
    expect(session.isGuest()).toBe(false);

    const compiled = fixture.nativeElement as HTMLElement;
    // Open the profile dropdown (clicking the user chip in the sidebar footer)
    const userChip = compiled.querySelector<HTMLElement>('.sidebar-user')!;
    expect(userChip).toBeTruthy();
    userChip.click();
    await fixture.whenStable();

    // Sign out is the <button> in the dropdown; the <a> sibling is Settings.
    const signOut = compiled.querySelector<HTMLButtonElement>('button.signout-btn-modern')!;
    expect(signOut).toBeTruthy();
    signOut.click();
    await fixture.whenStable();

    expect(session.isGuest()).toBe(true);
    expect(localStorage.getItem('google_profile')).toBeNull();
  });
});
