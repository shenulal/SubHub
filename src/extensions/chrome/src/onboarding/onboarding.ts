/**
 * Onboarding page script
 * Handles email verification and onboarding completion
 */

import { API_PATHS } from "../shared/api-paths";
import { DEFAULT_ONBOARDING_STATE, OnboardingState } from "../shared/types";
import { loadConfig, sendToBackend } from "../shared/utils";

const ONBOARDING_STATE_KEY = "onboardingState";

/**
 * Load onboarding state from storage
 */
async function loadOnboardingState(): Promise<OnboardingState> {
  return new Promise((resolve) => {
    chrome.storage.local.get(ONBOARDING_STATE_KEY, (result) => {
      resolve(
        (result[ONBOARDING_STATE_KEY] as OnboardingState) ||
          DEFAULT_ONBOARDING_STATE
      );
    });
  });
}

/**
 * Save onboarding state to storage
 */
async function saveOnboardingState(state: OnboardingState): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [ONBOARDING_STATE_KEY]: state }, resolve);
  });
}

/**
 * Show error message
 */
function showError(message: string): void {
  const errorEl = document.getElementById("error-msg");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
}

/**
 * Hide error message
 */
function hideError(): void {
  const errorEl = document.getElementById("error-msg");
  if (errorEl) {
    errorEl.style.display = "none";
  }
}

/**
 * Show success state
 */
function showSuccess(userName?: string): void {
  const formState = document.getElementById("form-state");
  const successState = document.getElementById("success-state");
  const welcomeMsg = document.getElementById("welcome-msg");

  if (formState) formState.style.display = "none";
  if (successState) successState.style.display = "block";
  if (welcomeMsg && userName) {
    welcomeMsg.textContent = `${userName}, the extension is now active.`;
  }

  // Close the tab after 3 seconds
  setTimeout(() => {
    window.close();
  }, 3000);
}

/**
 * Set button loading state
 */
function setLoading(loading: boolean): void {
  const btn = document.getElementById("submit-btn") as HTMLButtonElement;
  const emailInput = document.getElementById("email") as HTMLInputElement;

  if (btn) {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<span class="spinner"></span>Verifying...'
      : "Verify";
  }
  if (emailInput) {
    emailInput.disabled = loading;
  }
}

/**
 * Handle form submission
 */
async function handleSubmit(e: Event): Promise<void> {
  e.preventDefault();
  hideError();

  const emailInput = document.getElementById("email") as HTMLInputElement;
  const email = emailInput?.value?.trim();

  if (!email) {
    showError("Please enter your email.");
    return;
  }

  setLoading(true);

  try {
    const config = await loadConfig();

    // Step 1: Verify email
    const verifyResponse = await sendToBackend(
      API_PATHS.ONBOARDING_VERIFY,
      {
        device_id: config.id,
        email,
      },
      config.api
    );

    if (!verifyResponse.ok) {
      showError("Could not connect to the server. Please try again shortly.");
      setLoading(false);
      return;
    }

    const verifyData = await verifyResponse.json();

    if (!verifyData.success || !verifyData.data?.verified) {
      showError(
        "We could not verify this email. Please use the email registered with your organisation."
      );
      setLoading(false);
      return;
    }

    const { userId, userName } = verifyData.data;

    // Step 2: Complete onboarding (only if we have a userId)
    if (userId) {
      const completeResponse = await sendToBackend(
        API_PATHS.ONBOARDING_COMPLETE,
        {
          device_id: config.id,
          email,
          user_id: userId,
        },
        config.api
      );

      if (!completeResponse.ok) {
        showError("Failed to complete onboarding. Please try again.");
        setLoading(false);
        return;
      }

      const completeData = await completeResponse.json();

      if (!completeData.success) {
        showError("Failed to complete onboarding.");
        setLoading(false);
        return;
      }
    }

    // Save onboarding state
    const onboardingState: OnboardingState = {
      completed: true,
      email,
      userId: userId || undefined,
      userName: userName || undefined,
      completedAt: Date.now(),
    };
    await saveOnboardingState(onboardingState);

    // Notify background script
    chrome.runtime.sendMessage({
      type: "ONBOARDING_COMPLETE",
      data: onboardingState,
    });

    // Show success
    showSuccess(userName);
  } catch (error) {
    console.error("Onboarding error:", error);
    showError("An error occurred. Please try again shortly.");
    setLoading(false);
  }
}

/**
 * Initialize onboarding page
 */
async function init(): Promise<void> {
  // Check if already onboarded
  const state = await loadOnboardingState();
  if (state.completed) {
    showSuccess(state.userName);
    return;
  }

  // Set up form handler
  const form = document.getElementById("onboarding-form");
  form?.addEventListener("submit", handleSubmit);
}

// Initialize
document.addEventListener("DOMContentLoaded", init);
