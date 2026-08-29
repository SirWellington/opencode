import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { OpenCode, type OpenCodeClient } from "@opencode-ai/client/promise"
import type { ServerConnection } from "@/context/server"
import { decode64 } from "@/utils/base64"

export function authTokenFromCredentials(input: { username?: string; password: string }) {
  return btoa(`${input.username ?? "opencode"}:${input.password}`)
}

export function authFromToken(token: string | null) {
  const decoded = decode64(token ?? undefined)
  if (!decoded) return
  const separator = decoded.indexOf(":")
  if (separator === -1) return
  return {
    username: decoded.slice(0, separator) || "opencode",
    password: decoded.slice(separator + 1),
  }
}

function isSameOrigin(url: string) {
  if (typeof window === "undefined") return false
  try {
    return new URL(url).origin === window.location.origin
  } catch {
    return false
  }
}

// When the server rejects an API call because the browser session is missing or
// expired, send the user to the server's sign-in page instead of surfacing an
// opaque 401. Only applies when the app is served from the same origin as the
// server it is talking to.
export function withSignInRedirect(
  server: ServerConnection.HttpBase,
  fetcher: typeof globalThis.fetch,
): typeof globalThis.fetch {
  const wrapped = (
    input: Parameters<typeof globalThis.fetch>[0],
    init?: Parameters<typeof globalThis.fetch>[1],
  ) =>
    fetcher(input, init).then((response) => {
      if (response.status !== 401 || !isSameOrigin(server.url)) return response
      const next = window.location.pathname
      window.location.assign(next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`)
      return response
    })
  // Fetch implementations may carry statics (e.g. Bun's `preconnect`); forward them.
  return Object.assign(wrapped, fetcher)
}

export function createSdkForServer({
  server,
  ...config
}: Omit<NonNullable<Parameters<typeof createOpencodeClient>[0]>, "baseUrl"> & {
  server: ServerConnection.HttpBase
}) {
  const auth = (() => {
    if (!server.password) return
    return {
      Authorization: `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`,
    }
  })()

  return createOpencodeClient({
    ...config,
    fetch: withSignInRedirect(server, config.fetch ?? globalThis.fetch),
    headers: {
      ...(config.headers instanceof Headers ? Object.fromEntries(config.headers.entries()) : config.headers),
      ...auth,
    },
    baseUrl: server.url,
  })
}

export function createApiForServer(input: {
  server: ServerConnection.HttpBase
  fetch?: typeof globalThis.fetch
}): OpenCodeClient {
  return OpenCode.make({
    baseUrl: input.server.url,
    fetch: withSignInRedirect(input.server, input.fetch ?? globalThis.fetch),
    headers: input.server.password
      ? {
          Authorization: `Basic ${authTokenFromCredentials({
            username: input.server.username,
            password: input.server.password,
          })}`,
        }
      : undefined,
  })
}

export type ServerApi = OpenCodeClient
