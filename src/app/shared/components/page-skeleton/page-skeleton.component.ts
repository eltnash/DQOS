import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

export type PageSkeletonLayout = 'form' | 'table' | 'dashboard' | 'cards';

@Component({
  selector: 'app-page-skeleton',
  imports: [SkeletonModule],
  templateUrl: './page-skeleton.component.html',
  styleUrl: './page-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageSkeletonComponent {
  readonly layout = input<PageSkeletonLayout>('form');
}
