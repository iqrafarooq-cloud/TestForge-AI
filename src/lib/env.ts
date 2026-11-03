/** Server-only values. Never import into client components. */
export function serverEnv() {
  return {
    groqApiKey: process.env.GROQ_API_KEY ?? "",
    groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    /** Used automatically when the primary model's daily quota is exhausted. Set empty to disable. */
    groqFallbackModel: process.env.GROQ_FALLBACK_MODEL ?? "openai/gpt-oss-20b",
    encryptionSecret: process.env.ENCRYPTION_SECRET ?? "",
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    mailFrom: process.env.MAIL_FROM || "TestForge AI <onboarding@resend.dev>",
  }
}
