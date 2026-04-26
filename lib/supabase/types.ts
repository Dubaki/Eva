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
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          referred_by: number | null
          referrer_id: string | null
          is_subscribed: boolean
          subscription_checked_at: string | null
          subscribed_at: string | null
          last_test_date: string | null
          reminded_at: string | null
          mixed_trait_sent: boolean
          mixed_trait_sent_at: string | null
          invites_count: number
          referral_confirmed: boolean
          referral_confirmed_at: string | null
          current_step: number | null
          question_order: number[] | null
          shared_at: string | null
          contact_author_clicked: boolean
          bot_quiz_step: number | null
          last_bot_interaction: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tg_id: number
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          referred_by?: number | null
          referrer_id?: string | null
          is_subscribed?: boolean
          subscription_checked_at?: string | null
          subscribed_at?: string | null
          last_test_date?: string | null
          reminded_at?: string | null
          mixed_trait_sent?: boolean
          mixed_trait_sent_at?: string | null
          invites_count?: number
          referral_confirmed?: boolean
          referral_confirmed_at?: string | null
          current_step?: number | null
          question_order?: number[] | null
          shared_at?: string | null
          contact_author_clicked?: boolean
          bot_quiz_step?: number | null
          last_bot_interaction?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tg_id?: number
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          referred_by?: number | null
          referrer_id?: string | null
          is_subscribed?: boolean
          subscription_checked_at?: string | null
          subscribed_at?: string | null
          last_test_date?: string | null
          reminded_at?: string | null
          mixed_trait_sent?: boolean
          mixed_trait_sent_at?: string | null
          invites_count?: number
          referral_confirmed?: boolean
          referral_confirmed_at?: string | null
          current_step?: number | null
          question_order?: number[] | null
          shared_at?: string | null
          contact_author_clicked?: boolean
          bot_quiz_step?: number | null
          last_bot_interaction?: string | null
          created_at?: string
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
        }
        Insert: {
          id?: string
          profile_id: string
          current_tension_sphere: string
          tension_severity: string
          previous_experience: string
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          current_tension_sphere?: string
          tension_severity?: string
          previous_experience?: string
          created_at?: string
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
        }
        Relationships: []
      }
      bot_tasks_queue: {
        Row: {
          id: string
          profile_id: string
          tg_id: number
          event_type: string
          run_at: string
          status: string
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          tg_id: number
          event_type: string
          run_at: string
          status?: string
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          tg_id?: number
          event_type?: string
          run_at?: string
          status?: string
          error_message?: string | null
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
      submit_test_result_v2: {
        Args: {
          p_tg_id: number
          p_profile_id: string
          p_primary: string
          p_secondary: string
          p_answers: Json
          p_score_s: number
          p_score_u: number
          p_score_p: number
          p_score_r: number
          p_score_k: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
