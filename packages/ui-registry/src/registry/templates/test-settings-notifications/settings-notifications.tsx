import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

/**
 * 🎯 Purpose: Settings - Notifications page implemented from the Figma design
 *
 * This component is a page for managing user notification preferences.
 * - Sidebar navigation
 * - Notification frequency via a radio group
 * - Switch toggles per email notification type
 * - Mobile settings checkbox
 */
export function SettingsNotifications() {
  return (
    <div className="bg-background min-h-screen">
      <div className="p-10">
        {/* Header section */}
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and set e-mail preferences.
          </p>
        </div>

        <Separator className="my-6" />

        <div className="flex gap-12">
          {/* Sidebar navigation */}
          <aside className="w-[200px]">
            <nav className="flex flex-col space-y-1">
              <a
                href="#"
                className="hover:text-primary py-2 text-sm font-medium transition-colors"
              >
                Profile
              </a>
              <a
                href="#"
                className="hover:text-primary py-2 text-sm font-medium transition-colors"
              >
                Account
              </a>
              <a
                href="#"
                className="hover:text-primary py-2 text-sm font-medium transition-colors"
              >
                Appearance
              </a>
              <a
                href="#"
                className="bg-muted rounded-md px-3 py-2 text-sm font-medium"
              >
                Notifications
              </a>
              <a
                href="#"
                className="hover:text-primary py-2 text-sm font-medium transition-colors"
              >
                Display
              </a>
            </nav>
          </aside>

          {/* Main content */}
          <div className="max-w-2xl flex-1">
            <div className="space-y-6">
              {/* Page title */}
              <div>
                <h3 className="text-lg font-medium">Notifications</h3>
                <p className="text-muted-foreground text-sm">
                  Configure how you receive notifications.
                </p>
              </div>

              <Separator />

              {/* Notification settings form */}
              <div className="space-y-8">
                {/* Notification frequency */}
                <div className="space-y-3">
                  <Label htmlFor="notify-about">Notify me about...</Label>
                  <RadioGroup defaultValue="all" id="notify-about">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="all" id="all" />
                      <Label
                        htmlFor="all"
                        className="cursor-pointer font-normal"
                      >
                        All new messages
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="mentions" id="mentions" />
                      <Label
                        htmlFor="mentions"
                        className="cursor-pointer font-normal"
                      >
                        Direct messages and mentions
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="none" id="none" />
                      <Label
                        htmlFor="none"
                        className="cursor-pointer font-normal"
                      >
                        Nothing
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Email notification settings */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Email Notifications</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Communication emails */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <div className="text-base font-medium">
                          Communication emails
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Send notifications to device.
                        </div>
                      </div>
                      <Switch />
                    </div>

                    {/* Marketing emails */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <div className="text-base font-medium">
                          Marketing emails
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Receive emails about new products, features, and more.
                        </div>
                      </div>
                      <Switch />
                    </div>

                    {/* Social emails */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <div className="text-base font-medium">
                          Social emails
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Receive emails for friend requests, follows, and more.
                        </div>
                      </div>
                      <Switch />
                    </div>

                    {/* Security emails */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <div className="text-base font-medium">
                          Security emails
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Receive emails about your account activity and
                          security.
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                {/* Mobile settings checkbox */}
                <div className="flex items-start space-x-2">
                  <Checkbox id="mobile" defaultChecked />
                  <div className="space-y-1">
                    <Label
                      htmlFor="mobile"
                      className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Use different settings for my mobile devices
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      You can manage your mobile notifications in the mobile
                      settings page.
                    </p>
                  </div>
                </div>

                {/* Update button */}
                <Button>Update notifications</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
