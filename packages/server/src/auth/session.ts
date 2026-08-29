export * as ServerSession from "./session"

import { randomUUID } from "node:crypto"

export const COOKIE_NAME = "opencode_session"

// How long a signed-in session stays valid on the server. "Remember me"
// sessions outlive the browser; ordinary sessions expire sooner.
export const REMEMBER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

const MAX_ENTRIES = 1024

const entries = new Map<string, number>()

function prune(now: number) {
  for (const [token, expiresAt] of entries) {
    if (expiresAt <= now) entries.delete(token)
  }
}

export function issue(remember: boolean): string {
  const now = Date.now()
  prune(now)
  if (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value
    if (oldest !== undefined) entries.delete(oldest)
  }
  const token = randomUUID()
  const maxAgeMs = (remember ? REMEMBER_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS) * 1000
  entries.set(token, now + maxAgeMs)
  return token
}

export function isValid(token: string): boolean {
  const expiresAt = entries.get(token)
  if (expiresAt === undefined) return false
  if (expiresAt <= Date.now()) {
    entries.delete(token)
    return false
  }
  return true
}

export function revoke(token: string) {
  entries.delete(token)
}

export function tokenFromCookies(cookies: Readonly<Record<string, string>>): string | undefined {
  return Object.hasOwn(cookies, COOKIE_NAME) ? cookies[COOKIE_NAME] : undefined
}

export function reset() {
  entries.clear()
}
