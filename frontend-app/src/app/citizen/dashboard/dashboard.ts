import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IncidentService, CreateIncidentPayload } from './incident.service';
import { ProposalService, CreateProposalPayload } from './proposal.service';

export type IncidentCategory = 'ROAD_DAMAGE' | 'WASTE' | 'STREETLIGHT' | 'WATER_LEAK';

export type ProposalTheme = 'CULTURE' | 'SPORT' | 'ECOLOGY' | 'MOBILITY';

export type IncidentStatus = 'EN_ATTENTE' | 'EN_COURS' | 'RESOLU';

export type ProposalStatus = 'EN_EXAMEN' | 'PLANIFIEE' | 'APPROUVEE';

export interface Incident {
  id: number;
  title: string;
  description: string;
  category: string;
  status: IncidentStatus;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl?: string;
  upvotes: number;
  votedByMe?: boolean;
  dateLabel?: string;
  createdAt?: string;
  isMine?: boolean;
  userId?: string | number;
  voterIds?: number[];
}

export interface CitizenProposal {
  id: number;
  title: string;
  theme: ProposalTheme;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  authorName: string;
  userId?: string | number;
  votes: number;
  votedByMe: boolean;
  status: ProposalStatus;
  dateLabel: string;
  createdAt?: string;
  voterIds?: number[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html'
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {

  private incidentService = inject(IncidentService);
  private proposalService = inject(ProposalService);
  private router = inject(Router);
  private votingIds = new Set<number>();
  private proposalVotingIds = new Set<number>();

  private onWindowResize = (): void => {
  if (this.map) this.map.resize();
  if (this.proposalMap) this.proposalMap.resize();
};
  currentUser = signal<{ id?: number; nom?: string; prenom?: string; email?: string }>({
    prenom: 'Citoyen',
    nom: 'Fès'
  });

  // Navigation & Filtres
  activeTab = signal<'MAP' | 'MY_REPORTS' | 'PROPOSALS'>('MAP');
  activeFilter = signal<IncidentStatus | 'ALL'>('ALL');
  searchQuery = signal('');

  // Formulaire Signalement
  selectedCategory = signal<IncidentCategory>('ROAD_DAMAGE');
  address = signal('Avenue Hassan II, Fès');
  latitude = signal<number>(34.0331);
  longitude = signal<number>(-5.0003);
  description = signal('');
  previewUrl = signal<string | null>(null);
  selectedFile: File | null = null;
  submitting = signal(false);

  categories: { id: IncidentCategory; label: string; icon: string }[] = [
    { id: 'ROAD_DAMAGE', label: 'Voirie', icon: '🚧' },
    { id: 'WASTE', label: 'Déchets', icon: '🗑️' },
    { id: 'STREETLIGHT', label: 'Éclairage', icon: '💡' },
    { id: 'WATER_LEAK', label: "Fuite d'eau", icon: '💧' }
  ];

 // Liste des Signalements (chargée dynamiquement depuis l'API)
  incidents = signal<Incident[]>([]);

  selectedIncident = signal<Incident | null>(null);

  displayedIncidents = computed(() => {
    const base = this.activeTab() === 'MY_REPORTS'
      ? this.incidents().filter(i => i.isMine)
      : this.incidents();
    const status = this.activeFilter();
    const q = this.searchQuery().toLowerCase().trim();

    return base.filter(item => {
      const matchStatus = status === 'ALL' || item.status === status;
      const matchSearch = !q || item.title.toLowerCase().includes(q) || item.address.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  });

  stats = computed(() => {
    const list = this.incidents().filter(i => i.isMine);
    return {
      total: list.length,
      pending: list.filter(i => i.status === 'EN_ATTENTE').length,
      inProgress: list.filter(i => i.status === 'EN_COURS').length,
      resolved: list.filter(i => i.status === 'RESOLU').length
    };
  });

  // Formulaire Propositions (lié à l'utilisateur & carte)
  proposalTitle = signal('');
  proposalTheme = signal<ProposalTheme>('ECOLOGY');
  proposalAddress = signal('Ville Nouvelle, Fès');
  proposalLat = signal<number>(34.0355);
  proposalLng = signal<number>(-5.0020);
  proposalDescription = signal('');

  proposalThemes: { id: ProposalTheme; label: string }[] = [
    { id: 'ECOLOGY', label: '🌿 Écologie' },
    { id: 'CULTURE', label: '🏛️ Culture' },
    { id: 'SPORT', label: '⚽ Sport' },
    { id: 'MOBILITY', label: '🚲 Mobilité' }
  ];

 // Liste des Propositions (chargée dynamiquement depuis l'API)
  proposals = signal<CitizenProposal[]>([]);

  // Instances MapLibre
  private map: any = null;
  private marker: any = null;
  private proposalMap: any = null;
  private proposalMarker: any = null;
  private maplibregl: any = null;
  private incidentMarkers: any[] = [];

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('currentUser');
    if (!token || !userStr) {
      this.router.navigate(['/login']);
      return;
    }
    try {
      this.currentUser.set(JSON.parse(userStr));
    } catch {
      this.router.navigate(['/login']);
      return;
    }

    this.loadIncidentsFromBackend();
    this.loadProposalsFromBackend();
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', this.onWindowResize);
    setTimeout(() => this.initMainMap(), 250);
  }

 ngOnDestroy(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', this.onWindowResize);
  }
  this.destroyMaps();
}

  private destroyMaps(): void {
    this.clearIncidentMarkers();
    if (this.map) { this.map.remove(); this.map = null; this.marker = null; }
    if (this.proposalMap) { this.proposalMap.remove(); this.proposalMap = null; this.proposalMarker = null; }
  }

  private clearIncidentMarkers(): void {
    this.incidentMarkers.forEach(m => m.remove());
    this.incidentMarkers = [];
  }

  private refreshMapMarkers(): void {
    if (!this.map || !this.maplibregl) return;
    this.clearIncidentMarkers();
    this.incidents().forEach(inc => this.addIncidentMarker(inc));
  }

  loadIncidentsFromBackend(): void {
    this.incidentService.getIncidents().subscribe({
      next: (list) => {
        if (!Array.isArray(list)) return;
        const currentUserId = this.currentUser()?.id;
        const formatted: Incident[] = list.map(inc => ({
          ...inc,
          status: (inc.status as IncidentStatus) || 'EN_ATTENTE',
          votedByMe: currentUserId !== undefined && Array.isArray(inc.voterIds)
            ? inc.voterIds.map(String).includes(String(currentUserId))
            : (inc.votedByMe ?? false),
          isMine: this.isOwnedByCurrentUser(inc),
          dateLabel: inc.createdAt
            ? new Date(inc.createdAt).toLocaleDateString('fr-FR')
            : "Aujourd'hui"
        }));
        this.incidents.set(formatted);
        if (formatted.length > 0) {
          this.selectedIncident.set(formatted[0]);
        }
        this.refreshMapMarkers();
      },
      error: (err) => {
        console.warn('Backend indisponible, conservation des données locales :', err);
      }
    });
  }

  loadProposalsFromBackend(): void {
    this.proposalService.getProposals().subscribe({
      next: (list) => {
        if (!Array.isArray(list)) return;
        const currentUserId = this.currentUser()?.id;
        const formatted: CitizenProposal[] = list.map((p: any) => ({
          ...p,
          status: (p.status as ProposalStatus) || 'EN_EXAMEN',
          votedByMe: currentUserId !== undefined && Array.isArray(p.voterIds)
            ? p.voterIds.map(String).includes(String(currentUserId))
            : (p.votedByMe ?? false),
          dateLabel: p.createdAt
            ? new Date(p.createdAt).toLocaleDateString('fr-FR')
            : (p.dateLabel || "Aujourd'hui")
        }));
        this.proposals.set(formatted);
      },
      error: (err) => {
        console.warn('Backend propositions indisponible, conservation des données locales :', err);
      }
    });
  }

  switchTab(tab: 'MAP' | 'MY_REPORTS' | 'PROPOSALS'): void {
    this.activeTab.set(tab);
    this.destroyMaps();

    if (tab === 'MAP') {
      setTimeout(() => this.initMainMap(), 100);
    } else if (tab === 'PROPOSALS') {
      setTimeout(() => this.initProposalMap(), 100);
    }
  }

  getUserInitials(): string {
    const p = this.currentUser().prenom?.[0] || 'C';
    const n = this.currentUser().nom?.[0] || 'F';
    return (p + n).toUpperCase();
  }

  onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files?.[0]) {
    const file = input.files[0];
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(reader.result as string);
    reader.readAsDataURL(file);
    input.value = '';
  }
}

clearPhoto(): void {
  this.selectedFile = null;
  this.previewUrl.set(null);
}

