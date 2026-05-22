/**
 * Žrebovanie – pity timer (streak_of_loss × 1.5^n), osudie podľa virtual_points.
 * Zrkadlo logiky z utils/drawBasket.ts pre admin / prehliadač.
 */
(function (root) {
  const DRAW_CONFIG = {
    winnerCount: 100,
    mainCount: 3,
    smallCount: 97,
    pityBase: 1.5,
    revenueSplit: { owner: 0.45, first: 0.15, second: 0.1, third: 0.06, small: 0.24 },
    manualPoolSplit: { first: 15 / 55, second: 10 / 55, third: 6 / 55, small: 24 / 55 },
  };

  function computeVirtualPoints(monthly_points, streak_of_loss) {
    if (monthly_points <= 0) return 0;
    if (streak_of_loss <= 0) return monthly_points;
    return monthly_points * Math.pow(DRAW_CONFIG.pityBase, streak_of_loss);
  }

  function basketTicketCount(monthly_points, streak_of_loss) {
    return Math.round(computeVirtualPoints(monthly_points, streak_of_loss));
  }

  function buildDrawBasket(participants) {
    const basket = [];
    for (const p of participants) {
      const n = basketTicketCount(p.monthly_points, p.streak_of_loss ?? 0);
      for (let i = 0; i < n; i++) basket.push(p.userId);
    }
    return basket;
  }

  function removeUserFromBasket(basket, userId) {
    for (let i = basket.length - 1; i >= 0; i--) {
      if (basket[i] === userId) basket.splice(i, 1);
    }
  }

  function drawUniqueWinnersFromBasket(basket, count, rng) {
    const random = rng || Math.random;
    const pool = basket.slice();
    const winners = [];
    const won = new Set();

    while (winners.length < count && pool.length > 0) {
      const idx = Math.floor(random() * pool.length);
      const userId = pool[idx];
      if (!won.has(userId)) {
        won.add(userId);
        winners.push(userId);
      }
      removeUserFromBasket(pool, userId);
    }
    return winners;
  }

  function calculatePrizeAmounts(options) {
    const manualPrizePool = options.manualPrizePool;
    const payingUsers = options.payingUsers ?? 0;
    const priceMonthly = options.priceMonthly ?? 4.99;
    const { revenueSplit, manualPoolSplit, smallCount } = DRAW_CONFIG;

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
        poolAmount: pool,
        mainCount: DRAW_CONFIG.mainCount,
        smallCount: DRAW_CONFIG.smallCount,
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
      poolAmount: revenue * (1 - revenueSplit.owner),
      mainCount: DRAW_CONFIG.mainCount,
      smallCount: DRAW_CONFIG.smallCount,
    };
  }

  /** @deprecated použite calculatePrizeAmounts */
  function calculatePrizesFromPool(poolEur) {
    return calculatePrizeAmounts({ manualPrizePool: poolEur });
  }

  function computeStreakUpdates(participants, winnerIds) {
    const winnerSet = new Set(winnerIds);
    return participants.map((p) => {
      const played = p.monthly_points >= 1;
      const won = winnerSet.has(p.userId);
      let streak_of_loss = p.streak_of_loss ?? 0;
      if (won) streak_of_loss = 0;
      else if (played) streak_of_loss = (p.streak_of_loss ?? 0) + 1;
      return { userId: p.userId, streak_of_loss, won, played };
    });
  }

  /**
   * @param {object[]} participants – { userId, nick?, monthly_points, streak_of_loss }
   */
  function runMonthlyDraw(participants, monthKey, manualPrizePool, options) {
    const opts = options || {};
    const active = participants
      .map((p) => ({
        userId: p.userId,
        nick: p.nick,
        monthly_points: p.monthly_points ?? p.tickets ?? 0,
        streak_of_loss: p.streak_of_loss ?? 0,
      }))
      .filter((p) => p.monthly_points > 0);

    const prizes = calculatePrizeAmounts({
      manualPrizePool: manualPrizePool,
      payingUsers: opts.payingUsers,
      priceMonthly: opts.priceMonthly,
    });

    const basket = buildDrawBasket(active);
    const byId = new Map(active.map((p) => [p.userId, p]));
    const uniquePlayers = active.length;
    const drawCount = Math.min(DRAW_CONFIG.winnerCount, uniquePlayers);
    const winnerIds = drawUniqueWinnersFromBasket(basket, drawCount, opts.rng);

    const mainPrizes = [prizes.firstPrize, prizes.secondPrize, prizes.thirdPrize];
    const winners = winnerIds.map((userId, i) => {
      const p = byId.get(userId);
      const vp = computeVirtualPoints(p.monthly_points, p.streak_of_loss);
      const place = i + 1;
      const type = place <= DRAW_CONFIG.mainCount ? "main" : "small";
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

    return {
      monthKey,
      prizes,
      basketSize: basket.length,
      poolTicketCount: basket.length,
      participantCount: uniquePlayers,
      winners,
      main,
      small,
      streakUpdates,
      warning:
        uniquePlayers < DRAW_CONFIG.winnerCount
          ? `V koši je len ${uniquePlayers} hráčov s bodmi; v produkcii potrebujete aspoň ${DRAW_CONFIG.winnerCount}.`
          : null,
    };
  }

  const api = {
    DRAW_CONFIG,
    computeVirtualPoints,
    basketTicketCount,
    buildDrawBasket,
    drawUniqueWinnersFromBasket,
    calculatePrizeAmounts,
    calculatePrizesFromPool,
    computeStreakUpdates,
    runMonthlyDraw,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ChodzaDraw = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
