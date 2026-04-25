export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          value: string
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          tg_id: number
          username: string | null
          avatar_url: string | null
          referred_by: number | null
          referrer_id: string | null
          is_subscribed: boolean
          subscription_checked_at: string | null
          subscribed_at: string | null
          last_test_date: string | null
          selected_sphere: string | null
          reminded_at: string | null
          invites_count: number
          referral_confirmed: boolean
          referral_confirmed_at: string | null
          current_step: number | null
          shared_at: string | null
          contact_author_clicked: boolean
          bot_quiz_step: number | null
          last_bot_interaction: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tg_id: number
          username?: string | null
          avatar_url?: string | null
          referred_by?: number | null
          referrer_id?: string | null
          is_subscribed?: boolean
          subscription_checked_at?: string | null
          subscribed_at?: string | null
          last_test_date?: string | null
          selected_sphere?: string | null
          reminded_at?: string | null
          invites_count?: number
          referral_confirmed?: boolean
          referral_confirmed_at?: string | null
          current_step?: number | null
          shared_at?: string | null
          contact_author_clicked?: boolean
          bot_quiz_step?: number | null
          last_bot_interaction?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tg_id?: number
          username?: string | null
          avatar_url?: string | null
          referred_by?: number | null
          referrer_id?: string | null
          is_subscribed?: boolean
          subscription_checked_at?: string | null
          subscribed_at?: string | null
          last_test_date?: string | null
          selected_sphere?: string | null
          reminded_at?: string | null
          invites_count?: number
          referral_confirmed?: boolean
          referral_confirmed_at?: string | null
          current_step?: number | null
          shared_at?: string | null
          contact_author_clicked?: boolean
          bot_quiz_step?: number | null
          last_bot_interaction?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      qualifications: {
        Row: {
          id: string
          profile_id: string
          current_tension_sphere: string
          tension_severity: string
          previous_experience: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          current_tension_sphere: string
          tension_severity: string
          previous_experience: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          current_tension_sphere?: string
          tension_severity?: string
          previous_experience?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          id: string
          tg_id: number
          profile_id: string
          score_s: number
          score_u: number
          score_p: number
          score_r: number
          score_k: number
          primary_support: string
          secondary_support: string
          answers: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tg_id: number
          profile_id: string
          score_s?: number
          score_u?: number
          score_p?: number
          score_r?: number
          score_k?: number
          primary_support: string
          secondary_support: string
          answers?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tg_id?: number
          profile_id?: string
          score_s?: number
          score_u?: number
          score_p?: number
          score_r?: number
          score_k?: number
          primary_support?: string
          secondary_support?: string
          answers?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          id: string
          owner_id: string
          invited_id: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          invited_id: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          invited_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_log: {
        Row: {
          id: string
          profile_id: string
          action: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          action: string
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          action?: string
          details?: Json | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_test_result: {
        Args: {
          p_tg_id: number
          p_primary_support: string
          p_secondary_support: string
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
