import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { HomeComponent } from './home/home.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LoginComponent, RegisterComponent, HomeComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {
  activeForm: 'login' | 'register' = 'login';

  constructor(public authService: AuthService) {}

  showLogin() {
    this.activeForm = 'login';
  }

  showRegister() {
    this.activeForm = 'register';
  }
}