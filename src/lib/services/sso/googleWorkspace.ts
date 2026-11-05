// src/lib/services/sso/googleWorkspace.ts
/**
 * Google Workspace Admin SDK service
 * Provides Google Workspace integration features such as listing users and OAuth tokens
 */

import type {
  GoogleOAuthToken,
  GoogleOrgUnit,
  GoogleWorkspaceUser,
  ServiceAccountCredentials,
} from "@/types/sso";
import { admin_directory_v1, google } from "googleapis";

export class GoogleWorkspaceService {
  private adminClient: admin_directory_v1.Admin;

  constructor(credentials: ServiceAccountCredentials) {
    // Validate credentials
    if (!credentials.clientEmail) {
      throw new Error("Service account email is required");
    }
    if (!credentials.privateKey) {
      throw new Error("Service account private key is required");
    }
    if (!credentials.subject) {
      throw new Error("Admin email (subject) is required");
    }

    // Create the JWT auth client
    const auth = new google.auth.JWT({
      email: credentials.clientEmail,
      key: credentials.privateKey,
      subject: credentials.subject,
      scopes: [
        "https://www.googleapis.com/auth/admin.directory.user.readonly",
        "https://www.googleapis.com/auth/admin.directory.user.security",
        "https://www.googleapis.com/auth/admin.directory.orgunit.readonly",
      ],
    });

    // Initialise the Admin SDK client
    this.adminClient = google.admin({ version: "directory_v1", auth });
  }

  /**
   * Lists all users (handles pagination)
   * @param orgUnitPath Filter by a specific OU path (optional)
   */
  async listUsers(orgUnitPath?: string): Promise<GoogleWorkspaceUser[]> {
    const users: GoogleWorkspaceUser[] = [];
    let pageToken: string | undefined;

    do {
      const params: admin_directory_v1.Params$Resource$Users$List = {
        customer: "my_customer",
        maxResults: 500,
        pageToken,
        projection: "full",
      };

      if (orgUnitPath) {
        params.query = `orgUnitPath='${orgUnitPath}'`;
      }

      const response = await this.adminClient.users.list(params);
      const data = response.data;

      if (data.users) {
        users.push(...(data.users as GoogleWorkspaceUser[]));
      }

      pageToken = data.nextPageToken || undefined;
    } while (pageToken);

    return users;
  }

  /**
   * Gets a single user
   * @param userKey User e-mail or ID
   */
  async getUser(userKey: string): Promise<GoogleWorkspaceUser | null> {
    try {
      const response = await this.adminClient.users.get({
        userKey,
        projection: "full",
      });
      return response.data as GoogleWorkspaceUser;
    } catch (error: unknown) {
      // Return null when the user is not found
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Lists a user's OAuth tokens (for discovering connected apps)
   * @param userKey User e-mail or ID
   */
  async listTokens(userKey: string): Promise<GoogleOAuthToken[]> {
    try {
      const response = await this.adminClient.tokens.list({ userKey });
      return (response.data.items as GoogleOAuthToken[]) || [];
    } catch {
      throw new Error("Failed to fetch OAuth tokens");
    }
  }

  /**
   * Connection test
   * Checks that the credentials are valid
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log("[GoogleWorkspace] testConnection starting...");
      // Test the connection by fetching a single user
      const response = await this.adminClient.users.list({
        customer: "my_customer",
        maxResults: 1,
      });
      console.log(
        "[GoogleWorkspace] testConnection succeeded:",
        response.status
      );
      return true;
    } catch (error: unknown) {
      console.error("[GoogleWorkspace] testConnection failed:", error);

      // Extract GaxiosError details
      const gaxiosError = error as {
        code?: string | number;
        response?: {
          status?: number;
          data?: {
            error?: string;
            error_description?: string;
          };
        };
        message?: string;
      };

      const errorCode = gaxiosError.code || gaxiosError.response?.status;
      const errorData = gaxiosError.response?.data;
      const errorMessage = gaxiosError.message || "Unknown error";

      console.error("[GoogleWorkspace] Error code:", errorCode);
      console.error("[GoogleWorkspace] Error data:", errorData);
      console.error("[GoogleWorkspace] Error message:", errorMessage);

      // Build a specific error message
      let detailedMessage = `Google API error: ${errorMessage}`;

      if (errorMessage.includes("invalid_grant")) {
        detailedMessage =
          "Authentication failed: please check the Domain-Wide Delegation settings. " +
          "1) Enable 'Domain-wide delegation' for the service account in Google Cloud Console; " +
          "2) Register the Client ID and scopes under Google Admin Console > Security > API Controls.";
      } else if (errorMessage.includes("Not Authorized")) {
        detailedMessage =
          "Insufficient permissions: please check that the admin email (subject) has Google Workspace Super Admin rights.";
      } else if (errorMessage.includes("invalid_client")) {
        detailedMessage =
          "Client error: please check that the service account email is correct.";
      }

      throw new Error(detailedMessage);
    }
  }

  /**
   * Lists all Organizational Units (OUs)
   * @returns Array of GoogleOrgUnit
   */
  async listOrgUnits(): Promise<GoogleOrgUnit[]> {
    try {
      const response = await this.adminClient.orgunits.list({
        customerId: "my_customer",
        type: "ALL",
      });

      const orgUnits = response.data.organizationUnits || [];

      return orgUnits.map((ou) => ({
        orgUnitId: ou.orgUnitId || "",
        name: ou.name || "",
        description: ou.description || undefined,
        orgUnitPath: ou.orgUnitPath || "",
        parentOrgUnitId: ou.parentOrgUnitId || undefined,
        parentOrgUnitPath: ou.parentOrgUnitPath || undefined,
        blockInheritance: ou.blockInheritance || false,
      })) as GoogleOrgUnit[];
    } catch (error: unknown) {
      console.error("Failed to list OUs:", error);
      throw new Error("Failed to list Organizational Units");
    }
  }

  /**
   * Gets a specific Organizational Unit (OU)
   * @param orgUnitPath OU path (e.g. "/Engineering")
   * @returns GoogleOrgUnit or null
   */
  async getOrgUnit(orgUnitPath: string): Promise<GoogleOrgUnit | null> {
    try {
      // The OU path must be URL-encoded
      const encodedPath = encodeURIComponent(orgUnitPath);
      const response = await this.adminClient.orgunits.get({
        customerId: "my_customer",
        orgUnitPath: encodedPath,
      });

      const ou = response.data;
      return {
        orgUnitId: ou.orgUnitId || "",
        name: ou.name || "",
        description: ou.description || undefined,
        orgUnitPath: ou.orgUnitPath || "",
        parentOrgUnitId: ou.parentOrgUnitId || undefined,
        parentOrgUnitPath: ou.parentOrgUnitPath || undefined,
        blockInheritance: ou.blockInheritance || false,
      };
    } catch (error: unknown) {
      // Return null when the OU is not found
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 404
      ) {
        return null;
      }
      throw error;
    }
  }
}

/**
 * Creates a Google Workspace service instance from environment variables
 */
export function createGoogleWorkspaceServiceFromEnv(): GoogleWorkspaceService {
  const clientEmail = process.env.GOOGLE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );
  const subject = process.env.GOOGLE_ADMIN_SUBJECT;

  if (!clientEmail || !privateKey || !subject) {
    throw new Error("Google Workspace environment variables are not set");
  }

  return new GoogleWorkspaceService({
    clientEmail,
    privateKey,
    subject,
  });
}
