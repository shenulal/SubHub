/**
 * Content script for detecting login events
 * Main entry point - orchestrates login detection modules
 */

import {
  detectAndMonitorLoginButtons,
  detectFederatedFromLocation,
  detectOAuthProviderLogin,
  hookHistoryChanges,
} from "./detectors";
import { findAndMonitorForms } from "./handlers";
import {
  detectLoginFormEnhanced,
  forceRefreshValues,
  getLoginConfig,
  observeDOMChanges,
  observeShadowDOMChanges,
  observeVisibilityChanges,
  scanAndTrackFields,
  setupDynamicFormObserver,
  setupNavigationListener,
} from "./utils";
import { initializeDomainBlocker } from "./utils/domain-blocker";

/**
 * Enhanced form scanning with special SaaS handling
 */
const enhancedFormScan = async (): Promise<void> => {
  const hostname = window.location.hostname;
  const config = getLoginConfig(hostname);

  if (config) {
    console.log(
      "[Shade] Special SaaS detected:",
      hostname,
      "- Type:",
      config.type
    );

    // Handle the OAuth button type
    if (config.type === "oauth-button") {
      console.log("[Shade] OAuth button type - monitoring login buttons");
      const buttonResult = detectAndMonitorLoginButtons();
      if (buttonResult.found) {
        console.log(
          "[Shade] Login buttons detected:",
          buttonResult.buttonCount
        );
      }
      // Also run OAuth provider page detection
      detectOAuthProviderLogin();
      return;
    }

    // Handle the 2-step login type
    if (config.type === "2-step") {
      console.log("[Shade] 2-step login type - will monitor step transitions");
    }

    // Use enhanced form detection
    const result = await detectLoginFormEnhanced();

    if (result.found) {
      console.log("[Shade] Enhanced detection found login form:", result.type);
    } else {
      console.log(
        "[Shade] Enhanced detection: no form found, setting up observer"
      );
      // Detect dynamic form loading
      setupDynamicFormObserver(() => {
        findAndMonitorForms();
      });
    }
  } else {
    // Try login-button detection even for services without settings
    const buttonResult = detectAndMonitorLoginButtons();
    if (buttonResult.found && buttonResult.isOAuthButtonType) {
      console.log("[Shade] Detected OAuth button pattern on unconfigured site");
    }
  }

  // Also run the existing form monitoring
  findAndMonitorForms();

  // OAuth provider page check
  detectOAuthProviderLogin();
};

/**
 * Initialize the content script
 */
const initialize = (): void => {
  console.log("[Shade] Content script loaded on:", window.location.href);

  // Check domain blocking FIRST - before any other operations
  initializeDomainBlocker().then((/* blocked */) => {
    // Continue with normal initialization only if not blocked
    // The blocker will show a blocking page if domain is blocked
  });

  // Hook navigation changes to detect OAuth/OIDC hash or query params
  hookHistoryChanges();

  // Set up navigation listener for multi-step login flows (Google, Slack, etc.)
  setupNavigationListener(findAndMonitorForms);

  // Immediate check for federated indicators on current URL
  detectFederatedFromLocation();

  // Initial scan for forms
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", async () => {
      console.log("[Shade] DOM ready, scanning for forms...");

      // Enhanced form scan (including special SaaS handling)
      await enhancedFormScan();

      observeDOMChanges(findAndMonitorForms);
      // Observe visibility changes for hidden password fields
      observeVisibilityChanges(findAndMonitorForms);
      // Observe Shadow DOM additions
      observeShadowDOMChanges(findAndMonitorForms);
      // Start real-time field tracking (autofill, password managers)
      scanAndTrackFields();
      // Check again after DOM ready
      detectFederatedFromLocation();

      // Force refresh values after a delay (for slow password managers)
      setTimeout(forceRefreshValues, 1500);

      // Handle SPA dynamic loading - multiple delayed scans
      const delayedScans = [2000, 4000, 6000, 10000];
      delayedScans.forEach((delay) => {
        setTimeout(() => {
          console.log(`[Shade] Delayed scan at ${delay}ms`);
          scanAndTrackFields();
          findAndMonitorForms();
        }, delay);
      });
    });
  } else {
    console.log("[Shade] Document already loaded, scanning for forms...");

    // Enhanced form scan (including special SaaS handling)
    enhancedFormScan().then(() => {
      observeDOMChanges(findAndMonitorForms);
      // Observe visibility changes for hidden password fields
      observeVisibilityChanges(findAndMonitorForms);
      // Observe Shadow DOM additions
      observeShadowDOMChanges(findAndMonitorForms);
      // Start real-time field tracking
      scanAndTrackFields();
      detectFederatedFromLocation();

      // Force refresh values after a delay
      setTimeout(forceRefreshValues, 1500);

      // Handle SPA dynamic loading - multiple delayed scans
      const delayedScans = [2000, 4000, 6000, 10000];
      delayedScans.forEach((delay) => {
        setTimeout(() => {
          console.log(`[Shade] Delayed scan at ${delay}ms`);
          scanAndTrackFields();
          findAndMonitorForms();
        }, delay);
      });
    });
  }
};

// Start the content script (skip during tests)
if (typeof jest === "undefined") {
  initialize();
}

// Export for testing
export { initialize };
