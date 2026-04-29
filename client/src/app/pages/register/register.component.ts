import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CryptoService } from '../../core/services/crypto.service';
import { ApiService } from '../../core/services/api.service';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIf],
  styleUrls: ['./register.component.scss'],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  userData = { email: '', firstName: '', lastName: '', password: '' };
  errorMessage = '';
  successMessage = '';

  constructor(
    private authService: AuthService,
    private cryptoService: CryptoService,
    private apiService: ApiService,
    private router: Router,
  ) {}

  onSubmit() {
    this.authService.register(this.userData).pipe(
      switchMap(() => this.authService.login({
        email: this.userData.email,
        password: this.userData.password,
      })),
    ).subscribe({
      next: async () => {
        try {
          const { publicKey, privateKey } = await this.cryptoService.generateKeypair();
          await this.cryptoService.storePrivateKey(privateKey);

          this.apiService.savePublicKey(publicKey).subscribe();

          this.successMessage = 'Аккаунт создан. Перенаправление...';
          setTimeout(() => this.router.navigate(['/main']), 1500);
        } catch (err) {
          console.error('Ошибка генерации ключей:', err);
          this.router.navigate(['/main']);
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Ошибка регистрации';
      },
    });
  }
}