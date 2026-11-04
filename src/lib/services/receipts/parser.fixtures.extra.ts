// src/lib/services/receipts/parser.fixtures.extra.ts
/** Second half of the parser fixture set (kept separate to stay under the file-size cap). */
import { msg, type ReceiptFixture } from "./parser.fixtures.shared";

export const RECEIPT_FIXTURES_EXTRA: ReceiptFixture[] = [
  {
    name: "Charge date line overrides message date",
    message: msg(
      "m17",
      "Linear <billing@linear.app>",
      "Receipt for Linear",
      "2026-07-03T10:00:00Z",
      "Payment date: July 1, 2026\nAmount paid: $96.00\nPlan: Standard (monthly, 12 seats)"
    ),
    expect: {
      vendor: "Linear",
      amount: 96,
      currency: "USD",
      cycle: "MONTHLY",
      chargedAt: "2026-07-01",
      minConfidence: 0.75,
    },
  },
  {
    name: "One-time purchase – not a subscription",
    message: msg(
      "m18",
      "Gumroad <noreply@gumroad.com>",
      "You bought Icon Pack Vol. 2",
      "2026-02-02T10:00:00Z",
      "Thanks for your purchase! One-time payment of $29.00.\nDownload your files below."
    ),
    expect: { cycle: "ONE_TIME", maxConfidence: 0.6 },
  },
  {
    name: "Generic noreply domain – vendor from subject",
    message: msg(
      "m19",
      "no-reply@mail.1password.com",
      "Your 1Password Teams receipt",
      "2026-08-08T10:00:00Z",
      "Teams Starter Pack\nTotal: $19.95\nBilled monthly"
    ),
    expect: {
      vendor: "1Password Teams",
      amount: 19.95,
      currency: "USD",
      cycle: "MONTHLY",
      minConfidence: 0.75,
    },
  },
  {
    name: "Catalog alias match beats display name",
    message: msg(
      "m20",
      "Atlassian Billing <billing@mail-us.atlassian.com>",
      "Invoice for Jira Software (Cloud)",
      "2026-09-09T10:00:00Z",
      "Jira Software Standard – 25 users\nTotal: US$ 212.50\nBilled monthly\nNext charge on October 9, 2026"
    ),
    expect: {
      vendor: "Jira",
      amount: 212.5,
      currency: "USD",
      cycle: "MONTHLY",
      nextRenewal: "2026-10-09",
      minConfidence: 0.85,
    },
  },
  {
    name: "Quoted display name with Inc suffix",
    message: msg(
      "m21",
      '"HubSpot, Inc." <billing@hubspot.com>',
      "HubSpot invoice INV-7781",
      "2026-10-10T10:00:00Z",
      "Marketing Hub Starter\nAnnual commitment, billed monthly\nAmount charged $45.00"
    ),
    expect: {
      vendor: "HubSpot",
      amount: 45,
      currency: "USD",
      cycle: "MONTHLY",
      minConfidence: 0.7,
    },
  },
  {
    name: "SAR currency code",
    message: msg(
      "m22",
      "Tap Payments <receipts@tap.company>",
      "Payment receipt - Salla Pro",
      "2026-03-15T10:00:00Z",
      "Merchant: Salla\nAmount: SAR 299.00\nBilling cycle: Monthly\nRenews on 15 Apr 2026"
    ),
    expect: {
      amount: 299,
      currency: "SAR",
      cycle: "MONTHLY",
      nextRenewal: "2026-04-15",
      minConfidence: 0.7,
    },
  },
  {
    name: "Trial converted to paid annual",
    message: msg(
      "m23",
      "Loom <no-reply@loom.com>",
      "Your Loom Business subscription has been renewed",
      "2026-11-11T10:00:00Z",
      "Your free trial has ended and your Loom Business plan is now active.\nYou were charged $150.00 for 12 months.\nRenews automatically on Nov 11, 2027."
    ),
    expect: {
      vendor: "Loom",
      amount: 150,
      currency: "USD",
      cycle: "YEARLY",
      trial: true,
      nextRenewal: "2027-11-11",
      minConfidence: 0.8,
    },
  },
  {
    name: "Amount only on next line after Total",
    message: msg(
      "m24",
      "Vercel <billing@vercel.com>",
      "Your receipt from Vercel Inc.",
      "2026-04-04T10:00:00Z",
      "Pro plan (monthly)\nTotal\n$20.00\nNext billing date\nMay 4, 2026"
    ),
    expect: {
      vendor: "Vercel",
      amount: 20,
      currency: "USD",
      cycle: "MONTHLY",
      nextRenewal: "2026-05-04",
      minConfidence: 0.8,
    },
  },
  {
    name: "Amount with % nearby must not grab percent",
    message: msg(
      "m25",
      "Mailchimp <billing@mailchimp.com>",
      "Mailchimp payment receipt",
      "2026-01-30T10:00:00Z",
      "Standard plan — monthly\nDiscount 10%\nAmount charged: $17.10"
    ),
    expect: {
      vendor: "Mailchimp",
      amount: 17.1,
      currency: "USD",
      cycle: "MONTHLY",
      minConfidence: 0.75,
    },
  },
  {
    name: "Public mailbox sender – vendor from display name",
    message: msg(
      "m26",
      "Studio Freelance Tools <studio.tools@gmail.com>",
      "Invoice #12 – monthly retainer",
      "2026-02-28T10:00:00Z",
      "Monthly retainer for design tooling.\nTotal: AED 500.00"
    ),
    expect: {
      amount: 500,
      currency: "AED",
      cycle: "MONTHLY",
      minConfidence: 0.6,
    },
  },
  {
    name: "Annual with /yr shorthand and renewal phrase",
    message: msg(
      "m27",
      "Calendly <no-reply@calendly.com>",
      "Calendly: your payment was successful",
      "2026-06-20T10:00:00Z",
      "Standard plan — $120/yr\nYour plan will renew on June 20, 2027."
    ),
    expect: {
      vendor: "Calendly",
      amount: 120,
      currency: "USD",
      cycle: "YEARLY",
      nextRenewal: "2027-06-20",
      minConfidence: 0.75,
    },
  },
  {
    name: "Receipt with no cycle words",
    message: msg(
      "m28",
      "Postman <billing@postman.com>",
      "Postman receipt",
      "2026-02-11T10:00:00Z",
      "Receipt\nPostman Basic\nAmount paid $14.00"
    ),
    expect: {
      vendor: "Postman",
      amount: 14,
      currency: "USD",
      cycle: null,
      minConfidence: 0.55,
    },
  },
];
