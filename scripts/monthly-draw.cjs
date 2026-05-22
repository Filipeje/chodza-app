/**
 * Žrebovanie na konci mesiaca – pity timer + 100 výhercov.
 * Spustenie: node scripts/monthly-draw.cjs --month=2026-05 --pool=2500
 */

const draw = require("./draw-core.js");

const PRICE_MONTHLY = 4.99;

const mockParticipants = [
  { userId: "majo", nick: "Majo", monthly_points: 10, streak_of_loss: 2 },
  { userId: "u-001", nick: "ChodecPro_SK", monthly_points: 8, streak_of_loss: 0 },
  { userId: "u-002", nick: "Krokomerista", monthly_points: 15, streak_of_loss: 1 },
  { userId: "u-003", nick: "SynkoWalk", monthly_points: 5, streak_of_loss: 0 },
  { userId: "u-004", nick: "MaratonMan", monthly_points: 12, streak_of_loss: 3 },
];

function main() {
  const month = process.argv.find((a) => a.startsWith("--month="))?.split("=")[1];
  const poolArg = process.argv.find((a) => a.startsWith("--pool="))?.split("=")[1];
  const payingArg = process.argv.find((a) => a.startsWith("--paying="))?.split("=")[1];

  const manualPool = poolArg ? Number(poolArg) : null;
  const payingUsers = payingArg ? Number(payingArg) : 0;

  console.log(`Žrebovanie${month ? ` za ${month}` : ""}…\n`);

  const vp = draw.computeVirtualPoints(10, 2);
  console.log("Pity timer – Majo: 10 bodov, streak 2");
  console.log(`  virtual_points = 10 × 1.5² = ${vp}`);
  console.log(`  lístkov v osudí = ${draw.basketTicketCount(10, 2)}\n`);

  const prizes = draw.calculatePrizeAmounts({
    manualPrizePool: manualPool,
    payingUsers: manualPool ? 0 : payingUsers || 1000,
    priceMonthly: PRICE_MONTHLY,
  });

  console.log("--- Výšky cien ---");
  if (prizes.source === "manual") {
    console.log(`Manuálny kôš: ${prizes.manualPool.toFixed(2)} €`);
  } else {
    console.log(`Tržby: ${prizes.revenue.toFixed(2)} € (prevádzka 45 %: ${prizes.ownerAmount.toFixed(2)} €)`);
  }
  console.log(`1. cena: ${prizes.firstPrize.toFixed(2)} €`);
  console.log(`2. cena: ${prizes.secondPrize.toFixed(2)} €`);
  console.log(`3. cena: ${prizes.thirdPrize.toFixed(2)} €`);
  console.log(`Malá cena (×97): ${prizes.smallPrizeEach.toFixed(2)} € / osoba`);

  const result = draw.runMonthlyDraw(mockParticipants, month, manualPool, {
    payingUsers: payingUsers || 1000,
    priceMonthly: PRICE_MONTHLY,
  });

  console.log(`\nOsudie: ${result.basketSize} lístkov`);

  console.log("\n--- Hlavné ceny ---");
  result.main.forEach((w) => {
    console.log(
      `  ${w.place}. @${w.nick} – ${w.prizeEur.toFixed(2)} € (virtual ${w.virtual_points}, streak ${w.streak_of_loss})`
    );
  });

  console.log(`\n--- Menšie ceny (${result.small.length} z 97) ---`);
  result.small.slice(0, 5).forEach((w, i) => {
    console.log(`  ${i + 1}. @${w.nick} – ${w.prizeEur.toFixed(2)} €`);
  });
  if (result.small.length > 5) console.log(`  … + ${result.small.length - 5} ďalších`);

  console.log("\n--- Streak po žrebovaní ---");
  result.streakUpdates.forEach((u) => {
    const p = mockParticipants.find((x) => x.userId === u.userId);
    if (u.won) console.log(`  ${p?.nick}: streak → 0 (vyhral)`);
    else if (u.played) console.log(`  ${p?.nick}: streak → ${u.streak_of_loss}`);
  });

  if (result.warning) console.log(`\n${result.warning}`);
}

main();
