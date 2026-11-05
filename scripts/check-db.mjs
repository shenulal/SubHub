import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
  const paymentCount = await prisma.paymentRecord.count();
  const cardCount = await prisma.corporateCard.count();
  const transactionCount = await prisma.cardTransaction.count();

  console.log("=== Database overview ===");
  console.log("PaymentRecord (payments):", paymentCount, "records");
  console.log("CorporateCard (corporate cards):", cardCount, "records");
  console.log("CardTransaction (card transactions):", transactionCount, "records");

  if (cardCount > 0) {
    const cards = await prisma.corporateCard.findMany({
      select: { id: true, cardName: true, lastSyncAt: true }
    });
    console.log("\n=== Registered cards ===");
    cards.forEach(c => {
      console.log(`- ${c.cardName} (lastSync: ${c.lastSyncAt || 'never'})`);
    });
  }

  if (transactionCount > 0) {
    console.log("\n=== Latest 5 card transactions ===");
    const transactions = await prisma.cardTransaction.findMany({
      take: 5,
      orderBy: { transactionDate: "desc" },
      select: { merchantName: true, amount: true, transactionDate: true }
    });
    transactions.forEach(t => {
      console.log(`- ${t.merchantName}: ${t.amount} (${t.transactionDate.toISOString().split('T')[0]})`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
