/**
 * The official $GEMHOG contract. TBA until launch: the launch kit
 * (docs/LAUNCH.md, milestone 0.6.0) says exactly where to paste the CA once
 * the token is live. Everything that shows the contract reads this file.
 */
export const PROJECT_TOKEN = {
  ticker: "$GEMHOG",
  /** null until launch; a 0x address afterwards. */
  address: null as string | null,
} as const;

export const projectTokenLabel = (): string => PROJECT_TOKEN.address ?? "TBA";
