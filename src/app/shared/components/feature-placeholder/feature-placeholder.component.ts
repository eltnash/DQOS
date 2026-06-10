import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-feature-placeholder',
  imports: [CardModule],
  template: `
    <section class="feature-placeholder">
      @if (comingSoon) {
        <div class="feature-placeholder__banner" role="status">
          <i class="pi pi-sparkles feature-placeholder__banner-icon" aria-hidden="true"></i>
          <div>
            <p class="feature-placeholder__banner-title">Coming soon</p>
            <p class="feature-placeholder__banner-text">
              {{ comingSoonMessage }}
            </p>
          </div>
        </div>
      } @else {
        <p-card [header]="pageTitle" [subheader]="pageSubtitle">
          <p>{{ pageDescription }}</p>
        </p-card>
      }
    </section>
  `,
  styles: `
    .feature-placeholder {
      max-width: 720px;
    }

    .feature-placeholder__banner {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      margin-bottom: 1rem;
      padding: 1rem 1.1rem;
      border: 1px solid rgba(129, 140, 248, 0.35);
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(129, 140, 248, 0.06));
    }

    .feature-placeholder__banner-icon {
      flex-shrink: 0;
      margin-top: 0.1rem;
      font-size: 1.25rem;
      color: #a5b4fc;
    }

    .feature-placeholder__banner-title {
      margin: 0 0 0.25rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: #e0e7ff;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .feature-placeholder__banner-text {
      margin: 0;
      color: #c7d2fe;
      line-height: 1.5;
      font-size: 0.875rem;
    }

    p {
      margin: 0;
      color: #9ca3af;
      line-height: 1.6;
    }
  `,
})
export class FeaturePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly pageTitle = this.route.snapshot.data['title'] as string;
  protected readonly pageSubtitle = this.route.snapshot.data['subtitle'] as string;
  protected readonly pageDescription = this.route.snapshot.data['description'] as string;
  protected readonly comingSoon = Boolean(this.route.snapshot.data['comingSoon']);
  protected readonly comingSoonMessage =
    (this.route.snapshot.data['comingSoonMessage'] as string | undefined) ??
    'This workspace is under active development and will be available in a future release.';
}
