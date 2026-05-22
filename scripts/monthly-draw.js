/**
 * Žrebovanie na konci mesiaca: 3 hlavné + 70 menších cien.
 * Výšky cien sa počítajú z počtu platiacich × cena predplatného (podiely nie sú v appke zobrazené).
 *
 * Spustenie: node scripts/monthly-draw.js --month=2026-05 --paying=1000
 */

const PRICE_MONTHLY = 3.99;
const OWNER_SHARE = 0.45;
const PRIZE_POOL_SHARE = 0.55;
const MAIN_COUNT = 3;
const SMALL_COUNT = 70;
const POOL_SPLIT = { first: 0.25, second: 0.15, third: 0.1, small: 0.5 };

/** @type {{ userId: string, nick: string, tickets: number }[]} */
const mockTickets = [
  { userId: "u-001", nick: "ChodecPro_SK", tickets: 3 },
  { userId: "u-002", nick: "Krokomerista", tickets: 1 },
  { userId: "u-003", nick: "SynkoWalk", tickets: 5 },
  { userId: "u-004", nick: "MaratonMan", tickets: 2 },
  { userId: "u-005", nick: "VečernáPrechádzka", tickets: 1 },
  { userId: "u-006", nick: "FitJuraj", tickets: 4 },
];

function calculatePrizeBreakdown(payingUsers, priceMonthly = PRICE_MONTHLY) {
  const revenue = payingUsers * priceMonthly;
  const ownerAmount = revenue * OWNER_SHARE;
  const poolAmount = revenue * PRIZE_POOL_SHARE;
  const firstPrize = poolAmount * POOL_SPLIT.first;
  const secondPrize = poolAmount * POOL_SPLIT.second;
  const thirdPrize = poolAmount * POOL_SPLIT.third;
  const smallPrizeEach = (poolAmount * POOL_SPLIT.small) / SMALL_COUNT;

  return {
    revenue,
    ownerAmount,
    poolAmount,
    firstPrize,
    secondPrize,
    thirdPrize,
    smallPrizeEach,
  };
}

function buildPool(rows) {
  const pool = [];
  for (const row of rows) {
    for (let i = 0; i < row.tickets; i++) {
      pool.push(row);
    }
  }
  return pool;
}

function drawUniqueFromPool(pool, count) {
  if (pool.length === 0) return [];
  const winners = [];
  const usedIds = new Set();
  let guard = 0;
  while (winners.length < count && guard < pool.length * 50) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!usedIds.has(pick.userId)) {
      usedIds.add(pick.userId);
      winners.push(pick);
    }
    guard++;
  }
  return winners;
}

function main() {
  const month = process.argv.find((a) => a.startsWith("--month="))?.split("=")[1];
  const payingArg = process.argv.find((a) => a.startsWith("--paying="))?.split("=")[1];
  const payingUsers = payingArg ? Number(payingArg) : 1000;

  console.log(`Žrebovanie${month ? ` za ${month}` : ""}…`);
  console.log(`Platiaci predplatitelia: ${payingUsers}`);

  const prizes = calculatePrizeBreakdown(payingUsers);
  console.log("\n--- Výšky cien (interný výpočet) ---");
  console.log(`Fond na výhry: ${prizes.poolAmount.toFixed(2)} €`);
  console.log(`1. cena: ${prizes.firstPrize.toFixed(2)} €`);
  console.log(`2. cena: ${prizes.secondPrize.toFixed(2)} €`);
  console.log(`3. cena: ${prizes.thirdPrize.toFixed(2)} €`);
  console.log(`Menšia cena (×${SMALL_COUNT}): ${prizes.smallPrizeEach.toFixed(2)} € / osoba`);

  const pool = buildPool(mockTickets);
  console.log(`\nBodov v mesačnom koši: ${pool.length}`);

  const totalNeeded = MAIN_COUNT + SMALL_COUNT;
  const allWinners = drawUniqueFromPool(pool, Math.min(totalNeeded, new Set(pool.map((p) => p.userId)).size));

  const main = allWinners.slice(0, MAIN_COUNT);
  const small = allWinners.slice(MAIN_COUNT, MAIN_COUNT + SMALL_COUNT);

  console.log("\n--- Hlavné ceny ---");
  main.forEach((w, i) => {
    const amounts = [prizes.firstPrize, prizes.secondPrize, prizes.thirdPrize];
    console.log(`  ${i + 1}. @${w.nick} (${w.userId}) – ${amounts[i].toFixed(2)} €`);
  });

  console.log(`\n--- Menšie ceny (${small.length} z ${SMALL_COUNT}) ---`);
  small.forEach((w, i) => {
    console.log(`  ${i + 1}. @${w.nick} – ${prizes.smallPrizeEach.toFixed(2)} €`);
  });

  if (small.length < SMALL_COUNT) {
    console.log(
      `\nUpozornenie: v demo je málo unikátnych hráčov; v produkcii potrebujete aspoň ${SMALL_COUNT + MAIN_COUNT} rôznych účastníkov s bodmi v koši.`
    );
  }
}

main();
