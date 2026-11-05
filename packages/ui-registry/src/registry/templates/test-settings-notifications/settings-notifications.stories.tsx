import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SettingsNotifications } from "./settings-notifications";

/**
 * Settings - Notifications page template based on the Figma design
 *
 * A complete settings page for managing user notification preferences.
 *
 * Features:
 * - Sidebar navigation menu
 * - Notification frequency via a radio group
 * - Toggle switches per email notification type
 * - Mobile settings checkbox
 * - Update settings button
 *
 * Components used:
 * - Button: update action button
 * - Checkbox: mobile settings option
 * - RadioGroup: notification frequency selection
 * - Separator: section divider
 * - Switch: email notification toggle
 * - Label: form label
 */
const meta = {
  title: "templates/Test Settings Notifications",
  component: SettingsNotifications,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Q7c53iozMSDxpPnunZsEM6/shadcn-ui-kit-for-Figma---August-2025?node-id=23104-146258&m=dev",
    },
  },
} satisfies Meta<typeof SettingsNotifications>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default Settings - Notifications page.
 * Implements the same layout and behavior as the Figma design.
 *
 * Sections included:
 * - Page header (Settings title and description)
 * - Sidebar navigation (Profile, Account, Appearance, Notifications, Display)
 * - Notification frequency (All new messages, Direct messages and mentions, Nothing)
 * - Email notification settings (Communication, Marketing, Social, Security)
 * - Mobile settings checkbox
 *
 * 🎯 Theme: choose from 14 theme combinations in the Storybook toolbar
 * 📱 Viewport: switch between Mobile, Tablet and Desktop views in the toolbar
 */
export const Default: Story = {};