  // Création Signalement (API Spring Boot + MinIO)
  submitReport(): void {
    if (!this.description().trim() || this.submitting()) return;
    this.submitting.set(true);

    const cat = this.categories.find(c => c.id === this.selectedCategory());
    const user = this.currentUser();

    const payload: CreateIncidentPayload = {
      title: `${cat?.label || 'Incident'} · ${this.address()}`,
      description: this.description().trim(),
      category: this.selectedCategory(),
      address: this.address(),
      latitude: this.latitude(),
      longitude: this.longitude(),
      userId: user.id || user.email
    };

    this.incidentService.createIncident(payload, this.selectedFile).subscribe({
      next: (created) => {
        const newIncident: Incident = {
          ...created,
          status: (created.status as IncidentStatus) || 'EN_ATTENTE',
          photoUrl: created.photoUrl || this.previewUrl() || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800',
          upvotes: created.upvotes ?? 1,
          votedByMe: false,
          dateLabel: "À l'instant",
          isMine: true,
          userId: user.id || user.email
        };

        this.incidents.update(list => [newIncident, ...list]);
        this.selectedIncident.set(newIncident);
        this.addIncidentMarker(newIncident);
        this.description.set('');
        this.previewUrl.set(null);
        this.selectedFile = null;
        this.submitting.set(false);
      },
      error: (err) => {
        console.error('Erreur lors de la création du signalement :', err);
        this.submitting.set(false);
      }
    });
  }

