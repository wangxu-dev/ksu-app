import type { PersonalInfoData } from "@/lib/auth";
import { KSU_CACHE_POLICY } from "@/lib/cache/policy";

export type CachedPersonalInfo = {
  fetchedAt: number;
  data: PersonalInfoData;
};

const PERSONAL_INFO_KEY = KSU_CACHE_POLICY.personalInfo.key;

export function getCachedPersonalInfo(): CachedPersonalInfo | null {
  const raw = localStorage.getItem(PERSONAL_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedPersonalInfo;
  } catch {
    return null;
  }
}

export function setCachedPersonalInfo(data: PersonalInfoData) {
  const payload: CachedPersonalInfo = { fetchedAt: Date.now(), data };
  localStorage.setItem(PERSONAL_INFO_KEY, JSON.stringify(payload));
}

export function clearCachedPersonalInfo() {
  localStorage.removeItem(PERSONAL_INFO_KEY);
}
