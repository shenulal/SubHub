/**
 * Registers a test corporate card in the DB
 * Run: npx tsx src/lib/services/hyphen/seed-test-card.ts
 *
 * Prerequisites: set the following environment variables in .env.local
 * - TEST_CARD_CD: card company code (e.g. 010)
 * - TEST_CARD_NO: card number
 * - TEST_CARD_NM: card name (optional)
 * - TEST_CARD_USER_ID: card company login ID
 * - TEST_CARD_USER_PW: card company login password
 * - TEST_CARD_BIZ_NO: business registration number
 * - ENCRYPTION_KEY: encryption key (32 characters)
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { encryptJson, getCardLast4, maskCardNumber } from "@/lib/crypto";
import { PrismaClient } from "@prisma/client";
import type { CardCredentials } from "./types";

const prisma = new PrismaClient();

function getTestCardConfig() {
  const cardCd = process.env.TEST_CARD_CD;
  const cardNo = process.env.TEST_CARD_NO;
  const cardNm = process.env.TEST_CARD_NM || "Test Card";
  const userId = process.env.TEST_CARD_USER_ID;
  const userPw = process.env.TEST_CARD_USER_PW;
  const bizNo = process.env.TEST_CARD_BIZ_NO;

  // Check required environment variables
  const missing: string[] = [];
  if (!cardCd) missing.push("TEST_CARD_CD");
  if (!cardNo) missing.push("TEST_CARD_NO");
  if (!userId) missing.push("TEST_CARD_USER_ID");
  if (!userPw) missing.push("TEST_CARD_USER_PW");
  if (!bizNo) missing.push("TEST_CARD_BIZ_NO");

  if (missing.length > 0) {
    throw new Error(
      `Required environment variables are not set: ${missing.join(", ")}\n` +
        `Add the following environment variables to .env.local:\n` +
        `TEST_CARD_CD=010\n` +
        `TEST_CARD_NO=<card number>\n` +
        `TEST_CARD_USER_ID=<card company ID>\n` +
        `TEST_CARD_USER_PW=<card company password>\n` +
        `TEST_CARD_BIZ_NO=<business registration number>`
    );
  }

  return {
    cardCd: cardCd!,
    cardNo: cardNo!,
    cardNm,
    credentials: {
      loginMethod: "ID" as const,
      userId: userId!,
      userPw: userPw!,
      signPw: userPw!, // signPw is set to the same value as userPw
      bizNo: bizNo!,
      cardNo: cardNo!, // The original card number is also stored encrypted
    },
  };
}

async function seedTestCard() {
  console.log("========================================");
  console.log("  Register test corporate card in DB");
  console.log("========================================\n");

  try {
    // Check environment variables
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY environment variable is not set.");
    }

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }

    // Load card details from environment variables
    const testCard = getTestCardConfig();

    console.log(`Card company code: ${testCard.cardCd}`);
    console.log(`Card number: ${maskCardNumber(testCard.cardNo)}`);
    console.log(`Card name: ${testCard.cardNm}`);
    console.log(`User ID: ${testCard.credentials.userId}`);
    console.log(
      `Business registration number: ${testCard.credentials.bizNo}\n`
    );

    // Find the test organization (create it if missing)
    let organization = await prisma.organization.findFirst({
      where: { name: "Test Organization" },
    });

    if (!organization) {
      console.log("Creating test organization...");
      organization = await prisma.organization.create({
        data: {
          name: "Test Organization",
        },
      });
      console.log(`✅ Test organization created: ${organization.id}\n`);
    } else {
      console.log(`ℹ️ Using existing test organization: ${organization.id}\n`);
    }

    // Check for duplicates
    const maskedCardNo = maskCardNumber(testCard.cardNo);
    const existingCard = await prisma.corporateCard.findFirst({
      where: {
        organizationId: organization.id,
        cardNo: maskedCardNo,
      },
    });

    if (existingCard) {
      console.log("ℹ️ Card already registered. Updating...\n");

      // Encrypt credentials
      const encryptedCredentials = encryptJson<CardCredentials>(
        testCard.credentials
      );

      // Update
      await prisma.corporateCard.update({
        where: { id: existingCard.id },
        data: {
          encryptedCredentials,
          isActive: true,
          lastError: null,
        },
      });

      console.log("✅ Card details updated");
      console.log(`   Card ID: ${existingCard.id}`);
      console.log(`   Card number: ${maskedCardNo}`);
      return existingCard.id;
    }

    // Encrypt credentials
    console.log("Encrypting credentials...");
    const encryptedCredentials = encryptJson<CardCredentials>(
      testCard.credentials
    );
    console.log(
      `✅ Encryption complete (length: ${encryptedCredentials.length} characters)\n`
    );

    // Register the card
    console.log("Registering card in DB...");
    const card = await prisma.corporateCard.create({
      data: {
        organizationId: organization.id,
        cardCd: testCard.cardCd,
        cardNo: maskedCardNo,
        cardLast4: getCardLast4(testCard.cardNo),
        cardNm: testCard.cardNm,
        loginMethod: testCard.credentials.loginMethod,
        encryptedCredentials,
        bizNo: testCard.credentials.bizNo,
        isActive: true,
      },
    });

    console.log("\n========================================");
    console.log("  ✅ Card registered");
    console.log("========================================");
    console.log(`Card ID: ${card.id}`);
    console.log(`Organization ID: ${organization.id}`);
    console.log(`Card number: ${card.cardNo}`);
    console.log(`Card name: ${card.cardNm}`);
    console.log(`Last 4 digits: ${card.cardLast4}`);
    console.log("========================================\n");

    return card.id;
  } catch (error) {
    console.error("\n❌ Card registration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
seedTestCard()
  .then(() => {
    console.log(`\nRun the test with the following command:`);
    console.log(`npx tsx src/lib/services/hyphen/test-api.ts\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