  upvote(item: Incident, onUpdated?: () => void): void {
    if (this.votingIds.has(item.id)) return;
    this.votingIds.add(item.id);

    const userId = this.currentUser()?.id;

    this.incidentService.upvoteIncident(item.id, userId).subscribe({
      next: (updated) => {
        const hasVoted = userId !== undefined && Array.isArray(updated.voterIds)
          ? updated.voterIds.map(String).includes(String(userId))
          : !item.votedByMe;

        this.incidents.update(list =>
          list.map(i => {
            if (i.id !== item.id) return i;
            return {
              ...i,
              upvotes: updated.upvotes,
              voterIds: updated.voterIds,
              votedByMe: hasVoted
            };
          })
        );

        if (this.selectedIncident()?.id === item.id) {
          this.selectedIncident.set({
            ...this.selectedIncident()!,
            upvotes: updated.upvotes,
            voterIds: updated.voterIds,
            votedByMe: hasVoted
          });
        }

        this.votingIds.delete(item.id);
        if (onUpdated) onUpdated();
      },
      error: (err) => {
        console.error('Erreur lors du vote :', err);
        this.votingIds.delete(item.id);
      }
    });
  }

  // Création Proposition (API Spring Boot + PostgreSQL)
  submitProposal(): void {
    if (!this.proposalTitle().trim() || !this.proposalDescription().trim()) return;

    const user = this.currentUser();
    const fullName = `${user.prenom || 'Citoyen'} ${user.nom?.[0] || 'F'}.`;

    const payload: CreateProposalPayload = {
      title: this.proposalTitle().trim(),
      theme: this.proposalTheme(),
      address: this.proposalAddress(),
      latitude: this.proposalLat(),
      longitude: this.proposalLng(),
      description: this.proposalDescription().trim(),
      authorName: fullName,
      userId: user.id
    };

    this.proposalService.createProposal(payload).subscribe({
      next: (created: any) => {
        const newProposal: CitizenProposal = {
          ...created,
          votedByMe: true,
          votes: created.votes ?? 1,
          status: (created.status as ProposalStatus) || 'EN_EXAMEN',
          dateLabel: "À l'instant"
        };

        this.proposals.update(list => [newProposal, ...list]);
        this.proposalTitle.set('');
        this.proposalDescription.set('');
      },
      error: (err) => {
        console.error('Erreur lors de la création de la proposition :', err);
      }
    });
  }

