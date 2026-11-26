// Three layouts were used for the product column in editions before version 2.
// Current editions choose their own section titles.
export function publicSectionId(section, editorialVersion) {
  if (editorialVersion === 2) return section.id;
  const { title, kicker, items } = section;
  const hasDecisionArea = Array.isArray(items) && items.some((item) => item?.decision_area);
  const hasLegacyKicker = kicker === "Product opportunities" || kicker === "Leadership perspective · Product opportunities";
  if (title === "Product opportunities" || (title === "Product assessment" && hasDecisionArea) ||
      (hasLegacyKicker && /^Implications for .+$/i.test(title))) return "legacy-product-view";
  return section.id;
}
