/**
 * Live Hyphen API test script
 * Run: npx tsx src/lib/services/hyphen/test-api.ts
 *
 * Prerequisites:
 * 1. npx tsx src/lib/services/hyphen/seed-test-card.ts to register a card in the DB
 * 2. Set HYPHEN_USER_ID, HYPHEN_HKEY and ENCRYPTION_KEY in .env.local
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { decryptJson } from "@/lib/crypto";
import { PrismaClient } from "@prisma/client";
import { getCardApprovals, getCardPurchases } from "./card";
import type { CardCompanyCode, CardCredentials } from "./types";

const prisma = new PrismaClient();

// Query period
const QUERY_PERIOD = {
  sdate: "20251101",
  edate: "20251201",
};

async function testOAuthToken() {
  console.log("\n========== Step 1: OAuth token request test ==========\n");

  const HYPHEN_API_BASE = "https://api.hyphen.im";
  const userId = process.env.HYPHEN_USER_ID;
  const hkey = process.env.HYPHEN_HKEY;

  console.log(`Request URL: ${HYPHEN_API_BASE}/oauth/token`);
  console.log(`Request body: { user_id: "${userId}", hkey: "${hkey}" }`);

  try {
    const response = await fetch(`${HYPHEN_API_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, hkey: hkey }),
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);

    const rawText = await response.text();
    console.log(`Response body: ${rawText}`);

    if (response.ok) {
      const data = JSON.parse(rawText);
      if (data.access_token) {
        console.log("\n✅ Token issued successfully");
        console.log(
          `   Token (first 50 characters): ${data.access_token.substring(0, 50)}...`
        );
        return true;
      }
    }

    console.error("\n❌ Token request failed: no access_token returned");
    return false;
  } catch (error) {
    console.error("❌ Token request failed:", error);
    return false;
  }
}

async function getTestCardFromDB() {
  console.log("\n========== Load test card from DB ==========\n");

  // Load the most recent active card
  const card = await prisma.corporateCard.findFirst({
    where: {
      isActive: true,
    },
    include: {
      organization: {
        select: { name: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!card) {
    throw new Error(
      "No card is registered in the DB. Run seed-test-card.ts first."
    );
  }

  console.log(`✅ Card loaded`);
  console.log(`   Card ID: ${card.id}`);
  console.log(`   Card name: ${card.cardNm}`);
  console.log(`   Card number: ${card.cardNo}`);
  console.log(`   Organization: ${card.organization.name}`);

  // Decrypt credentials
  console.log("\nDecrypting credentials...");
  const credentials = decryptJson<CardCredentials>(card.encryptedCredentials);
  console.log(`✅ Decryption succeeded`);
  console.log(`   Login method: ${credentials.loginMethod}`);
  console.log(
    `   User ID: ${credentials.loginMethod === "ID" ? credentials.userId : "(certificate login)"}`
  );
  console.log(`   Business registration number: ${credentials.bizNo || "N/A"}`);

  return { card, credentials };
}

// CardCredentials extended with cardNo
type ExtendedCardCredentials = CardCredentials & {
  cardNo?: string;
};

async function testCardApprovals(
  card: { cardCd: string; cardNo: string },
  credentials: ExtendedCardCredentials
) {
  console.log("\n========== Step 2: approval history test ==========\n");

  // The original card number comes from the encrypted credentials
  const originalCardNo = credentials.cardNo || card.cardNo.replace(/\*/g, "");

  const request = {
    cardCd: card.cardCd as CardCompanyCode,
    cardNo: originalCardNo,
    sdate: QUERY_PERIOD.sdate,
    edate: QUERY_PERIOD.edate,
    useArea: "D" as const,
  };

  console.log(
    "Request parameters:",
    JSON.stringify(
      {
        ...request,
        userId:
          credentials.loginMethod === "ID"
            ? credentials.userId
            : "(certificate)",
        userPw: "***hidden***",
        bizNo: credentials.bizNo || "N/A",
      },
      null,
      2
    )
  );

  try {
    const response = await getCardApprovals(request, credentials);

    console.log("\n✅ Approval history retrieved");
    console.log(`   Results: ${response.data.list?.length || 0}`);
    console.log(`   Total amount: ${response.data.totalAmt || "N/A"}`);

    if (response.data.list && response.data.list.length > 0) {
      console.log("\n   [Approval history sample (up to 5)]");
      response.data.list.slice(0, 5).forEach((item, i) => {
        console.log(
          `   ${i + 1}. ${item.useDt} | ${item.useStore} | ${item.useAmt} KRW`
        );
      });
    }

    return true;
  } catch (error: unknown) {
    console.error("\n❌ Approval history request failed:");
    if (error instanceof Error) {
      console.error("   Error message:", error.message);
    }
    return false;
  }
}

