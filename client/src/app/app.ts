import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LoginComponent, RegisterComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {
  activeForm: 'login' | 'register' = 'login';

  showLogin() {
    this.activeForm = 'login';
  }

  showRegister() {
    this.activeForm = 'register';
  }
}