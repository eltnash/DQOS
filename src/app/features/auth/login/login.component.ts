import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { TabsModule } from 'primeng/tabs';

import { AuthService } from '../../../core/auth/auth.service';
import { PageSkeletonComponent } from '../../../shared/components/page-skeleton/page-skeleton.component';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    TabsModule,
    PageSkeletonComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly signInForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly signUpForm = this.fb.nonNullable.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected async onSignIn(): Promise<void> {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      this.errorMessage.set('Enter a valid email and password (min 6 characters).');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      const { email, password } = this.signInForm.getRawValue();
      await this.auth.signIn(email, password);
      await this.router.navigate(['/accounts']);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async onSignUp(): Promise<void> {
    if (this.signUpForm.invalid) {
      this.signUpForm.markAllAsTouched();
      this.errorMessage.set('Use a valid email like name@example.com and a password of at least 6 characters.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const { email, password, displayName } = this.signUpForm.getRawValue();
      await this.auth.signUp(email, password, displayName || undefined);
      this.successMessage.set('Account created. Check your email if confirmation is enabled, then sign in.');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      this.submitting.set(false);
    }
  }
}
