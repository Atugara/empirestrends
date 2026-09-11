export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      channels: {
        Row: {
          account_label: string
          channel: Database["public"]["Enums"]["draft_channel"]
          connected: boolean
          created_at: string
          enabled: boolean
          id: string
          user_id: string
        }
        Insert: {
          account_label?: string
          channel: Database["public"]["Enums"]["draft_channel"]
          connected?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          user_id: string
        }
        Update: {
          account_label?: string
          channel?: Database["public"]["Enums"]["draft_channel"]
          connected?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      drafts: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["draft_channel"]
          created_at: string
          error: string | null
          external_url: string | null
          hashtags: string[]
          id: string
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["draft_status"]
          topic_id: string
          updated_at: string
          user_id: string
          video_script: string | null
        }
        Insert: {
          body?: string
          channel: Database["public"]["Enums"]["draft_channel"]
          created_at?: string
          error?: string | null
          external_url?: string | null
          hashtags?: string[]
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["draft_status"]
          topic_id: string
          updated_at?: string
          user_id: string
          video_script?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["draft_channel"]
          created_at?: string
          error?: string | null
          external_url?: string | null
          hashtags?: string[]
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["draft_status"]
          topic_id?: string
          updated_at?: string
          user_id?: string
          video_script?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drafts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_runs: {
        Row: {
          drafts_created: number
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          lease_until: string | null
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          topics_found: number
          user_id: string
        }
        Insert: {
          drafts_created?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          lease_until?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          topics_found?: number
          user_id: string
        }
        Update: {
          drafts_created?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          lease_until?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          topics_found?: number
          user_id?: string
        }
        Relationships: []
      }
      publish_log: {
        Row: {
          channel: Database["public"]["Enums"]["draft_channel"]
          created_at: string
          draft_id: string | null
          id: string
          message: string
          status: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["draft_channel"]
          created_at?: string
          draft_id?: string | null
          id?: string
          message?: string
          status: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["draft_channel"]
          created_at?: string
          draft_id?: string | null
          id?: string
          message?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_log_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          auto_run: boolean
          categories: string[]
          daily_post_cap: number
          humor_level: number
          keywords: string
          pause_reason: string | null
          paused: boolean
          post_length: string
          posting_window_end: number
          posting_window_start: number
          style_notes: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_run?: boolean
          categories?: string[]
          daily_post_cap?: number
          humor_level?: number
          keywords?: string
          pause_reason?: string | null
          paused?: boolean
          post_length?: string
          posting_window_end?: number
          posting_window_start?: number
          style_notes?: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_run?: boolean
          categories?: string[]
          daily_post_cap?: number
          humor_level?: number
          keywords?: string
          pause_reason?: string | null
          paused?: boolean
          post_length?: string
          posting_window_end?: number
          posting_window_start?: number
          style_notes?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          category: string
          created_at: string
          dedupe_key: string
          discovered_at: string
          generated: boolean
          id: string
          score: number
          source_name: string
          source_url: string
          summary: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          dedupe_key: string
          discovered_at?: string
          generated?: boolean
          id?: string
          score?: number
          source_name?: string
          source_url?: string
          summary?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          dedupe_key?: string
          discovered_at?: string
          generated?: boolean
          id?: string
          score?: number
          source_name?: string
          source_url?: string
          summary?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      draft_channel:
        | "twitter"
        | "linkedin"
        | "facebook"
        | "instagram"
        | "tiktok"
      draft_status:
        | "draft"
        | "approved"
        | "scheduled"
        | "published"
        | "rejected"
        | "failed"
      run_status: "running" | "success" | "failed" | "paused"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      draft_channel: ["twitter", "linkedin", "facebook", "instagram", "tiktok"],
      draft_status: [
        "draft",
        "approved",
        "scheduled",
        "published",
        "rejected",
        "failed",
      ],
      run_status: ["running", "success", "failed", "paused"],
    },
  },
} as const
