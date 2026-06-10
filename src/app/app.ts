import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth/auth.service';
import { PageSkeletonComponent } from './shared/components/page-skeleton/page-skeleton.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PageSkeletonComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
}
