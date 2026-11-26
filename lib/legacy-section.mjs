// Three layouts were used for the product column in editions before version 2.
// Current editions choose their own section titles.
export function publicSectionId(section, editorialVersion) {
  if (editorialVersion === 2) return section.id;
  const { title, kicker, items } = section;
  const hasDecisionArea = Array.isArray(items) && items.some((item) => item?.decision_area);
  const hasLegacyKicker = kicker === "机会与打法" || kicker === "CEO 视角 · 机会与打法";
  if (title === "机会与打法" || (title === "产品判断" && hasDecisionArea) ||
      (hasLegacyKicker && /^对.+的启发$/.test(title))) return "legacy-product-view";
  return section.id;
}
