import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-feature-placeholder',
  imports: [CardModule],
  template: `
    <section class="feature-placeholder">
      <p-card [header]="pageTitle" [subheader]="pageSubtitle">
        <p>{{ pageDescription }}</p>
      </p-card>
    </section>
  `,
  styles: `
    .feature-placeholder {
      max-width: 720px;
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
}
