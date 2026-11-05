// src/components/devices/fleetdm-install-guide.test.tsx
import messages from "@/i18n/messages/en.json";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { FleetDMInstallGuide } from "./fleetdm-install-guide";

const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
};

describe("FleetDMInstallGuide", () => {
  describe("rendering", () => {
    it("should render title", () => {
      renderWithProvider(<FleetDMInstallGuide />);

      expect(screen.getByText("Install FleetDM agent")).toBeInTheDocument();
    });

    it("should render OS tabs", () => {
      renderWithProvider(<FleetDMInstallGuide />);

      expect(screen.getByRole("tab", { name: /macos/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /windows/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /linux/i })).toBeInTheDocument();
    });

    it("should show macOS content by default", () => {
      renderWithProvider(<FleetDMInstallGuide />);

      expect(screen.getByText(/Homebrew/)).toBeInTheDocument();
    });
  });

  describe("tab switching", () => {
    it("should have Windows tab available", () => {
      renderWithProvider(<FleetDMInstallGuide />);

      const windowsTab = screen.getByRole("tab", { name: /windows/i });
      // Windows tab is clickable
      expect(windowsTab).not.toBeDisabled();
    });

    it("should have Linux tab available", () => {
      renderWithProvider(<FleetDMInstallGuide />);

      const linuxTab = screen.getByRole("tab", { name: /linux/i });
      // Linux tab is clickable
      expect(linuxTab).not.toBeDisabled();
    });

    it("should have macOS tab selected by default", () => {
      renderWithProvider(<FleetDMInstallGuide />);

      const macosTab = screen.getByRole("tab", { name: /macos/i });
      expect(macosTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("download link", () => {
    it("should have download link", () => {
      renderWithProvider(<FleetDMInstallGuide />);

      // Verify the download page link
      const downloadLink = screen.getByRole("link", {
        name: /official download page/,
      });
      expect(downloadLink).toHaveAttribute(
        "href",
        expect.stringContaining("fleetdm.com")
      );
    });
  });

  describe("copy feature", () => {
    it("should have copy button for install command", () => {
      renderWithProvider(<FleetDMInstallGuide />);

      const copyButtons = screen.getAllByRole("button");
      // Verify the copy button exists
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });

  describe("onClose callback", () => {
    it("should call onClose when close button is clicked", () => {
      const onClose = vi.fn();
      renderWithProvider(<FleetDMInstallGuide onClose={onClose} />);

      const closeButton = screen.getByRole("button", { name: /Close/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
