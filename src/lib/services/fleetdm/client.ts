// FleetDM API Client
// Reference: https://fleetdm.com/docs/rest-api

import type {
  FleetDMActivitiesResponse,
  FleetDMClientConfig,
  FleetDMError,
  FleetDMHost,
  FleetDMHostSoftwareResponse,
  FleetDMHostsResponse,
  FleetDMSoftware,
  FleetDMTeam,
} from "./types";

export class FleetDMClient {
  private baseUrl: string;
  private apiToken: string;
  private teamId?: number;

  constructor(config: FleetDMClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiToken = config.apiToken;
    this.teamId = config.teamId;
  }

  /**
   * API request helper
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1/fleet${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `FleetDM API Error: ${response.status}`;
      try {
        const error = (await response.json()) as FleetDMError;
        errorMessage = error.message || errorMessage;
      } catch {
        // Use the default error message if JSON parsing fails
      }
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Lists hosts
   */
  async getHosts(params?: {
    page?: number;
    perPage?: number;
    orderKey?: string;
    orderDirection?: "asc" | "desc";
    query?: string;
    status?: "new" | "online" | "offline" | "missing";
    teamId?: number;
  }): Promise<FleetDMHost[]> {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.perPage) searchParams.set("per_page", String(params.perPage));
    if (params?.orderKey) searchParams.set("order_key", params.orderKey);
    if (params?.orderDirection)
      searchParams.set("order_direction", params.orderDirection);
    if (params?.query) searchParams.set("query", params.query);
    if (params?.status) searchParams.set("status", params.status);

    const teamId = params?.teamId ?? this.teamId;
    if (teamId) searchParams.set("team_id", String(teamId));

    const queryString = searchParams.toString();
    const endpoint = `/hosts${queryString ? `?${queryString}` : ""}`;

    const response = await this.request<FleetDMHostsResponse>(endpoint);
    return response.hosts;
  }

  /**
   * Gets host details
   */
  async getHost(hostId: number): Promise<FleetDMHost> {
    const response = await this.request<{ host: FleetDMHost }>(
      `/hosts/${hostId}`
    );
    return response.host;
  }

  /**
   * Lists software installed on a host
   */
  async getHostSoftware(
    hostId: number,
    params?: {
      page?: number;
      perPage?: number;
      query?: string;
    }
  ): Promise<FleetDMSoftware[]> {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.perPage) searchParams.set("per_page", String(params.perPage));
    if (params?.query) searchParams.set("query", params.query);

    const queryString = searchParams.toString();
    const endpoint = `/hosts/${hostId}/software${queryString ? `?${queryString}` : ""}`;

    const response = await this.request<FleetDMHostSoftwareResponse>(endpoint);
    return response.software;
  }

  /**
   * Lists all software
   */
  async getSoftware(params?: {
    page?: number;
    perPage?: number;
    orderKey?: string;
    orderDirection?: "asc" | "desc";
    query?: string;
    teamId?: number;
    vulnerable?: boolean;
  }): Promise<FleetDMSoftware[]> {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.perPage) searchParams.set("per_page", String(params.perPage));
    if (params?.orderKey) searchParams.set("order_key", params.orderKey);
    if (params?.orderDirection)
      searchParams.set("order_direction", params.orderDirection);
    if (params?.query) searchParams.set("query", params.query);
    if (params?.vulnerable !== undefined)
      searchParams.set("vulnerable", String(params.vulnerable));

    const teamId = params?.teamId ?? this.teamId;
    if (teamId) searchParams.set("team_id", String(teamId));

    const queryString = searchParams.toString();
    const endpoint = `/software${queryString ? `?${queryString}` : ""}`;

    const response = await this.request<{ software: FleetDMSoftware[] }>(
      endpoint
    );
    return response.software;
  }

  /**
   * Lists activity logs
   */
  async getActivities(params?: {
    page?: number;
    perPage?: number;
  }): Promise<FleetDMActivitiesResponse> {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.perPage) searchParams.set("per_page", String(params.perPage));

    const queryString = searchParams.toString();
    const endpoint = `/activities${queryString ? `?${queryString}` : ""}`;

    return this.request<FleetDMActivitiesResponse>(endpoint);
  }

  /**
   * Lists teams
   */
  async getTeams(): Promise<FleetDMTeam[]> {
    const response = await this.request<{ teams: FleetDMTeam[] }>("/teams");
    return response.teams;
  }

  /**
   * Gets team details
   */
  async getTeam(teamId: number): Promise<FleetDMTeam> {
    const response = await this.request<{ team: FleetDMTeam }>(
      `/teams/${teamId}`
    );
    return response.team;
  }

  /**
   * Tests the connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request<unknown>("/me");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Counts hosts (for statistics)
   */
  async getHostsCount(params?: {
    status?: "new" | "online" | "offline" | "missing";
    teamId?: number;
  }): Promise<number> {
    const searchParams = new URLSearchParams();
    searchParams.set("per_page", "1"); // Fetch the minimum

    if (params?.status) searchParams.set("status", params.status);

    const teamId = params?.teamId ?? this.teamId;
    if (teamId) searchParams.set("team_id", String(teamId));

    const queryString = searchParams.toString();
    const endpoint = `/hosts/count?${queryString}`;

    const response = await this.request<{ count: number }>(endpoint);
    return response.count;
  }

  /**
   * Counts software (for statistics)
   */
  async getSoftwareCount(params?: {
    teamId?: number;
    vulnerable?: boolean;
  }): Promise<number> {
    const searchParams = new URLSearchParams();
    searchParams.set("per_page", "1");

    if (params?.vulnerable !== undefined)
      searchParams.set("vulnerable", String(params.vulnerable));

    const teamId = params?.teamId ?? this.teamId;
    if (teamId) searchParams.set("team_id", String(teamId));

    const queryString = searchParams.toString();
    const endpoint = `/software/count?${queryString}`;

    const response = await this.request<{ count: number }>(endpoint);
    return response.count;
  }
}

/**
 * Helper to create a FleetDM client instance
 */
export function createFleetDMClient(
  config: FleetDMClientConfig
): FleetDMClient {
  return new FleetDMClient(config);
}
