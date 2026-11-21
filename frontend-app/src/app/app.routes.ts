import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { Dashboard } from './citizen/dashboard/dashboard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'citizen/dashboard', component: Dashboard },
  {
    path: 'chef/dashboard',
    loadComponent: () => import('./chef/dashboard/dashboard').then(m => m.Dashboard)
  }
];