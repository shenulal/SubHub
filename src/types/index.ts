/**
 * SubHub shared types
 */

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter types
export interface FilterParams {
  search?: string;
  status?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Server Action state types
export interface ActionState<T = null> {
  success: boolean;
  message?: string;
  error?: string; // single error message
  data?: T;
  errors?: Record<string, string[]>; // per-field error messages
}

// User session types
export interface UserSession {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role: "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER";
  organizationId: string;
}
