export type IncidentStatus = 'EN_ATTENTE' | 'EN_COURS' | 'RESOLU';

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
}