/**
 * Balíky predplatného: free, plus (4,99 €), premium (7,99 €)
 */
(function (root) {
  const PLANS = {
    free: {
      id: "free",
      priceEur: 0,
      pointsMultiplier: 1,
      eligibleForDraw: false,
      pityBase: 1.5,
      theme: "free",
    },
    plus: {
      id: "plus",
      priceEur: 4.99,
      pointsMultiplier: 1,
      eligibleForDraw: true,
      pityBase: 1.5,
      theme: "plus",
    },
    premium: {
      id: "premium",
      priceEur: 7.99,
      pointsMultiplier: 2,
      eligibleForDraw: true,
      pityBase: 1.5,
      theme: "premium",
    },
  };

  function getPlan(planId) {
    return PLANS[planId] || PLANS.free;
  }

  function normalizePlan(planId) {
    if (planId === "plus" || planId === "premium" || planId === "free") return planId;
    // migrácia starých názvov
    if (planId === "basic") return "plus";
    return "free";
  }

  function isPayingPlan(planId) {
    const p = normalizePlan(planId);
    return p === "plus" || p === "premium";
  }

  function isDrawEligible(planId) {
    return getPlan(normalizePlan(planId)).eligibleForDraw;
  }

  function getPointsMultiplier(planId) {
    return getPlan(normalizePlan(planId)).pointsMultiplier;
  }

  function getMaxPointsForPlan(baseMax, planId) {
    return baseMax * getPointsMultiplier(planId);
  }

  function computePointsForKm(km, goalKm, baseMaxPerDay, planId) {
    const step = goalKm;
    if (!step || step <= 0) return 0;
    const mult = getPointsMultiplier(planId);
    const maxPts = getMaxPointsForPlan(baseMaxPerDay, planId);
    const raw = Math.floor(km / step) * mult;
    return Math.min(maxPts, raw);
  }

  function countPayingUsers(users) {
    let plus = 0;
    let premium = 0;
    for (const u of users) {
      const plan = normalizePlan(
        u.subscriptionPlan ||
          (u.status_predplatneho === "premium" ? "premium" : u.status_predplatneho === "plus" ? "premium" : "free")
      );
      if (plan === "plus") plus += 1;
      else if (plan === "premium") premium += 1;
    }
    return { plus, premium, total: plus + premium };
  }

  function monthlyRevenueFromUsers(users) {
    const { plus, premium } = countPayingUsers(users);
    return plus * PLANS.plus.priceEur + premium * PLANS.premium.priceEur;
  }

  root.ChodzaPlans = {
    PLANS,
    getPlan,
    normalizePlan,
    isPayingPlan,
    isDrawEligible,
    getPointsMultiplier,
    getMaxPointsForPlan,
    computePointsForKm,
    countPayingUsers,
    monthlyRevenueFromUsers,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
