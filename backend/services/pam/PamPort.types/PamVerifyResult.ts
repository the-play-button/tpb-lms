
export interface PamVerifyResult {
  allowed: boolean;
  owner?: { email: string };
}
