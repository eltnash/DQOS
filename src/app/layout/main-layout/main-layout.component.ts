import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'pi pi-chart-bar' },
    { label: 'Gatekeeper', route: '/gatekeeper', icon: 'pi pi-shield' },
    { label: 'Journal', route: '/journal', icon: 'pi pi-table' },
    { label: 'Setups', route: '/setups', icon: 'pi pi-book' },
    { label: 'Edge Lab', route: '/lab', icon: 'pi pi-sparkles' },
  ];

  protected readonly userEmail = () => this.auth.user()?.email ?? '';

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
