import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  IncidentStatus,
  ProposalStatus,
  ServiceIncident,
  ServiceProposal,
  TeamKey
} from './chef.model';

@Injectable({
  providedIn: 'root'
})
export class ChefService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api';

  private getAuthHeaders(): HttpHeaders {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return new HttpHeaders({
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
  }

  getAllIncidents(): Observable<ServiceIncident[]> {
    return this.http.get<ServiceIncident[]>(`${this.apiUrl}/incidents`, {
      headers: this.getAuthHeaders()
    });
  }

  getAllProposals(): Observable<ServiceProposal[]> {
    return this.http.get<ServiceProposal[]>(`${this.apiUrl}/proposals`, {
      headers: this.getAuthHeaders()
    });
  }

  updateIncidentStatus(
    id: number,
    status: IncidentStatus,
    payload?: { resolutionNote?: string; resolutionPhotoUrl?: string }
  ): Observable<ServiceIncident> {
    return this.http.put<ServiceIncident>(
      `${this.apiUrl}/incidents/${id}/status`,
      { status, ...payload },
      { headers: this.getAuthHeaders() }
    );
  }

  assignIncidentTeam(id: number, teamKey: TeamKey, teamLabel: string): Observable<ServiceIncident> {
    return this.http.put<ServiceIncident>(
      `${this.apiUrl}/incidents/${id}/assign`,
      { assignedTeam: teamKey, assignedTeamLabel: teamLabel },
      { headers: this.getAuthHeaders() }
    );
  }

  updateProposalStatus(id: number, status: ProposalStatus): Observable<ServiceProposal> {
    return this.http.put<ServiceProposal>(
      `${this.apiUrl}/proposals/${id}/status`,
      { status },
      { headers: this.getAuthHeaders() }
    );
  }
}