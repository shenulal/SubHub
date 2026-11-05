import { RootThemeProvider } from "@/components/providers/root-theme-provider";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Materio typography: Inter (300–700)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
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
