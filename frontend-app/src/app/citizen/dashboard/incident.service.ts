import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Incident } from './dashboard';
export interface CreateIncidentPayload {
  title: string;
  description: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  userId?: number | string;
}

@Injectable({
  providedIn: 'root'
})
export class IncidentService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/incidents';

  getIncidents(): Observable<Incident[]> {
    return this.http.get<Incident[]>(this.apiUrl);
  }

  createIncident(data: CreateIncidentPayload, photo?: File | null): Observable<Incident> {
    const formData = new FormData();
    if (data.userId !== undefined && data.userId !== null) {
  formData.append('userId', String(data.userId));
}
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('category', data.category);
    formData.append('address', data.address);
    formData.append('latitude', data.latitude.toString());
    formData.append('longitude', data.longitude.toString());

    if (photo) {
      formData.append('photo', photo, photo.name);
    }

    return this.http.post<Incident>(this.apiUrl, formData);
  }

 upvoteIncident(id: number, userId?: number | string): Observable<Incident> {
  const url = userId !== undefined && userId !== null
    ? `${this.apiUrl}/${id}/upvote?userId=${userId}`
    : `${this.apiUrl}/${id}/upvote`;
  return this.http.put<Incident>(url, {});
}
}