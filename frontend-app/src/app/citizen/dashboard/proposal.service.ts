import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CitizenProposal, ProposalTheme } from './dashboard';

export interface CreateProposalPayload {
  title: string;
  theme: ProposalTheme;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  authorName: string;
  userId?: number | string;
}

@Injectable({ providedIn: 'root' })
export class ProposalService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/proposals';

  getProposals(): Observable<CitizenProposal[]> {
    return this.http.get<CitizenProposal[]>(this.apiUrl);
  }

  createProposal(payload: CreateProposalPayload): Observable<CitizenProposal> {
    return this.http.post<CitizenProposal>(this.apiUrl, payload);
  }

  toggleVote(id: number, userId?: number | string): Observable<CitizenProposal> {
    const url = userId !== undefined && userId !== null
      ? `${this.apiUrl}/${id}/vote?userId=${userId}`
      : `${this.apiUrl}/${id}/vote`;
    return this.http.put<CitizenProposal>(url, {});
  }
}