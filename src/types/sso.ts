// src/types/sso.ts
/**
 * SSO integration types
 * Used for the Google Workspace Admin SDK integration
 */

import type {
  IntegrationStatus,
  IntegrationType,
  SyncStatus,
} from "@prisma/client";

// ==================== Google Workspace Types ====================

/**
 * Google Workspace user
 * Based on the Admin SDK Directory API response
 */
export interface GoogleWorkspaceUser {
  id: string;
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
    fullName: string;
  };
  orgUnitPath?: string;
  isAdmin: boolean;
  isDelegatedAdmin?: boolean;
  suspended: boolean;
  archived?: boolean;
  creationTime: string;
  lastLoginTime?: string;
  thumbnailPhotoUrl?: string;
  customSchemas?: Record<string, unknown>;
  /** Manager relationship */
  relations?: Array<{
    type: string; // "manager", "assistant", "custom"
    value: string; // email address
    customType?: string;
  }>;
  /** Job title/department within the organization */
  organizations?: Array<{
    name?: string; // organization name
    title?: string; // job title
    department?: string; // department
    location?: string; // work location
    primary?: boolean;
  }>;
}

/**
 * Google Workspace organizational unit (OU)
 * Based on the Admin SDK Directory API response
 */
export interface GoogleOrgUnit {
  /** OU unique ID */
  orgUnitId: string;
  /** OU name (last segment) */
  name: string;
  /** OU description */
  description?: string;
  /** Full OU path (e.g. "/Engineering/Frontend") */
  orgUnitPath: string;
  /** Parent OU ID */
  parentOrgUnitId?: string;
  /** Parent OU path */
  parentOrgUnitPath?: string;
  /** Whether inheritance is blocked */
  blockInheritance?: boolean;
}

/**
 * Google Workspace OAuth token
 * Used to list the apps a user has authorised
 */
export interface GoogleOAuthToken {
  clientId: string;
  displayText: string;
  kind: string;
  scopes: string[];
  userKey: string;
  etag?: string;
  nativeApp?: boolean;
  anonymous?: boolean;
}

/**
 * Google Workspace service account credentials
 */
export interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  subject: string; // admin email (for delegation)
}

// ==================== Integration Types ====================

/**
 * Integration create input
 */
export interface CreateIntegrationInput {
  type: IntegrationType;
  credentials: IntegrationCredentials;
  metadata?: IntegrationMetadata;
}

/**
 * Integration credentials (JSON field)
 */
export interface IntegrationCredentials {
  // Google Workspace service account
  serviceAccountEmail?: string;
  privateKey?: string;
  adminEmail?: string; // admin to impersonate via delegation

  // OAuth tokens (user OAuth flow)
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Integration metadata (JSON field)
 */
export interface IntegrationMetadata {
  domain?: string;
  totalUsers?: number;
  lastUserCount?: number;
  syncFrequency?: "hourly" | "daily" | "weekly" | "monthly";
  enabledFeatures?: string[];
}

/**
 * Integration details (for reads)
 */
export interface IntegrationWithStats {
  id: string;
  type: IntegrationType;
  status: IntegrationStatus;
  metadata: IntegrationMetadata;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Statistics
  syncCount?: number;
  lastSyncResult?: SyncResult;
}

// ==================== Sync Types ====================

/**
 * Sync result
 */
export interface SyncResult {
  status: SyncStatus;
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped?: number;
  errors: SyncError[];
  duration?: number; // milliseconds
}

/**
 * Team sync result (OU -> Team)
 */
export interface TeamSyncResult extends SyncResult {
  /** Number of deleted teams (orphaned teams) */
  teamsDeleted?: number;
}

/**
 * Full Google Workspace sync result
 */
export interface FullSyncResult {
  /** Team sync result */
  teamResult: TeamSyncResult;
  /** User sync result */
  userResult: SyncResult;
  /** Total duration (milliseconds) */
  totalDuration: number;
}

/**
 * Sync error
 */
export interface SyncError {
  code: string;
  message: string;
  entity?: string;
  entityId?: string;
  timestamp?: Date;
}

/**
 * User sync options
 */
export interface UserSyncOptions {
  /** Whether to create new users */
  createNew?: boolean;
  /** Whether to update existing users */
  updateExisting?: boolean;
  /** Whether to auto-detect departed employees */
  detectTerminated?: boolean;
  /** OU path to sync (all if omitted) */
  orgUnitPath?: string;
  /** Batch size */
  batchSize?: number;
}

/**
 * App discovery options
 */
export interface AppDiscoveryOptions {
  /** Minimum user count (only discover apps used by at least this many) */
  minUsers?: number;
  /** Whether to match against the SaaS catalog */
  matchCatalog?: boolean;
  /** Whether to update existing apps */
  updateExisting?: boolean;
}

// ==================== Discovery Types ====================

/**
 * Discovered app
 */
export interface DiscoveredApp {
  clientId: string;
  name: string;
  scopes: string[];
  users: DiscoveredAppUser[];
  userCount: number;
  /** Matched SaaS catalog ID */
  catalogId?: string;
  /** Match confidence (0-1) */
  matchConfidence?: number;
}

/**
 * User of an app
 */
export interface DiscoveredAppUser {
  email: string;
  userId?: string;
  lastUsedAt?: Date;
}

/**
 * SaaS match result
 */
export interface SaaSMatchResult {
  catalogId: string;
  catalogName: string;
  confidence: number;
  matchedBy: "exact" | "pattern" | "fuzzy";
}

// ==================== API Response Types ====================

/**
 * Sync start response
 */
export interface StartSyncResponse {
  success: boolean;
  syncLogId?: string;
  message?: string;
  error?: string;
}

/**
 * Integration list response
 */
export interface IntegrationListResponse {
  integrations: IntegrationWithStats[];
  total: number;
}
