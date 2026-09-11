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
      daily_metrics: {
        Row: {
          created_at: string
          creatine_g: number | null
          creatine_taken: boolean
          id: string
          metric_date: string
          notes: string | null
          sleep_hours: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          water_ml: number | null
          weight_kg: number | null
          workout_minutes: number | null
          workout_type: string | null
        }
        Insert: {
          created_at?: string
          creatine_g?: number | null
          creatine_taken?: boolean
          id?: string
          metric_date?: string
          notes?: string | null
          sleep_hours?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          water_ml?: number | null
          weight_kg?: number | null
          workout_minutes?: number | null
          workout_type?: string | null
        }
        Update: {
          created_at?: string
          creatine_g?: number | null
          creatine_taken?: boolean
          id?: string
          metric_date?: string
          notes?: string | null
          sleep_hours?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          water_ml?: number | null
          weight_kg?: number | null
          workout_minutes?: number | null
          workout_type?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          calorie_target: number
          carb_target_g: number
          created_at: string
          creatine_target_g: number
          fat_target_g: number
          goal_type: string
          id: string
          is_active: boolean
          protein_target_g: number
          sleep_target_hours: number
          target_weight_kg: number
          updated_at: string
          user_id: string
          water_target_ml: number
          workout_days_per_week: number
        }
        Insert: {
          calorie_target?: number
          carb_target_g?: number
          created_at?: string
          creatine_target_g?: number
          fat_target_g?: number
          goal_type?: string
          id?: string
          is_active?: boolean
          protein_target_g?: number
          sleep_target_hours?: number
          target_weight_kg?: number
          updated_at?: string
          user_id: string
          water_target_ml?: number
          workout_days_per_week?: number
        }
        Update: {
          calorie_target?: number
          carb_target_g?: number
          created_at?: string
          creatine_target_g?: number
          fat_target_g?: number
          goal_type?: string
          id?: string
          is_active?: boolean
          protein_target_g?: number
          sleep_target_hours?: number
          target_weight_kg?: number
          updated_at?: string
          user_id?: string
          water_target_ml?: number
          workout_days_per_week?: number
        }
        Relationships: []
      }
      meals: {
        Row: {
          calories: number
          carbs_g: number
          category: string
          created_at: string
          eaten_at: string
          estimate_source: string | null
          fat_g: number
          id: string
          is_demo: boolean
          is_estimate: boolean
          name: string
          notes: string | null
          photo_path: string | null
          protein_g: number
          serving_amount: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calories?: number
          carbs_g?: number
          category?: string
          created_at?: string
          eaten_at?: string
          estimate_source?: string | null
          fat_g?: number
          id?: string
          is_demo?: boolean
          is_estimate?: boolean
          name: string
          notes?: string | null
          photo_path?: string | null
          protein_g?: number
          serving_amount?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          category?: string
          created_at?: string
          eaten_at?: string
          estimate_source?: string | null
          fat_g?: number
          id?: string
          is_demo?: boolean
          is_estimate?: boolean
          name?: string
          notes?: string | null
          photo_path?: string | null
          protein_g?: number
          serving_amount?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          created_at: string
          display_name: string | null
          goal_weight_kg: number | null
          height_cm: number | null
          id: string
          onboarded: boolean
          sex: string | null
          start_weight_kg: number | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          display_name?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id: string
          onboarded?: boolean
          sex?: string | null
          start_weight_kg?: number | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          created_at?: string
          display_name?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id?: string
          onboarded?: boolean
          sex?: string | null
          start_weight_kg?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      exercise_catalog: {
        Row: {
          created_at: string
          equipment: string | null
          id: string
          is_active: boolean
          is_bodyweight: boolean
          muscle_group: string
          name: string
          variant: string | null
        }
        Insert: {
          created_at?: string
          equipment?: string | null
          id?: string
          is_active?: boolean
          is_bodyweight?: boolean
          muscle_group: string
          name: string
          variant?: string | null
        }
        Update: {
          created_at?: string
          equipment?: string | null
          id?: string
          is_active?: boolean
          is_bodyweight?: boolean
          muscle_group?: string
          name?: string
          variant?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          dedupe_key: string | null
          expires_at: string | null
          id: string
          is_dismissed: boolean
          is_read: boolean
          message: string
          priority: string
          related_exercise_name: string | null
          related_workout_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          dedupe_key?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message: string
          priority?: string
          related_exercise_name?: string | null
          related_workout_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          dedupe_key?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message?: string
          priority?: string
          related_exercise_name?: string | null
          related_workout_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_training_preferences: {
        Row: {
          created_at: string
          enable_health_notifications: boolean
          enable_motivation_notifications: boolean
          enable_progression_notifications: boolean
          experience_level: Database["public"]["Enums"]["experience_level"] | null
          minimum_sessions_for_suggestion: number
          minimum_weeks_for_suggestion: number
          progression_mode: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          target_max_reps: number
          target_min_reps: number
          target_sets: number
          training_phase: Database["public"]["Enums"]["training_phase"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enable_health_notifications?: boolean
          enable_motivation_notifications?: boolean
          enable_progression_notifications?: boolean
          experience_level?: Database["public"]["Enums"]["experience_level"] | null
          minimum_sessions_for_suggestion?: number
          minimum_weeks_for_suggestion?: number
          progression_mode?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          target_max_reps?: number
          target_min_reps?: number
          target_sets?: number
          training_phase?: Database["public"]["Enums"]["training_phase"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enable_health_notifications?: boolean
          enable_motivation_notifications?: boolean
          enable_progression_notifications?: boolean
          experience_level?: Database["public"]["Enums"]["experience_level"] | null
          minimum_sessions_for_suggestion?: number
          minimum_weeks_for_suggestion?: number
          progression_mode?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          target_max_reps?: number
          target_min_reps?: number
          target_sets?: number
          training_phase?: Database["public"]["Enums"]["training_phase"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_message_logs: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          notification_id: string | null
          provider_message_id: string | null
          read_at: string | null
          recipient_phone: string
          sent_at: string | null
          status: string
          template_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient_phone: string
          sent_at?: string | null
          status?: string
          template_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string
          template_name?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_preferences: {
        Row: {
          consented_at: string | null
          created_at: string
          enable_progress: boolean
          enable_recovery: boolean
          enable_safety: boolean
          enable_workout_guidance: boolean
          notifications_enabled: boolean
          phone_number: string | null
          phone_verified: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consented_at?: string | null
          created_at?: string
          enable_progress?: boolean
          enable_recovery?: boolean
          enable_safety?: boolean
          enable_workout_guidance?: boolean
          notifications_enabled?: boolean
          phone_number?: string | null
          phone_verified?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consented_at?: string | null
          created_at?: string
          enable_progress?: boolean
          enable_recovery?: boolean
          enable_safety?: boolean
          enable_workout_guidance?: boolean
          notifications_enabled?: boolean
          phone_number?: string | null
          phone_verified?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string
          equipment: string | null
          exercise_catalog_id: string | null
          exercise_name: string
          exercise_order: number
          exercise_variant: string | null
          id: string
          muscle_group: string
          notes: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment?: string | null
          exercise_catalog_id?: string | null
          exercise_name: string
          exercise_order?: number
          exercise_variant?: string | null
          id?: string
          muscle_group: string
          notes?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment?: string | null
          exercise_catalog_id?: string | null
          exercise_name?: string
          exercise_order?: number
          exercise_variant?: string | null
          id?: string
          muscle_group?: string
          notes?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          average_heart_rate: number | null
          calories_source: Database["public"]["Enums"]["workout_data_source"] | null
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          estimated_calories_burned: number | null
          external_source: string | null
          external_workout_id: string | null
          id: string
          intensity: Database["public"]["Enums"]["workout_intensity"] | null
          max_heart_rate: number | null
          notes: string | null
          source: Database["public"]["Enums"]["workout_data_source"]
          started_at: string | null
          total_volume: number
          training_phase: Database["public"]["Enums"]["training_phase"] | null
          updated_at: string
          user_id: string
          wearable_calories_burned: number | null
          workout_date: string
        }
        Insert: {
          average_heart_rate?: number | null
          calories_source?: Database["public"]["Enums"]["workout_data_source"] | null
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          estimated_calories_burned?: number | null
          external_source?: string | null
          external_workout_id?: string | null
          id?: string
          intensity?: Database["public"]["Enums"]["workout_intensity"] | null
          max_heart_rate?: number | null
          notes?: string | null
          source?: Database["public"]["Enums"]["workout_data_source"]
          started_at?: string | null
          total_volume?: number
          training_phase?: Database["public"]["Enums"]["training_phase"] | null
          updated_at?: string
          user_id: string
          wearable_calories_burned?: number | null
          workout_date?: string
        }
        Update: {
          average_heart_rate?: number | null
          calories_source?: Database["public"]["Enums"]["workout_data_source"] | null
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          estimated_calories_burned?: number | null
          external_source?: string | null
          external_workout_id?: string | null
          id?: string
          intensity?: Database["public"]["Enums"]["workout_intensity"] | null
          max_heart_rate?: number | null
          notes?: string | null
          source?: Database["public"]["Enums"]["workout_data_source"]
          started_at?: string | null
          total_volume?: number
          training_phase?: Database["public"]["Enums"]["training_phase"] | null
          updated_at?: string
          user_id?: string
          wearable_calories_burned?: number | null
          workout_date?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          notes: string | null
          reps: number
          rest_seconds: number | null
          rir: number | null
          rpe: number | null
          set_number: number
          user_id: string
          weight_kg: number | null
          weight_mode: string
          workout_exercise_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          reps: number
          rest_seconds?: number | null
          rir?: number | null
          rpe?: number | null
          set_number: number
          user_id: string
          weight_kg?: number | null
          weight_mode?: string
          workout_exercise_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          reps?: number
          rest_seconds?: number | null
          rir?: number | null
          rpe?: number | null
          set_number?: number
          user_id?: string
          weight_kg?: number | null
          weight_mode?: string
          workout_exercise_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_workout_session: {
        Args: {
          p_workout_date: string
          p_duration_minutes: number | null
          p_intensity: Database["public"]["Enums"]["workout_intensity"] | null
          p_training_phase: Database["public"]["Enums"]["training_phase"] | null
          p_estimated_calories_burned: number | null
          p_wearable_calories_burned: number | null
          p_calories_source: Database["public"]["Enums"]["workout_data_source"] | null
          p_average_heart_rate: number | null
          p_max_heart_rate: number | null
          p_total_volume: number
          p_notes: string | null
          p_exercises: Json
        }
        Returns: Database["public"]["Tables"]["workout_sessions"]["Row"]
      }
    }
    Enums: {
      experience_level: "beginner" | "intermediate" | "advanced"
      notification_category:
        | "progress"
        | "motivation"
        | "workout_guidance"
        | "progression"
        | "nutrition"
        | "recovery"
        | "safety"
        | "wearable"
        | "system"
      training_phase:
        | "hypertrophy"
        | "strength"
        | "fat_loss"
        | "general_fitness"
        | "endurance"
        | "maintenance"
        | "custom"
      workout_data_source: "manual" | "wearable" | "estimated" | "imported"
      workout_intensity: "light" | "moderate" | "vigorous"
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
      experience_level: ["beginner", "intermediate", "advanced"],
      notification_category: [
        "progress",
        "motivation",
        "workout_guidance",
        "progression",
        "nutrition",
        "recovery",
        "safety",
        "wearable",
        "system",
      ],
      training_phase: [
        "hypertrophy",
        "strength",
        "fat_loss",
        "general_fitness",
        "endurance",
        "maintenance",
        "custom",
      ],
      workout_data_source: ["manual", "wearable", "estimated", "imported"],
      workout_intensity: ["light", "moderate", "vigorous"],
    },
  },
} as const
