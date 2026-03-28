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
          outreach_brands: number;
          outreach_influencers: number;
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
          outreach_brands?: number;
          outreach_influencers?: number;
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
          outreach_brands?: number;
          outreach_influencers?: number;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
