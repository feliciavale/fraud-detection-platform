/** Three score bars and an amber threshold line. Same drawing as app/icon.svg. */
export default function Logo({ size = 28, dark = true }: { size?: number; dark?: boolean }) {
  const bar = dark ? "#FFFFFF" : "#14243A";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill={dark ? "#FFFFFF" : "#14243A"} fillOpacity={dark ? 0.1 : 0.06} />
      <rect x="7" y="17" width="4" height="8" fill={bar} />
      <rect x="14" y="12" width="4" height="13" fill={bar} />
      <rect x="21" y="7" width="4" height="18" fill={bar} />
      <rect x="5" y="14" width="22" height="1.5" fill="#F59E0B" />
    </svg>
  );
}
