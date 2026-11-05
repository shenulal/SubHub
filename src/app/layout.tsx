import { RootThemeProvider } from "@/components/providers/root-theme-provider";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist_Mono, Inter, Lato } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Primary typeface: Lato, normal (upright) style. 400 = regular text,
// 700 = titles and emphasis, 300 = light display figures.
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "700"],
  style: ["normal"],
  display: "swap",
});

// Fallback typeface: Inter, used only if Lato cannot be loaded. Not preloaded,
// so browsers download it only when a glyph actually falls back to it.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: false,
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
        className={`${lato.variable} ${inter.variable} ${geistMono.variable} font-sans antialiased`}
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
