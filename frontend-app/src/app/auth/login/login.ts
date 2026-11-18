import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  email = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    this.errorMessage = '';
    if (!this.email || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs.';
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.http.post<any>('http://localhost:8080/api/auth/login', {
      email: this.email,
      password: this.password
    }).subscribe({
      next: (user) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('token', user.token);
        localStorage.setItem('currentUser', JSON.stringify(user));

        switch (user.role) {
          case 'ADMIN':
            alert(`Bienvenue Admin ${user.prenom} ${user.nom} !`);
            break;
          case 'CHEF_SERVICE':
            alert(`Bienvenue Chef de Service (${user.serviceName}) : ${user.prenom} ${user.nom} !`);
            break;
          case 'MEMBRE_EQUIPE':
            alert(`Bienvenue Membre d'équipe (${user.serviceName}) : ${user.prenom} ${user.nom} !`);
            break;
          case 'CITOYEN':
            alert(`Bienvenue Citoyen(ne) ${user.prenom} ${user.nom} !`);
            break;
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Email ou mot de passe incorrect.';
        this.cdr.detectChanges();
      }
    });
  }
}