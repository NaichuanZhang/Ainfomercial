/**
 * Deterministic mock data for the advertiser insights pages (/console/insights).
 *
 * Everything here is ILLUSTRATIVE demo data. Numbers are derived from a small set of
 * hand-authored campaign parameters plus a seeded PRNG, so the same campaign always
 * renders the same dashboard (stable screenshots, no Math.random at render time).
 *
 * Internal consistency rules:
 * - unique viewers = viewer-seconds on the timeline / average watch time
 * - funnel: impressions >= viewers >= engaged >= product-card clicks >= add-to-cart >= purchases
 * - revenue = sum of every purchase (qty x unit price); AOV = revenue / purchases
 * - spend = bid (credits/min) x airtime minutes x CREDIT_USD; ROAS = revenue / spend
 */

/** The mocked "previous airing" ran production-length 75 s segments (the live demo uses short ones). */
export const SEGMENT_SECONDS = 75;

/** Demo credit value in dollars; bids on the live board are credits per minute. */
export const CREDIT_USD = 8;

export type InsightsCampaignId = "diet-coke" | "cloudstep-runner" | "glow-ramen";

export type InsightsCampaign = {
  id: InsightsCampaignId;
  brand: string;
  product: string;
  category: string;
  /** Unit price in USD. */
  unitPrice: number;
  compareAtPrice: number | null;
  /** Winning bid, credits per minute of airtime. */
  bidPerMin: number;
  /** Number of 75 s segments aired in the last airing. */
  segments: number;
  /** Local clock time the airing started (fixed so the mock is stable). */
  airingStart: string;
  /** Accent colour used by the charts for this campaign. */
  accent: string;
};

export type Kpi = {
  key: string;
  label: string;
  value: string;
  /** Small caption under the value, e.g. a rate or a definition. */
  hint: string;
  /** Change vs the campaign's previous airing, in percent (positive = up). */
  deltaPct: number | null;
};

export type ViewerPoint = {
  /** Seconds since the airing started. */
  t: number;
  /** Concurrent viewers at t. */
  viewers: number;
};

export type AnswerMarker = {
  /** Seconds since the airing started when the host answered on air. */
  t: number;
  question: string;
  /** Concurrent viewers at that moment (for the marker position). */
  viewers: number;
};

export type Share = { label: string; sharePct: number };

export type Metro = { name: string; viewers: number; sharePct: number };

export type DeviceSlice = { label: "Mobile" | "Desktop" | "CTV"; sharePct: number };

export type Audience = {
  ageBands: Share[];
  gender: Share[];
  metros: Metro[];
  devices: DeviceSlice[];
  newVsReturning: { newPct: number; returningPct: number };
};

export type FunnelStep = {
  key: string;
  label: string;
  value: number;
  /** Percent of the previous step (100 for the first step). */
  pctOfPrev: number;
  /** Percent of unique viewers (the step everything is attributed against). */
  pctOfViewers: number;
};

export type Order = {
  id: string;
  /** Clock time, e.g. "7:36:42 PM". */
  time: string;
  qty: number;
  value: number;
  metro: string;
  device: DeviceSlice["label"];
};

export type AnswerMoment = {
  t: number;
  question: string;
  /** Add-to-carts in the 30 s after the answer vs the 30 s before it. */
  atcBefore: number;
  atcAfter: number;
};

export type AnswerImpact = {
  /** Add-to-carts per minute across the whole airing, excluding post-answer windows. */
  baselineAtcPerMin: number;
  /** Add-to-carts per minute in the 30 s after an on-air answer. */
  postAnswerAtcPerMin: number;
  liftPct: number;
  /** Share of all add-to-carts that landed inside a post-answer window. */
  atcInWindowsPct: number;
  moments: AnswerMoment[];
};

export type Conversions = {
  funnel: FunnelStep[];
  orders: Order[];
  answerImpact: AnswerImpact;
};