  toggleProposalVote(item: CitizenProposal): void {
    if (this.proposalVotingIds.has(item.id)) return;
    this.proposalVotingIds.add(item.id);

    const userId = this.currentUser()?.id;

    this.proposalService.toggleVote(item.id, userId).subscribe({
      next: (updated: any) => {
        const hasVoted = userId !== undefined && Array.isArray(updated.voterIds)
          ? updated.voterIds.map(String).includes(String(userId))
          : !item.votedByMe;

        this.proposals.update(list =>
          list.map(p => p.id === item.id
            ? { ...p, votes: updated.votes, voterIds: updated.voterIds, votedByMe: hasVoted }
            : p
          )
        );
        this.proposalVotingIds.delete(item.id);
      },
      error: (err) => {
        console.error('Erreur lors du vote sur la proposition :', err);
        this.proposalVotingIds.delete(item.id);
      }
    });
  }

  getThemeLabel(theme: ProposalTheme): string {
    return this.proposalThemes.find(t => t.id === theme)?.label || theme;
  }

  getProposalStatusLabel(status: ProposalStatus): string {
    switch (status) {
      case 'APPROUVEE':
        return 'Approuvée';
      case 'PLANIFIEE':
        return 'Planifiée';
      case 'EN_EXAMEN':
      default:
        return 'En examen';
    }
  }

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/login']);
  }

  // ==========================================
  // MAPLIBRE GL (CARTE PRINCIPALE & PROPOSITION)
  // ==========================================

  private getOsmStyle(): any {
    return {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap'
        }
      },
      layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles' }]
    };
  }

  async initMainMap(): Promise<void> {
    if (this.map || typeof window === 'undefined') return;
    const mod = await import('maplibre-gl');
    this.maplibregl = (mod as any).default || mod;

    if (!document.getElementById('maplibre-container')) return;

    this.map = new this.maplibregl.Map({
      container: 'maplibre-container',
      style: this.getOsmStyle(),
      center: [-5.0003, 34.0331],
      zoom: 13,
      maxBounds: [[-5.1500, 33.9000], [-4.8500, 34.1500]]
    });

    this.map.on('load', () => {
      this.map.resize();
      this.refreshMapMarkers();
    });

    this.map.on('click', (e: any) => {
      this.selectLocation(e.lngLat.lat, e.lngLat.lng, 'INCIDENT');
    });
  }

  async initProposalMap(): Promise<void> {
    if (this.proposalMap || typeof window === 'undefined') return;
    const mod = await import('maplibre-gl');
    this.maplibregl = (mod as any).default || mod;

    if (!document.getElementById('proposal-map-container')) return;

    this.proposalMap = new this.maplibregl.Map({
      container: 'proposal-map-container',
      style: this.getOsmStyle(),
      center: [-5.0020, 34.0355],
      zoom: 12.5,
      maxBounds: [[-5.1500, 33.9000], [-4.8500, 34.1500]]
    });

    this.proposalMap.on('load', () => this.proposalMap.resize());

    this.proposalMap.on('click', (e: any) => {
      this.selectLocation(e.lngLat.lat, e.lngLat.lng, 'PROPOSAL');
    });
  }

  private addIncidentMarker(incident: Incident): void {
    if (!this.map || !this.maplibregl) return;

    const borderColor = incident.status === 'RESOLU' ? 'border-emerald-600'
                      : incident.status === 'EN_COURS' ? 'border-sky-600' : 'border-amber-500';

    // 1. Marqueur photo miniature
    const el = document.createElement('div');
    el.className = `w-11 h-11 rounded-full overflow-hidden shadow-lg border-2 ${borderColor} bg-white cursor-pointer hover:scale-125 transition-transform duration-200`;
    el.innerHTML = `
      <img src="${incident.photoUrl}" alt="${incident.title}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800'" />
    `;

    // 2. Contenu dynamique de la popup
    const popupDiv = document.createElement('div');
    popupDiv.className = 'p-3 min-w-[220px] font-sans';

    const updatePopupContent = () => {
      const current = this.incidents().find(i => i.id === incident.id) || incident;

      popupDiv.innerHTML = `
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">${current.status}</span>
          <span class="text-[10px] text-slate-400">${current.dateLabel || ''}</span>
        </div>
        <p class="text-xs font-bold text-slate-800 mb-1">${current.title}</p>
        <p class="text-[11px] text-slate-500 mb-3 truncate">📍 ${current.address}</p>
        <div class="flex items-center justify-between pt-2 border-t border-slate-100">
          <span class="text-[11px] font-bold text-brand">Soutiens : ${current.upvotes}</span>
          <button id="vote-btn-dynamic" class="px-3 py-1.5 rounded-lg ${current.votedByMe ? 'bg-emerald-600 text-white' : 'bg-brand text-white'} text-xs font-semibold hover:opacity-90 transition-all shadow-sm">
            ${current.votedByMe ? 'Voté ✓' : '▲ Soutenir'}
          </button>
        </div>
      `;

      const btn = popupDiv.querySelector('#vote-btn-dynamic');
      btn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        this.upvote(current, () => updatePopupContent());
      });
    };

    updatePopupContent();

    // 3. Création et association de la Popup MapLibre
    const popup = new this.maplibregl.Popup({ offset: 25, closeButton: true, closeOnClick: true })
      .setDOMContent(popupDiv);

    const markerInstance = new this.maplibregl.Marker({ element: el })
      .setLngLat([incident.longitude, incident.latitude])
      .setPopup(popup)
      .addTo(this.map);

    this.incidentMarkers.push(markerInstance);
  }

  async selectLocation(lat: number, lng: number, target: 'INCIDENT' | 'PROPOSAL'): Promise<void> {
    if (!this.maplibregl) return;
    const fixedLat = Number(lat.toFixed(6));
    const fixedLng = Number(lng.toFixed(6));

    if (target === 'INCIDENT' && this.map) {
      this.latitude.set(fixedLat);
      this.longitude.set(fixedLng);
      if (this.marker) {
        this.marker.setLngLat([fixedLng, fixedLat]);
      } else {
        const el = document.createElement('div');
        el.className = 'w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs shadow-lg border-2 border-white';
        el.innerHTML = '📍';
        this.marker = new this.maplibregl.Marker({ element: el }).setLngLat([fixedLng, fixedLat]).addTo(this.map);
      }
      this.address.set('Détection...');
      this.address.set(await this.reverseGeocode(fixedLat, fixedLng));
    }

    if (target === 'PROPOSAL' && this.proposalMap) {
      this.proposalLat.set(fixedLat);
      this.proposalLng.set(fixedLng);
      if (this.proposalMarker) {
        this.proposalMarker.setLngLat([fixedLng, fixedLat]);
      } else {
        const el = document.createElement('div');
        el.className = 'w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs shadow-lg border-2 border-white';
        el.innerHTML = '💡';
        this.proposalMarker = new this.maplibregl.Marker({ element: el }).setLngLat([fixedLng, fixedLat]).addTo(this.proposalMap);
      }
      this.proposalAddress.set('Détection...');
      this.proposalAddress.set(await this.reverseGeocode(fixedLat, fixedLng));
    }
  }

  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fr`);
      const data = await res.json();
      const a = data.address || {};
      const parts = [a.road, a.neighbourhood || a.suburb || a.quarter, a.city || 'Fès'].filter(Boolean);
      return parts.length ? parts.join(', ') : `${lat}, ${lng}`;
    } catch {
      return `${lat}, ${lng}`;
    }
  }

  private isOwnedByCurrentUser(inc: Incident): boolean {
    const currentUserId = this.currentUser()?.id;
    if (currentUserId === undefined || currentUserId === null) return false;
    if (inc.userId === undefined || inc.userId === null) return false;
    return String(inc.userId) === String(currentUserId);
  }

  
  getEmptyIncidentsMessage(): { title: string; subtitle: string } {
  if (this.searchQuery().trim() || this.activeFilter() !== 'ALL') {
    return {
      title: 'Aucun signalement ne correspond à ce filtre',
      subtitle: 'Essaie de réinitialiser le statut ou ta recherche.'
    };
  }

  if (this.activeTab() === 'MY_REPORTS') {
    return {
      title: "Tu n'as encore publié aucun signalement",
      subtitle: 'Utilise le formulaire pour déclarer un incident à Fès.'
    };
  }

  return {
    title: 'Aucun signalement enregistré pour le moment',
    subtitle: 'Sois le premier citoyen à signaler un incident sur la carte.'
  };
}
}