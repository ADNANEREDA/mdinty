export type ServiceKey =
  | 'ELECTRICITY_WATER'
  | 'URBAN_CLEANLINESS'
  | 'INFRASTRUCTURE'
  | 'PROPOSALS';

export type IncidentStatus = 'EN_ATTENTE' | 'EN_COURS' | 'RESOLU';

export type ProposalStatus = 'EN_EXAMEN' | 'PLANIFIEE' | 'APPROUVEE';

export type IncidentSortKey = 'URGENCY' | 'RECENT' | 'VOTES';

export type TeamKey =
  | 'EQUIPE_ELECTRICITE'
  | 'EQUIPE_EAU'
  | 'EQUIPE_NADAFA'
  | 'EQUIPE_INFRASTRUCTURE';

export interface FieldTeam {
  id: TeamKey;
  label: string;
  service: Exclude<ServiceKey, 'PROPOSALS'>;
}

export type AiIncidentStatus = 'VALIDATED' | 'DOUBLON' | 'A_VERIFIER' | 'SPAM' | string;
export type AiSeverityLevel = 'FAIBLE' | 'MOYENNE' | 'ELEVEE' | 'URGENTE' | string;

export interface ServiceIncident {
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
  userId?: number | null;
  voterIds?: number[];
  createdAt?: string;
  assignedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  resolutionPhotoUrl?: string | null;

  // Champs IA & priorité renvoyés par le backend
  priorityScore?: number | null;
  aiStatus?: AiIncidentStatus | null;
  aiSeverity?: AiSeverityLevel | null;
  aiReason?: string | null;
  aiConfidence?: number | null;
  aiCategoryConsistent?: boolean | null;
  duplicateCount?: number | null;
  parentIncidentId?: number | null;

  // Compatibilité / anciens champs UI
  aiSeverityScore?: number | null;
  aiSeverityLabel?: string | null;
  dateLabel?: string;
  assignedAtLabel?: string;
  resolvedAtLabel?: string;
  isSlaBreached?: boolean;
  isUrgent?: boolean;
  urgencyLevel?: 'CRITIQUE' | 'ELEVE' | 'NORMAL';
  urgencyReason?: string;
  assignedTeam?: TeamKey | string | null;
  assignedTeamLabel?: string | null;
}
export interface ServiceProposal {
  id: number;
  title: string;
  theme: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  authorName: string;
  votes: number;
  status?: ProposalStatus | string;
  createdAt?: string;
  dateLabel?: string;
  // Réservé pour l'intégration future du Ranking IA
  aiScore?: number;
  aiRank?: number;
}

export const SERVICE_CONFIG: Record<
  ServiceKey,
  { label: string; subtitle: string; badge: string }
> = {
  ELECTRICITY_WATER: {
    label: 'Service Électricité & Eau',
    subtitle: 'Gestion des pannes d’éclairage public et fuites d’eau à Fès',
    badge: 'Électricité & Eau'
  },
  URBAN_CLEANLINESS: {
    label: 'Service Propreté Urbaine',
    subtitle: 'Suivi de la collecte des déchets et de la propreté des quartiers',
    badge: 'Propreté Urbaine'
  },
  INFRASTRUCTURE: {
    label: 'Service Infrastructure',
    subtitle: 'Entretien des routes, trottoirs, ponts et équipements publics de Fès',
    badge: 'Infrastructure'
  },
  PROPOSALS: {
    label: 'Service Propositions Citoyennes',
    subtitle: 'Évaluation et priorisation des initiatives citoyennes pour Fès',
    badge: 'Propositions Citoyennes'
  }
};

export const FIELD_TEAMS: FieldTeam[] = [
  { id: 'EQUIPE_ELECTRICITE', label: 'Équipe Électricité', service: 'ELECTRICITY_WATER' },
  { id: 'EQUIPE_EAU', label: 'Équipe Eau', service: 'ELECTRICITY_WATER' },
  { id: 'EQUIPE_NADAFA', label: 'Équipe Propreté Urbaine (Nadafa)', service: 'URBAN_CLEANLINESS' },
  { id: 'EQUIPE_INFRASTRUCTURE', label: 'Équipe Infrastructure', service: 'INFRASTRUCTURE' }
];