export type CampaignInsights = {
  campaign: InsightsCampaign;
  /** e.g. "Last airing: today" */
  periodLabel: string;
  airtimeSeconds: number;
  kpis: Kpi[];
  timeline: ViewerPoint[];
  markers: AnswerMarker[];
  totals: {
    impressions: number;
    viewers: number;
    peakConcurrent: number;
    avgWatchSeconds: number;
    chatMessages: number;
    questionsAnswered: number;
    engaged: number;
    productCardClicks: number;
    addToCart: number;
    purchases: number;
    revenue: number;
    aov: number;
    spendCredits: number;
    roas: number;
    revenuePerMinute: number;
  };
  audience: Audience;
  conversions: Conversions;
};

/* ------------------------------------------------------------------ */
/* seeded PRNG                                                          */
/* ------------------------------------------------------------------ */

/** mulberry32: tiny, fast, good enough for mock data. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ */
/* hand-authored campaign parameters                                    */
/* ------------------------------------------------------------------ */

type QuestionSpec = { segment: number; offset: number; question: string };

type CampaignSpec = {
  campaign: InsightsCampaign;
  /** Average concurrent viewers in the first segment's plateau. */
  baseConcurrent: number;
  /** Multiplicative audience drift per segment (1.03 = +3% each segment). */
  segmentDrift: number;
  avgWatchSeconds: number;
  /** Impressions -> viewers. */
  tuneInRate: number;
  /** Viewers -> engaged (watched >= 30 s or chatted). */
  engagedRate: number;
  /** Viewers -> product-card clicks (the CTR shown on the card). */
  ctr: number;
  /** Clicks -> add to cart. */
  atcRate: number;
  /** Add to cart -> purchase. */
  checkoutRate: number;
  /** Probability of 1 / 2 / 3 units per order (sums to 1). */
  qtyMix: [number, number, number];
  /** Chat messages per viewer-minute. */
  chatPerViewerMinute: number;
  /** vs previous airing, percent, for the KPI deltas. */
  deltas: Partial<Record<string, number>>;
  questions: QuestionSpec[];
  audience: {
    ageBands: number[];
    gender: number[];
    devices: [number, number, number];
    returningPct: number;
    metros: { name: string; weight: number }[];
  };
};

const AGE_LABELS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDER_LABELS = ["Women", "Men", "Non-binary / undisclosed"];

