import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';

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

    constructor(private authService: AuthService, private router: Router) {}

    onSubmit() {
        this.authService.register(this.userData).subscribe({
        next: () => {
            this.successMessage = 'Redirecting...';
            setTimeout(() => this.router.navigate(['/auth/login']), 2000);
        },
        error: (err) => {
            this.errorMessage = err.error?.error || 'Registration failed';
        }
        });
    }
}