export const FES_DISTRICTS = [
  'Agdal',
  'Médina',
  'Saïss',
  'Narjiss',
  'Bensouda',
  'Ville Nouvelle',
  'Zouagha',
  'Autres quartiers'
];

export function detectFesDistrict(address?: string): string {
  const a = (address || '').toLowerCase();
  if (a.includes('agdal')) return 'Agdal';
  if (a.includes('médina') || a.includes('medina') || a.includes('batha') || a.includes('boujloud')) return 'Médina';
  if (a.includes('saïss') || a.includes('saiss') || a.includes('hay tarik')) return 'Saïss';
  if (a.includes('narjiss') || a.includes('nerjis')) return 'Narjiss';
  if (a.includes('bensouda') || a.includes('ben souda')) return 'Bensouda';
  if (a.includes('ville nouvelle') || a.includes('hassan ii') || a.includes('atlas')) return 'Ville Nouvelle';
  if (a.includes('zouagha') || a.includes('ain kadous')) return 'Zouagha';
  return 'Autres quartiers';
}

export function mapCategoryToService(category?: string): Exclude<ServiceKey, 'PROPOSALS'> | null {
  const c = (category || '').toUpperCase().trim();
  if (['STREETLIGHT', 'WATER_LEAK', 'ELECTRICITY_WATER', 'ECLAIRAGE', 'EAU'].includes(c)) {
    return 'ELECTRICITY_WATER';
  }
  if (['WASTE', 'NADAFA', 'URBAN_CLEANLINESS', 'DECHETS', 'PROPRETE'].includes(c)) {
    return 'URBAN_CLEANLINESS';
  }
  if (
    ['ROAD_DAMAGE', 'INFRASTRUCTURE', 'VOIRIE', 'TROTTOIR', 'PONT', 'EQUIPEMENT_PUBLIC', 'OTHER_INFRA'].includes(c)
  ) {
    return 'INFRASTRUCTURE';
  }
  return null;
}

export function getCategoryFrenchLabel(category?: string): string {
  switch ((category || '').toUpperCase().trim()) {
    case 'ROAD_DAMAGE':
    case 'VOIRIE':
      return 'Voirie & Chaussée';
    case 'INFRASTRUCTURE':
    case 'TROTTOIR':
    case 'EQUIPEMENT_PUBLIC':
      return 'Infrastructure publique';
    case 'STREETLIGHT':
    case 'ECLAIRAGE':
      return 'Éclairage public';
    case 'WATER_LEAK':
    case 'EAU':
      return "Fuite d'eau";
    case 'WASTE':
    case 'NADAFA':
      return 'Déchets & Propreté';
    default:
      return category || 'Signalement';
  }
}

export function getStatusFrenchLabel(status?: string): string {
  switch ((status || '').toUpperCase().trim()) {
    case 'EN_COURS':
      return 'En cours';
    case 'RESOLU':
      return 'Résolu';
    default:
      return 'En attente';
  }
}

export function getProposalStatusFrenchLabel(status?: string): string {
  switch ((status || '').toUpperCase().trim()) {
    case 'PLANIFIEE':
      return 'Planifiée';
    case 'APPROUVEE':
      return 'Approuvée';
    default:
      return 'En examen';
  }
}

export function getThemeFrenchLabel(theme?: string): string {
  switch ((theme || '').toUpperCase().trim()) {
    case 'ECOLOGY':
      return '🌿 Écologie';
    case 'CULTURE':
      return '🏛️ Culture';
    case 'SPORT':
      return '⚽ Sport';
    case 'MOBILITY':
      return '🚲 Mobilité';
    default:
      return theme || 'Proposition';
  }
}