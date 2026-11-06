import { RootThemeProvider } from "@/components/providers/root-theme-provider";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Typeface: Inter (Google Fonts), loaded as the variable font so every weight
// from 300 to 700 is a real face, with the optical-size axis so large titles use
// Inter's display cut and small text its text cut. See docs/DESIGN-SYSTEM.md.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  style: ["normal"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SubHub",
    template: "%s | SubHub",
  },
  description:
    "SubHub — track subscriptions, route approvals, get renewal reminders and see spend in one place.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    // The font variables sit on <html> because the --app-font-* tokens are
    // declared on :root; a var() there cannot see variables set lower down.
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <RootThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
            <Toaster position="top-right" richColors />
          </NextIntlClientProvider>
        </RootThemeProvider>
      </body>
    </html>
  );
}
