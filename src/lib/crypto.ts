import "server-only"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { serverEnv } from "@/lib/env"

function key() {
  const secret = serverEnv().encryptionSecret
  if (!secret || secret.length < 16) {
    throw new Error("ENCRYPTION_SECRET is not configured (min 16 chars). Add it to .env.local.")
  }
  return createHash("sha256").update(secret).digest()
}

/** AES-256-GCM. Output format: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".")
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(".")
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported ciphertext format")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
}

export function maskSecret(value: string) {
  if (value.length <= 8) return "••••"
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}
