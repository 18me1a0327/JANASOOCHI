'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import * as pdfjs from 'pdfjs-dist'
import { createWorker, PSM } from 'tesseract.js'
import { createClient, isSupabaseConfigured } from '../lib/supabase/client'
import { analyzeOcrLayout, columnizeOcrWords, countRecordLabels, detectLanguage, detectPart, extractGridCodes, gridCardizeOcrWords, languageFromFilename, OCR_REVIEW_THRESHOLD, ocrLanguages, parseRecords, pdfPayloadProblem, UNSUPPORTED } from './core'
import type { BoundingBox, FieldConfidence, RecordLanguage, Voter } from './types'
import type { Database } from '../supabase/database.types'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
export const configured = isSupabaseConfigured()
export const supabase = configured
  ? createClient()
  : createSupabaseClient<Database>('https://invalid.local', 'invalid', {
      auth: { persistSession: false },
    })

export type PageType = 'cover' | 'summary' | 'map' | 'voter' | 'unknown'
export type PageProcessState = {
  page: number
  status: 'processed' | 'requires_review'
  pageType: PageType
  printed: number | null
  confidence: number | null
  detected: number
  extracted: number
  reviewRecords: number
  droppedRecords: number
  issue: string | null
  errorType: string | null
  errorMessage: string | null
  detectedLanguage: RecordLanguage
  languageConfidence: number
  attempts: number
}
export type ProcessedPage = { state: PageProcessState; records: Omit<Voter, 'id' | 'pdf_id'>[] }

export async function sha256(file: File) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
function ensurePdf(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('PDF files only.')
}
async function validatedPdfBytes(file:File){ensurePdf(file);const bytes=new Uint8Array(await file.arrayBuffer()),problem=pdfPayloadProblem(bytes);if(problem==='html')throw new Error('Invalid PDF file. The upload contains an HTML error page instead of PDF data.');if(problem==='invalid')throw new Error('Unable to open PDF');return bytes}
export function extractExpectedVoterTotal(text: string) {
  const patterns = [
    /(?:Total\s+(?:Electors|Voters)|మొత్తం\s*ఓటర్లు|کل\s*ووٹر)\D{0,40}(\d{2,5})/i,
    /(?:Male\s*\+\s*Female\s*\+\s*Third\s*Gender)\D{0,30}(\d{2,5})/i,
  ]
  for (const pattern of patterns) {
    const value = Number(text.match(pattern)?.[1])
    if (value > 0) return value
  }
  return null
}
export async function inspectPdf(file: File) {
  const bytes=await validatedPdfBytes(file)
  let pdf
  try { pdf = await pdfjs.getDocument({ data: bytes }).promise }
  catch (error) { console.error('PDF validation failed', error); throw new Error('Unable to open PDF') }
  if (!pdf.numPages) throw new Error('Unable to open PDF')
  let part = detectPart('', file.name), sample = ''
  for (let pageNumber = 1; pageNumber <= Math.min(3, pdf.numPages); pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    sample += ` ${content.items.map((item) => 'str' in item ? item.str : '').join(' ')}`
    part = part || detectPart(sample, file.name)
  }
  if (!part) throw new Error(UNSUPPORTED)
  return { part, totalPages: pdf.numPages, language: languageFromFilename(file.name), sample, expectedVoterTotal: extractExpectedVoterTotal(sample) }
}
function printedPage(text: string) {
  const patterns = [
    /Total\s+Pages\s*\d+\s*-\s*Page\s*:?\s*(\d+)/i,
    /మొత్తం\s*పేజీలు\s*\d+\s*-\s*పేజీ\s*:?\s*(\d+)/i,
    /کل\s*صفحات\s*\d+\s*-\s*صفحہ\s*:?\s*(\d+)/i,
    /(?:^|\n)\s*(?:Page|పేజీ|صفحہ)\s*[:\-]?\s*(\d+)\s*$/im,
  ]
  for (const pattern of patterns) {
    const value = Number(text.match(pattern)?.[1])
    if (value > 0) return value
  }
  return null
}
function classifyPage(text: string, detected: number, pageNo: number): PageType {
  if (detected > 0) return 'voter'
  if (/(?:summary|electors?\s+summary|మొత్తం\s*ఓటర్లు|کل\s*ووٹر)/i.test(text)) return 'summary'
  if (/(?:map|నక్షా|نقشہ)/i.test(text)) return 'map'
  if (pageNo <= 3 && /(?:electoral\s+roll|draft\s+roll|భాగం|حصہ)/i.test(text)) return 'cover'
  return 'unknown'
}
function markProbableDuplicates(records: Omit<Voter, 'id' | 'pdf_id'>[]) {
  const epic = new Map<string, number[]>(), fingerprint = new Map<string, number[]>()
  records.forEach((record, index) => {
    if (record.epic_number) epic.set(record.epic_number, [...(epic.get(record.epic_number) ?? []), index])
    const key = [record.normalized_name, record.normalized_relation_name, record.normalized_house_number, record.age].join('|')
    if (record.normalized_name && record.normalized_house_number) fingerprint.set(key, [...(fingerprint.get(key) ?? []), index])
  })
  for (const indexes of [...epic.values(), ...fingerprint.values()]) if (indexes.length > 1) indexes.forEach((index) => {
    records[index].possible_duplicate = true
    records[index].verification_status = 'requires_review'
  })
}

