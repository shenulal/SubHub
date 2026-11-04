// src/lib/services/receipts/parser.fixtures.ts
/**
 * Synthetic receipt emails used by parser tests. Vendors are real product names
 * (so alias matching is meaningful) but every amount/date/address is invented.
 */
import { RECEIPT_FIXTURES_EXTRA } from "./parser.fixtures.extra";
import { msg, type ReceiptFixture } from "./parser.fixtures.shared";

export type { ReceiptFixture } from "./parser.fixtures.shared";

const RECEIPT_FIXTURES_CORE: ReceiptFixture[] = [
  {
    name: "Notion monthly USD",
    message: msg(
      "m1",
      "Notion Team <team@makenotion.com>",
      "Your Notion receipt",
      "2026-01-05T10:00:00Z",
      "Thanks for your payment.\nPlan: Plus (monthly)\nAmount charged: $12.00\nNext billing date: February 5, 2026\nInvoice #INV-1001"
    ),
    expect: {
      vendor: "Notion",
      amount: 12,
      currency: "USD",
      cycle: "MONTHLY",
      nextRenewal: "2026-02-05",
      minConfidence: 0.8,
    },
  },
  {
    name: "Slack annual USD with code suffix",
    message: msg(
      "m2",
      "Slack <feedback@slack.com>",
      "Your Slack invoice is available",
      "2026-03-01T08:00:00Z",
      "Workspace: Acme\nBilling period: Mar 1, 2026 - Feb 28, 2027\nSubtotal 1,200.00 USD\nTax 0.00 USD\nTotal 1,200.00 USD\nBilled annually."
    ),
    expect: {
      vendor: "Slack",
      amount: 1200,
      currency: "USD",
      cycle: "YEARLY",
      nextRenewal: "2027-02-28",
      minConfidence: 0.8,
    },
  },
  {
    name: "Zoom via Stripe AED",
    message: msg(
      "m3",
      "Stripe <receipts+acct@stripe.com>",
      "Your receipt from Zoom Video Communications #2041-5522",
      "2026-02-10T12:00:00Z",
      "Receipt from Zoom Video Communications\nAmount paid AED 55.00\nDate paid Feb 10, 2026\nZoom Pro - Monthly subscription\nYour next payment is on Mar 10, 2026"
    ),
    expect: {
      vendor: "Zoom Video Communications",
      amount: 55,
      currency: "AED",
      cycle: "MONTHLY",
      nextRenewal: "2026-03-10",
      minConfidence: 0.8,
    },
  },
  {
    name: "Adobe EUR comma decimal",
    message: msg(
      "m4",
      "Adobe <mail@email.adobe.com>",
      "Rechnung / Invoice for your Adobe subscription",
      "2026-01-20T09:30:00Z",
      "Creative Cloud All Apps\nMonthly plan\nTotal: €59,99\nNext billing: 20 Feb 2026"
    ),
    expect: {
      vendor: "Adobe",
      amount: 59.99,
      currency: "EUR",
      cycle: "MONTHLY",
      nextRenewal: "2026-02-20",
      minConfidence: 0.8,
    },
  },
  {
    name: "Figma GBP annual",
    message: msg(
      "m5",
      '"Figma" <billing@figma.com>',
      "Payment received – Figma Professional",
      "2026-04-02T07:00:00Z",
      "Hi,\nWe received your payment of £144.00 for Figma Professional (annual).\nYour subscription renews on April 2, 2027.\nThank you!"
    ),
    expect: {
      vendor: "Figma",
      amount: 144,
      currency: "GBP",
      cycle: "YEARLY",
      nextRenewal: "2027-04-02",
      minConfidence: 0.8,
    },
  },
  {
    name: "GitHub USD per month wording",
    message: msg(
      "m6",
      "GitHub <noreply@github.com>",
      "[GitHub] Payment receipt for Acme Corp",
      "2026-05-15T00:00:00Z",
      "Receipt\nGitHub Team: 10 seats x $4.00 per month\nTotal charged: $40.00\nThis is a recurring charge."
    ),
    expect: {
      vendor: "GitHub",
      amount: 40,
      currency: "USD",
      cycle: "MONTHLY",
      minConfidence: 0.75,
    },
  },
  {
    name: "Canva free trial reminder (no charge)",
    message: msg(
      "m7",
      "Canva <no-reply@canva.com>",
      "Your Canva Pro free trial ends soon",
      "2026-06-01T10:00:00Z",
      "Your free trial ends on June 7, 2026. After that you will be charged $12.99/mo unless you cancel.\nManage your subscription."
    ),
    expect: {
      vendor: "Canva",
      amount: 12.99,
      currency: "USD",
      cycle: "MONTHLY",
      trial: true,
    },
  },
  {
    name: "Amazon shipping – non-subscription",
    message: msg(
      "m8",
      "Amazon.ae <shipment-tracking@amazon.ae>",
      "Your Amazon.ae order has shipped",
      "2026-02-03T10:00:00Z",
      "Your order #403-1234567 has shipped.\nTracking number: 1Z999\nOrder total: AED 349.00\nEstimated delivery: Feb 5, 2026"
    ),
    expect: { maxConfidence: 0.6, currency: "AED", amount: 349 },
  },
  {
    name: "Marketing promo – non-subscription",
    message: msg(
      "m9",
      "Grammarly <offers@grammarly.com>",
      "Last chance: 40% off Grammarly Premium",
      "2026-11-25T10:00:00Z",
      "Black Friday deal! Get 40% off an annual plan. Limited time offer — upgrade today for $72/yr."
    ),
    expect: { maxConfidence: 0.6 },
  },
  {
    name: "Plain text with no money",
    message: msg(
      "m10",
      "Alice <alice@example.com>",
      "Lunch tomorrow?",
      "2026-01-01T10:00:00Z",
      "Hey, are we still on for lunch tomorrow at noon?"
    ),
    expect: { maxConfidence: 0.3 },
  },
  {
    name: "Microsoft 365 quarterly",
    message: msg(
      "m11",
      "Microsoft <microsoft-noreply@microsoft.com>",
      "Your Microsoft 365 Business invoice",
      "2026-01-08T10:00:00Z",
      "Invoice number: E0400\nBilling frequency: Quarterly\nAmount due: USD 180.00\nService period: Jan 8, 2026 – Apr 7, 2026"
    ),
    expect: {
      vendor: "Microsoft",
      amount: 180,
      currency: "USD",
      cycle: "QUARTERLY",
      nextRenewal: "2026-04-07",
      minConfidence: 0.8,
    },
  },
  {
    name: "Dropbox HTML-only body",
    message: msg(
      "m12",
      "Dropbox <no-reply@dropbox.com>",
      "Your Dropbox receipt",
      "2026-02-14T10:00:00Z",
      "",
      "<html><body><table><tr><td>Dropbox Plus (yearly)</td></tr><tr><td>Total</td><td>$119.88</td></tr><tr><td>Next payment on March 14, 2027</td></tr></table></body></html>"
    ),
    expect: {
      vendor: "Dropbox",
      amount: 119.88,
      currency: "USD",
      cycle: "YEARLY",
      nextRenewal: "2027-03-14",
      minConfidence: 0.8,
    },
  },
  {
    name: "Suffixed currency 12.99 USD",
    message: msg(
      "m13",
      "Spotify <no-reply@spotify.com>",
      "Spotify Premium – payment confirmation",
      "2026-03-03T10:00:00Z",
      "Payment confirmation\nSpotify Premium Individual\n12.99 USD per month\nYour next bill is on 03/04/2026."
    ),
    expect: {
      vendor: "Spotify",
      amount: 12.99,
      currency: "USD",
      cycle: "MONTHLY",
      nextRenewal: "2026-03-04",
      minConfidence: 0.75,
    },
  },
  {
    name: "AED with Arabic symbol and thousands",
    message: msg(
      "m14",
      "Zoho <billing@zohocorp.com>",
      "Tax invoice for Zoho One",
      "2026-01-12T10:00:00Z",
      "Tax Invoice\nZoho One - Annual\nSubtotal AED 1,250.00\nVAT 5% AED 62.50\nGrand total AED 1,312.50\nValid until 12 Jan 2027"
    ),
    expect: {
      vendor: "Zoho",
      amount: 1312.5,
      currency: "AED",
      cycle: "YEARLY",
      nextRenewal: "2027-01-12",
      minConfidence: 0.8,
    },
  },
  {
    name: "Paddle on behalf of vendor in subject",
    message: msg(
      "m15",
      "Paddle.com <help@paddle.com>",
      "Your invoice from Setapp",
      "2026-02-20T10:00:00Z",
      "Setapp Team plan\nAmount: USD 9.99\nBilled monthly\nNext renewal: 2026-03-20"
    ),
    expect: {
      vendor: "Setapp",
      amount: 9.99,
      currency: "USD",
      cycle: "MONTHLY",
      nextRenewal: "2026-03-20",
      minConfidence: 0.75,
    },
  },
  {
    name: "European 1.299,00 EUR annual",
    message: msg(
      "m16",
      "JetBrains <sales@jetbrains.com>",
      "Invoice for JetBrains All Products Pack",
      "2026-05-05T10:00:00Z",
      "Rechnungsbetrag / Total: 1.299,00 EUR\nSubscription period: 1 year\nNext billing date: 05.05.2027"
    ),
    expect: {
      vendor: "JetBrains",
      amount: 1299,
      currency: "EUR",
      cycle: "YEARLY",
      nextRenewal: "2027-05-05",
      minConfidence: 0.75,
    },
  },
];

export const RECEIPT_FIXTURES: ReceiptFixture[] = [
  ...RECEIPT_FIXTURES_CORE,
  ...RECEIPT_FIXTURES_EXTRA,
];
