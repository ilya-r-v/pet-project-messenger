import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [FormsModule, RouterLink, NgIf],
    styleUrls: ['./login.component.scss'],
    templateUrl: './login.component.html',
})
export class LoginComponent {
    credentials = { email: '', password: '' };
    errorMessage = '';

    constructor(private authService: AuthService, private router: Router) {}

    onSubmit() {
        this.authService.login(this.credentials).subscribe({
            next: (user) => {
            this.router.navigate(['/main']);
            },
            error: (err) => {
            this.errorMessage = err.error?.error || 'Login failed';
            }
        });
    }
}