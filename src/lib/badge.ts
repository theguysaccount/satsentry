function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSvgBadge(
  label: string,
  value: string,
  colorHex: string
): string {
  const safeLabel = escapeXml(label);
  const safeValue = escapeXml(value);
  const labelWidth = Math.max(66, Math.round(label.length * 6.8 + 18));
  const valueWidth = Math.max(64, Math.round(value.length * 6.8 + 18));
  const totalWidth = labelWidth + valueWidth;
  const labelCenter = Math.round(labelWidth / 2);
  const valueCenter = labelWidth + Math.round(valueWidth / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="22" role="img" aria-label="${safeLabel}: ${safeValue}">
  <title>${safeLabel}: ${safeValue}</title>
  <clipPath id="r">
    <rect width="${totalWidth}" height="22" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="22" fill="#141820"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="22" fill="${colorHex}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="11" font-weight="600">
    <text x="${labelCenter}" y="15" fill="#f7931a">${safeLabel}</text>
    <text x="${valueCenter}" y="15" fill="#090b0e">${safeValue}</text>
  </g>
</svg>`;
}
