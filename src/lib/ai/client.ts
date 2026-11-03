import "server-only"
import { z } from "zod"
import { serverEnv } from "@/lib/env"

/** User-facing AI failure (bad response, provider error, missing key). */
export class AiError extends Error {}

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
const MAX_RATE_LIMIT_RETRIES = 4
const MIN_OUTPUT_TOKENS = 1200

/**
 * Tokens-per-minute limit of the account. Groq counts prompt + reserved completion tokens
 * against it, so output reservations are sized to fit. Learned from response headers,
 * so upgrading the Groq plan raises the budget automatically.
 */
let tpmLimit = 8000
const estimateTokens = (text: string) => Math.ceil(text.length / 3.2)

type JsonSchema = Record<string, unknown>

// Keywords outside the strict structured-output subset. Zod still enforces them after parsing.
const UNSUPPORTED = new Set(["$schema", "minItems", "maxItems", "minimum", "maximum", "minLength", "maxLength", "pattern", "format"])

/** Converts a Zod JSON Schema into the strict subset: no unsupported keywords, closed objects, all keys required. */
function toStrictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrictSchema)
  if (!node || typeof node !== "object") return node
  const out: JsonSchema = {}
  for (const [k, v] of Object.entries(node as JsonSchema)) {
    if (UNSUPPORTED.has(k)) continue
    out[k] = k === "properties" ? Object.fromEntries(Object.entries(v as JsonSchema).map(([pk, pv]) => [pk, toStrictSchema(pv)])) : toStrictSchema(v)
  }
  if (out.type === "object" && out.properties) {
    out.additionalProperties = false
    out.required = Object.keys(out.properties as JsonSchema)
  }
  return out
}

function stripFences(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fenced ? fenced[1] : trimmed
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[]
  error?: { message?: string; code?: string; failed_generation?: string }
}

async function callGroq(body: Record<string, unknown>): Promise<ChatResponse> {
  const { groqApiKey } = serverEnv()
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
        cache: "no-store",
      })
    } catch (err) {
      throw new AiError(`Could not reach the AI service: ${(err as Error).message}`)
    }

    const limitHeader = Number(res.headers.get("x-ratelimit-limit-tokens"))
    if (Number.isFinite(limitHeader) && limitHeader > 0) tpmLimit = limitHeader

    const data = (await res.json().catch(() => ({}))) as ChatResponse
    if (res.ok) return data
    const msg = data.error?.message ?? res.statusText

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 5 * (attempt + 1)
      // Daily quotas (or any long wait) are not worth blocking on: let the caller switch models.
      if (/per day|TPD|RPD/i.test(msg) || retryAfter > 60) {
        exhaustedUntil.set(String(body.model), Date.now() + retryAfter * 1000)
        throw new QuotaExhausted(retryAfter)
      }
      if (attempt < MAX_RATE_LIMIT_RETRIES) {
        // Per-minute windows reset quickly; wait as instructed, then retry.
        await sleep((retryAfter + 0.5) * 1000)
        continue
      }
      throw new AiError("AI rate limit reached. Please retry in a minute.")
    }
    if (res.status === 401) throw new AiError("The AI API key is invalid. Check GROQ_API_KEY in .env.local.")
    if (res.status === 413) {
      const m = msg.match(/Limit (\d+), Requested (\d+)/)
      throw new RequestTooLarge(m ? Number(m[2]) - Number(m[1]) : 500)
    }
    if (res.status === 400 && (data.error?.code === "json_validate_failed" || /Failed to generate JSON/i.test(msg))) {
      throw new GenerationFailed(data.error?.failed_generation ?? "")
    }
    if (res.status === 400 && /json_schema|response_format|schema/i.test(msg)) {
      throw new SchemaUnsupported(msg)
    }
    throw new AiError(`AI request failed (${res.status}): ${msg.slice(0, 200)}`)
  }
}

class SchemaUnsupported extends Error {}
class QuotaExhausted extends Error {
  constructor(public retryAfterSeconds: number) {
    super("quota exhausted")
  }
}
/** Models whose daily quota is used up, with the time they become usable again. */
const exhaustedUntil = new Map<string, number>()
/** The provider rejected the model's output as invalid JSON; carries the raw output for salvage. */
class GenerationFailed extends Error {
  constructor(public output: string) {
    super("json_validate_failed")
  }
}

/**
 * The model sometimes wraps or double-encodes otherwise correct JSON (e.g. as a string inside a
 * tool-call envelope). Walk the raw output, decoding nested JSON strings, and return the first
 * value that passes the Zod schema. Nothing unvalidated is ever returned.
 */
function salvage<T extends z.ZodType>(raw: string, schema: T): z.infer<T> | undefined {
  const seen = new Set<unknown>()
  const visit = (value: unknown, depth: number): z.infer<T> | undefined => {
    if (depth > 6 || value === null || value === undefined || seen.has(value)) return undefined
    if (typeof value === "string") {
      const t = value.trim()
      if (!t.startsWith("{") && !t.startsWith("[") && !t.startsWith('"')) return undefined
      try {
        return visit(JSON.parse(stripFences(t)), depth + 1)
      } catch {
        return undefined
      }
    }
    if (typeof value !== "object") return undefined
    seen.add(value)
    const direct = schema.safeParse(value)
    if (direct.success) return direct.data
    for (const v of Array.isArray(value) ? value : Object.values(value)) {
      const found = visit(v, depth + 1)
      if (found !== undefined) return found
    }
    return undefined
  }
  const fromWhole = visit(raw, 0)
  if (fromWhole !== undefined) return fromWhole
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  return start >= 0 && end > start ? visit(raw.slice(start, end + 1), 0) : undefined
}
class RequestTooLarge extends Error {
  constructor(public overBy: number) {
    super("request too large")
  }
}

