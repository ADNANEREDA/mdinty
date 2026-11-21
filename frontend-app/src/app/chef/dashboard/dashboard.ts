import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChefService } from './chef.service';
import {
  FES_DISTRICTS,
  FIELD_TEAMS,
  IncidentSortKey,
  IncidentStatus,
  ProposalStatus,
  SERVICE_CONFIG,
  ServiceIncident,
  ServiceKey,
  ServiceProposal,
  TeamKey,
  detectFesDistrict,
  getCategoryFrenchLabel,
  getProposalStatusFrenchLabel,
  getStatusFrenchLabel,
  getThemeFrenchLabel,
  mapCategoryToService
} from './chef.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  private chefService = inject(ChefService);
  private router = inject(Router);

  readonly fallbackPhoto =
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800';

  readonly categoryLabel = getCategoryFrenchLabel;
  readonly statusLabel = getStatusFrenchLabel;
  readonly proposalStatusLabel = getProposalStatusFrenchLabel;
  readonly themeLabel = getThemeFrenchLabel;

  currentUser = signal<{
    id?: number;
    prenom?: string;
    nom?: string;
    email?: string;
    role?: string;
    serviceName?: string;
  }>({});

  chefServiceKey = signal<ServiceKey>('ELECTRICITY_WATER');
  viewMode = signal<'GRID' | 'MAP' | 'STATS'>('GRID');
  statusFilter = signal<IncidentStatus | 'ALL' | 'URGENT'>('ALL');
  sortBy = signal<IncidentSortKey>('URGENCY');
  searchQuery = signal('');

  incidents = signal<ServiceIncident[]>([]);
  proposals = signal<ServiceProposal[]>([]);
  loading = signal(false);

  selectedIncident = signal<ServiceIncident | null>(null);
  selectedProposal = signal<ServiceProposal | null>(null);

  // Affiche ou masque le panneau "Voir traitement" (rapport & photo équipe terrain) dans la modale
  showTreatmentPanel = signal(false);

  toast = signal<{ message: string; type: 'success' | 'info' } | null>(null);

  selectedTeams: Record<number, TeamKey> = {};
  readonly serviceConfig = SERVICE_CONFIG;

  private map: any = null;
  private maplibregl: any = null;
  private markers: any[] = [];
  private onWindowResize = (): void => {
    if (this.map) this.map.resize();
  };

  availableTeams = computed(() => {
    const current = this.chefServiceKey();
    if (current === 'PROPOSALS') return [];
    return FIELD_TEAMS.filter(t => t.service === current);
  });

  serviceIncidents = computed(() => {
    const svc = this.chefServiceKey();
    if (svc === 'PROPOSALS') return [];
    const now = Date.now();

    return this.incidents()
      .filter(inc => mapCategoryToService(inc.category) === svc)
      .map(inc => {
        const status = (inc.status as IncidentStatus) || 'EN_ATTENTE';
        const createdMs = inc.createdAt ? new Date(inc.createdAt).getTime() : now;
        const hoursElapsed = (now - createdMs) / (1000 * 60 * 60);
        const isSlaBreached = status === 'EN_ATTENTE' && hoursElapsed > 48;

        const aiLabel = (inc.aiSeverityLabel || '').toUpperCase();
        const aiScore = inc.aiSeverityScore ?? 0;
        const isCritique =
          status !== 'RESOLU' &&
          (aiLabel === 'CRITIQUE' || aiScore >= 0.8 || isSlaBreached || (inc.upvotes ?? 0) >= 5);
        const isEleve =
          !isCritique &&
          status !== 'RESOLU' &&
          (aiLabel === 'ELEVE' || aiScore >= 0.55 || (inc.upvotes ?? 0) >= 3);

        let urgencyReason = '';
        if (aiLabel === 'CRITIQUE' || aiScore >= 0.8) {
          urgencyReason = 'Gravité Critique (CV)';
        } else if (isSlaBreached) {
          urgencyReason = 'SLA > 48h dépassé';
        } else if ((inc.upvotes ?? 0) >= 5) {
          urgencyReason = `${inc.upvotes} soutiens citoyens`;
        } else if (isEleve) {
          urgencyReason = 'Priorité élevée';
        }

        return {
          ...inc,
          status,
          isSlaBreached,
          isUrgent: isCritique || isEleve,
          urgencyLevel: isCritique ? ('CRITIQUE' as const) : isEleve ? ('ELEVE' as const) : ('NORMAL' as const),
          urgencyReason,
          dateLabel: this.formatDateTime(inc.createdAt),
          assignedAtLabel: inc.assignedAt ? this.formatDateTime(inc.assignedAt) : undefined,
          resolvedAtLabel: inc.resolvedAt ? this.formatDateTime(inc.resolvedAt) : undefined
        };
      });
  });

  filteredIncidents = computed(() => {
    const st = this.statusFilter();
    const sort = this.sortBy();
    const q = this.searchQuery().toLowerCase().trim();

    const filtered = this.serviceIncidents().filter(inc => {
      const matchStatus =
        st === 'ALL'
          ? true
          : st === 'URGENT'
          ? Boolean(inc.isUrgent)
          : inc.status === st;

      const matchSearch =
        !q ||
        (inc.title || '').toLowerCase().includes(q) ||
        (inc.address || '').toLowerCase().includes(q) ||
        (inc.description || '').toLowerCase().includes(q) ||
        getCategoryFrenchLabel(inc.category).toLowerCase().includes(q);

      return matchStatus && matchSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'VOTES') {
        return (b.upvotes ?? 0) - (a.upvotes ?? 0);
      }
      if (sort === 'RECENT') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      const weight = (x: ServiceIncident) =>
        x.urgencyLevel === 'CRITIQUE' ? 3 : x.urgencyLevel === 'ELEVE' ? 2 : 1;
      const diff = weight(b) - weight(a);
      if (diff !== 0) return diff;
      return (b.upvotes ?? 0) - (a.upvotes ?? 0);
    });
  });

  kpis = computed(() => {
    const list = this.serviceIncidents();
    const resolvedWithDates = list.filter(i => i.status === 'RESOLU' && i.createdAt && i.resolvedAt);

    let mttrLabel = '—';
    if (resolvedWithDates.length > 0) {
      const totalHours = resolvedWithDates.reduce((acc, item) => {
        const start = new Date(item.createdAt!).getTime();
        const end = new Date(item.resolvedAt!).getTime();
        return acc + Math.max(0.5, (end - start) / (1000 * 60 * 60));
      }, 0);
      const avgHours = totalHours / resolvedWithDates.length;
      mttrLabel =
        avgHours < 24
          ? `${avgHours.toFixed(1)} h`
          : `${(avgHours / 24).toFixed(1)} j`;
    }

    return {
      total: list.length,
      pending: list.filter(i => i.status === 'EN_ATTENTE').length,
      inProgress: list.filter(i => i.status === 'EN_COURS').length,
      resolved: list.filter(i => i.status === 'RESOLU').length,
      urgent: list.filter(i => i.isUrgent).length,
      mttr: mttrLabel,
      resolutionRate:
        list.length > 0
          ? Math.round((list.filter(i => i.status === 'RESOLU').length / list.length) * 100)
          : 0
    };
  });

  districtStats = computed(() => {
    const list = this.serviceIncidents();
    const total = list.length || 1;
    const counts: Record<string, { total: number; resolved: number; urgent: number }> = {};

    for (const d of FES_DISTRICTS) {
      counts[d] = { total: 0, resolved: 0, urgent: 0 };
    }

    for (const inc of list) {
      const district = detectFesDistrict(inc.address);
      if (!counts[district]) counts[district] = { total: 0, resolved: 0, urgent: 0 };
      counts[district].total++;
      if (inc.status === 'RESOLU') counts[district].resolved++;
      if (inc.isUrgent) counts[district].urgent++;
    }

    return Object.entries(counts)
      .filter(([, v]) => v.total > 0)
      .map(([name, v]) => ({
        name,
        total: v.total,
        resolved: v.resolved,
        urgent: v.urgent,
        percent: Math.round((v.total / total) * 100)
      }))
      .sort((a, b) => b.total - a.total);
  });

  sortedProposals = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return [...this.proposals()]
      .filter(
        p =>
          !q ||
          (p.title || '').toLowerCase().includes(q) ||
          (p.address || '').toLowerCase().includes(q) ||
          getThemeFrenchLabel(p.theme).toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      )
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      .map(p => ({
        ...p,
        status: (p.status as ProposalStatus) || 'EN_EXAMEN',
        dateLabel: this.formatDateTime(p.createdAt)
      }));
  });

  constructor() {
    effect(() => {
      const list = this.filteredIncidents();
      const mode = this.viewMode();
      if (mode === 'MAP' && this.map) {
        this.refreshMarkers(list);
      }
    });
  }

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', this.onWindowResize);

    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('currentUser');
    if (!token || !userStr) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'CHEF_SERVICE') {
        this.router.navigate([user.role === 'CITOYEN' ? '/citizen/dashboard' : '/login']);
        return;
      }
      this.currentUser.set(user);
      this.chefServiceKey.set(this.detectServiceFromName(user.serviceName));
    } catch {
      this.router.navigate(['/login']);
      return;
    }

    this.loadData();
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize);
    }
    this.destroyMap();
  }

  private formatDateTime(iso?: string): string {
    if (!iso) return "Aujourd'hui";
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private detectServiceFromName(serviceName?: string): ServiceKey {
    const s = (serviceName || '').toLowerCase();
    if (s.includes('propos') || s.includes('activit')) return 'PROPOSALS';
    if (
      s.includes('nadafa') ||
      s.includes('propret') ||
      s.includes('clean') ||
      s.includes('déchet') ||
      s.includes('dechet')
    ) {
      return 'URBAN_CLEANLINESS';
    }
    if (s.includes('infra') || s.includes('voirie') || s.includes('route')) {
      return 'INFRASTRUCTURE';
    }
    return 'ELECTRICITY_WATER';
  }

  setViewMode(mode: 'GRID' | 'MAP' | 'STATS'): void {
    this.viewMode.set(mode);
    if (mode === 'MAP') {
      setTimeout(() => this.initMap(), 120);
    } else {
      this.destroyMap();
    }
  }

  private destroyMap(): void {
    this.markers.forEach(m => m.remove());
    this.markers = [];
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private async initMap(): Promise<void> {
    if (this.map || typeof window === 'undefined') return;
    if (!document.getElementById('chef-maplibre-container')) return;

    const mod = await import('maplibre-gl');
    this.maplibregl = (mod as any).default || mod;

    this.map = new this.maplibregl.Map({
      container: 'chef-maplibre-container',
      style: {
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
      },
      center: [-5.0003, 34.0331],
      zoom: 12.5,
      maxBounds: [[-5.1500, 33.9000], [-4.8500, 34.1500]]
    });

    this.map.on('load', () => {
      this.map.resize();
      this.refreshMarkers(this.filteredIncidents());
    });
  }

  private refreshMarkers(items: ServiceIncident[]): void {
    if (!this.map || !this.maplibregl) return;
    this.markers.forEach(m => m.remove());
    this.markers = [];

    for (const inc of items) {
      if (typeof inc.latitude !== 'number' || typeof inc.longitude !== 'number') continue;

      const ringClass =
        inc.status === 'RESOLU'
          ? 'border-emerald-600'
          : inc.urgencyLevel === 'CRITIQUE'
          ? 'border-red-600 ring-2 ring-red-400'
          : inc.status === 'EN_COURS'
          ? 'border-sky-600'
          : 'border-amber-500';

      const el = document.createElement('div');
      el.className = `w-11 h-11 rounded-full overflow-hidden shadow-lg border-2 ${ringClass} bg-white cursor-pointer hover:scale-110 transition-transform`;
      el.innerHTML = `<img src="${inc.photoUrl || this.fallbackPhoto}" alt="Incident" onerror="this.src='${this.fallbackPhoto}'" class="w-full h-full object-cover" />`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openIncidentDetails(inc);
      });

      const marker = new this.maplibregl.Marker({ element: el })
        .setLngLat([inc.longitude, inc.latitude])
        .addTo(this.map);

      this.markers.push(marker);
    }
  }

  loadData(): void {
    this.loading.set(true);
    const defaultTeam = this.availableTeams()[0]?.id;

    if (this.chefServiceKey() === 'PROPOSALS') {
      this.chefService.getAllProposals().subscribe({
        next: (list) => {
          this.proposals.set(Array.isArray(list) ? list : []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
    } else {
      this.chefService.getAllIncidents().subscribe({
        next: (list) => {
          const items = Array.isArray(list) ? list : [];
          this.incidents.set(items);
          for (const inc of items) {
            if (!this.selectedTeams[inc.id] && defaultTeam) {
              this.selectedTeams[inc.id] = (inc.assignedTeam as TeamKey) || defaultTeam;
            }
          }
          this.loading.set(false);
          if (this.viewMode() === 'MAP') {
            setTimeout(() => this.initMap(), 80);
          }
        },
        error: () => this.loading.set(false)
      });
    }
  }

  refreshData(): void {
    this.loadData();
    this.triggerToast('Données actualisées', 'info');
  }

  getGoogleMapsUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  openIncidentDetails(inc: ServiceIncident, event?: Event, openTreatment = false): void {
    event?.stopPropagation();
    this.selectedProposal.set(null);
    if (!this.selectedTeams[inc.id] && this.availableTeams()[0]) {
      this.selectedTeams[inc.id] = (inc.assignedTeam as TeamKey) || this.availableTeams()[0].id;
    }
    this.showTreatmentPanel.set(openTreatment || Boolean(inc.resolutionNote || inc.resolutionPhotoUrl));
    this.selectedIncident.set(inc);
  }

  toggleTreatmentPanel(): void {
    this.showTreatmentPanel.update(v => !v);
  }

  openProposalDetails(prop: ServiceProposal, event?: Event): void {
    event?.stopPropagation();
    this.selectedIncident.set(null);
    this.selectedProposal.set(prop);
  }

  closeDetails(): void {
    this.selectedIncident.set(null);
    this.selectedProposal.set(null);
    this.showTreatmentPanel.set(false);
  }

  validateAndResolve(incidentId: number, event?: Event): void {
    event?.stopPropagation();
    this.chefService.updateIncidentStatus(incidentId, 'RESOLU').subscribe({
      next: (updated) => {
        const nextStatus = (updated.status as IncidentStatus) || 'RESOLU';
        this.incidents.update(list =>
          list.map(item =>
            item.id === incidentId
              ? {
                  ...item,
                  status: nextStatus,
                  assignedAt: updated.assignedAt || item.assignedAt,
                  resolvedAt: updated.resolvedAt || item.resolvedAt || new Date().toISOString()
                }
              : item
          )
        );
        const refreshed = this.serviceIncidents().find(i => i.id === incidentId);
        if (refreshed && this.selectedIncident()?.id === incidentId) {
          this.selectedIncident.set(refreshed);
        }
        this.triggerToast('Traitement terrain validé — Incident marqué Résolu', 'success');
      },
      error: () => this.triggerToast('Erreur lors de la validation de résolution', 'info')
    });
  }

  assignTeam(incidentId: number, event?: Event): void {
    event?.stopPropagation();
    const teamId = this.selectedTeams[incidentId] || this.availableTeams()[0]?.id;
    const teamObj = FIELD_TEAMS.find(t => t.id === teamId);
    if (!teamObj) return;

    this.chefService.assignIncidentTeam(incidentId, teamObj.id, teamObj.label).subscribe({
      next: (updated) => {
        const nextTeam = updated.assignedTeam ?? teamObj.id;
        const nextTeamLabel = updated.assignedTeamLabel ?? teamObj.label;
        const nextStatus = (updated.status as IncidentStatus) || 'EN_COURS';

        this.incidents.update(list =>
          list.map(item =>
            item.id === incidentId
              ? {
                  ...item,
                  assignedTeam: nextTeam,
                  assignedTeamLabel: nextTeamLabel,
                  assignedAt: updated.assignedAt || item.assignedAt || new Date().toISOString(),
                  status: nextStatus
                }
              : item
          )
        );

        const refreshed = this.serviceIncidents().find(i => i.id === incidentId);
        if (refreshed && this.selectedIncident()?.id === incidentId) {
          this.selectedIncident.set(refreshed);
        }

        this.triggerToast(`Équipe affectée (${teamObj.label}) — Statut : En cours`, 'success');
      },
      error: () => this.triggerToast("Erreur lors de l'affectation de l'équipe", 'info')
    });
  }

  changeProposalStatus(proposalId: number, status: ProposalStatus, event?: Event): void {
    event?.stopPropagation();
    this.chefService.updateProposalStatus(proposalId, status).subscribe({
      next: (updated) => {
        const nextStatus = (updated.status as ProposalStatus) || status;
        this.proposals.update(list =>
          list.map(p => (p.id === proposalId ? { ...p, status: nextStatus } : p))
        );
        if (this.selectedProposal()?.id === proposalId) {
          this.selectedProposal.set({ ...this.selectedProposal()!, status: nextStatus });
        }
        this.triggerToast(`Proposition : ${getProposalStatusFrenchLabel(nextStatus)}`, 'success');
      },
      error: () => this.triggerToast('Erreur lors de la mise à jour de la proposition', 'info')
    });
  }

  onPhotoError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== this.fallbackPhoto) {
      img.src = this.fallbackPhoto;
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'RESOLU':
      case 'APPROUVEE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'EN_COURS':
      case 'PLANIFIEE':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  }

  getUserInitials(): string {
    const p = this.currentUser().prenom?.[0] || 'C';
    const n = this.currentUser().nom?.[0] || 'S';
    return (p + n).toUpperCase();
  }

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/login']);
  }

  private triggerToast(message: string, type: 'success' | 'info' = 'success'): void {
    this.toast.set({ message, type });
    setTimeout(() => {
      if (this.toast()?.message === message) {
        this.toast.set(null);
      }
    }, 3200);
  }
}