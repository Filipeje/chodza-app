/**
 * Žrebovanie – skrytý pity timer (streak_of_loss × 1.5^n) a osudie podľa virtual_points.
 * 100 výhercov: 1. / 2. / 3. miesto + 97 ďalších. Jeden hráč max. 1 výhra / mesiac.
 */

export const DRAW_BASKET_CONFIG = {
  winnerCount: 100,
  mainCount: 3,
  smallCount: 97,
  pityBase: 1.5,
  /** Podiely z celkovej tržby (ak nie je manualPrizePool) */
  revenueSplit: {
    owner: 0.45,
    first: 0.15,
    second: 0.1,
    third: 0.06,
    small: 0.24,
  },
  /** Podiely z manuálneho mesačného koša (100 % sumy ide na výhry) */
  manualPoolSplit: {
    first: 15 / 55,
    second: 10 / 55,
    third: 6 / 55,
    small: 24 / 55,
  },
} as const;

export interface DrawParticipant {
  userId: string;
  nick?: string;
  monthly_points: number;
  streak_of_loss: number;
}

export interface PrizeAmounts {
  source: "manual" | "revenue";
  revenue?: number;
  manualPool?: number;
  ownerAmount: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  smallPrizeEach: number;
}

export interface DrawWinner {
  userId: string;
  nick?: string;
  place: number;
  type: "main" | "small";
  prizeEur: number;
  monthly_points: number;
  streak_of_loss: number;
  virtual_points: number;
  basketTickets: number;
}

export interface StreakUpdate {
  userId: string;
  streak_of_loss: number;
  won: boolean;
  played: boolean;
}

export interface DrawBasketResult {
  monthKey?: string;
  prizes: PrizeAmounts;
  basketSize: number;
  participantCount: number;
  winners: DrawWinner[];
  main: DrawWinner[];
  small: DrawWinner[];
  streakUpdates: StreakUpdate[];
  warning: string | null;
}

/** virtual_points = monthly_points × 1.5^streak (ak streak > 0), inak monthly_points */
export function computeVirtualPoints(monthly_points: number, streak_of_loss: number): number {
  if (monthly_points <= 0) return 0;
  if (streak_of_loss <= 0) return monthly_points;
  return monthly_points * Math.pow(DRAW_BASKET_CONFIG.pityBase, streak_of_loss);
}

/** Koľko ID-čiek ide do osudia (zaokrúhlené virtual_points) */
export function basketTicketCount(monthly_points: number, streak_of_loss: number): number {
  return Math.round(computeVirtualPoints(monthly_points, streak_of_loss));
}

/** Vytvorí pole userId – toľkokrát, koľko má zaokrúhlených virtual_points */
export function buildDrawBasket(participants: DrawParticipant[]): string[] {
  const basket: string[] = [];
  for (const p of participants) {
    const n = basketTicketCount(p.monthly_points, p.streak_of_loss);
    for (let i = 0; i < n; i++) {
      basket.push(p.userId);
    }
  }
  return basket;
}

function removeUserFromBasket(basket: string[], userId: string): void {
  for (let i = basket.length - 1; i >= 0; i--) {
    if (basket[i] === userId) basket.splice(i, 1);
  }
}

/**
 * Ťahá count unikátnych výhercov. Po vytiahnutí vymaže všetky zvyšné lístky daného hráča.
 */
export function drawUniqueWinnersFromBasket(
  basket: string[],
  count: number,
  rng: () => number = Math.random
): string[] {
  const pool = [...basket];
  const winners: string[] = [];
  const won = new Set<string>();

  while (winners.length < count && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    const userId = pool[idx];
    if (!won.has(userId)) {
      won.add(userId);
      winners.push(userId);
    }
    removeUserFromBasket(pool, userId);
  }

  return winners;
}

