/**
 * Spoločná logika žrebovania (admin panel, neskôr aj server).
 * Skrytá prioritizácia: dlhšie bez výhry = vyššia váha v koši.
 */
(function (root) {
  const DRAW_CONFIG = {
    mainCount: 3,
    smallCount: 70,
    poolSplit: { first: 0.25, second: 0.15, third: 0.1, small: 0.5 },
  };

  function calculatePrizesFromPool(poolEur) {
    const { first, second, third, small } = DRAW_CONFIG.poolSplit;
    const poolAmount = Number(poolEur) || 0;
    const smallTotal = poolAmount * small;
    return {
      poolAmount,
      firstPrize: poolAmount * first,
      secondPrize: poolAmount * second,
      thirdPrize: poolAmount * third,
      smallPrizeEach: smallTotal / DRAW_CONFIG.smallCount,
      mainCount: DRAW_CONFIG.mainCount,
      smallCount: DRAW_CONFIG.smallCount,
    };
  }

  function monthDiff(fromKey, toKey) {
    const [fy, fm] = fromKey.split("-").map(Number);
    const [ty, tm] = toKey.split("-").map(Number);
    return (ty - fy) * 12 + (tm - fm);
  }

  function getWinPriorityWeight(winHistory, currentMonth) {
    if (!winHistory || !winHistory.length) return 3;
    const sorted = [...winHistory].sort((a, b) => b.month.localeCompare(a.month));
    const last = sorted[0];
    const monthsSince = monthDiff(last.month, currentMonth);
    if (last.type === "main" && monthsSince < 6) return 1;
    if (last.type === "small" && monthsSince < 3) return 1.25;
    if (monthsSince >= 12) return 2.5;
    if (monthsSince >= 6) return 2;
    return 1.5;
  }

  function buildWeightedPool(rows) {
    const pool = [];
    for (const row of rows) {
      const t = Math.max(0, Math.floor(row.tickets));
      const w = row.weight ?? 1;
      const entries = Math.max(1, Math.round(t * w));
      for (let i = 0; i < entries; i++) {
        pool.push({ userId: row.userId, nick: row.nick });
      }
    }
    return pool;
  }

  function drawUniqueFromPool(pool, count) {
    if (!pool.length || count <= 0) return [];
    const winners = [];
    const usedIds = new Set();
    let guard = 0;
    const maxGuard = Math.max(pool.length * 80, count * 100);
    while (winners.length < count && guard < maxGuard) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!usedIds.has(pick.userId)) {
        usedIds.add(pick.userId);
        winners.push(pick);
      }
      guard++;
    }
    return winners;
  }

  function runMonthlyDraw(participants, monthKey, poolEur) {
    const prizes = calculatePrizesFromPool(poolEur);
    const rows = participants
      .filter((p) => p.tickets > 0)
      .map((p) => ({
        userId: p.userId,
        nick: p.nick,
        tickets: p.tickets,
        weight: getWinPriorityWeight(p.winHistory, monthKey),
      }));

    const pool = buildWeightedPool(rows);
    const uniqueCount = new Set(pool.map((p) => p.userId)).size;
    const totalNeeded = DRAW_CONFIG.mainCount + DRAW_CONFIG.smallCount;
    const drawCount = Math.min(totalNeeded, uniqueCount);

    const all = drawUniqueFromPool(pool, drawCount);
    const main = all.slice(0, DRAW_CONFIG.mainCount).map((w, i) => ({
      ...w,
      place: i + 1,
      type: "main",
      prizeEur: [prizes.firstPrize, prizes.secondPrize, prizes.thirdPrize][i],
    }));
    const small = all.slice(DRAW_CONFIG.mainCount).map((w, i) => ({
      ...w,
      place: DRAW_CONFIG.mainCount + i + 1,
      type: "small",
      prizeEur: prizes.smallPrizeEach,
    }));

    return {
      monthKey,
      prizes,
      poolTicketCount: pool.length,
      participantCount: uniqueCount,
      main,
      small,
      warning:
        uniqueCount < totalNeeded
          ? `V koši je len ${uniqueCount} hráčov s bodmi; v produkcii potrebujete aspoň ${totalNeeded}.`
          : null,
    };
  }

  const api = {
    DRAW_CONFIG,
    calculatePrizesFromPool,
    getWinPriorityWeight,
    buildWeightedPool,
    drawUniqueFromPool,
    runMonthlyDraw,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ChodzaDraw = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
