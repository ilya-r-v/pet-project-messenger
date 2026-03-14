import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AsyncPipe, NgIf } from '@angular/common';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, NgIf, AsyncPipe],
    styleUrls: ['./navbar.component.scss'],
    templateUrl: './navbar.component.html',
    })

export class NavbarComponent {
    constructor(public authService: AuthService) {}

    logout() {
        this.authService.logout();
    }
}