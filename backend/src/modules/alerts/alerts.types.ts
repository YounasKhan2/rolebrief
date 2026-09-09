import { AlertCadence, AlertChannel, AlertEligibilityPolicy, AlertStatus, WorkMode } from '@prisma/client';

export type AlertAlignmentTier = 'STRONG_ALIGNMENT' | 'PARTIAL_ALIGNMENT' | 'ANY';

export interface AlertCriteriaV1 {
  version: 1;
  targetTitles: string[];
  workModes: WorkMode[];
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
