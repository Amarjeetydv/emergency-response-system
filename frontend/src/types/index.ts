export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'citizen' | 'police' | 'fire' | 'ambulance' | 'responder' | 'dispatcher';
  approval_status: 'pending' | 'approved' | 'rejected' | null;
  created_at?: string;
  token?: string;
}

export interface Emergency {
  id: number;
  citizen_id?: number;
  citizen_name?: string;
  emergency_type: 'police' | 'medical' | 'fire' | 'other';
  latitude: number;
  longitude: number;
  description?: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'escalated';
  media_url?: string;
  mediaUrl?: string;
  created_at: string;
  assigned_responder?: number;
  responder_name?: string;
  is_source?: boolean;
  is_destination?: boolean;
  name?: string;
  type?: string;
}

export type LiveEvent =
  | { type: 'NEW'; data: Emergency }
  | { type: 'STATUS'; data: Emergency }
  | { type: 'LOCATION'; data: ResponderLocation };

export interface ResponderLocation {
  responderId: number;
  name?: string;
  role?: string;
  latitude: number;
  longitude: number;
  ts?: number;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  action: string;
  details?: string;
  created_at: string;
}

export interface Analytics {
  totalEmergencies: number;
  statusCounts: {
    pending: number;
    escalated: number;
    active: number;
    completed: number;
  };
  responderStats: {
    total: number;
    pendingApproval: number;
  };
}
