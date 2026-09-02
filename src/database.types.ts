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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: []
      }
      logical_voters: {
        Row: {
          canonical_source_record_id: string | null
          created_at: string
          id: string
          lifecycle_status: string
          part_number: number
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          canonical_source_record_id?: string | null
          created_at?: string
          id?: string
          lifecycle_status?: string
          part_number: number
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          canonical_source_record_id?: string | null
          created_at?: string
          id?: string
          lifecycle_status?: string
          part_number?: number
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logical_voters_canonical_source_record_id_fkey"
            columns: ["canonical_source_record_id"]
            isOneToOne: false
            referencedRelation: "voter_records"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_corrections: {
        Row: {
          corrected_at: string
          corrected_by: string
          corrected_value: Json
          id: number
          original_value: Json
          voter_id: string
        }
        Insert: {
          corrected_at?: string
          corrected_by: string
          corrected_value: Json
          id?: never
          original_value: Json
          voter_id: string
        }
        Update: {
          corrected_at?: string
          corrected_by?: string
          corrected_value?: Json
          id?: never
          original_value?: Json
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_corrections_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "voter_records"
            referencedColumns: ["id"]
          },
        ]
      }
      page_processing: {
        Row: {
          created_at: string
          detected_language: string | null
          dropped_records: number
          error_message: string | null
          error_type: string | null
          id: number
          issue_detail: string | null
          language_confidence: number | null
          ocr_confidence: number | null
          page_type: string
          pdf_id: string
          pdf_page_number: number
          printed_page_number: number | null
          processed_at: string | null
          records_detected: number
          records_extracted: number
          retry_count: number
          review_records: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detected_language?: string | null
          dropped_records?: number
          error_message?: string | null
          error_type?: string | null
          id?: never
          issue_detail?: string | null
          language_confidence?: number | null
          ocr_confidence?: number | null
          page_type?: string
          pdf_id: string
          pdf_page_number: number
          printed_page_number?: number | null
          processed_at?: string | null
          records_detected?: number
          records_extracted?: number
          retry_count?: number
          review_records?: number
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detected_language?: string | null
          dropped_records?: number
          error_message?: string | null
          error_type?: string | null
          id?: never
          issue_detail?: string | null
          language_confidence?: number | null
          ocr_confidence?: number | null
          page_type?: string
          pdf_id?: string
          pdf_page_number?: number
          printed_page_number?: number | null
          processed_at?: string | null
          records_detected?: number
          records_extracted?: number
          retry_count?: number
          review_records?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_processing_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "uploaded_pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      review_issues: {
        Row: {
          created_at: string
          id: number
          issue_detail: string
          issue_type: string
          page_id: number | null
          pdf_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          voter_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          issue_detail: string
          issue_type: string
          page_id?: number | null
          pdf_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          voter_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          issue_detail?: string
          issue_type?: string
          page_id?: number | null
          pdf_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          voter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_issues_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "page_processing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_issues_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "uploaded_pdfs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_issues_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "voter_records"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_pdfs: {
        Row: {
          active_version: boolean
          checksum: string
          completed_at: string | null
          detected_language: string | null
          expected_voter_total: number | null
          failed_pages: number
          filename: string
          id: string
          language_confidence: number | null
          part_number: number
          processed_pages: number
          processing_status: string
          records_count: number
          review_records: number
          revision_identifier: string | null
          source_language: string
          storage_path: string
          supersedes_id: string | null
          total_pdf_pages: number
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          active_version?: boolean
          checksum: string
          completed_at?: string | null
          detected_language?: string | null
          expected_voter_total?: number | null
          failed_pages?: number
          filename: string
          id?: string
          language_confidence?: number | null
          part_number: number
          processed_pages?: number
          processing_status: string
          records_count?: number
          review_records?: number
          revision_identifier?: string | null
          source_language?: string
          storage_path: string
          supersedes_id?: string | null
          total_pdf_pages: number
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Update: {
          active_version?: boolean
          checksum?: string
          completed_at?: string | null
          detected_language?: string | null
          expected_voter_total?: number | null
          failed_pages?: number
          filename?: string
          id?: string
          language_confidence?: number | null
          part_number?: number
          processed_pages?: number
          processing_status?: string
          records_count?: number
          review_records?: number
          revision_identifier?: string | null
          source_language?: string
          storage_path?: string
          supersedes_id?: string | null
          total_pdf_pages?: number
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_pdfs_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "uploaded_pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      voter_records: {
        Row: {
          age: number | null
          age_confidence: number | null
          bounding_box: Json | null
          corrected_at: string | null
          corrected_by: string | null
          corrected_value: Json | null
          created_at: string
          duplicate_of: string | null
          epic_confidence: number | null
          epic_number: string | null
          field_confidence: Json
          gender: string | null
          house_confidence: number | null
          id: string
          logical_voter_id: string | null
          name_confidence: number | null
          normalized_house_number: string | null
          normalized_name: string | null
          normalized_relation_name: string | null
          ocr_confidence: number | null
          original_house_number: string | null
          original_language: string | null
          original_name: string | null
          original_relation_name: string | null
          original_text: string
          part_number: number
          pdf_id: string
          pdf_page_number: number
          possible_duplicate: boolean
          printed_page_number: number | null
          relation_confidence: number | null
          relation_type: string
          serial_number: string | null
          transliterated_name: string | null
          transliterated_relation_name: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          age?: number | null
          age_confidence?: number | null
          bounding_box?: Json | null
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_value?: Json | null
          created_at?: string
          duplicate_of?: string | null
          epic_confidence?: number | null
          epic_number?: string | null
          field_confidence?: Json
          gender?: string | null
          house_confidence?: number | null
          id?: string
          logical_voter_id?: string | null
          name_confidence?: number | null
          normalized_house_number?: string | null
          normalized_name?: string | null
          normalized_relation_name?: string | null
          ocr_confidence?: number | null
          original_house_number?: string | null
          original_language?: string | null
          original_name?: string | null
          original_relation_name?: string | null
          original_text: string
          part_number: number
          pdf_id: string
          pdf_page_number: number
          possible_duplicate?: boolean
          printed_page_number?: number | null
          relation_confidence?: number | null
          relation_type: string
          serial_number?: string | null
          transliterated_name?: string | null
          transliterated_relation_name?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          age?: number | null
          age_confidence?: number | null
          bounding_box?: Json | null
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_value?: Json | null
          created_at?: string
          duplicate_of?: string | null
          epic_confidence?: number | null
          epic_number?: string | null
          field_confidence?: Json
          gender?: string | null
          house_confidence?: number | null
          id?: string
          logical_voter_id?: string | null
          name_confidence?: number | null
          normalized_house_number?: string | null
          normalized_name?: string | null
          normalized_relation_name?: string | null
          ocr_confidence?: number | null
          original_house_number?: string | null
          original_language?: string | null
          original_name?: string | null
          original_relation_name?: string | null
          original_text?: string
          part_number?: number
          pdf_id?: string
          pdf_page_number?: number
          possible_duplicate?: boolean
          printed_page_number?: number | null
          relation_confidence?: number | null
          relation_type?: string
          serial_number?: string | null
          transliterated_name?: string | null
          transliterated_relation_name?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "voter_records_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "voter_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voter_records_logical_voter_id_fkey"
            columns: ["logical_voter_id"]
            isOneToOne: false
            referencedRelation: "logical_voters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voter_records_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "uploaded_pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_review_issues_page: {
        Args: {
          p_category?: string
          p_language?: string
          p_limit?: number
          p_offset?: number
          p_part?: number
          p_status?: string
        }
        Returns: {
          age: number
          corrected_value: Json
          epic_number: string
          field_confidence: Json
          filename: string
          gender: string
          house_number: string
          issue_created_at: string
          issue_detail: string
          issue_id: number
          issue_status: string
          issue_type: string
          original_text: string
          page_id: number
          page_ocr_confidence: number
          page_pdf_page_number: number
          page_printed_page_number: number
          page_status: string
          part_number: number
          pdf_id: string
          relation_name: string
          relation_type: string
          serial_number: string
          source_language: string
          storage_path: string
          total_count: number
          verification_status: Database["public"]["Enums"]["verification_status"]
          voter_id: string
          voter_name: string
          voter_ocr_confidence: number
          voter_pdf_page_number: number
          voter_printed_page_number: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      reconcile_logical_voters_for_part: {
        Args: { p_part: number }
        Returns: undefined
      }
      voter_language_coverage: {
        Args: { p_part?: number }
        Returns: {
          linked_records: number
          logical_total: number
          source_language: string
          source_records: number
          unavailable_records: number
          unlinked_records: number
        }[]
      }
    }
    Enums: {
      user_role: "admin" | "viewer"
      verification_status: "unverified" | "requires_review" | "verified"
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
      user_role: ["admin", "viewer"],
      verification_status: ["unverified", "requires_review", "verified"],
    },
  },
} as const
