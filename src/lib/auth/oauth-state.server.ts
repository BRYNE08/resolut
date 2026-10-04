import { timingSafeEqual } from "node:crypto";

export type OAuthFlow = {
  provider?: string;
  state?: string;
  nonce?: string;
  verifier?: string;
  redirect?: string;
  createdAt?: number;
};

export function validOAuthState(flow: OAuthFlow, state: string | null, now = Date.now()) {
  if (
    !state ||
    !flow.state ||
    !flow.nonce ||
    !flow.verifier ||
    !flow.createdAt ||
    now - flow.createdAt >= 600_000 ||
    flow.createdAt > now
  )
    return false;
  const actual = Buffer.from(state);
  const expected = Buffer.from(flow.state);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