async function testCardPurchases(
  card: { cardCd: string; cardNo: string },
  credentials: ExtendedCardCredentials
) {
  console.log("\n========== Step 3: purchase history test ==========\n");

  // The original card number comes from the encrypted credentials
  const originalCardNo = credentials.cardNo || card.cardNo.replace(/\*/g, "");

  const request = {
    cardCd: card.cardCd as CardCompanyCode,
    cardNo: originalCardNo,
    sdate: QUERY_PERIOD.sdate,
    edate: QUERY_PERIOD.edate,
    useArea: "D" as const,
  };

  console.log(
    "Request parameters:",
    JSON.stringify(
      {
        ...request,
        userId:
          credentials.loginMethod === "ID"
            ? credentials.userId
            : "(certificate)",
        userPw: "***hidden***",
        bizNo: credentials.bizNo || "N/A",
      },
      null,
      2
    )
  );

  try {
    const response = await getCardPurchases(request, credentials);

    console.log("\n✅ Purchase history retrieved");
    console.log(`   Results: ${response.data.list?.length || 0}`);
    console.log(`   Total amount: ${response.data.totalAmt || "N/A"}`);

    if (response.data.list && response.data.list.length > 0) {
      console.log("\n   [Purchase history sample (up to 5)]");
      response.data.list.slice(0, 5).forEach((item, i) => {
        console.log(
          `   ${i + 1}. ${item.useDt} | ${item.useStore} | ${item.useAmt} KRW | Purchase date: ${item.pchDt || "N/A"}`
        );
      });
    }

    return true;
  } catch (error: unknown) {
    console.error("\n❌ Purchase history request failed:");
    if (error instanceof Error) {
      console.error("   Error message:", error.message);
    }
    return false;
  }
}

async function main() {
  console.log("================================================");
  console.log("   Hyphen corporate card API test (DB-based)");
  console.log("================================================");
  console.log(`Query period: ${QUERY_PERIOD.sdate} ~ ${QUERY_PERIOD.edate}`);

  // Check environment variables
  if (!process.env.HYPHEN_USER_ID || !process.env.HYPHEN_HKEY) {
    console.error(
      "\n❌ Environment error: HYPHEN_USER_ID or HYPHEN_HKEY is not set."
    );
    console.error("   Please check your .env.local file.");
    process.exit(1);
  }

  if (!process.env.ENCRYPTION_KEY) {
    console.error("\n❌ Environment error: ENCRYPTION_KEY is not set.");
    console.error("   Please check your .env.local file.");
    process.exit(1);
  }

  console.log(`\nHyphen account: ${process.env.HYPHEN_USER_ID}`);

  const results = {
    oauth: false,
    dbQuery: false,
    approvals: false,
    purchases: false,
  };

  try {
    // Step 1: OAuth token test
    results.oauth = await testOAuthToken();

    if (!results.oauth) {
      throw new Error("OAuth token request failed");
    }

    // Step 2: load and decrypt the card from the DB
    const { card, credentials } = await getTestCardFromDB();
    results.dbQuery = true;

    // Step 3: approval history
    results.approvals = await testCardApprovals(card, credentials);

    // Step 4: purchase history
    results.purchases = await testCardPurchases(card, credentials);
  } catch (error) {
    console.error("\n❌ Error during test:", error);
  } finally {
    await prisma.$disconnect();
  }

  // Result summary
  console.log("\n================================================");
  console.log("   Test result summary");
  console.log("================================================");
  console.log(`OAuth token:      ${results.oauth ? "✅ Passed" : "❌ Failed"}`);
  console.log(
    `DB card lookup:   ${results.dbQuery ? "✅ Passed" : "❌ Failed"}`
  );
  console.log(
    `Approval history: ${results.approvals ? "✅ Passed" : "❌ Failed"}`
  );
  console.log(
    `Purchase history: ${results.purchases ? "✅ Passed" : "❌ Failed"}`
  );
  console.log("================================================\n");
}

main().catch(console.error);
