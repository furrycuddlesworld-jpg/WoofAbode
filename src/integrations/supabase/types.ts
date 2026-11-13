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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      advances: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          parent_id: string
          received_on: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          parent_id: string
          received_on?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          parent_id?: string
          received_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          advance_applied: number
          bill_number: number
          generated_at: string
          has_estimate: boolean
          id: string
          lines: Json
          month: string
          paid: number
          parent_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["bill_status"]
          subtotal: number
          total: number
        }
        Insert: {
          advance_applied?: number
          bill_number?: number
          generated_at?: string
          has_estimate?: boolean
          id?: string
          lines?: Json
          month: string
          paid?: number
          parent_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          total?: number
        }
        Update: {
          advance_applied?: number
          bill_number?: number
          generated_at?: string
          has_estimate?: boolean
          id?: string
          lines?: Json
          month?: string
          paid?: number
          parent_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "bills_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          created_by: string | null
          dog_id: string
          end_date: string
          id: string
          note: string | null
          service: string
          start_date: string
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          created_by?: string | null
          dog_id: string
          end_date: string
          id?: string
          note?: string | null
          service: string
          start_date: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          created_by?: string | null
          dog_id?: string
          end_date?: string
          id?: string
          note?: string | null
          service?: string
          start_date?: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      day_boarding: {
        Row: {
          date: string
          dog_id: string
          id: string
          imported: boolean
          marked_at: string | null
          status: Database["public"]["Enums"]["day_status"]
        }
        Insert: {
          date: string
          dog_id: string
          id?: string
          imported?: boolean
          marked_at?: string | null
          status?: Database["public"]["Enums"]["day_status"]
        }
        Update: {
          date?: string
          dog_id?: string
          id?: string
          imported?: boolean
          marked_at?: string | null
          status?: Database["public"]["Enums"]["day_status"]
        }
        Relationships: [
          {
            foreignKeyName: "day_boarding_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      day_boarding_roster: {
        Row: {
          added_manually: boolean
          created_at: string
          dog_id: string
          hidden: boolean
          id: string
          month: string
        }
        Insert: {
          added_manually?: boolean
          created_at?: string
          dog_id: string
          hidden?: boolean
          id?: string
          month: string
        }
        Update: {
          added_manually?: boolean
          created_at?: string
          dog_id?: string
          hidden?: boolean
          id?: string
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_boarding_roster_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dogs: {
        Row: {
          active: boolean
          allergies: string | null
          behaviour_notes: string | null
          breed: string | null
          created_at: string
          date_of_birth: string | null
          food: string | null
          id: string
          location: string | null
          medicines: string | null
          name: string
          neutered: boolean | null
          owner_id: string | null
          pending_owner_email: string | null
          pending_owner_name: string | null
          pending_owner_phone: string | null
          photo_path: string | null
          service_type: string
          sex: string | null
          vet_address: string | null
          vet_clinic: string | null
          vet_name: string | null
          vet_phone: string | null
          weight_kg: number | null
        }
        Insert: {
          active?: boolean
          allergies?: string | null
          behaviour_notes?: string | null
          breed?: string | null
          created_at?: string
          date_of_birth?: string | null
          food?: string | null
          id?: string
          location?: string | null
          medicines?: string | null
          name: string
          neutered?: boolean | null
          owner_id?: string | null
          pending_owner_email?: string | null
          pending_owner_name?: string | null
          pending_owner_phone?: string | null
          photo_path?: string | null
          service_type?: string
          sex?: string | null
          vet_address?: string | null
          vet_clinic?: string | null
          vet_name?: string | null
          vet_phone?: string | null
          weight_kg?: number | null
        }
        Update: {
          active?: boolean
          allergies?: string | null
          behaviour_notes?: string | null
          breed?: string | null
          created_at?: string
          date_of_birth?: string | null
          food?: string | null
          id?: string
          location?: string | null
          medicines?: string | null
          name?: string
          neutered?: boolean | null
          owner_id?: string | null
          pending_owner_email?: string | null
          pending_owner_name?: string | null
          pending_owner_phone?: string | null
          photo_path?: string | null
          service_type?: string
          sex?: string | null
          vet_address?: string | null
          vet_clinic?: string | null
          vet_name?: string | null
          vet_phone?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dogs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          created_at: string
          created_by: string | null
          date_given: string | null
          dog_id: string
          file_path: string | null
          id: string
          kind: Database["public"]["Enums"]["health_kind"]
          name: string
          next_due_date: string | null
          notes: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_given?: string | null
          dog_id: string
          file_path?: string | null
          id?: string
          kind: Database["public"]["Enums"]["health_kind"]
          name: string
          next_due_date?: string | null
          notes?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_given?: string | null
          dog_id?: string
          file_path?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["health_kind"]
          name?: string
          next_due_date?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_records_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_on: string
          status: Database["public"]["Enums"]["payment_status"]
          upi_txn_id: string | null
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_on?: string
          status?: Database["public"]["Enums"]["payment_status"]
          upi_txn_id?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_on?: string
          status?: Database["public"]["Enums"]["payment_status"]
          upi_txn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string
          emergency1_name: string | null
          emergency1_phone: string | null
          emergency1_relation: string | null
          emergency2_name: string | null
          emergency2_phone: string | null
          emergency2_relation: string | null
          full_name: string
          id: string
          phone: string | null
          whatsapp: string | null
          whatsapp_opt_in: boolean
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          emergency1_name?: string | null
          emergency1_phone?: string | null
          emergency1_relation?: string | null
          emergency2_name?: string | null
          emergency2_phone?: string | null
          emergency2_relation?: string | null
          full_name?: string
          id: string
          phone?: string | null
          whatsapp?: string | null
          whatsapp_opt_in?: boolean
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          emergency1_name?: string | null
          emergency1_phone?: string | null
          emergency1_relation?: string | null
          emergency2_name?: string | null
          emergency2_phone?: string | null
          emergency2_relation?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          whatsapp?: string | null
          whatsapp_opt_in?: boolean
        }
        Relationships: []
      }
      rates: {
        Row: {
          created_at: string
          day_rate: number | null
          dog_id: string
          effective_from: string
          id: string
          night_rate: number | null
          same_day_rate: number | null
        }
        Insert: {
          created_at?: string
          day_rate?: number | null
          dog_id: string
          effective_from: string
          id?: string
          night_rate?: number | null
          same_day_rate?: number | null
        }
        Update: {
          created_at?: string
          day_rate?: number | null
          dog_id?: string
          effective_from?: string
          id?: string
          night_rate?: number | null
          same_day_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rates_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_log: {
        Row: {
          channel: string
          days_before: number
          due_date: string
          error: string | null
          health_record_id: string
          id: string
          sent_at: string
          status: string
        }
        Insert: {
          channel: string
          days_before: number
          due_date: string
          error?: string | null
          health_record_id: string
          id?: string
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          days_before?: number
          due_date?: string
          error?: string | null
          health_record_id?: string
          id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_health_record_id_fkey"
            columns: ["health_record_id"]
            isOneToOne: false
            referencedRelation: "health_records"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          business_address: string | null
          business_name: string
          business_phone: string | null
          capacity_limit: number
          id: number
          upi_id: string | null
          upi_payee_name: string | null
        }
        Insert: {
          business_address?: string | null
          business_name?: string
          business_phone?: string | null
          capacity_limit?: number
          id?: number
          upi_id?: string | null
          upi_payee_name?: string | null
        }
        Update: {
          business_address?: string | null
          business_name?: string
          business_phone?: string | null
          capacity_limit?: number
          id?: number
          upi_id?: string | null
          upi_payee_name?: string | null
        }
        Relationships: []
      }
      stays: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          dog_id: string
          id: string
          imported: boolean
          imported_amount: number | null
          imported_paid: boolean | null
          night_rate_override: number | null
          notes: string | null
          override_reason: string | null
          planned_end: string
          planned_start: string
          status: Database["public"]["Enums"]["stay_status"]
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          dog_id: string
          id?: string
          imported?: boolean
          imported_amount?: number | null
          imported_paid?: boolean | null
          night_rate_override?: number | null
          notes?: string | null
          override_reason?: string | null
          planned_end: string
          planned_start: string
          status?: Database["public"]["Enums"]["stay_status"]
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          dog_id?: string
          id?: string
          imported?: boolean
          imported_amount?: number | null
          imported_paid?: boolean | null
          night_rate_override?: number | null
          notes?: string | null
          override_reason?: string | null
          planned_end?: string
          planned_start?: string
          status?: Database["public"]["Enums"]["stay_status"]
        }
        Relationships: [
          {
            foreignKeyName: "stays_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      owns_bill: { Args: { _bill_id: string }; Returns: boolean }
      owns_dog: { Args: { _dog_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "client" | "user"
      bill_status: "pending" | "partly_paid" | "paid"
      day_status: "scheduled" | "present" | "absent"
      health_kind: "vaccination" | "deworming" | "health_report"
      payment_method: "upi" | "cash" | "bank"
      payment_status: "to_confirm" | "confirmed" | "rejected"
      request_status: "pending" | "approved" | "declined"
      stay_status: "scheduled" | "in_progress" | "completed" | "cancelled"
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
      app_role: ["admin", "client", "user"],
      bill_status: ["pending", "partly_paid", "paid"],
      day_status: ["scheduled", "present", "absent"],
      health_kind: ["vaccination", "deworming", "health_report"],
      payment_method: ["upi", "cash", "bank"],
      payment_status: ["to_confirm", "confirmed", "rejected"],
      request_status: ["pending", "approved", "declined"],
      stay_status: ["scheduled", "in_progress", "completed", "cancelled"],
    },
  },
} as const
