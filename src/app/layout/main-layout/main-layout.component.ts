import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  label: string;
  path: string;
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

  /** Parent route for sidebar links — resolves sibling child routes correctly. */
  protected readonly route = inject(ActivatedRoute);

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: 'dashboard', icon: 'pi pi-chart-bar' },
    { label: 'Gatekeeper', path: 'gatekeeper', icon: 'pi pi-shield' },
    { label: 'Journal', path: 'journal', icon: 'pi pi-table' },
    { label: 'Setups', path: 'setups', icon: 'pi pi-book' },
    { label: 'Edge Lab', path: 'lab', icon: 'pi pi-sparkles' },
  ];

  protected readonly userEmail = () => this.auth.user()?.email ?? '';

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
