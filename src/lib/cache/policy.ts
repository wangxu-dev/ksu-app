export const KSU_CACHE_POLICY = {
  personalInfo: {
    key: "ksu:personal:info:v1",
    ttlMs: 6 * 60 * 60 * 1000,
  },
  grades: {
    key: "ksu:grades:project1:v1",
    ttlMs: 7 * 24 * 60 * 60 * 1000,
  },
  calendar: {
    keyPrefix: "ksu:calendar:v1",
    ttlMs: 30 * 24 * 60 * 60 * 1000,
  },
} as const;

export type CachePolicyKey = keyof typeof KSU_CACHE_POLICY;