export function calculatePrizeAmounts(options: {
  manualPrizePool?: number | null;
  payingUsers?: number;
  priceMonthly?: number;
}): PrizeAmounts {
  const { manualPrizePool, payingUsers = 0, priceMonthly = 4.99 } = options;
  const { revenueSplit, manualPoolSplit, smallCount } = DRAW_BASKET_CONFIG;

  if (manualPrizePool != null && manualPrizePool > 0) {
    const pool = manualPrizePool;
    const smallTotal = pool * manualPoolSplit.small;
    return {
      source: "manual",
      manualPool: pool,
      ownerAmount: 0,
      firstPrize: pool * manualPoolSplit.first,
      secondPrize: pool * manualPoolSplit.second,
      thirdPrize: pool * manualPoolSplit.third,
      smallPrizeEach: smallTotal / smallCount,
    };
  }

  const revenue = payingUsers * priceMonthly;
  const smallTotal = revenue * revenueSplit.small;
  return {
    source: "revenue",
    revenue,
    ownerAmount: revenue * revenueSplit.owner,
    firstPrize: revenue * revenueSplit.first,
    secondPrize: revenue * revenueSplit.second,
    thirdPrize: revenue * revenueSplit.third,
    smallPrizeEach: smallTotal / smallCount,
  };
}

/** Simulácia DB: výhercovia streak=0, ostatní hráči s ≥1 bodom streak+1 */
export function computeStreakUpdates(
  participants: DrawParticipant[],
  winnerIds: string[]
): StreakUpdate[] {
  const winnerSet = new Set(winnerIds);
  return participants.map((p) => {
    const played = p.monthly_points >= 1;
    const won = winnerSet.has(p.userId);
    let streak_of_loss = p.streak_of_loss;
    if (won) {
      streak_of_loss = 0;
    } else if (played) {
      streak_of_loss = p.streak_of_loss + 1;
    }
    return { userId: p.userId, streak_of_loss, won, played };
  });
}

export function runDrawBasket(
  participants: DrawParticipant[],
  options: {
    monthKey?: string;
    manualPrizePool?: number | null;
    payingUsers?: number;
    priceMonthly?: number;
    rng?: () => number;
  } = {}
): DrawBasketResult {
  const { monthKey, manualPrizePool, payingUsers, priceMonthly, rng } = options;
  const { winnerCount, mainCount } = DRAW_BASKET_CONFIG;

  const active = participants.filter((p) => p.monthly_points > 0);
  const prizes = calculatePrizeAmounts({ manualPrizePool, payingUsers, priceMonthly });
  const basket = buildDrawBasket(active);
  const byId = new Map(active.map((p) => [p.userId, p]));

  const uniquePlayers = active.length;
  const drawCount = Math.min(winnerCount, uniquePlayers);
  const winnerIds = drawUniqueWinnersFromBasket(basket, drawCount, rng);

  const mainPrizes = [prizes.firstPrize, prizes.secondPrize, prizes.thirdPrize];
  const winners: DrawWinner[] = winnerIds.map((userId, i) => {
    const p = byId.get(userId)!;
    const vp = computeVirtualPoints(p.monthly_points, p.streak_of_loss);
    const place = i + 1;
    const type: "main" | "small" = place <= mainCount ? "main" : "small";
    return {
      userId,
      nick: p.nick,
      place,
      type,
      prizeEur: type === "main" ? mainPrizes[place - 1] : prizes.smallPrizeEach,
      monthly_points: p.monthly_points,
      streak_of_loss: p.streak_of_loss,
      virtual_points: vp,
      basketTickets: basketTicketCount(p.monthly_points, p.streak_of_loss),
    };
  });

  const main = winners.filter((w) => w.type === "main");
  const small = winners.filter((w) => w.type === "small");
  const streakUpdates = computeStreakUpdates(active, winnerIds);

  let warning: string | null = null;
  if (uniquePlayers < winnerCount) {
    warning = `V koši je len ${uniquePlayers} hráčov s bodmi; v produkcii potrebujete aspoň ${winnerCount}.`;
  }

  return {
    monthKey,
    prizes,
    basketSize: buildDrawBasket(active).length,
    participantCount: uniquePlayers,
    winners,
    main,
    small,
    streakUpdates,
    warning,
  };
}

