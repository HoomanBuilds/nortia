export type OracleProviderProfile = "free" | "managed";

type OracleAccessInput = {
  profile?: string;
  pythApiKey?: string | null;
  pythOrigin?: string;
  switchboardOrigin?: string;
};

function secureOrigin(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid HTTPS origin`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${label} must be a valid HTTPS origin`);
  }
  return value.replace(/\/+$/, "");
}

export function resolveOracleAccess(input: OracleAccessInput) {
  const profile = input.profile ?? "free";
  if (profile !== "free" && profile !== "managed") {
    throw new Error("ORACLE_PROVIDER_PROFILE must be free or managed");
  }
  if (profile === "free") {
    return {
      profile,
      pythOrigin: "https://hermes.pyth.network",
      pythApiKey: null,
      pythMinimumRequestIntervalMs: 1_100,
      switchboardOrigin: "https://crossbar.switchboard.xyz",
    } as const;
  }
  const pythApiKey = input.pythApiKey?.trim();
  if (!pythApiKey) throw new Error("PYTH_API_KEY is required for the managed oracle profile");
  return {
    profile,
    pythOrigin: secureOrigin(input.pythOrigin ?? "https://hermes.pyth.network", "PYTH_HERMES_ORIGIN"),
    pythApiKey,
    pythMinimumRequestIntervalMs: 0,
    switchboardOrigin: secureOrigin(
      input.switchboardOrigin ?? "https://crossbar.switchboard.xyz",
      "SWITCHBOARD_CROSSBAR_ORIGIN",
    ),
  } as const;
}
