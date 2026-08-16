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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bill_transactions: {
        Row: {
          amount: number
          created_at: string
          customer_identifier: string
          external_reference: string | null
          id: string
          internal_reference: string
          metadata: Json
          product: string | null
          provider: string
          service: string
          status: Database["public"]["Enums"]["tx_status"]
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_identifier: string
          external_reference?: string | null
          id?: string
          internal_reference: string
          metadata?: Json
          product?: string | null
          provider: string
          service: string
          status?: Database["public"]["Enums"]["tx_status"]
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_identifier?: string
          external_reference?: string | null
          id?: string
          internal_reference?: string
          metadata?: Json
          product?: string | null
          provider?: string
          service?: string
          status?: Database["public"]["Enums"]["tx_status"]
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          read?: boolean
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          billpay_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          billpay_id: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          billpay_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_payments: {
        Row: {
          created_at: string
          customer_identifier: string
          id: string
          metadata: Json
          nickname: string
          provider: string
          service: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_identifier: string
          id?: string
          metadata?: Json
          nickname: string
          provider: string
          service: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_identifier?: string
          id?: string
          metadata?: Json
          nickname?: string
          provider?: string
          service?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          description: string
          id: string
          status: Database["public"]["Enums"]["ticket_status"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          description: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          description?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "bill_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_pins: {
        Row: {
          created_at: string
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          provider: string | null
          provider_reference: string | null
          provider_transaction_id: string | null
          reference: string
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["wallet_tx_type"]
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          provider?: string | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          reference: string
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["wallet_tx_type"]
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          provider?: string | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      __apply_migration: { Args: { sql: string }; Returns: undefined }
      _pin_is_locked: { Args: { _locked_until: string }; Returns: boolean }
      admin_dashboard_stats: { Args: never; Returns: Json }
      bootstrap_current_user: {
        Args: { _full_name?: string; _phone?: string }
        Returns: {
          account_status: string
          avatar_url: string
          balance: number
          billpay_id: string
          currency: string
          email: string
          full_name: string
          phone: string
          profile_id: string
          wallet_id: string
          wallet_status: string
        }[]
      }
      change_transaction_pin: {
        Args: { _current_pin: string; _new_pin: string }
        Returns: boolean
      }
      complete_paystack_funding: {
        Args: {
          _paid_amount: number
          _payload?: Json
          _provider_transaction_id: string
          _reference: string
        }
        Returns: {
          amount: number
          balance_after: number
          credited: boolean
          status: Database["public"]["Enums"]["tx_status"]
        }[]
      }
      create_wallet_funding_intent: {
        Args: { _amount: number }
        Returns: {
          amount: number
          email: string
          reference: string
        }[]
      }
      demo_bill_payment: {
        Args: {
          _amount: number
          _customer_identifier: string
          _metadata?: Json
          _product: string
          _provider: string
          _service: string
          _status: Database["public"]["Enums"]["tx_status"]
        }
        Returns: {
          balance_after: number
          bill_id: string
          internal_reference: string
        }[]
      }
      demo_fund_wallet: {
        Args: { _amount: number; _description?: string }
        Returns: {
          balance_after: number
          reference: string
        }[]
      }
      generate_billpay_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_transaction_pin: { Args: never; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      new_reference: { Args: { prefix: string }; Returns: string }
      secure_bill_payment: {
        Args: {
          _amount: number
          _customer_identifier: string
          _metadata?: Json
          _pin?: string
          _product: string
          _provider: string
          _service: string
          _status: Database["public"]["Enums"]["tx_status"]
        }
        Returns: {
          balance_after: number
          bill_id: string
          internal_reference: string
        }[]
      }
      set_transaction_pin: { Args: { _pin: string }; Returns: boolean }
      settle_paystack_funding: {
        Args: {
          _payload?: Json
          _reference: string
          _status: Database["public"]["Enums"]["tx_status"]
        }
        Returns: {
          amount: number
          status: Database["public"]["Enums"]["tx_status"]
        }[]
      }
      verify_transaction_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "support"
      notification_type:
        | "success"
        | "warning"
        | "pending"
        | "information"
        | "security"
      ticket_category:
        | "payment_not_received"
        | "wrong_amount"
        | "pending_transaction"
        | "token_not_received"
        | "other"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
      tx_status: "pending" | "successful" | "failed" | "reversed"
      wallet_tx_type:
        | "deposit"
        | "bill_payment"
        | "refund"
        | "reversal"
        | "adjustment"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["super_admin", "admin", "support"],
      notification_type: [
        "success",
        "warning",
        "pending",
        "information",
        "security",
      ],
      ticket_category: [
        "payment_not_received",
        "wrong_amount",
        "pending_transaction",
        "token_not_received",
        "other",
      ],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
      tx_status: ["pending", "successful", "failed", "reversed"],
      wallet_tx_type: [
        "deposit",
        "bill_payment",
        "refund",
        "reversal",
        "adjustment",
      ],
    },
  },
} as const
