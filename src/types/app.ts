// src/types/app.ts
// App management types

import type { AppSource, AppStatus } from "@prisma/client";

/**
 * App list item
 */
export interface AppListItem {
  id: string;
  name: string;
  status: AppStatus;
  source: AppSource;
  category: string | null;
  customLogoUrl: string | null;
  catalogLogoUrl?: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  subscriptionCount: number;
  userAccessCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Multiple team assignment
  teams: { id: string; name: string }[];
}

/**
 * App details
 */
export interface AppDetail extends AppListItem {
  catalogId: string | null;
  customWebsite: string | null;
  notes: string | null;
  tags: string[];
  riskScore: number | null;
  discoveredAt: Date | null;
}

/**
 * App create input
 */
export interface CreateAppInput {
  name: string;
  category?: string;
  customLogoUrl?: string;
  customWebsite?: string;
  notes?: string;
  tags?: string[];
  ownerId?: string;
  catalogId?: string;
  teamIds?: string[];
}

/**
 * App update input
 */
export interface UpdateAppInput {
  name?: string;
  status?: AppStatus;
  category?: string;
  customLogoUrl?: string;
  customWebsite?: string;
  notes?: string;
  tags?: string[];
  ownerId?: string;
  teamIds?: string[];
}

/**
 * App filter options
 */
export interface AppFilterOptions {
  search?: string;
  status?: AppStatus;
  source?: AppSource;
  category?: string;
  ownerId?: string;
  teamIds?: string[];
}

/**
 * App sort options
 */
export interface AppSortOptions {
  sortBy?: "name" | "createdAt" | "updatedAt" | "category";
  sortOrder?: "asc" | "desc";
}