const SPECS: Record<InsightsCampaignId, CampaignSpec> = {
  "diet-coke": {
    campaign: {
      id: "diet-coke",
      brand: "Coca-Cola",
      product: "Diet Coke 12-pack",
      category: "Beverages",
      unitPrice: 8.99,
      compareAtPrice: 10.99,
      bidPerMin: 25,
      segments: 6,
      airingStart: "7:30:00 PM",
      accent: "#ff3d3d",
    },
    baseConcurrent: 2240,
    segmentDrift: 1.035,
    avgWatchSeconds: 58,
    tuneInRate: 0.59,
    engagedRate: 0.42,
    ctr: 0.062,
    atcRate: 0.48,
    checkoutRate: 0.62,
    qtyMix: [0.5, 0.35, 0.15],
    chatPerViewerMinute: 0.08,
    deltas: {
      viewers: 12.4,
      peak: 8.1,
      watch: 3.6,
      chat: 18.9,
      questions: 27.3,
      ctr: 0.9,
      atc: 14.7,
      purchases: 16.2,
      revenue: 17.8,
      aov: 1.4,
      roas: 6.1,
      spend: 11.1,
      rpm: 17.8,
    },
    questions: [
      { segment: 0, offset: 41, question: "Q: does it taste like regular Coke?" },
      { segment: 1, offset: 22, question: "Q: how many calories per can?" },
      { segment: 1, offset: 58, question: "Q: is there caffeine in it?" },
      { segment: 2, offset: 33, question: "Q: does the 12-pack ship cold?" },
      { segment: 3, offset: 17, question: "Q: any aspartame-free version?" },
      { segment: 3, offset: 52, question: "Q: what's the price per can?" },
      { segment: 4, offset: 29, question: "Q: can I mix it with lime?" },
      { segment: 5, offset: 38, question: "Q: is the deal on until midnight?" },
    ],
    audience: {
      ageBands: [14, 31, 27, 16, 8, 4],
      gender: [54, 43, 3],
      devices: [58, 27, 15],
      returningPct: 37,
      metros: [
        { name: "New York", weight: 11.2 },
        { name: "Los Angeles", weight: 8.9 },
        { name: "Chicago", weight: 5.6 },
        { name: "Dallas-Fort Worth", weight: 4.8 },
        { name: "Atlanta", weight: 4.1 },
        { name: "Houston", weight: 3.7 },
        { name: "Miami", weight: 3.3 },
        { name: "Phoenix", weight: 2.9 },
      ],
    },
  },
  "cloudstep-runner": {
    campaign: {
      id: "cloudstep-runner",
      brand: "CloudStep",
      product: "CloudStep Runner sneakers",
      category: "Footwear",
      unitPrice: 129,
      compareAtPrice: 159,
      bidPerMin: 22,
      segments: 4,
      airingStart: "6:15:00 PM",
      accent: "#3fd6ff",
    },
    baseConcurrent: 1260,
    segmentDrift: 1.02,
    avgWatchSeconds: 63,
    tuneInRate: 0.55,
    engagedRate: 0.46,
    ctr: 0.061,
    atcRate: 0.36,
    checkoutRate: 0.4,
    qtyMix: [0.91, 0.08, 0.01],
    chatPerViewerMinute: 0.07,
    deltas: {
      viewers: 4.2,
      peak: -2.3,
      watch: 6.8,
      chat: 9.4,
      questions: 0,
      ctr: 2.2,
      atc: 5.9,
      purchases: 3.1,
      revenue: 3.1,
      aov: 0,
      roas: 3.1,
      spend: 0,
      rpm: 3.1,
    },
    questions: [
      { segment: 0, offset: 36, question: "Q: do they run narrow?" },
      { segment: 1, offset: 27, question: "Q: are they waterproof?" },
      { segment: 2, offset: 19, question: "Q: what's the drop in millimetres?" },
      { segment: 2, offset: 61, question: "Q: do you have wide sizes?" },
      { segment: 3, offset: 44, question: "Q: how long is the return window?" },
    ],
    audience: {
      ageBands: [22, 36, 24, 11, 5, 2],
      gender: [41, 56, 3],
      devices: [71, 22, 7],
      returningPct: 24,
      metros: [
        { name: "Los Angeles", weight: 10.4 },
        { name: "New York", weight: 9.1 },
        { name: "Seattle", weight: 5.9 },
        { name: "Denver", weight: 5.2 },
        { name: "Austin", weight: 4.6 },
        { name: "Portland", weight: 4.0 },
        { name: "San Francisco", weight: 3.8 },
        { name: "Boston", weight: 3.1 },
      ],
    },
  },
  "glow-ramen": {
    campaign: {
      id: "glow-ramen",
      brand: "Glow Foods",
      product: "Glow Ramen 6-pack",
      category: "Grocery",
      unitPrice: 14.5,
      compareAtPrice: null,
      bidPerMin: 18,
      segments: 3,
      airingStart: "5:20:00 PM",
      accent: "#ffd23f",
    },
    baseConcurrent: 940,
    segmentDrift: 1.05,
    avgWatchSeconds: 49,
    tuneInRate: 0.57,
    engagedRate: 0.39,
    ctr: 0.054,
    atcRate: 0.52,
    checkoutRate: 0.58,
    qtyMix: [0.55, 0.33, 0.12],
    chatPerViewerMinute: 0.1,
    deltas: {
      viewers: 31.5,
      peak: 22.7,
      watch: -4.1,
      chat: 40.2,
      questions: 50,
      ctr: -0.6,
      atc: 28.4,
      purchases: 26.9,
      revenue: 29.3,
      aov: 1.9,
      roas: 29.3,
      spend: 0,
      rpm: 29.3,
    },
    questions: [
      { segment: 0, offset: 48, question: "Q: how spicy is the miso one?" },
      { segment: 1, offset: 31, question: "Q: is it vegan?" },
      { segment: 2, offset: 24, question: "Q: microwave or stovetop?" },
    ],
    audience: {
      ageBands: [29, 38, 19, 9, 4, 1],
      gender: [51, 45, 4],
      devices: [76, 19, 5],
      returningPct: 18,
      metros: [
        { name: "Los Angeles", weight: 9.8 },
        { name: "New York", weight: 9.2 },
        { name: "San Francisco", weight: 6.1 },
        { name: "Seattle", weight: 4.9 },
        { name: "Houston", weight: 4.3 },
        { name: "Chicago", weight: 4.0 },
        { name: "Honolulu", weight: 2.7 },
        { name: "Las Vegas", weight: 2.4 },
      ],
    },
  },
};

