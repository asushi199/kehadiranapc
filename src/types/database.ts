export type AppRole = 'counter_staff' | 'secretariat' | 'super_admin';
export type SessionMode = 'rehearsal' | 'live';
export type AttendanceStatus = 'not_confirmed' | 'confirmed';
export type ConfirmationSource = 'participant' | 'staff';

export interface Participant {
  [key: string]: unknown;
  id: string;
  bil: number;
  name: string;
  name_normalized: string;
  ic_hmac: string;
  ic_last4: string;
  organization: string;
  seat_no: number;
  counter_no: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventSession {
  [key: string]: unknown;
  id: string;
  name: string;
  mode: SessionMode;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantActivity {
  [key: string]: unknown;
  id: string;
  participant_id: string;
  session_id: string;
  first_lookup_at: string | null;
  last_lookup_at: string | null;
  lookup_count: number;
  attendance_status: AttendanceStatus;
  attendance_confirmed_at: string | null;
  confirmation_source: ConfirmationSource | null;
  confirmed_by: string | null;
  updated_at: string;
}

export interface UserProfile {
  [key: string]: unknown;
  id: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  [key: string]: unknown;
  id: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      participants: { Row: Participant; Insert: Omit<Participant, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Participant, 'id' | 'created_at'>>; Relationships: [] };
      event_sessions: { Row: EventSession; Insert: Omit<EventSession, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<EventSession, 'id' | 'created_at'>>; Relationships: [] };
      participant_activity: { Row: ParticipantActivity; Insert: Omit<ParticipantActivity, 'id' | 'updated_at'>; Update: Partial<Omit<ParticipantActivity, 'id'>>; Relationships: [] };
      user_profiles: { Row: UserProfile; Insert: Omit<UserProfile, 'created_at' | 'updated_at'>; Update: Partial<Omit<UserProfile, 'id' | 'created_at'>>; Relationships: [] };
      audit_logs: { Row: AuditLog; Insert: Omit<AuditLog, 'id' | 'created_at'>; Update: never; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      check_rate_limit: {
        Args: { p_key_hmac: string; p_limit: number; p_route: string; p_window_starts_at: string } & Record<string, unknown>;
        Returns: boolean;
      };
      confirm_participant_attendance: {
        Args: { p_participant_id: string; p_session_id: string } & Record<string, unknown>;
        Returns: ParticipantActivity;
      };
      record_participant_lookup: {
        Args: { p_participant_id: string; p_session_id: string } & Record<string, unknown>;
        Returns: ParticipantActivity;
      };
      reset_rehearsal_session: {
        Args: { p_actor: string; p_session_id: string } & Record<string, unknown>;
        Returns: { backup_id: string; record_count: number }[];
      };
    };
    Enums: {
      app_role: AppRole;
      session_mode: SessionMode;
      attendance_status: AttendanceStatus;
      confirmation_source: ConfirmationSource;
    };
    CompositeTypes: Record<string, never>;
  };
}
