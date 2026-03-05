import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { AuthComponent } from './auth/auth.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    {path: 'auth', component: AuthComponent},
    {path: 'home', component: HomeComponent, canActivate: [authGuard]},
    {path: '', redirectTo: '/auth', pathMatch: 'full'},
    {path: '**', redirectTo: '/auth'},
];
