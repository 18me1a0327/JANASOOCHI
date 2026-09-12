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
          operation_status: string
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          operation_status?: string
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          operation_status?: string
          request_id?: string | null
        }
        Relationships: []
      }
      dataset_exports: {
        Row: {
          checksum: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string | null
          export_format: string
          filters: Json
          id: string
          metadata: Json
          record_count: number | null
          requested_at: string
          requested_by: string | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          checksum?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_format: string
          filters?: Json
          id?: string
          metadata?: Json
          record_count?: number | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          checksum?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_format?: string
          filters?: Json
          id?: string
          metadata?: Json
          record_count?: number | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      logical_voters: {
        Row: {
          canonical_source_record_id: string | null
          created_at: string
          expected_slot: boolean
          id: string
          lifecycle_status: string
          part_number: number
          quarantine_reason: string | null
          serial_number: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          canonical_source_record_id?: string | null
          created_at?: string
          expected_slot?: boolean
          id?: string
          lifecycle_status?: string
          part_number: number
          quarantine_reason?: string | null
          serial_number?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          canonical_source_record_id?: string | null
          created_at?: string
          expected_slot?: boolean
          id?: string
          lifecycle_status?: string
          part_number?: number
          quarantine_reason?: string | null
          serial_number?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logical_voters_canonical_source_record_id_fkey"
            columns: ["canonical_source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
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
          correction_reason: string | null
          field_name: string | null
          id: number
          metadata: Json
          original_value: Json
          resolution_type: string | null
          voter_id: string
        }
        Insert: {
          corrected_at?: string
          corrected_by: string
          corrected_value: Json
          correction_reason?: string | null
          field_name?: string | null
          id?: never
          metadata?: Json
          original_value: Json
          resolution_type?: string | null
          voter_id: string
        }
        Update: {
          corrected_at?: string
          corrected_by?: string
          corrected_value?: Json
          correction_reason?: string | null
          field_name?: string | null
          id?: never
          metadata?: Json
          original_value?: Json
          resolution_type?: string | null
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_corrections_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
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
          card_states: Json
          created_at: string
          detected_language: string | null
          dropped_records: number
          error_message: string | null
          error_type: string | null
          extraction_attempts: number
          id: number
          issue_detail: string | null
          language_confidence: number | null
          last_error_at: string | null
          ocr_confidence: number | null
          page_type: string
          pdf_id: string
          pdf_page_number: number
          printed_page_number: number | null
          processed_at: string | null
          processing_run_id: string | null
          records_detected: number
          records_extracted: number
          render_attempts: number
          resumable: boolean
          retry_count: number
          review_records: number
          status: string
          updated_at: string
        }
        Insert: {
          card_states?: Json
          created_at?: string
          detected_language?: string | null
          dropped_records?: number
          error_message?: string | null
          error_type?: string | null
          extraction_attempts?: number
          id?: never
          issue_detail?: string | null
          language_confidence?: number | null
          last_error_at?: string | null
          ocr_confidence?: number | null
          page_type?: string
          pdf_id: string
          pdf_page_number: number
          printed_page_number?: number | null
          processed_at?: string | null
          processing_run_id?: string | null
          records_detected?: number
          records_extracted?: number
          render_attempts?: number
          resumable?: boolean
          retry_count?: number
          review_records?: number
          status: string
          updated_at?: string
        }
        Update: {
          card_states?: Json
          created_at?: string
          detected_language?: string | null
          dropped_records?: number
          error_message?: string | null
          error_type?: string | null
          extraction_attempts?: number
          id?: never
          issue_detail?: string | null
          language_confidence?: number | null
          last_error_at?: string | null
          ocr_confidence?: number | null
          page_type?: string
          pdf_id?: string
          pdf_page_number?: number
          printed_page_number?: number | null
          processed_at?: string | null
          processing_run_id?: string | null
          records_detected?: number
          records_extracted?: number
          render_attempts?: number
          resumable?: boolean
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
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_processing_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "uploaded_pdfs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_processing_processing_run_id_fkey"
            columns: ["processing_run_id"]
            isOneToOne: false
            referencedRelation: "processing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      part_expectations: {
        Row: {
          expected_serial_end: number
          expected_serial_start: number
          expected_voter_total: number
          part_number: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          expected_serial_end: number
          expected_serial_start: number
          expected_voter_total: number
          part_number: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          expected_serial_end?: number
          expected_serial_start?: number
          expected_voter_total?: number
          part_number?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      processing_runs: {
        Row: {
          attempt_number: number
          cards_detected: number
          completed_at: string | null
          created_at: string
          document_id: string
          error_summary: Json
          failed_pages: number
          id: string
          last_heartbeat_at: string | null
          metrics: Json
          processed_pages: number
          records_extracted: number
          resume_state: Json
          source_language: string | null
          stage: string
          started_at: string
          started_by: string | null
          status: string
          succeeded_pages: number
          total_pages: number
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          cards_detected?: number
          completed_at?: string | null
          created_at?: string
          document_id: string
          error_summary?: Json
          failed_pages?: number
          id?: string
          last_heartbeat_at?: string | null
          metrics?: Json
          processed_pages?: number
          records_extracted?: number
          resume_state?: Json
          source_language?: string | null
          stage?: string
          started_at?: string
          started_by?: string | null
          status?: string
          succeeded_pages?: number
          total_pages?: number
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          cards_detected?: number
          completed_at?: string | null
          created_at?: string
          document_id?: string
          error_summary?: Json
          failed_pages?: number
          id?: string
          last_heartbeat_at?: string | null
          metrics?: Json
          processed_pages?: number
          records_extracted?: number
          resume_state?: Json
          source_language?: string | null
          stage?: string
          started_at?: string
          started_by?: string | null
          status?: string
          succeeded_pages?: number
          total_pages?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_runs_document_id_fkey"
            columns: ["document_id"]
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
          auto_resolved: boolean
          created_at: string
          id: number
          issue_detail: string
          issue_type: string
          original_values: Json
          page_id: number | null
          pdf_id: string
          resolution_metadata: Json
          resolution_reason: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          resulting_values: Json
          severity: string
          status: string
          updated_at: string
          voter_id: string | null
        }
        Insert: {
          auto_resolved?: boolean
          created_at?: string
          id?: never
          issue_detail: string
          issue_type: string
          original_values?: Json
          page_id?: number | null
          pdf_id: string
          resolution_metadata?: Json
          resolution_reason?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resulting_values?: Json
          severity?: string
          status?: string
          updated_at?: string
          voter_id?: string | null
        }
        Update: {
          auto_resolved?: boolean
          created_at?: string
          id?: never
          issue_detail?: string
          issue_type?: string
          original_values?: Json
          page_id?: number | null
          pdf_id?: string
          resolution_metadata?: Json
          resolution_reason?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resulting_values?: Json
          severity?: string
          status?: string
          updated_at?: string
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
            foreignKeyName: "review_issues_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pdf_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_issues_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
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
            referencedRelation: "source_records"
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
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_pdfs_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "uploaded_pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          extraction_method: string | null
          field_confidence: Json
          gender: string | null
          house_confidence: number | null
          id: string
          logical_voter_id: string | null
          name_confidence: number | null
          normalization_version: string | null
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
          source_card_index: number | null
          transliterated_name: string | null
          transliterated_relation_name: string | null
          updated_at: string
          verification_evidence: Json
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
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
          extraction_method?: string | null
          field_confidence?: Json
          gender?: string | null
          house_confidence?: number | null
          id?: string
          logical_voter_id?: string | null
          name_confidence?: number | null
          normalization_version?: string | null
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
          source_card_index?: number | null
          transliterated_name?: string | null
          transliterated_relation_name?: string | null
          updated_at?: string
          verification_evidence?: Json
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
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
          extraction_method?: string | null
          field_confidence?: Json
          gender?: string | null
          house_confidence?: number | null
          id?: string
          logical_voter_id?: string | null
          name_confidence?: number | null
          normalization_version?: string | null
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
          source_card_index?: number | null
          transliterated_name?: string | null
          transliterated_relation_name?: string | null
          updated_at?: string
          verification_evidence?: Json
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voter_records_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "uploaded_documents"
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
      pdf_pages: {
        Row: {
          card_states: Json | null
          created_at: string | null
          detected_language: string | null
          document_id: string | null
          dropped_records: number | null
          error_message: string | null
          error_type: string | null
          extraction_attempts: number | null
          id: number | null
          issue_detail: string | null
          language_confidence: number | null
          last_error_at: string | null
          ocr_confidence: number | null
          page_type: string | null
          physical_page_number: number | null
          printed_page_number: number | null
          processed_at: string | null
          processing_run_id: string | null
          records_detected: number | null
          records_extracted: number | null
          render_attempts: number | null
          resumable: boolean | null
          retry_count: number | null
          review_records: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          card_states?: Json | null
          created_at?: string | null
          detected_language?: string | null
          document_id?: string | null
          dropped_records?: number | null
          error_message?: string | null
          error_type?: string | null
          extraction_attempts?: number | null
          id?: number | null
          issue_detail?: string | null
          language_confidence?: number | null
          last_error_at?: string | null
          ocr_confidence?: number | null
          page_type?: string | null
          physical_page_number?: number | null
          printed_page_number?: number | null
          processed_at?: string | null
          processing_run_id?: string | null
          records_detected?: number | null
          records_extracted?: number | null
          render_attempts?: number | null
          resumable?: boolean | null
          retry_count?: number | null
          review_records?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          card_states?: Json | null
          created_at?: string | null
          detected_language?: string | null
          document_id?: string | null
          dropped_records?: number | null
          error_message?: string | null
          error_type?: string | null
          extraction_attempts?: number | null
          id?: number | null
          issue_detail?: string | null
          language_confidence?: number | null
          last_error_at?: string | null
          ocr_confidence?: number | null
          page_type?: string | null
          physical_page_number?: number | null
          printed_page_number?: number | null
          processed_at?: string | null
          processing_run_id?: string | null
          records_detected?: number | null
          records_extracted?: number | null
          render_attempts?: number | null
          resumable?: boolean | null
          retry_count?: number | null
          review_records?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_processing_pdf_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_processing_pdf_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_pdfs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_processing_processing_run_id_fkey"
            columns: ["processing_run_id"]
            isOneToOne: false
            referencedRelation: "processing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      record_corrections: {
        Row: {
          corrected_at: string | null
          corrected_by: string | null
          corrected_value: Json | null
          correction_reason: string | null
          field_name: string | null
          id: number | null
          metadata: Json | null
          original_value: Json | null
          resolution_type: string | null
          source_record_id: string | null
        }
        Insert: {
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_value?: Json | null
          correction_reason?: string | null
          field_name?: string | null
          id?: number | null
          metadata?: Json | null
          original_value?: Json | null
          resolution_type?: string | null
          source_record_id?: string | null
        }
        Update: {
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_value?: Json | null
          correction_reason?: string | null
          field_name?: string | null
          id?: number | null
          metadata?: Json | null
          original_value?: Json | null
          resolution_type?: string | null
          source_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_corrections_voter_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_corrections_voter_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "voter_records"
            referencedColumns: ["id"]
          },
        ]
      }
      source_records: {
        Row: {
          age: number | null
          age_confidence: number | null
          bounding_box: Json | null
          corrected_at: string | null
          corrected_by: string | null
          corrected_value: Json | null
          created_at: string | null
          document_id: string | null
          duplicate_of: string | null
          epic_confidence: number | null
          epic_number: string | null
          extraction_method: string | null
          field_confidence: Json | null
          gender: string | null
          house_confidence: number | null
          id: string | null
          logical_voter_id: string | null
          name_confidence: number | null
          normalization_version: string | null
          normalized_house_number: string | null
          normalized_name: string | null
          normalized_relation_name: string | null
          ocr_confidence: number | null
          original_house_number: string | null
          original_name: string | null
          original_relation_name: string | null
          original_text: string | null
          part_number: number | null
          physical_page_number: number | null
          possible_duplicate: boolean | null
          printed_page_number: number | null
          relation_confidence: number | null
          relation_type: string | null
          serial_number: string | null
          source_card_index: number | null
          source_language: string | null
          transliterated_name: string | null
          transliterated_relation_name: string | null
          updated_at: string | null
          verification_evidence: Json | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          age?: number | null
          age_confidence?: number | null
          bounding_box?: Json | null
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_value?: Json | null
          created_at?: string | null
          document_id?: string | null
          duplicate_of?: string | null
          epic_confidence?: number | null
          epic_number?: string | null
          extraction_method?: string | null
          field_confidence?: Json | null
          gender?: string | null
          house_confidence?: number | null
          id?: string | null
          logical_voter_id?: string | null
          name_confidence?: number | null
          normalization_version?: string | null
          normalized_house_number?: string | null
          normalized_name?: string | null
          normalized_relation_name?: string | null
          ocr_confidence?: number | null
          original_house_number?: string | null
          original_name?: string | null
          original_relation_name?: string | null
          original_text?: string | null
          part_number?: number | null
          physical_page_number?: number | null
          possible_duplicate?: boolean | null
          printed_page_number?: number | null
          relation_confidence?: number | null
          relation_type?: string | null
          serial_number?: string | null
          source_card_index?: number | null
          source_language?: string | null
          transliterated_name?: string | null
          transliterated_relation_name?: string | null
          updated_at?: string | null
          verification_evidence?: Json | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          age?: number | null
          age_confidence?: number | null
          bounding_box?: Json | null
          corrected_at?: string | null
          corrected_by?: string | null
          corrected_value?: Json | null
          created_at?: string | null
          document_id?: string | null
          duplicate_of?: string | null
          epic_confidence?: number | null
          epic_number?: string | null
          extraction_method?: string | null
          field_confidence?: Json | null
          gender?: string | null
          house_confidence?: number | null
          id?: string | null
          logical_voter_id?: string | null
          name_confidence?: number | null
          normalization_version?: string | null
          normalized_house_number?: string | null
          normalized_name?: string | null
          normalized_relation_name?: string | null
          ocr_confidence?: number | null
          original_house_number?: string | null
          original_name?: string | null
          original_relation_name?: string | null
          original_text?: string | null
          part_number?: number | null
          physical_page_number?: number | null
          possible_duplicate?: boolean | null
          printed_page_number?: number | null
          relation_confidence?: number | null
          relation_type?: string | null
          serial_number?: string | null
          source_card_index?: number | null
          source_language?: string | null
          transliterated_name?: string | null
          transliterated_relation_name?: string | null
          updated_at?: string | null
          verification_evidence?: Json | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voter_records_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
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
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voter_records_pdf_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          active_version: boolean | null
          checksum: string | null
          completed_at: string | null
          detected_language: string | null
          expected_voter_total: number | null
          failed_pages: number | null
          filename: string | null
          id: string | null
          language_confidence: number | null
          part_number: number | null
          processed_pages: number | null
          processing_status: string | null
          records_count: number | null
          review_records: number | null
          revision_identifier: string | null
          source_language: string | null
          storage_path: string | null
          supersedes_id: string | null
          total_pdf_pages: number | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          active_version?: boolean | null
          checksum?: string | null
          completed_at?: string | null
          detected_language?: string | null
          expected_voter_total?: number | null
          failed_pages?: number | null
          filename?: string | null
          id?: string | null
          language_confidence?: number | null
          part_number?: number | null
          processed_pages?: number | null
          processing_status?: string | null
          records_count?: number | null
          review_records?: number | null
          revision_identifier?: string | null
          source_language?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          total_pdf_pages?: number | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          active_version?: boolean | null
          checksum?: string | null
          completed_at?: string | null
          detected_language?: string | null
          expected_voter_total?: number | null
          failed_pages?: number | null
          filename?: string | null
          id?: string | null
          language_confidence?: number | null
          part_number?: number | null
          processed_pages?: number | null
          processing_status?: string | null
          records_count?: number | null
          review_records?: number | null
          revision_identifier?: string | null
          source_language?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          total_pdf_pages?: number | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_pdfs_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_pdfs_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "uploaded_pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_data_quality_summary: {
        Args: { p_language?: string; p_part?: number }
        Returns: {
          active_logical_voters: number
          critical_issues: number
          duplicate_epic_groups: number
          duplicate_serial_groups: number
          expected_slots: number
          expected_voter_cards: number
          extracted_source_records: number
          extracted_voter_cards: number
          failed_pages: number
          informational_issues: number
          linked_source_records: number
          missing_serials: number
          needs_review_issues: number
          null_age_records: number
          null_epic_records: number
          null_house_records: number
          null_name_records: number
          null_relation_records: number
          partial_pages: number
          reconciliation_conflicts: number
          unexpected_serials: number
          unverified_logical_voters: number
          verified_logical_voters: number
        }[]
      }
      get_master_dataset_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          logical_voter_id: string
          part_number: number
          serial_number: string
          source_records: Json
          total_count: number
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string
        }[]
      }
      get_part_language_quality: {
        Args: never
        Returns: {
          expected_slots: number
          linked_slot_count: number
          missing_slot_count: number
          part_number: number
          source_language: string
          source_record_count: number
          unlinked_source_count: number
        }[]
      }
      get_reconciliation_evidence_page_v1: {
        Args: {
          p_after_part?: number
          p_after_row_key?: string
          p_after_serial?: number
          p_limit?: number
          p_part?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          age_evidence: string
          cursor_part: number
          cursor_serial: number
          english_age: number
          english_bounding_box: Json
          english_document_id: string
          english_epic: string
          english_gender: string
          english_house_number: string
          english_physical_page: number
          english_printed_page: number
          english_relation_name: string
          english_revision_identifier: string
          english_source_count: number
          english_source_record_id: string
          english_voter_name: string
          epic_evidence: string
          gender_evidence: string
          house_evidence: string
          logical_verification_status: Database["public"]["Enums"]["verification_status"]
          logical_voter_id: string
          part_number: number
          reconciliation_status: string
          row_key: string
          serial_number: string
          telugu_age: number
          telugu_bounding_box: Json
          telugu_document_id: string
          telugu_epic: string
          telugu_gender: string
          telugu_house_number: string
          telugu_physical_page: number
          telugu_printed_page: number
          telugu_relation_name: string
          telugu_revision_identifier: string
          telugu_source_count: number
          telugu_source_record_id: string
          telugu_voter_name: string
          total_count: number
        }[]
      }
      get_revision_reconciliation_summary_v1: {
        Args: { p_part?: number }
        Returns: {
          active_documents: number
          duplicate_source_slots: number
          english_linked_slots: number
          epic_conflict_slots: number
          expected_slots: number
          missing_english_slots: number
          missing_telugu_slots: number
          needs_review_slots: number
          paired_slots: number
          part_number: number
          reconciled_slots: number
          revision_identifiers: string[]
          source_records: number
          telugu_linked_slots: number
          unlinked_source_records: number
          verified_slots: number
        }[]
      }
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
      get_review_issues_page_v2: {
        Args: {
          p_after_created_at?: string
          p_after_id?: number
          p_category?: string
          p_language?: string
          p_limit?: number
          p_part?: number
          p_search?: string
          p_severity?: string
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
          issue_severity: string
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
      get_serial_completeness_page: {
        Args: {
          p_after_cursor?: string
          p_language?: string
          p_limit?: number
          p_part: number
          p_status?: string
        }
        Returns: {
          occurrence_count: number
          page_cursor: string
          serial_number: string
          serial_status: string
          source_record_ids: string[]
          total_count: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_authorized_user: { Args: never; Returns: boolean }
      reconcile_logical_voters_for_part: {
        Args: { p_part: number }
        Returns: undefined
      }
      record_dataset_export: {
        Args: {
          p_error_message?: string
          p_format: string
          p_record_count: number
          p_status?: string
        }
        Returns: string
      }
      save_review_correction_v1: {
        Args: {
          p_corrected_value: Json
          p_issue_id: number
          p_mark_verified?: boolean
          p_reason?: string
        }
        Returns: {
          corrected_at: string
          issue_id: number
          issue_status: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          voter_id: string
        }[]
      }
      search_source_records_page: {
        Args: {
          p_age?: number
          p_epic?: string
          p_fuzzy?: boolean
          p_gender?: string
          p_house_number?: string
          p_language?: string
          p_limit?: number
          p_name?: string
          p_offset?: number
          p_part?: number
          p_relation_name?: string
          p_relation_type?: string
          p_serial?: string
        }
        Returns: {
          age: number
          bounding_box: Json
          document_id: string
          epic_number: string
          gender: string
          house_number: string
          id: string
          logical_voter_id: string
          match_score: number
          ocr_confidence: number
          part_number: number
          physical_page_number: number
          printed_page_number: number
          relation_name: string
          relation_type: string
          serial_number: string
          source_language: string
          total_count: number
          verification_status: Database["public"]["Enums"]["verification_status"]
          voter_name: string
        }[]
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
      user_role: ["admin", "viewer"],
      verification_status: ["unverified", "requires_review", "verified"],
    },
  },
} as const

