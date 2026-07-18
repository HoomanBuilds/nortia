import assert from "node:assert/strict";
import test from "node:test";
import { resolveOracleAccess } from "./oracle-access.js";

test("free provider profile uses public endpoints without forwarding credentials", () => {
  const access = resolveOracleAccess({
    profile: undefined,
    pythApiKey: "must-not-leak",
    pythOrigin: "https://paid.example/pyth",
    switchboardOrigin: "https://paid.example/crossbar",
    storkOrigin: "https://paid.example/stork",
    storkApiToken: "must-not-leak",
  });
  assert.deepEqual(access, {
    profile: "free",
    pythOrigin: "https://hermes.pyth.network",
    pythApiKey: null,
    pythMinimumRequestIntervalMs: 1_100,
    switchboardOrigin: "https://crossbar.switchboard.xyz",
    storkOrigin: "https://rest.dev.stork-oracle.network",
    storkApiToken: null,
  });
});

test("managed provider profile retains configurable authenticated adapters", () => {
  const access = resolveOracleAccess({
    profile: "managed",
    pythApiKey: "secret-key",
    pythOrigin: "https://provider.example/hermes/",
    switchboardOrigin: "https://provider.example/crossbar/",
    storkOrigin: "https://provider.example/stork/",
    storkApiToken: "stork-key",
  });
  assert.deepEqual(access, {
    profile: "managed",
    pythOrigin: "https://provider.example/hermes",
    pythApiKey: "secret-key",
    pythMinimumRequestIntervalMs: 0,
    switchboardOrigin: "https://provider.example/crossbar",
    storkOrigin: "https://provider.example/stork",
    storkApiToken: "stork-key",
  });
});

test("managed profile and provider origins fail closed when misconfigured", () => {
  assert.throws(() => resolveOracleAccess({ profile: "managed", pythApiKey: null }), /PYTH_API_KEY/);
  assert.throws(() => resolveOracleAccess({ profile: "paid", pythApiKey: "key" }), /ORACLE_PROVIDER_PROFILE/);
  assert.throws(() => resolveOracleAccess({
    profile: "managed",
    pythApiKey: "key",
    pythOrigin: "http://provider.example",
  }), /HTTPS/);
});
