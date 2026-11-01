export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: Database["public"]["Enums"]["activity_action"];
          actor_email: string | null;
          content_item_id: string;
          created_at: string;
          from_value: string | null;
          id: number;
          note: string | null;
          to_value: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: Database["public"]["Enums"]["activity_action"];
          actor_email?: string | null;
          content_item_id: string;
          created_at?: string;
          from_value?: string | null;
          id?: never;
          note?: string | null;
          to_value?: string | null;
        };
        Update: {
          action?: Database["public"]["Enums"]["activity_action"];
          actor_email?: string | null;
          content_item_id?: string;
          created_at?: string;
          from_value?: string | null;
          id?: never;
          note?: string | null;
          to_value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_content_item_id_fkey";
            columns: ["content_item_id"];
            isOneToOne: false;
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_profile: {
        Row: {
          audience_description: string;
          business_description: string;
          business_name: string;
          courses: string[];
          current_offers: string | null;
          do_list: string[];
          dont_list: string[];
          id: number;
          links: NonNullable<Json>;
          tone_instagram: string;
          tone_linkedin: string;
          tone_whatsapp: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          audience_description: string;
          business_description: string;
          business_name: string;
          courses?: string[];
          current_offers?: string | null;
          do_list?: string[];
          dont_list?: string[];
          id?: number;
          links?: NonNullable<Json>;
          tone_instagram: string;
          tone_linkedin: string;
          tone_whatsapp: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          audience_description?: string;
          business_description?: string;
          business_name?: string;
          courses?: string[];
          current_offers?: string | null;
          do_list?: string[];
          dont_list?: string[];
          id?: number;
          links?: NonNullable<Json>;
          tone_instagram?: string;
          tone_linkedin?: string;
          tone_whatsapp?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      content_items: {
        Row: {
          body: Json | null;
          caption: string | null;
          created_at: string;
          cta: string | null;
          design_brief: Json | null;
          format: Database["public"]["Enums"]["content_format"];
          generation_error: string | null;
          hashtags: string[];
          hook: string | null;
          hydrated_at: string | null;
          id: string;
          idea: string;
          pillar: Database["public"]["Enums"]["content_pillar"];
          plan_id: string | null;
          platform: Database["public"]["Enums"]["platform"];
          posted_at: string | null;
          posted_by: string | null;
          prompt_version: string | null;
          regenerated_count: number;
          scheduled_date: string;
          skip_reason: string | null;
          slot: number;
          source_refs: NonNullable<Json>;
          status: Database["public"]["Enums"]["content_status"];
          title: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: Json | null;
          caption?: string | null;
          created_at?: string;
          cta?: string | null;
          design_brief?: Json | null;
          format: Database["public"]["Enums"]["content_format"];
          generation_error?: string | null;
          hashtags?: string[];
          hook?: string | null;
          hydrated_at?: string | null;
          id?: string;
          idea: string;
          pillar: Database["public"]["Enums"]["content_pillar"];
          plan_id?: string | null;
          platform: Database["public"]["Enums"]["platform"];
          posted_at?: string | null;
          posted_by?: string | null;
          prompt_version?: string | null;
          regenerated_count?: number;
          scheduled_date: string;
          skip_reason?: string | null;
          slot: number;
          source_refs?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: Json | null;
          caption?: string | null;
          created_at?: string;
          cta?: string | null;
          design_brief?: Json | null;
          format?: Database["public"]["Enums"]["content_format"];
          generation_error?: string | null;
          hashtags?: string[];
          hook?: string | null;
          hydrated_at?: string | null;
          id?: string;
          idea?: string;
          pillar?: Database["public"]["Enums"]["content_pillar"];
          plan_id?: string | null;
          platform?: Database["public"]["Enums"]["platform"];
          posted_at?: string | null;
          posted_by?: string | null;
          prompt_version?: string | null;
          regenerated_count?: number;
          scheduled_date?: string;
          skip_reason?: string | null;
          slot?: number;
          source_refs?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_items_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "content_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      content_plans: {
        Row: {
          created_at: string;
          generated_at: string | null;
          id: string;
          model: string | null;
          plan_month: string;
          prompt_version: string | null;
          status: Database["public"]["Enums"]["plan_status"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          generated_at?: string | null;
          id?: string;
          model?: string | null;
          plan_month: string;
          prompt_version?: string | null;
          status?: Database["public"]["Enums"]["plan_status"];
        };
        Update: {
          created_at?: string;
          generated_at?: string | null;
          id?: string;
          model?: string | null;
          plan_month?: string;
          prompt_version?: string | null;
          status?: Database["public"]["Enums"]["plan_status"];
        };
        Relationships: [];
      };
      daily_tips: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          prompt_version: string | null;
          tip: string;
          tip_date: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          prompt_version?: string | null;
          tip: string;
          tip_date: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          prompt_version?: string | null;
          tip?: string;
          tip_date?: string;
        };
        Relationships: [];
      };
      generation_runs: {
        Row: {
          content_item_id: string | null;
          error: string | null;
          estimated_cost_usd: number | null;
          finished_at: string | null;
          id: number;
          input_tokens: number | null;
          items_processed: number;
          kind: Database["public"]["Enums"]["run_kind"];
          model: string | null;
          output_tokens: number | null;
          prompt_version: string | null;
          started_at: string;
          status: Database["public"]["Enums"]["run_status"];
          target_month: string | null;
        };
        ComputedFields: never;
        Insert: {
          content_item_id?: string | null;
          error?: string | null;
          estimated_cost_usd?: number | null;
          finished_at?: string | null;
          id?: never;
          input_tokens?: number | null;
          items_processed?: number;
          kind: Database["public"]["Enums"]["run_kind"];
          model?: string | null;
          output_tokens?: number | null;
          prompt_version?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["run_status"];
          target_month?: string | null;
        };
        Update: {
          content_item_id?: string | null;
          error?: string | null;
          estimated_cost_usd?: number | null;
          finished_at?: string | null;
          id?: never;
          input_tokens?: number | null;
          items_processed?: number;
          kind?: Database["public"]["Enums"]["run_kind"];
          model?: string | null;
          output_tokens?: number | null;
          prompt_version?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["run_status"];
          target_month?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "generation_runs_content_item_id_fkey";
            columns: ["content_item_id"];
            isOneToOne: false;
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
        ];
      };
      news_items: {
        Row: {
          fetched_at: string;
          id: string;
          published_at: string | null;
          source: string;
          summary: string | null;
          title: string;
          url: string;
          url_hash: string;
        };
        ComputedFields: never;
        Insert: {
          fetched_at?: string;
          id?: string;
          published_at?: string | null;
          source: string;
          summary?: string | null;
          title: string;
          url: string;
          url_hash: string;
        };
        Update: {
          fetched_at?: string;
          id?: string;
          published_at?: string | null;
          source?: string;
          summary?: string | null;
          title?: string;
          url?: string;
          url_hash?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          action_key: string;
          actor_key: string;
          count: number;
          updated_at: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          action_key: string;
          actor_key: string;
          count?: number;
          updated_at?: string;
          window_start: string;
        };
        Update: {
          action_key?: string;
          actor_key?: string;
          count?: number;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      change_content_status: {
        Args: {
          p_item_id: string;
          p_note?: string;
          p_skip_reason?: string;
          p_status: Database["public"]["Enums"]["content_status"];
        };
        Returns: Json;
      };
      consume_rate_limit: {
        Args: {
          p_action_key: string;
          p_actor_key: string;
          p_limit: number;
          p_window_start: string;
        };
        Returns: boolean;
      };
      dearmor: { Args: { "": string }; Returns: string };
      gen_random_uuid: { Args: Record<PropertyKey, never>; Returns: string };
      gen_salt: { Args: { "": string }; Returns: string };
      pgp_armor_headers: {
        Args: { "": string };
        Returns: Record<string, unknown>[];
      };
    };
    Enums: {
      activity_action:
        | "created"
        | "hydrated"
        | "regenerated"
        | "status_changed"
        | "note_added";
      content_format: "carousel" | "reel" | "post" | "story" | "meme" | "poll";
      content_pillar:
        | "salesforce_tips"
        | "salesforce_news"
        | "memes"
        | "interview_questions"
        | "success_stories"
        | "course_promos"
        | "career_guidance"
        | "behind_the_scenes"
        | "myth_busting"
        | "polls_engagement";
      content_status: "idea" | "ready" | "posted" | "skipped";
      plan_status: "pending" | "generating" | "complete" | "failed";
      platform: "instagram" | "linkedin" | "whatsapp";
      run_kind:
        | "month_skeleton"
        | "item_hydration"
        | "item_regeneration"
        | "daily_tip"
        | "news_ingest";
      run_status: "running" | "success" | "partial" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      activity_action: [
        "created",
        "hydrated",
        "regenerated",
        "status_changed",
        "note_added",
      ],
      content_format: ["carousel", "reel", "post", "story", "meme", "poll"],
      content_pillar: [
        "salesforce_tips",
        "salesforce_news",
        "memes",
        "interview_questions",
        "success_stories",
        "course_promos",
        "career_guidance",
        "behind_the_scenes",
        "myth_busting",
        "polls_engagement",
      ],
      content_status: ["idea", "ready", "posted", "skipped"],
      plan_status: ["pending", "generating", "complete", "failed"],
      platform: ["instagram", "linkedin", "whatsapp"],
      run_kind: [
        "month_skeleton",
        "item_hydration",
        "item_regeneration",
        "daily_tip",
        "news_ingest",
      ],
      run_status: ["running", "success", "partial", "failed"],
    },
  },
} as const;
