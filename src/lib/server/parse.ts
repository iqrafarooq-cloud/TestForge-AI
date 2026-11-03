import "server-only"
import { UserError } from "@/lib/server/guard"

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_SOURCE_CHARS = 200_000

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size === 0) throw new UserError("The uploaded file is empty.")
  if (file.size > MAX_UPLOAD_BYTES) throw new UserError("File is larger than 10 MB.")
  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  let text = ""
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf")
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const result = await extractText(pdf, { mergePages: true })
    text = Array.isArray(result.text) ? result.text.join("\n") : result.text
  } else if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth")
    const result = await mammoth.extractRawText({ buffer })
    text = result.value
  } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    text = buffer.toString("utf8")
  } else {
    throw new UserError("Unsupported file type. Upload a PDF, DOCX, TXT, or MD file.")
  }

  text = normalize(text)
  if (text.length < 20) {
    throw new UserError("Could not extract readable text. Scanned PDFs need OCR before upload.")
  }
  return text
}

export function normalize(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_SOURCE_CHARS)
}