function quotaError(until: number) {
  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000))
  return new AiError(
    `The daily AI quota of the Groq plan is used up. It frees up again in about ${minutes} minute${minutes === 1 ? "" : "s"}; upgrade the Groq plan for higher limits.`,
  )
}

export interface GenerateJsonOptions<T extends z.ZodType> {
  schema: T
  system: string
  prompt: string
  temperature?: number
  /** Upper bound for the response; large code exports need more room. */
  maxTokens?: number
}

/**
 * Calls Groq with strict JSON-schema structured output derived from the Zod schema,
 * validates the result with Zod, and re-prompts once with the validation error on failure.
 * Falls back to plain JSON mode (schema embedded in the prompt) if the model rejects json_schema.
 */
export async function generateJson<T extends z.ZodType>(opts: GenerateJsonOptions<T>): Promise<z.infer<T>> {
  const { groqApiKey, groqModel, groqFallbackModel } = serverEnv()
  const models = [...new Set([groqModel, groqFallbackModel].filter(Boolean))]
  let modelIndex = models.findIndex((m) => (exhaustedUntil.get(m) ?? 0) <= Date.now())
  if (modelIndex === -1) throw quotaError(Math.min(...models.map((m) => exhaustedUntil.get(m) ?? 0)))
  if (!groqApiKey) throw new AiError("AI is not configured. Set GROQ_API_KEY in .env.local and restart the server.")

  const jsonSchema = toStrictSchema(z.toJSONSchema(opts.schema, { target: "draft-7" })) as JsonSchema
  const promptTokens = estimateTokens(opts.system + opts.prompt + JSON.stringify(jsonSchema)) + 200
  let maxTokens = Math.min(opts.maxTokens ?? 8192, tpmLimit - promptTokens)
  const tooLarge = () =>
    new AiError(
      `This input is too large for the AI plan's limit of ${tpmLimit.toLocaleString()} tokens per minute. Use a shorter document or fewer items, or upgrade the Groq plan.`,
    )
  if (maxTokens < MIN_OUTPUT_TOKENS) throw tooLarge()
  let useSchemaMode = true
  let feedback = ""
  let lastError = "Unknown AI error"

  for (let attempt = 0; attempt < 4; attempt++) {
    const system = useSchemaMode
      ? opts.system
      : `${opts.system}\n\nReturn a JSON object that conforms exactly to this JSON Schema:\n${JSON.stringify(jsonSchema)}`
    let data: ChatResponse
    try {
      data = await callGroq({
        model: models[modelIndex],
        temperature: opts.temperature ?? 0.3,
        max_completion_tokens: maxTokens,
        reasoning_effort: "low",
        include_reasoning: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: opts.prompt + feedback },
        ],
        response_format: useSchemaMode
          ? { type: "json_schema", json_schema: { name: "result", strict: true, schema: jsonSchema } }
          : { type: "json_object" },
      })
    } catch (err) {
      if (err instanceof QuotaExhausted) {
        const next = models.findIndex((m, i) => i > modelIndex && (exhaustedUntil.get(m) ?? 0) <= Date.now())
        if (next === -1) throw quotaError(Date.now() + err.retryAfterSeconds * 1000)
        console.warn("[ai] %s daily quota reached; falling back to %s", models[modelIndex], models[next])
        modelIndex = next
        attempt--
        continue
      }
      if (err instanceof SchemaUnsupported && useSchemaMode) {
        useSchemaMode = false
        continue
      }
      if (err instanceof GenerationFailed) {
        const recovered = salvage(err.output, opts.schema)
        if (recovered !== undefined) return recovered
        console.warn("[ai] unrecoverable json_validate_failed (%d chars)", err.output.length)
        lastError = "The AI could not produce valid output. Please try again."
        // Second failure in strict mode: fall back to JSON mode, still validated by Zod below.
        if (attempt >= 1) useSchemaMode = false
        continue
      }
      if (err instanceof RequestTooLarge) {
        maxTokens -= err.overBy + 300
        if (maxTokens < MIN_OUTPUT_TOKENS) throw tooLarge()
        continue
      }
      throw err
    }

    const choice = data.choices?.[0]
    const text = choice?.message?.content
    if (!text) {
      lastError = choice?.finish_reason === "length" ? "The AI response was too long. Try a smaller selection." : "The AI returned an empty response."
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(stripFences(text))
    } catch {
      lastError = "The AI returned malformed JSON."
      feedback = "\n\nYour previous reply was not valid JSON. Reply with JSON only."
      continue
    }
    const result = opts.schema.safeParse(parsed)
    if (result.success) return result.data
    lastError = `AI response failed validation: ${result.error.issues[0]?.message ?? "invalid shape"}`
    feedback = `\n\nYour previous reply failed validation:\n${z.prettifyError(result.error).slice(0, 800)}\nReturn corrected JSON only.`
  }
  throw new AiError(lastError)
}
