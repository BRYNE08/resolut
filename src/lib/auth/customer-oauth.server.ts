import { Apple, Google, generateCodeVerifier, generateState } from "arctic";
import { getSession, updateSession, clearSession } from "@tanstack/react-start/server";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { authSecret } from "./secret.server";
import { listProviders } from "./config";
import { customerReturnPath, isCustomerProvider, type CustomerProvider } from "./customer-auth";
import {
  CustomerAuthError,
  resolveCustomer,
  verifyCustomerIdentity,
} from "./customer-identity.server";
import { getPrisma } from "../data/prisma.server";
import { startSession } from "./session.server";
import { validOAuthState, type OAuthFlow as Flow } from "./oauth-state.server";

function siteOrigin(request: Request) {
  const configured = process.env["PUBLIC_SITE_URL"] || process.env["AUTH_URL"];
  if (!configured && process.env["NODE_ENV"] === "production")
    throw new CustomerAuthError("unavailable");
  const url = new URL(configured || request.url);
  if (
    url.protocol !== "https:" &&
    !(
      process.env["NODE_ENV"] !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  ) {
    throw new CustomerAuthError("unavailable");
  }
  return url.origin;
}

function flowConfig(provider: CustomerProvider, origin: string) {
  return {
    name: `resolut_oauth_${provider}`,
    sessionHeader: false as const,
    password: authSecret(),
    maxAge: 600,
    cookie: {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: provider === "apple" ? ("none" as const) : ("lax" as const),
      path: "/api/auth/customer",
    },
  };
}

async function database() {
  const db = await getPrisma();
  if (!db) throw new CustomerAuthError("unavailable");
  return db as PrismaClient;
}

function providerClient(provider: CustomerProvider, origin: string) {
  if (!listProviders(process.env).find((p) => p.id === provider)?.configured) {
    throw new CustomerAuthError("unavailable");
  }
  const callback = `${origin}/api/auth/customer/${provider}/callback`;
  if (provider === "google") {
    return new Google(process.env["AUTH_GOOGLE_ID"]!, process.env["AUTH_GOOGLE_SECRET"]!, callback);
  }
  if (!origin.startsWith("https://")) throw new CustomerAuthError("unavailable");
  const pem = process.env["AUTH_APPLE_PRIVATE_KEY"]!.replace(/\\n/g, "\n");
  const key = Buffer.from(pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s/g, ""), "base64");
  return new Apple(
    process.env["AUTH_APPLE_ID"]!,
    process.env["AUTH_APPLE_TEAM_ID"]!,
    process.env["AUTH_APPLE_KEY_ID"]!,
    key,
    callback,
  );
}

export async function beginCustomerOAuth(
  provider: CustomerProvider,
  request: Request,
  redirect?: string,
) {
  const origin = siteOrigin(request);
  const client = providerClient(provider, origin);
  // OAuth never uses the storefront's in-memory repository fallback.
  const db = await database();
  await db.$queryRaw`SELECT 1`;
  const flow = {
    provider,
    state: generateState(),
    nonce: generateState(),
    verifier: generateCodeVerifier(),
    redirect: customerReturnPath(redirect),
    createdAt: Date.now(),
  };
  const url =
    client instanceof Google
      ? client.createAuthorizationURL(flow.state, flow.verifier, ["openid", "email", "profile"])
      : client.createAuthorizationURL(flow.state, ["name", "email"]);
  url.searchParams.set("nonce", flow.nonce);
  if (provider === "apple") url.searchParams.set("response_mode", "form_post");
  if (provider === "google") url.searchParams.set("prompt", "select_account");
  const config = flowConfig(provider, origin);
  const stored = await getSession<Flow>(config);
  stored.id = crypto.randomUUID();
  stored.createdAt = Date.now();
  stored.data = {};
  await updateSession<Flow>(config, flow);
  return url.toString();
}

function responseRedirect(path: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: path,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function finishCustomerOAuth(request: Request, providerName: string) {
  if (!isCustomerProvider(providerName)) return new Response("Not found", { status: 404 });
  const provider = providerName;
  let returnPath = "/account";
  try {
    if (
      (provider === "apple" && request.method !== "POST") ||
      (provider === "google" && request.method !== "GET")
    ) {
      throw new CustomerAuthError("failed");
    }
    const origin = siteOrigin(request);
    const config = flowConfig(provider, origin);
    const flow = (await getSession<Flow>(config)).data;
    await clearSession(config);
    if (Number(request.headers.get("content-length") || 0) > 16_384)
      throw new CustomerAuthError("failed");
    let params: URLSearchParams;
    if (request.method === "POST") {
      if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))
        throw new CustomerAuthError("failed");
      const body = await request.text();
      if (body.length > 16_384) throw new CustomerAuthError("failed");
      params = new URLSearchParams(body);
    } else {
      params = new URL(request.url).searchParams;
    }
    if (flow.provider !== provider || !validOAuthState(flow, params.get("state"))) {
      throw new CustomerAuthError("expired");
    }
    returnPath = customerReturnPath(flow.redirect);
    if (params.has("error"))
      throw new CustomerAuthError(params.get("error") === "access_denied" ? "cancelled" : "failed");
    const code = params.get("code");
    if (!code || code.length > 4096) throw new CustomerAuthError("failed");
    const client = providerClient(provider, origin);
    const tokens =
      client instanceof Google
        ? await client.validateAuthorizationCode(code, flow.verifier!)
        : await client.validateAuthorizationCode(code);
    const clientId = process.env[provider === "google" ? "AUTH_GOOGLE_ID" : "AUTH_APPLE_ID"]!;
    const identity = await verifyCustomerIdentity(
      provider,
      tokens.idToken(),
      clientId,
      flow.nonce!,
    );
    if (provider === "apple" && params.get("user")) {
      try {
        const profile = z
          .object({
            name: z
              .object({
                firstName: z.string().max(100).optional(),
                lastName: z.string().max(100).optional(),
              })
              .optional(),
          })
          .parse(JSON.parse(params.get("user")!));
        identity.name = [profile.name?.firstName, profile.name?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim()
          .slice(0, 100);
      } catch {
        /* A missing/invalid optional display name must not block a verified login. */
      }
    }
    const user = await resolveCustomer(await database(), identity);
    await startSession(user);
    return responseRedirect(returnPath);
  } catch (error) {
    // Never log authorization codes, tokens, profile payloads or provider response bodies.
    const code = error instanceof CustomerAuthError ? error.code : "failed";
    console.warn(`[customer-auth] ${provider}: ${code}`);
    const search = new URLSearchParams({ error: code, redirect: returnPath });
    return responseRedirect(`/signin?${search}`);
  }
}
