// Research records keep source publication dates separate from verification dates.
export const RESEARCH_CATEGORIES = Object.freeze({
  "perp-protocol": "Perpetual futures protocol",
  "trading-frontend": "Trading frontend",
  "spot-infrastructure": "Spot market infrastructure",
  "prediction-market": "Prediction market",
  other: "Other project",
});

export const DISCUSSION_AFFILIATIONS = Object.freeze({
  official: "Official",
  independent: "Independent analysis",
  sponsored: "Sponsored",
  unknown: "Affiliation unconfirmed",
});

export const isIsoDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date) && date.toISOString().slice(0, 10) === value;
};

export const isHttpUrl = (value) => {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch { return false; }
};

export const extractUrlDate = (url = "") => {
  if (typeof url !== "string") return null;
  const match = url.match(/\b(20\d{2})[\/\-_](0[1-9]|1[0-2])[\/\-_](0[1-9]|[12]\d|3[01])\b/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  return isIsoDate(iso) ? { iso, d: new Date(`${iso}T00:00:00Z`) } : null;
};

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, minimum = 1) => typeof value === "string" && value.trim().length >= minimum;

// Count words as readers see them, after removing supported bold markup.
export const wordCount = (value) => (String(value || "").replace(/\*\*/g, "").match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu) || []).length;
export const visibleCharCount = (value) => Array.from(String(value || "").replace(/\*\*/g, "").replace(/\s/g, "")).length;
export const sentences = (value) => [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(String(value || ""))].map(x => x.segment.trim()).filter(Boolean);

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthPattern = monthNames.map(name => name.slice(0, 3) + "(?:" + name.slice(3) + ")?").join("|");
const dateTokens = new RegExp("\\b(?:(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})|(" + monthPattern + ")\\.?\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?)\\b", "gi");
const headlineDates = (value) => [...String(value || "").matchAll(dateTokens)];
// Match verification language while allowing ordinary uses of dates and numerical ranges.
const headlineUsesCheckDateFraming = headline => /\bas of\s+(?:today|\d{1,2}[-/]\d{1,2}\b)|^(?:today(?:'s)?|[0-9]{1,2}[-/][0-9]{1,2})\s+(?:review|research|verification|check|audit)/i.test(headline);
const headlineIncludesDate = (headline, iso) => {
  if (!isIsoDate(iso)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  return headlineDates(headline).some(([, y, m, d, name, md, my]) => y
    ? Number(y) === year && Number(m) === month && Number(d) === day
    : (!my || Number(my) === year) && name.toLowerCase().startsWith(monthNames[month - 1].slice(0, 3).toLowerCase()) && Number(md) === day);
};

// Both the structure and freshness checks enforce the same item rules.
export function validateV2Item(item, reportDate, tag = "item") {
  const errors = [];
  const E = (message) => errors.push(`${tag}.${message}`);
  if (!object(item)) return [`${tag} must be an object`];
  if (!["crypto", "ai", "crypto-ai"].includes(item.domain)) E(`domain must be crypto, ai or crypto-ai`);
  if (!text(item.relevance, 12)) E(`relevance must explain the specific relationship in at least 12 characters`);
  const headlineLength = wordCount(item.headline);
  if (!text(item.headline) || headlineLength < 3 || headlineLength > 25) E("headline must contain 3–25 words");
  if (typeof item.body !== "string") E(`body must be a single string`);
  else {
    if (/[\r\n\u2028\u2029]/.test(item.body) || /[•●▪◦‣⁃]/.test(item.body) || /^\s*(?:[-+*]|\d+[.),])\s+/.test(item.body)) {
      E(`body must be a single paragraph without line breaks or bullets`);
    }
    const length = wordCount(item.body);
    if (length < 30 || length > 100) E(`body must contain 30–100 words; found ${length}`);
    const labels = /(?:^|[\n.!?;])\s*(?:event|mechanism|impact|background|conclusion|analysis|GTM(?: strategy)?|product(?: strategy)?|selection rationale|unknowns|discussion)\s*:/i;
    if (labels.test(item.body) || /\*\*[^*\n]{1,24}\*\*\s*:/.test(item.body) || /\[[^\]\n]{1,24}\](?!\()\s*:?/.test(item.body) || /^\s{0,3}#{1,6}\s+/m.test(item.body)) {
      E(`body must not contain labeled subheadings`);
    }
  }
  if (Object.hasOwn(item, "context")) E(`context is retired; include facts and limits in the body`);
  const hasEventDate = item.event_date != null;
  const hasSnapshotDate = Object.hasOwn(item, "snapshot_date");
  if (hasSnapshotDate) {
    if (item.kind !== "research") E(`snapshot_date is restricted to research`);
    if (hasEventDate) E(`snapshot_date and event_date are mutually exclusive`);
    if (!isIsoDate(item.snapshot_date)) E(`snapshot_date must be a real ISO date`);
    else {
      if (isIsoDate(reportDate) && item.snapshot_date > reportDate) E(`snapshot_date cannot be later than the report date`);
      if (!headlineIncludesDate(item.headline, item.snapshot_date) || !/\bas of\b/i.test(item.headline)) {
        E(`headline must say As of and match snapshot_date`);
      }
    }
  }
  if (item.kind !== "research" || hasEventDate) {
    if (!isIsoDate(item.event_date)) E(`event_date must be a real ISO date`);
    else {
      if (isIsoDate(reportDate) && item.event_date > reportDate) E(`event_date cannot be later than the report date`);
      if (!headlineIncludesDate(item.headline, item.event_date)) E(`headline must include the matching event_date`);
    }
  } else if (!hasSnapshotDate && (headlineDates(item.headline).length || headlineUsesCheckDateFraming(item.headline))) {
    E(`headline must be undated; checked_at is not an event or snapshot date`);
  }
  return errors;
}

export function validateResearchItem(item, reportDate, tag = "research", editorialVersion) {
  const errors = [];
  const E = (message) => errors.push(`${tag}.${message}`);
  if (!object(item)) return [`${tag} must be an object`];
  if (item.kind !== "research") E(`kind must be research`);
  if (!isIsoDate(reportDate)) E(`invalid report date`);
  if (!text(item.headline)) E(`headline missing`);
  const body = typeof item.body === "string" ? [item.body] : item.body;
  if (!Array.isArray(body) || !body.length || !body.every((part) => text(part))) {
    E(`body must contain a research summary`);
  } else if (editorialVersion !== 2 && sentences(body.join(" ")).length > 2) {
    E(`body must contain 1–2 sentences`);
  }

  const checkSource = (source, path) => {
    if (!object(source)) return E(`${path} must be an object`);
    if (!text(source.source)) E(`${path}.source missing`);
    if (!isHttpUrl(source.url)) E(`${path}.url must be HTTP(S)`);
    if (!isIsoDate(source.checked_at) || source.checked_at !== reportDate) {
      E(`${path}.checked_at must equal ${reportDate}`);
    }
    const urlDate = extractUrlDate(source.url);
    if (source.date == null) {
      if (urlDate) E(`${path}.date missing despite date in URL: ${urlDate.iso}`);
    } else if (!isIsoDate(source.date)) {
      E(`${path}.date must be ISO; omit it for undated sources`);
    } else {
      if (isIsoDate(reportDate) && source.date > reportDate) E(`${path}.date cannot be later than the report date`);
      if (urlDate && source.date !== urlDate.iso) E(`${path}.date conflicts with date in URL`);
    }
  };
  checkSource(item, "primary source");
  if (!Array.isArray(item.references) || item.references.length < 1 || item.references.length > 3) {
    E(`references must include 1–3 additional sources`);
  } else {
    const urls = new Set([item.url]);
    item.references.forEach((reference, index) => {
      checkSource(reference, `references[${index}]`);
      if (isHttpUrl(reference?.url)) {
        if (urls.has(reference.url)) E(`references[${index}].url duplicates a source`);
        urls.add(reference.url);
      }
    });
    if (urls.size < 2) E(`references must include at least two distinct URLs`);
  }

  const research = item.research;
  if (!object(research)) return [...errors, `${tag}.research must be an object`];
  if (!text(research.project)) E(`research.project missing`);
  if (!Object.hasOwn(RESEARCH_CATEGORIES, research.category)) E(`research.category must be a supported category`);
  for (const field of ["why_now", "mechanism", "gtm", "product", "implication", "unknowns"]) {
    if (!text(research[field], 12)) E(`research.${field} requires at least 12 characters`);
  }
  if (!Array.isArray(research.discussions) || research.discussions.length > 4) {
    E(`research.discussions must be an array of 0–4 discussions`);
  } else {
    if (research.discussions.length === 0 && !text(research.discussion_gap, 12)) E(`research.discussion_gap must explain the missing evidence in at least 12 characters`);
    research.discussions.forEach((discussion, index) => {
      const path = `research.discussions[${index}]`;
      if (!object(discussion)) return E(`${path} must be an object`);
      if (!text(discussion.speaker)) E(`${path}.speaker missing`);
      if (!Object.hasOwn(DISCUSSION_AFFILIATIONS, discussion.affiliation)) E(`${path}.affiliation must designate a supported relationship`);
      if (!text(discussion.summary)) E(`${path}.summary missing`);
      if (!isHttpUrl(discussion.url)) E(`${path}.url must be HTTP(S)`);
      if (!isIsoDate(discussion.date)) E(`${path}.date must be a real publication date`);
      else {
        const age = (new Date(`${reportDate}T00:00:00Z`) - new Date(`${discussion.date}T00:00:00Z`)) / 86400000;
        if (age < 0 || age > 30) E(`${path}.date must be within 0–30 days`);
        const urlDate = extractUrlDate(discussion.url);
        if (urlDate && discussion.date !== urlDate.iso) E(`${path}.date conflicts with date in URL`);
      }
    });
  }
  return errors;
}
