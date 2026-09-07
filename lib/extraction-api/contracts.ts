export const SUPPORTED_EXTRACTION_PARTS = [227, 228, 229, 230] as const

export type ExtractionPart = (typeof SUPPORTED_EXTRACTION_PARTS)[number]
export type ExtractionSourceLanguage = 'en' | 'te' | 'ur'
export type ExtractionJobStatus =
  | 'queued'
  | 'validating'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed'
  | 'cancelled'

export type ExtractionJobStage =
  | 'validation'
  | 'rendering'
  | 'segmentation'
  | 'extraction'
  | 'ocr'
  | 'normalization'
  | 'reconciliation'
  | 'completeness'
  | 'review'
  | 'completed'

export interface ExtractionPipelineVersions {
  pipeline_version: string
  preprocessing_version: string
  parser_version: string
  ocr_engine: string | null
  ocr_engine_version: string | null
}

export interface CreateExtractionJobRequest {
  document_id: string
  part_number: ExtractionPart
  source_language: ExtractionSourceLanguage
  total_pages: number
  requested_pages?: number[]
}

export interface ExtractionJob {
  id: string
  document_id: string
  part_number: ExtractionPart
  source_language: ExtractionSourceLanguage
  status: ExtractionJobStatus
  stage: ExtractionJobStage
  total_pages: number
  requested_pages: number[] | null
  versions: ExtractionPipelineVersions
  created_at: string
  updated_at: string
}

export interface ExtractionApiError {
  error: {
    code: string
    message: string
    retryable: boolean
    details: Record<string, unknown>
  }
}