// ---------------------------------------------------------------------------
// Simulácia (spustenie: npx tsx utils/drawBasket.ts)
// ---------------------------------------------------------------------------
function runBuiltInSimulation(): void {
  console.log("=== Skrytý filter (pity timer) – simulácia ===\n");

  const majo: DrawParticipant = {
    userId: "majo",
    nick: "Majo",
    monthly_points: 10,
    streak_of_loss: 2,
  };
  const vp = computeVirtualPoints(majo.monthly_points, majo.streak_of_loss);
  const tickets = basketTicketCount(majo.monthly_points, majo.streak_of_loss);

  console.log("Majo:");
  console.log(`  monthly_points     = ${majo.monthly_points}`);
  console.log(`  streak_of_loss     = ${majo.streak_of_loss} (2 mesiace bez výhry)`);
  console.log(
    `  virtual_points     = ${majo.monthly_points} × 1.5^${majo.streak_of_loss} = ${vp}`
  );
  console.log(`  lístkov v osudí    = round(${vp}) = ${tickets}\n`);

  const demoPlayers: DrawParticipant[] = [
    majo,
    { userId: "u-001", nick: "Ana", monthly_points: 8, streak_of_loss: 0 },
    { userId: "u-002", nick: "Boris", monthly_points: 15, streak_of_loss: 1 },
    { userId: "u-003", nick: "Cyril", monthly_points: 5, streak_of_loss: 3 },
    { userId: "u-004", nick: "Dana", monthly_points: 12, streak_of_loss: 0 },
  ];

  console.log("Virtuálne body pred žrebovaním:");
  for (const p of demoPlayers) {
    const v = computeVirtualPoints(p.monthly_points, p.streak_of_loss);
    console.log(
      `  ${p.nick}: ${p.monthly_points} bodov, streak ${p.streak_of_loss} → virtual ${v} → ${Math.round(v)} lístkov`
    );
  }

  const manualPool = 2500;
  const result = runDrawBasket(demoPlayers, {
    monthKey: "2026-05",
    manualPrizePool: manualPool,
    rng: () => 0.42,
  });

  console.log(`\nOsudie: ${result.basketSize} lístkov, ťahaných ${result.winners.length} výhercov`);
  console.log(
    `Ceny (manual ${manualPool} €): 1. ${result.prizes.firstPrize.toFixed(2)} €, 2. ${result.prizes.secondPrize.toFixed(2)} €, 3. ${result.prizes.thirdPrize.toFixed(2)} €, malé ${result.prizes.smallPrizeEach.toFixed(2)} €`
  );

  console.log("\nVýhercovia:");
  for (const w of result.winners) {
    console.log(
      `  ${w.place}. ${w.nick} – ${w.prizeEur.toFixed(2)} € (virtual ${w.virtual_points}, lístkov ${w.basketTickets})`
    );
  }

  console.log("\nAktualizácia streak_of_loss (simulácia DB):");
  for (const u of result.streakUpdates) {
    const p = demoPlayers.find((x) => x.userId === u.userId)!;
    const label = demoPlayers.find((x) => x.userId === u.userId)?.nick ?? u.userId;
    if (u.won) {
      console.log(`  ${label}: ${p.streak_of_loss} → 0 (vyhral)`);
    } else if (u.played) {
      console.log(`  ${label}: ${p.streak_of_loss} → ${u.streak_of_loss} (nevyhral, hral)`);
    } else {
      console.log(`  ${label}: bez zmeny (nehral)`);
    }
  }

  const revenueDemo = calculatePrizeAmounts({ payingUsers: 1000, priceMonthly: 4.99 });
  console.log("\nBez manual pool (1000 × 4,99 €):");
  console.log(`  Prevádzka 45 %: ${revenueDemo.ownerAmount.toFixed(2)} €`);
  console.log(
    `  1./2./3.: ${revenueDemo.firstPrize.toFixed(2)} / ${revenueDemo.secondPrize.toFixed(2)} / ${revenueDemo.thirdPrize.toFixed(2)} €`
  );
  console.log(`  97× malá cena: ${revenueDemo.smallPrizeEach.toFixed(2)} €`);
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  (process.argv[1].includes("drawBasket.ts") || process.argv[1].includes("drawBasket.js"));

if (isDirectRun) {
  runBuiltInSimulation();
}
