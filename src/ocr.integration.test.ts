import { afterAll, describe, expect, it } from 'vitest'
import { createWorker, PSM, type Worker } from 'tesseract.js'
import { countRecordLabels, extractGridCodes, gridCardizeOcrWords, parseRecords } from './core'

const auditEnv = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const imagePath = auditEnv.OCR_AUDIT_IMAGE
const auditPage = Number(auditEnv.OCR_AUDIT_PAGE) || 3
const auditEpics = new Set((auditEnv.OCR_AUDIT_EPICS ?? '').split(',').map((value) => value.trim()).filter(Boolean))
let worker: Worker | null = null

describe.runIf(Boolean(imagePath))('real Telugu electoral-roll OCR', () => {
  afterAll(async () => { await worker?.terminate() })

  it('detects and segments at least 95% of the 30 visible voter cards', async () => {
    worker = await createWorker('eng+tel')
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', classify_enable_learning: '0' })
    const result = await worker.recognize(imagePath!, {}, { text: true, blocks: true })
    const words = result.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words.map((word) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: word.bbox,
    }))))) ?? []
    const grid = gridCardizeOcrWords(words, Number(auditEnv.OCR_AUDIT_WIDTH) || 3305, Number(auditEnv.OCR_AUDIT_HEIGHT) || 4677)
    const detected = countRecordLabels(grid.text)
    const records = parseRecords(grid.text, 230, auditPage, result.data.confidence, { language: 'te', boundingBoxes: grid.boxes, fieldConfidences: grid.fieldConfidences, printedPage: auditPage })
    if (records.some((record) => !record.serial_number || !record.epic_number)) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' })
      const codeResult = await worker.recognize(imagePath!, {}, { blocks: true })
      const codeWords = codeResult.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words.map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox }))))) ?? []
      const codes = extractGridCodes(codeWords, 3305, 4677)
      for (const record of records) {
        const box = record.bounding_box
        if (!box) continue
        const column = Math.min(2, Math.max(0, Math.round(box.x / (3305 / 3)))), row = Math.min(9, Math.max(0, Math.round((box.y - 4677 * .032) / (4677 * (.972 - .032) / 10))))
        const code = codes[row * 3 + column]
        if (!record.serial_number && code?.serial) record.serial_number = code.serial
        if (!record.epic_number && code?.epic) record.epic_number = code.epic
      }
    }
    const distinctSerials = new Set(records.map((record) => record.serial_number).filter(Boolean)).size
    const completeCoreFields = records.filter((record) => record.original_name && record.original_house_number && record.age && record.epic_number).length
    console.info(JSON.stringify({ confidence: result.data.confidence, detected, extracted: records.length, distinctSerials, completeCoreFields, boxes: grid.boxes.length }))
    console.info(grid.text.slice(0, 1600))
    console.info(JSON.stringify(records.slice(0, 2)))
    if (auditEpics.size) console.info(`OCR_AUDIT_MATCHES=${JSON.stringify(records.filter((record) => record.epic_number && auditEpics.has(record.epic_number)))}`)
    expect(detected).toBeGreaterThanOrEqual(29)
    expect(records.length).toBeGreaterThanOrEqual(29)
    expect(distinctSerials).toBeGreaterThanOrEqual(29)
    expect(completeCoreFields).toBeGreaterThanOrEqual(29)
    expect(grid.boxes).toHaveLength(detected)
  }, 180_000)
})