export async function processPdf(
  file: File,
  onProgress: (page: number, total: number, records: number, reviews: number) => void,
  options: { part?: number; skipPages?: Set<number>; priorPrintedPages?: number[]; expectedVoterTotal?: number | null; onPage?: (page: ProcessedPage) => Promise<void> | void } = {},
) {
  const bytes=await validatedPdfBytes(file)
  let pdf
  try { pdf = await pdfjs.getDocument({ data: bytes }).promise }
  catch (error) { console.error('Unable to open PDF', error); throw new Error('Unable to open PDF') }
  if (!pdf.numPages) throw new Error('Unable to open PDF')
  let part: number | null = options.part ?? detectPart('', file.name)
  const output: Omit<Voter, 'id' | 'pdf_id'>[] = [], pageStates: PageProcessState[] = []
  const sourceLanguage = languageFromFilename(file.name)
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null, reviews = 0
  let lastPrinted = Math.max(0, ...(options.priorPrintedPages ?? [])) || null
  let expectedVoterTotal = options.expectedVoterTotal ?? null
  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      if (options.skipPages?.has(pageNo)) { onProgress(pageNo, pdf.numPages, output.length, reviews); continue }
      let processed: ProcessedPage | null = null, attempts = 0
      for (let attempt = 0; attempt < 3 && !processed; attempt++) {
        attempts = attempt + 1
        try {
          const page = await pdf.getPage(pageNo), content = await page.getTextContent()
          let sourceText = content.items.map((item) => 'str' in item ? item.str : '').join(' ').trim(), recordText = sourceText
          let confidence: number | null = null, boxes: BoundingBox[] | undefined, fieldConfidences: FieldConfidence[] | undefined, renderedCanvas: HTMLCanvasElement | null = null
          if (sourceText.length < 40) {
            if (!worker) {
              worker = await createWorker(ocrLanguages(file.name))
              await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', classify_enable_learning: '0' })
            }
            const viewport = page.getViewport({ scale: 2.8 }), canvas = document.createElement('canvas')
            canvas.width = viewport.width; canvas.height = viewport.height
            renderedCanvas = canvas
            await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
            const result = await worker.recognize(canvas, {}, { text: true, blocks: true })
            sourceText = result.data.text; confidence = result.data.confidence
            const words = result.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words.map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox }))))) ?? []
            const columnText = words.length ? columnizeOcrWords(words, canvas.width) : ''
            const grid = words.length ? gridCardizeOcrWords(words, canvas.width, canvas.height) : null
            if (grid && countRecordLabels(grid.text) >= Math.max(countRecordLabels(columnText), countRecordLabels(sourceText))) {
              recordText = grid.text; boxes = grid.boxes; fieldConfidences = grid.fieldConfidences
            } else if (countRecordLabels(columnText) >= countRecordLabels(sourceText)) {
              recordText = columnText
              const layout = analyzeOcrLayout(words, canvas.width, canvas.height)
              boxes = layout.boxes; fieldConfidences = layout.fieldConfidences
            } else recordText = sourceText
          }
          part = part || detectPart(sourceText, file.name)
          if (!part && pageNo === Math.min(3, pdf.numPages)) throw new Error(UNSUPPORTED)
          expectedVoterTotal = expectedVoterTotal ?? extractExpectedVoterTotal(sourceText)
          const language = detectLanguage(sourceText, sourceLanguage), detected = countRecordLabels(recordText)
          const printed = printedPage(sourceText), issues: string[] = []
          const pageRecords = part ? parseRecords(recordText, part, pageNo, confidence, { language: language.language, boundingBoxes: boxes, fieldConfidences, printedPage: printed }) : []
          if (worker && renderedCanvas && boxes?.length && pageRecords.some((record) => !record.epic_number)) {
            await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' })
            const codeViewport = page.getViewport({ scale: 2.8 }), codeCanvas = document.createElement('canvas')
            codeCanvas.width = codeViewport.width; codeCanvas.height = codeViewport.height
            await page.render({ canvasContext: codeCanvas.getContext('2d')!, viewport: codeViewport }).promise
            const codeResult = await worker.recognize(codeCanvas, {}, { blocks: true })
            const codeWords = codeResult.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words.map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox }))))) ?? []
            const codes = extractGridCodes(codeWords, codeCanvas.width, codeCanvas.height)
            const top = renderedCanvas.height * .032, rowHeight = (renderedCanvas.height * (.972 - .032)) / 10, columnWidth = renderedCanvas.width / 3
            for (const record of pageRecords) {
              const box = record.bounding_box;if (!box) continue
              const column = Math.min(2, Math.max(0, Math.round(box.x / columnWidth))), row = Math.min(9, Math.max(0, Math.round((box.y - top) / rowHeight)))
              const code = codes[row * 3 + column];if (!code) continue
              if (!record.serial_number && code.serial) record.serial_number = code.serial
              if (!record.epic_number && code.epic) record.epic_number = code.epic
              if (code.epic && record.epic_confidence === null) record.epic_confidence = code.confidence
            }
            await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '', preserve_interword_spaces: '1', classify_enable_learning: '0' })
          }
          if (detected > pageRecords.length) issues.push(`Detected ${detected} voter blocks but extracted ${pageRecords.length}`)
          if (detected > 0 && confidence !== null && confidence < OCR_REVIEW_THRESHOLD) issues.push(`OCR confidence below ${OCR_REVIEW_THRESHOLD}%`)
          if (detected > 0 && language.confidence < 60) issues.push('Language requires verification')
          if (printed !== null && lastPrinted !== null) {
            if (printed > lastPrinted + 1) issues.push(`Printed page ${lastPrinted + 1} appears unavailable in uploaded PDF`)
            else if (printed <= lastPrinted) issues.push('Page sequence requires verification')
          }
          if (printed !== null) lastPrinted = Math.max(lastPrinted ?? 0, printed)
          const reviewRecords = pageRecords.filter((record) => record.verification_status === 'requires_review').length
          processed = { state: { page: pageNo, status: issues.length ? 'requires_review' : 'processed', pageType: classifyPage(sourceText, detected, pageNo), printed, confidence, detected, extracted: pageRecords.length, reviewRecords, droppedRecords: Math.max(0, detected - pageRecords.length), issue: issues.join(' · ') || null, errorType: null, errorMessage: null, detectedLanguage: language.language, languageConfidence: language.confidence, attempts }, records: pageRecords }
        } catch (error) {
          console.error(`page ${pageNo} attempt ${attempt + 1}`, error)
          if (error instanceof Error && error.message === UNSUPPORTED) throw error
        }
      }
      if (!processed) processed = { state: { page: pageNo, status: 'requires_review', pageType: 'unknown', printed: null, confidence: null, detected: 0, extracted: 0, reviewRecords: 0, droppedRecords: 0, issue: 'Unable to process this page', errorType: 'page_processing_failed', errorMessage: 'Unable to process this page after 2 retries', detectedLanguage: sourceLanguage, languageConfidence: 0, attempts: 3 }, records: [] }
      if (processed.state.status === 'requires_review') reviews++
      markProbableDuplicates(processed.records)
      output.push(...processed.records); pageStates.push(processed.state)
      await options.onPage?.(processed)
      onProgress(pageNo, pdf.numPages, output.length, reviews)
    }
  } finally { await worker?.terminate() }
  if (!part) throw new Error(UNSUPPORTED)
  markProbableDuplicates(output)
  return { part, totalPages: pdf.numPages, records: output, pageStates, reviews, language: sourceLanguage, expectedVoterTotal }
}

export async function getSourceUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from('voter-pdfs').createSignedUrl(storagePath, 300)
  if (error) throw error
  return data.signedUrl
}
export async function openSource(storagePath: string, page: number) {
  const target = window.open('about:blank', '_blank')
  try {
    const signedUrl = await getSourceUrl(storagePath), source = `${signedUrl}#page=${page}`
    if (target) { target.opener = null; target.location.href = source }
    else window.open(source, '_blank', 'noopener,noreferrer')
  } catch (error) { target?.close(); throw error }
}
export { pdfjs }

