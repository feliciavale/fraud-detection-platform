import { DETECTORS, DetectorId } from "@/lib/detectors";

export default function DetectorBadge({ id }: { id: DetectorId }) {
  const d = DETECTORS[id];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: d.soft, color: d.accent }}
    >
      <span className="h-1.5 w-1.5" style={{ backgroundColor: d.accent }} aria-hidden="true" />
      {d.name}
    </span>
  );
}
