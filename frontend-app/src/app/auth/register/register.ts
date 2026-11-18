import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
  nom = '';
  prenom = '';
  email = '';
  telephone = '';
  password = '';
  confirmPassword = '';

  showPassword = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onRegister() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.nom || !this.prenom || !this.email || !this.telephone || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    const newCitizen = {
      nom: this.nom,
      prenom: this.prenom,
      email: this.email,
      telephone: this.telephone,
      password: this.password,
      role: 'CITOYEN'
    };

    this.http.post<any>('http://localhost:8080/api/auth/register', newCitizen).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Compte créé avec succès ! Redirection vers la connexion...';
        this.cdr.detectChanges();

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1200);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Erreur lors de la création du compte.';
        this.cdr.detectChanges();
      }
    });
  }
}