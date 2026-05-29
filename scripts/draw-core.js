/**
 * Žrebovanie z osudia + TOP makači (km) + rozdelenie odmien (percent / manuál).
 */
(function (root) {
  const DRAW_CONFIG = {
    winnerCount: 100,
    mainCount: 3,
    smallCount: 97,
    pityBase: 1.5,
  };

  const PRIZE_PERCENT = {
    owner: 0.45,
    drawFirst: 0.15,
    drawSecond: 0.1,
    drawThird: 0.06,
    walkersPool: 0.04,
    smallPool: 0.2,
  };

  const WALKER_SHARE = { 1: 0.5, 2: 0.3, 3: 0.2 };

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

  function normalizeSettings(settings) {
    const s = settings || {};
    const prizeMode = s.prizeMode === "manual" ? "manual" : "percent";
    const mp = s.manualPrizes || {};
    return {
      prizeMode,
      totalFundEur: Number(s.totalFundEur ?? s.prizePoolEur ?? 0) || 0,
      manualPrizes: {
        drawFirst: Number(mp.drawFirst) || 0,
        drawSecond: Number(mp.drawSecond) || 0,
        drawThird: Number(mp.drawThird) || 0,
        smallEach: Number(mp.smallEach) || 0,
        walkerFirst: Number(mp.walkerFirst) || 0,
        walkerSecond: Number(mp.walkerSecond) || 0,
        walkerThird: Number(mp.walkerThird) || 0,
      },
    };
  }

  function calculatePrizesFromPercent(totalFund) {
    const fund = Math.max(0, Number(totalFund) || 0);
    const walkersPool = fund * PRIZE_PERCENT.walkersPool;
    return {
      source: "percent",
      prizeMode: "percent",
      totalFundEur: fund,
      ownerAmount: fund * PRIZE_PERCENT.owner,
      drawFirst: fund * PRIZE_PERCENT.drawFirst,
      drawSecond: fund * PRIZE_PERCENT.drawSecond,
      drawThird: fund * PRIZE_PERCENT.drawThird,
      smallEach: fund > 0 ? (fund * PRIZE_PERCENT.smallPool) / DRAW_CONFIG.smallCount : 0,
      walkerFirst: walkersPool * WALKER_SHARE[1],
      walkerSecond: walkersPool * WALKER_SHARE[2],
      walkerThird: walkersPool * WALKER_SHARE[3],
      walkersPool,
      reserveAmount: 0,
      smallCount: DRAW_CONFIG.smallCount,
    };
  }

  function calculatePrizesFromManual(mp) {
    const smallTotal = (Number(mp.smallEach) || 0) * DRAW_CONFIG.smallCount;
    const prizesPaid =
      (Number(mp.drawFirst) || 0) +
      (Number(mp.drawSecond) || 0) +
      (Number(mp.drawThird) || 0) +
      smallTotal +
      (Number(mp.walkerFirst) || 0) +
      (Number(mp.walkerSecond) || 0) +
      (Number(mp.walkerThird) || 0);
    return {
      source: "manual",
      prizeMode: "manual",
      totalFundEur: prizesPaid,
      ownerAmount: 0,
      drawFirst: Number(mp.drawFirst) || 0,
      drawSecond: Number(mp.drawSecond) || 0,
      drawThird: Number(mp.drawThird) || 0,
      smallEach: Number(mp.smallEach) || 0,
      walkerFirst: Number(mp.walkerFirst) || 0,
      walkerSecond: Number(mp.walkerSecond) || 0,
      walkerThird: Number(mp.walkerThird) || 0,
      walkersPool:
        (Number(mp.walkerFirst) || 0) +
        (Number(mp.walkerSecond) || 0) +
        (Number(mp.walkerThird) || 0),
      reserveAmount: 0,
      smallCount: DRAW_CONFIG.smallCount,
    };
  }

  /** @param {function} [getUserPlan] (user) => 'free'|'plus'|'premium' */
  function resolvePrizeConfig(settings, users, getUserPlan) {
    const norm = normalizeSettings(settings);
    if (norm.prizeMode === "manual") {
      return calculatePrizesFromManual(norm.manualPrizes);
    }
    if (norm.totalFundEur > 0) {
      return calculatePrizesFromPercent(norm.totalFundEur);
    }
    let revenue = 0;
    if (users && typeof root.ChodzaPlans !== "undefined") {
      revenue = root.ChodzaPlans.monthlyRevenueFromUsers(users);
    }
    if (revenue > 0) {
      return calculatePrizesFromPercent(revenue);
    }
    return calculatePrizesFromPercent(0);
  }

  function sumUserKmForMonth(user, monthKey) {
    const prefix = monthKey + "-";
    return (user.dailyWalks || [])
      .filter((d) => String(d.datum || "").startsWith(prefix))
      .reduce((s, d) => s + (Number(d.kilometre) || 0), 0);
  }

  function rankTopWalkers(users, monthKey, prizes, getUserPlan) {
    const planFn =
      getUserPlan ||
      ((u) =>
        u.subscriptionPlan === "premium" || u.subscriptionPlan === "plus"
          ? u.subscriptionPlan
          : u.status_predplatneho === "premium"
            ? "premium"
            : "free");

    const amounts = [prizes.walkerFirst, prizes.walkerSecond, prizes.walkerThird];
    const ranked = (users || [])
      .map((u) => ({
        userId: u.id,
        nick: u.meno || u.username || u.email,
        km: Math.round(sumUserKmForMonth(u, monthKey) * 10) / 10,
        plan: planFn(u),
      }))
      .filter((x) => x.km > 0)
      .sort((a, b) => b.km - a.km)
      .slice(0, 3);

    let reserveAmount = 0;
    const walkers = ranked.map((r, i) => {
      const place = i + 1;
      const cashAmount = amounts[i] ?? 0;
      if (r.plan === "free") {
        reserveAmount += cashAmount;
        return {
          userId: r.userId,
          nick: r.nick,
          km: r.km,
          place,
          plan: r.plan,
          prizeEur: 0,
          prizeType: "premium_month",
          prizeLabel: "PREMIUM členstvo na ďalší mesiac zadarmo",
          forfeitedEur: cashAmount,
        };
      }
      return {
        userId: r.userId,
        nick: r.nick,
        km: r.km,
        place,
        plan: r.plan,
        prizeEur: cashAmount,
        prizeType: "cash",
        prizeLabel: null,
        forfeitedEur: 0,
      };
    });

    return { walkers, reserveAmount };
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

  function runMonthlyDraw(participants, monthKey, prizes, options) {
    const opts = options || {};
    const active = participants
      .map((p) => ({
        userId: p.userId,
        nick: p.nick,
        monthly_points: p.monthly_points ?? p.tickets ?? 0,
        streak_of_loss: p.streak_of_loss ?? 0,
      }))
      .filter((p) => p.monthly_points > 0);

    const mainPrizes = [prizes.drawFirst, prizes.drawSecond, prizes.drawThird];
    const basket = buildDrawBasket(active);
    const byId = new Map(active.map((p) => [p.userId, p]));
    const uniquePlayers = active.length;
    const drawCount = Math.min(DRAW_CONFIG.winnerCount, uniquePlayers);
    const winnerIds = drawUniqueWinnersFromBasket(basket, drawCount, opts.rng);

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
        prizeEur: type === "main" ? mainPrizes[place - 1] : prizes.smallEach,
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

  /** Kompletné uzatvorenie mesiaca: osudie + makači */
  function runMonthlyClose(params) {
    const { participants, allUsers, monthKey, settings, getUserPlan, options } = params;
    const prizes = resolvePrizeConfig(settings, allUsers, getUserPlan);
    const walkerResult = rankTopWalkers(allUsers, monthKey, prizes, getUserPlan);
    prizes.reserveAmount = (prizes.reserveAmount || 0) + walkerResult.reserveAmount;
    prizes.ownerAmount = (prizes.ownerAmount || 0) + walkerResult.reserveAmount;

    const draw = runMonthlyDraw(participants, monthKey, prizes, options);

    return {
      draw,
      walkers: walkerResult.walkers,
      prizes,
      prizeMode: normalizeSettings(settings).prizeMode,
    };
  }

  /** @deprecated – starý výpočet z tržieb */
  function calculatePrizeAmounts(options) {
    const total =
      options.manualPrizePool != null && options.manualPrizePool > 0
        ? options.manualPrizePool
        : options.revenue != null
          ? options.revenue
          : (options.payingUsers ?? 0) * (options.priceMonthly ?? 4.99);
    const p = calculatePrizesFromPercent(total);
    return {
      source: p.source,
      revenue: total,
      ownerAmount: p.ownerAmount,
      firstPrize: p.drawFirst,
      secondPrize: p.drawSecond,
      thirdPrize: p.drawThird,
      smallPrizeEach: p.smallEach,
      poolAmount: total - p.ownerAmount,
      mainCount: DRAW_CONFIG.mainCount,
      smallCount: DRAW_CONFIG.smallCount,
    };
  }

  const api = {
    DRAW_CONFIG,
    PRIZE_PERCENT,
    WALKER_SHARE,
    computeVirtualPoints,
    basketTicketCount,
    buildDrawBasket,
    drawUniqueWinnersFromBasket,
    normalizeSettings,
    calculatePrizesFromPercent,
    calculatePrizesFromManual,
    resolvePrizeConfig,
    sumUserKmForMonth,
    rankTopWalkers,
    computeStreakUpdates,
    runMonthlyDraw,
    runMonthlyClose,
    calculatePrizeAmounts,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ChodzaDraw = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
