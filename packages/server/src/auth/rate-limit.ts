export * as ServerRateLimit from "./rate-limit"

import { Context, Effect, Layer } from "effect"

// Failed credential attempts are counted across every login channel (sign-in
// form, basic auth, auth_token query) so a brute-force cannot be split across
// them. After MAX_FAILURES the server stops checking credentials for
// LOCKOUT_MS; existing sessions keep working.
const MAX_FAILURES = 10
const LOCKOUT_MS = 60_000

export interface RateLimit {
  readonly recordFailure: (now: number) => void
  readonly retryAfterSeconds: (now: number) => number
  readonly reset: () => void
}

export class Service extends Context.Service<Service, RateLimit>()("@opencode/ServerAuthRateLimit") {}

function makeRateLimit(): RateLimit {
  let failures = 0
  let lockedUntil = 0
  return {
    recordFailure(now) {
      failures += 1
      if (failures >= MAX_FAILURES) lockedUntil = now + LOCKOUT_MS
    },
    retryAfterSeconds(now) {
      if (now >= lockedUntil) return 0
      return Math.max(1, Math.ceil((lockedUntil - now) / 1000))
    },
    reset() {
      failures = 0
      lockedUntil = 0
    },
  }
}

export const layer = Layer.effect(Service, Effect.sync(() => Service.of(makeRateLimit())))
