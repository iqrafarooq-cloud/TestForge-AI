export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  downloadBlob(filename, new Blob([text], { type: `${type};charset=utf-8` }))
}

export async function downloadZip(filename: string, files: { path: string; content: string }[]) {
  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  for (const f of files) zip.file(f.path.replace(/^\/+/, ""), f.content)
  downloadBlob(filename, await zip.generateAsync({ type: "blob" }))
}

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return [cols.map(csvCell).join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n")
}