export const INSIGHTS_CAMPAIGN_IDS: InsightsCampaignId[] = [
  "diet-coke",
  "cloudstep-runner",
  "glow-ramen",
];

export const DEFAULT_INSIGHTS_CAMPAIGN: InsightsCampaignId = "diet-coke";

export function listInsightsCampaigns(): InsightsCampaign[] {
  return INSIGHTS_CAMPAIGN_IDS.map((id) => SPECS[id].campaign);
}

/* ------------------------------------------------------------------ */
/* generator                                                            */
/* ------------------------------------------------------------------ */

/** Sample resolution of the viewers timeline, seconds. */
export const TIMELINE_STEP_SECONDS = 5;
/** Window after an on-air answer that we attribute add-to-cart lift to, seconds. */
export const ANSWER_WINDOW_SECONDS = 30;

const DEVICE_LABELS: DeviceSlice["label"][] = ["Mobile", "Desktop", "CTV"];

/** Splits `total` into integer parts proportional to `weights`; parts sum to exactly `total`. */
function splitInteger(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floored = raw.map(Math.floor);
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  // Hand the leftover units to the largest fractional parts (deterministic order).
  const order = raw
    .map((r, i) => ({ frac: r - Math.floor(r), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    floored[order[k].i] += 1;
  }
  return floored;
}

/** Percent shares that sum to exactly 100 (last share absorbs rounding). */
function toShares(labels: string[], weights: number[]): Share[] {
  const parts = splitInteger(100, weights);
  return labels.map((label, i) => ({ label, sharePct: parts[i] }));
}

/** Shape of a single 75 s segment: a dip at the hand-off bumper, quick ramp-in, plateau, soft fade. */
function segmentCurve(secondsIntoSegment: number): number {
  const s = secondsIntoSegment;
  const rampIn = 1 - Math.exp(-s / 5); // viewers pile back in over the first ~12 s
  const fade = s > 62 ? 1 - ((s - 62) / 13) * 0.1 : 1; // slight drop-off before the next segment
  return 0.8 + 0.2 * rampIn * fade;
}

function clockTime(start: string, offsetSeconds: number): string {
  const m = /^(\d+):(\d+):(\d+) (AM|PM)$/.exec(start);
  if (!m) return start;
  let h = Number(m[1]) % 12;
  if (m[4] === "PM") h += 12;
  const total = h * 3600 + Number(m[2]) * 60 + Number(m[3]) + offsetSeconds;
  const hh = Math.floor(total / 3600) % 24;
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const suffix = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")} ${suffix}`;
}

function orderId(rand: () => number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "A1-";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(rand() * alphabet.length)];
  return out;
}

const cache = new Map<InsightsCampaignId, CampaignInsights>();

export function getCampaignInsights(id: InsightsCampaignId): CampaignInsights {
  const cached = cache.get(id);
  if (cached) return cached;

  const spec = SPECS[id];
  const { campaign } = spec;
  const rand = mulberry32(hashSeed(`ainfomercial-insights:${id}`));
  const airtimeSeconds = campaign.segments * SEGMENT_SECONDS;

  /* ----- answered questions, in airing seconds ----- */
  const answerTimes = spec.questions
    .map((q) => ({ t: q.segment * SEGMENT_SECONDS + q.offset, question: q.question }))
    .sort((a, b) => a.t - b.t);

  /* ----- concurrent viewers timeline ----- */
  const timeline: ViewerPoint[] = [];
  for (let t = 0; t <= airtimeSeconds; t += TIMELINE_STEP_SECONDS) {
    const segment = Math.min(campaign.segments - 1, Math.floor(t / SEGMENT_SECONDS));
    const into = t - segment * SEGMENT_SECONDS;
    const drift = Math.pow(spec.segmentDrift, segment);
    let v = spec.baseConcurrent * drift * segmentCurve(into);
    // An answered question pulls people in for ~25 s and then decays.
    for (const a of answerTimes) {
      const dt = t - a.t;
      if (dt >= 0 && dt < 40) v *= 1 + 0.11 * Math.exp(-dt / 14);
    }
    v *= 1 + (rand() - 0.5) * 0.06; // +/-3% jitter
    timeline.push({ t, viewers: Math.round(v) });
  }

  const viewerSeconds = timeline.reduce((acc, p, i) => {
    if (i === 0) return 0;
    return acc + ((timeline[i - 1].viewers + p.viewers) / 2) * TIMELINE_STEP_SECONDS;
  }, 0);

  const viewers = Math.round(viewerSeconds / spec.avgWatchSeconds);
  const peakConcurrent = Math.max(...timeline.map((p) => p.viewers));
  const impressions = Math.round(viewers / spec.tuneInRate);
  const engaged = Math.round(viewers * spec.engagedRate);
  const productCardClicks = Math.round(viewers * spec.ctr);
  const addToCart = Math.round(productCardClicks * spec.atcRate);
  const purchases = Math.round(addToCart * spec.checkoutRate);
  const chatMessages = Math.round((viewerSeconds / 60) * spec.chatPerViewerMinute);

  const markers: AnswerMarker[] = answerTimes.map((a) => {
    const idx = Math.min(timeline.length - 1, Math.round(a.t / TIMELINE_STEP_SECONDS));
    return { t: a.t, question: a.question, viewers: timeline[idx].viewers };
  });

  /* ----- purchases: quantity per order, revenue is the exact sum ----- */
  const qtyCounts = splitInteger(purchases, spec.qtyMix);
  const quantities: number[] = [];
  qtyCounts.forEach((count, i) => {
    for (let k = 0; k < count; k++) quantities.push(i + 1);
  });
  // Deterministic shuffle so the "recent orders" table is a believable mix.
  for (let i = quantities.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [quantities[i], quantities[j]] = [quantities[j], quantities[i]];
  }
  const revenue = Math.round(quantities.reduce((a, q) => a + q * campaign.unitPrice, 0) * 100) / 100;
  const aov = purchases > 0 ? revenue / purchases : 0;

  const airtimeMinutes = airtimeSeconds / 60;
  const spendCredits = campaign.bidPerMin * airtimeMinutes;
  const spendUsd = spendCredits * CREDIT_USD;
  const roas = spendUsd > 0 ? revenue / spendUsd : 0;
  const revenuePerMinute = revenue / airtimeMinutes;

  /* ----- audience ----- */
  const ageBands = toShares(AGE_LABELS, spec.audience.ageBands);
  const gender = toShares(GENDER_LABELS, spec.audience.gender);
  const deviceShares = splitInteger(100, spec.audience.devices);
  const devices: DeviceSlice[] = DEVICE_LABELS.map((label, i) => ({
    label,
    sharePct: deviceShares[i],
  }));
  const metros: Metro[] = spec.audience.metros.map((m) => {
    const metroViewers = Math.round((viewers * m.weight) / 100);
    return { name: m.name, viewers: metroViewers, sharePct: m.weight };
  });
  const newVsReturning = {
    newPct: 100 - spec.audience.returningPct,
    returningPct: spec.audience.returningPct,
  };

  /* ----- funnel ----- */
  const funnelRaw: { key: string; label: string; value: number }[] = [
    { key: "impressions", label: "Impressions", value: impressions },
    { key: "viewers", label: "Viewers", value: viewers },
    { key: "engaged", label: "Engaged", value: engaged },
    { key: "clicks", label: "Product-card clicks", value: productCardClicks },
    { key: "atc", label: "Add to cart", value: addToCart },
    { key: "purchases", label: "Purchases", value: purchases },
  ];
  const funnel: FunnelStep[] = funnelRaw.map((step, i) => ({
    ...step,
    pctOfPrev: i === 0 ? 100 : (step.value / funnelRaw[i - 1].value) * 100,
    pctOfViewers: (step.value / viewers) * 100,
  }));

  /* ----- recent attributed orders (last 8 of the airing) ----- */
  const orders: Order[] = [];
  const metroPool = spec.audience.metros;
  let cursor = airtimeSeconds - 4;
  for (let i = 0; i < 8; i++) {
    cursor -= 3 + Math.floor(rand() * 14); // orders trickle in every 3-16 s near the end
    const qty = quantities[i] ?? 1;
    // Weighted picks: metros by weight, devices by share.
    const mr = rand() * metroPool.reduce((a, m) => a + m.weight, 0);
    let acc = 0;
    let metro = metroPool[0].name;
    for (const m of metroPool) {
      acc += m.weight;
      if (mr <= acc) {
        metro = m.name;
        break;
      }
    }
    const dr = rand() * 100;
    const device: DeviceSlice["label"] =
      dr < devices[0].sharePct
        ? "Mobile"
        : dr < devices[0].sharePct + devices[1].sharePct
          ? "Desktop"
          : "CTV";
    orders.push({
      id: orderId(rand),
      time: clockTime(campaign.airingStart, Math.max(0, cursor)),
      qty,
      value: Math.round(qty * campaign.unitPrice * 100) / 100,
      metro,
      device,
    });
  }

  /* ----- answer impact ----- */
  // Distribute add-to-carts over the airing proportionally to concurrent viewers, then
  // boost the 30 s after each answer. Keeps the total equal to `addToCart`.
  const intervals = timeline.length - 1;
  const weights: number[] = [];
  for (let i = 0; i < intervals; i++) {
    const t = timeline[i].t;
    let w = (timeline[i].viewers + timeline[i + 1].viewers) / 2;
    for (const a of answerTimes) {
      if (t >= a.t && t < a.t + ANSWER_WINDOW_SECONDS) w *= 1.5;
    }
    weights.push(w);
  }
  const atcPerInterval = splitInteger(addToCart, weights);
  const inWindow = (t: number) =>
    answerTimes.some((a) => t >= a.t && t < a.t + ANSWER_WINDOW_SECONDS);
  let atcInWindows = 0;
  let windowSeconds = 0;
  for (let i = 0; i < intervals; i++) {
    if (inWindow(timeline[i].t)) {
      atcInWindows += atcPerInterval[i];
      windowSeconds += TIMELINE_STEP_SECONDS;
    }
  }
  const baselineSeconds = airtimeSeconds - windowSeconds;
  const baselineAtcPerMin = ((addToCart - atcInWindows) / baselineSeconds) * 60;
  const postAnswerAtcPerMin = windowSeconds > 0 ? (atcInWindows / windowSeconds) * 60 : 0;
  const liftPct =
    baselineAtcPerMin > 0 ? ((postAnswerAtcPerMin - baselineAtcPerMin) / baselineAtcPerMin) * 100 : 0;
  const sumRange = (from: number, to: number) => {
    let s = 0;
    for (let i = 0; i < intervals; i++) {
      const t = timeline[i].t;
      if (t >= from && t < to) s += atcPerInterval[i];
    }
    return s;
  };
  const moments: AnswerMoment[] = answerTimes
    .map((a) => ({
      t: a.t,
      question: a.question,
      atcBefore: sumRange(a.t - ANSWER_WINDOW_SECONDS, a.t),
      atcAfter: sumRange(a.t, a.t + ANSWER_WINDOW_SECONDS),
    }))
    .sort((a, b) => b.atcAfter - b.atcBefore - (a.atcAfter - a.atcBefore) || a.t - b.t)
    .slice(0, 3);

  /* ----- KPI cards ----- */
  const d = spec.deltas;
  const kpis: Kpi[] = [
    {
      key: "viewers",
      label: "Live viewers",
      value: fmtInt(viewers),
      hint: `unique · ${fmtInt(impressions)} impressions`,
      deltaPct: d.viewers ?? null,
    },
    {
      key: "peak",
      label: "Peak concurrent",
      value: fmtInt(peakConcurrent),
      hint: `at ${fmtClock(timeline.find((p) => p.viewers === peakConcurrent)?.t ?? 0)} into airing`,
      deltaPct: d.peak ?? null,
    },
    {
      key: "watch",
      label: "Avg watch time",
      value: `${spec.avgWatchSeconds}s`,
      hint: `per viewer · ${SEGMENT_SECONDS}s segments`,
      deltaPct: d.watch ?? null,
    },
    {
      key: "chat",
      label: "Chat messages",
      value: fmtInt(chatMessages),
      hint: `${(chatMessages / airtimeMinutes).toFixed(0)} per minute on air`,
      deltaPct: d.chat ?? null,
    },
    {
      key: "questions",
      label: "Questions answered on air",
      value: String(answerTimes.length),
      hint: `${(answerTimes.length / airtimeMinutes).toFixed(1)} per minute`,
      deltaPct: d.questions ?? null,
    },
    {
      key: "ctr",
      label: "Product-card CTR",
      value: fmtPct(spec.ctr * 100, 1),
      hint: `${fmtInt(productCardClicks)} clicks / viewers`,
      deltaPct: d.ctr ?? null,
    },
    {
      key: "atc",
      label: "Add to cart",
      value: fmtInt(addToCart),
      hint: `${fmtPct((addToCart / productCardClicks) * 100, 0)} of clicks`,
      deltaPct: d.atc ?? null,
    },
    {
      key: "purchases",
      label: "Purchases",
      value: fmtInt(purchases),
      hint: `${fmtPct((purchases / addToCart) * 100, 0)} of carts · ${fmtPct((purchases / viewers) * 100, 1)} of viewers`,
      deltaPct: d.purchases ?? null,
    },
    {
      key: "revenue",
      label: "Revenue",
      value: fmtMoney(revenue),
      hint: "attributed within the airing",
      deltaPct: d.revenue ?? null,
    },
    {
      key: "aov",
      label: "AOV",
      value: fmtMoneyCents(aov),
      hint: `${(quantities.reduce((a, q) => a + q, 0) / Math.max(1, purchases)).toFixed(2)} units per order`,
      deltaPct: d.aov ?? null,
    },
    {
      key: "roas",
      label: "ROAS",
      value: `${roas.toFixed(2)}x`,
      hint: `revenue ÷ spend (1 credit = $${CREDIT_USD})`,
      deltaPct: d.roas ?? null,
    },
    {
      key: "spend",
      label: "Spend",
      value: fmtMoney(spendUsd),
      hint: `${campaign.bidPerMin} cr/min × ${fmtMinutes(airtimeMinutes)} × $${CREDIT_USD}/cr`,
      deltaPct: d.spend ?? null,
    },
    {
      key: "rpm",
      label: "Revenue per airtime-minute",
      value: fmtMoney(revenuePerMinute),
      hint: `${fmtMoney(revenue)} over ${fmtMinutes(airtimeMinutes)}`,
      deltaPct: d.rpm ?? null,
    },
  ];

  const result: CampaignInsights = {
    campaign,
    periodLabel: "Last airing: today",
    airtimeSeconds,
    kpis,
    timeline,
    markers,
    totals: {
      impressions,
      viewers,
      peakConcurrent,
      avgWatchSeconds: spec.avgWatchSeconds,
      chatMessages,
      questionsAnswered: answerTimes.length,
      engaged,
      productCardClicks,
      addToCart,
      purchases,
      revenue,
      aov,
      spendCredits,
      roas,
      revenuePerMinute,
    },
    audience: { ageBands, gender, metros, devices, newVsReturning },
    conversions: {
      funnel,
      orders,
      answerImpact: {
        baselineAtcPerMin,
        postAnswerAtcPerMin,
        liftPct,
        atcInWindowsPct: addToCart > 0 ? (atcInWindows / addToCart) * 100 : 0,
        moments,
      },
    },
  };
  cache.set(id, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* formatting (shared by the cards)                                     */
/* ------------------------------------------------------------------ */

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const moneyCentsFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtInt(n: number): string {
  return intFmt.format(Math.round(n));
}

/** Whole dollars: "$4,981". */
export function fmtMoney(n: number): string {
  return moneyFmt.format(n);
}

/** Always two decimals: "$14.62". */
export function fmtMoneyCents(n: number): string {
  return moneyCentsFmt.format(n);
}

export function fmtPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/** Seconds -> m:ss (e.g. 95 -> "1:35"). */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtMinutes(minutes: number): string {
  return `${Number(minutes.toFixed(2))} min`;
}

/** Compact axis labels: 2,310 -> "2.3k". */
export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
}
