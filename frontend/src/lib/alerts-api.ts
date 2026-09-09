import { authRequest } from "./auth-api";

export type AlertChannel = "IN_APP" | "EMAIL" | "BOTH";
export type AlertCadence = "INSTANT" | "DAILY" | "WEEKLY";
export type AlertStatus = "ACTIVE" | "PAUSED" | "DISABLED";
export type AlertEligibilityPolicy = "ELIGIBLE_ONLY" | "ELIGIBLE_AND_UNKNOWN" | "ANY";
export type AlertAlignmentTier = "STRONG_ALIGNMENT" | "PARTIAL_ALIGNMENT" | "ANY";

export interface AlertCriteriaV1 {
  version: 1;
  targetTitles: string[];
  workModes: string[];
  employmentTypes: string[];
  countryCodes: string[];
  providers: string[];
  salaryDisclosed?: boolean;
  eligibilityPolicy: AlertEligibilityPolicy;
  alignment: AlertAlignmentTier;
}

export interface SerializedAlert {
  id: string;
  name: string;
  status: AlertStatus;
  channel: AlertChannel;
  cadence: AlertCadence;
  deliveryHourUtc: number;
  deliveryDayOfWeek: number | null;
  criteria: AlertCriteriaV1;
  revision: number;
  matchCount?: number;
  lastEvaluatedAt: string | null;
  lastDeliveredAt: string | null;
  nextDeliveryDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertInput {
  name: string;
  channel?: AlertChannel;
  cadence?: AlertCadence;
  deliveryHourUtc?: number;
  deliveryDayOfWeek?: number;
  criteria: {
    targetTitles: string[];
    workModes: string[];
    employmentTypes?: string[];
    countryCodes?: string[];
    providers?: string[];
    salaryDisclosed?: boolean;
    eligibilityPolicy?: AlertEligibilityPolicy;
    alignment?: AlertAlignmentTier;
  };
}

export interface UpdateAlertInput {
  expectedRevision: number;
  name?: string;
  channel?: AlertChannel;
  cadence?: AlertCadence;
  deliveryHourUtc?: number;
  deliveryDayOfWeek?: number;
  criteria?: {
    targetTitles?: string[];
    workModes?: string[];
    employmentTypes?: string[];
    countryCodes?: string[];
    providers?: string[];
    salaryDisclosed?: boolean;
    eligibilityPolicy?: AlertEligibilityPolicy;
    alignment?: AlertAlignmentTier;
  };
}

export async function getAlerts(): Promise<SerializedAlert[]> {
  return authRequest<SerializedAlert[]>("/alerts");
}

export async function getAlert(id: string): Promise<SerializedAlert> {
  return authRequest<SerializedAlert>(`/alerts/${encodeURIComponent(id)}`);
}

export async function createAlert(input: CreateAlertInput): Promise<SerializedAlert> {
  return authRequest<SerializedAlert>("/alerts", {
    method: "POST",
    body: input,
    csrf: true
  });
}

export async function updateAlert(id: string, input: UpdateAlertInput): Promise<SerializedAlert> {
  return authRequest<SerializedAlert>(`/alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
    csrf: true
  });
}

export async function pauseAlert(id: string, expectedRevision: number): Promise<SerializedAlert> {
  return authRequest<SerializedAlert>(`/alerts/${encodeURIComponent(id)}/pause`, {
    method: "PATCH",
    body: { expectedRevision },
    csrf: true
  });
}

export async function resumeAlert(id: string, expectedRevision: number): Promise<SerializedAlert> {
  return authRequest<SerializedAlert>(`/alerts/${encodeURIComponent(id)}/resume`, {
    method: "PATCH",
    body: { expectedRevision },
    csrf: true
  });
}

export async function deleteAlert(id: string): Promise<{ deleted: boolean }> {
  return authRequest<{ deleted: boolean }>(`/alerts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    csrf: true
  });
}
