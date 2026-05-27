/**
 * Balíky predplatného: free, basic (4,99 €), plus (7,99 €)
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
    basic: {
      id: "basic",
      priceEur: 4.99,
      pointsMultiplier: 1,
      eligibleForDraw: true,
      pityBase: 1.5,
      theme: "basic",
    },
    plus: {
      id: "plus",
      priceEur: 7.99,
      pointsMultiplier: 2,
      eligibleForDraw: true,
      pityBase: 1.5,
      theme: "plus",
    },
  };

  function getPlan(planId) {
    return PLANS[planId] || PLANS.free;
  }

  function normalizePlan(planId) {
    if (planId === "basic" || planId === "plus" || planId === "free") return planId;
    if (planId === "premium") return "basic";
    return "free";
  }

  function isPayingPlan(planId) {
    const p = normalizePlan(planId);
    return p === "basic" || p === "plus";
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
    let basic = 0;
    let plus = 0;
    for (const u of users) {
      const plan = normalizePlan(u.subscriptionPlan || (u.status_predplatneho === "premium" ? "basic" : "free"));
      if (plan === "basic") basic += 1;
      else if (plan === "plus") plus += 1;
    }
    return { basic, plus, total: basic + plus };
  }

  function monthlyRevenueFromUsers(users) {
    const { basic, plus } = countPayingUsers(users);
    return basic * PLANS.basic.priceEur + plus * PLANS.plus.priceEur;
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
