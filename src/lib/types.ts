// Auto-generated types placeholder for the V1 schema.
// Regenerate with: npx supabase gen types typescript --local > src/lib/types.ts
// (requires Docker + local Supabase to be running)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_id: string | null;
          email: string;
          name: string;
          role: "owner" | "coach" | "student";
          coach_id: string | null;
          niche: string | null;
          status: "active" | "inactive" | "suspended";
          joined_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          email: string;
          name: string;
          role: "owner" | "coach" | "student";
          coach_id?: string | null;
          niche?: string | null;
          status?: "active" | "inactive" | "suspended";
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string | null;
          email?: string;
          name?: string;
          role?: "owner" | "coach" | "student";
          coach_id?: string | null;
          niche?: string | null;
          status?: "active" | "inactive" | "suspended";
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      invites: {
        Row: {
          id: string;
          email: string;
          role: "coach" | "student";
          invited_by: string;
          coach_id: string | null;
          code: string;
          used: boolean;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role: "coach" | "student";
          invited_by: string;
          coach_id?: string | null;
          code: string;
          used?: boolean;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: "coach" | "student";
          invited_by?: string;
          coach_id?: string | null;
          code?: string;
          used?: boolean;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      magic_links: {
        Row: {
          id: string;
          code: string;
          role: "coach" | "student";
          created_by: string;
          expires_at: string | null;
          max_uses: number | null;
          use_count: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          role: "coach" | "student";
          created_by: string;
          expires_at?: string | null;
          max_uses?: number | null;
          use_count?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          role?: "coach" | "student";
          created_by?: string;
          expires_at?: string | null;
          max_uses?: number | null;
          use_count?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "magic_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      work_sessions: {
        Row: {
          id: string;
          student_id: string;
          date: string;
          cycle_number: number;
          started_at: string;
          completed_at: string | null;
          duration_minutes: number;
          session_minutes: number;
          status: "in_progress" | "completed" | "abandoned" | "paused";
          paused_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          date: string;
          cycle_number: number;
          started_at: string;
          completed_at?: string | null;
          duration_minutes?: number;
          session_minutes: number;
          status?: "in_progress" | "completed" | "abandoned" | "paused";
          paused_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          date?: string;
          cycle_number?: number;
          started_at?: string;
          completed_at?: string | null;
          duration_minutes?: number;
          session_minutes?: number;
          status?: "in_progress" | "completed" | "abandoned" | "paused";
          paused_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      roadmap_progress: {
        Row: {
          id: string;
          student_id: string;
          step_number: number;
          step_name: string;
          status: "locked" | "active" | "completed";
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          step_number: number;
          step_name: string;
          status?: "locked" | "active" | "completed";
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          step_number?: number;
          step_name?: string;
          status?: "locked" | "active" | "completed";
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_progress_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      daily_reports: {
        Row: {
          id: string;
          student_id: string;
          date: string;
          hours_worked: number;
          star_rating: number | null;
          outreach_count: number;
          brands_contacted: number;
          influencers_contacted: number;
          calls_joined: number;
          wins: string | null;
          improvements: string | null;
          submitted_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          date: string;
          hours_worked?: number;
          star_rating?: number | null;
          outreach_count?: number;
          brands_contacted?: number;
          influencers_contacted?: number;
          calls_joined?: number;
          wins?: string | null;
          improvements?: string | null;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          date?: string;
          hours_worked?: number;
          star_rating?: number | null;
          outreach_count?: number;
          brands_contacted?: number;
          influencers_contacted?: number;
          calls_joined?: number;
          wins?: string | null;
          improvements?: string | null;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_reports_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_reports_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      alert_dismissals: {
        Row: {
          id: string;
          owner_id: string;
          alert_key: string;
          dismissed_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          alert_key: string;
          dismissed_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          alert_key?: string;
          dismissed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alert_dismissals_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      student_kpi_summaries: {
        Row: {
          student_id: string;
          total_brands_contacted: number;
          total_influencers_contacted: number;
          total_hours_worked: number;
          total_calls_joined: number;
          total_reports: number;
          last_active_date: string | null;
          current_streak: number;
          last_report_date: string | null;
          updated_at: string;
        };
        Insert: {
          student_id: string;
          total_brands_contacted?: number;
          total_influencers_contacted?: number;
          total_hours_worked?: number;
          total_calls_joined?: number;
          total_reports?: number;
          last_active_date?: string | null;
          current_streak?: number;
          last_report_date?: string | null;
          updated_at?: string;
        };
        Update: {
          student_id?: string;
          total_brands_contacted?: number;
          total_influencers_contacted?: number;
          total_hours_worked?: number;
          total_calls_joined?: number;
          total_reports?: number;
          last_active_date?: string | null;
          current_streak?: number;
          last_report_date?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_kpi_summaries_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      rate_limit_log: {
        Row: {
          id: number;
          user_id: string;
          endpoint: string;
          called_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          endpoint: string;
          called_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          endpoint?: string;
          called_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rate_limit_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      daily_plans: {
        Row: {
          id: string;
          student_id: string;
          date: string;
          plan_json: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          date?: string;
          plan_json: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          date?: string;
          plan_json?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_plans_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      roadmap_undo_log: {
        Row: {
          id: string;
          actor_id: string;
          actor_role: "coach" | "owner";
          student_id: string;
          step_number: number;
          undone_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          actor_role: "coach" | "owner";
          student_id: string;
          step_number: number;
          undone_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          actor_role?: "coach" | "owner";
          student_id?: string;
          step_number?: number;
          undone_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_undo_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_undo_log_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_user_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_owner_dashboard_stats: {
        Args: Record<string, never>;
        Returns: {
          total_students: number;
          total_coaches: number;
          active_today_count: number;
          reports_today: number;
        };
      };
      get_sidebar_badges: {
        Args: {
          p_user_id: string;
          p_role: string;
        };
        Returns: {
          active_alerts?: number;
          unreviewed_reports?: number;
        };
      };
      get_student_detail: {
        Args: {
          p_student_id: string;
          p_include_coach_mgmt: boolean;
        };
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
