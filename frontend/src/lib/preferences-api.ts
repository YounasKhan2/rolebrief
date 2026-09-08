import { authRequest } from "./auth-api";
import { MotionPreference, ContrastPreference } from "./accessibility";

export interface UserPreferences {
  productUpdates: boolean;
  marketingEmails: boolean;
  motionPreference: MotionPreference;
  contrastPreference: ContrastPreference;
  timezone: string;
  revision: number;
  isPersisted: boolean;
  updatedAt: string | null;
}

export function getPreferences() {
  return authRequest<{ preferences: UserPreferences }>("/me/preferences");
}

export interface UpdatePreferencesPayload {
  productUpdates?: boolean;
  marketingEmails?: boolean;
  motionPreference?: MotionPreference;
  contrastPreference?: ContrastPreference;
  timezone?: string;
  expectedRevision: number;
}

export function updatePreferences(updates: UpdatePreferencesPayload) {
  return authRequest<{ preferences: UserPreferences }>("/me/preferences", {
    method: "PATCH",
    body: updates,
    csrf: true
  });
}
