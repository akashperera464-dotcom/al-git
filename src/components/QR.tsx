export function QR({ value, className }: { value: string; className?: string }) {
  const cells = 13;
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  const bits: number[] = [];
  for (let i = 0; i < cells * cells; i += 1) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    bits.push((h >> 16) & 1);
  }
  const corners = [
    [0, 0],
    [0, cells - 3],
    [cells - 3, 0],
  ];
  return (
    <svg viewBox={`0 0 ${cells} ${cells}`} className={className}>
      <rect x="-0.5" y="-0.5" width={cells + 1} height={cells + 1} fill="#fff" />
      {bits.map((b, i) => {
        const x = i % cells;
        const y = Math.floor(i / cells);
        const inCorner = corners.some(([cx, cy]) => x >= cx && x < cx + 3 && y >= cy && y < cy + 3);
        return b && !inCorner ? <rect key={i} x={x} y={y} width={1} height={1} fill="#064e3b" /> : null;
      })}
      {corners.map(([cx, cy], i) => (
        <g key={i}>
          <rect x={cx} y={cy} width={3} height={3} fill="#064e3b" />
          <rect x={cx + 0.6} y={cy + 0.6} width={1.8} height={1.8} fill="#fff" />
          <rect x={cx + 1} y={cy + 1} width={1} height={1} fill="#064e3b" />
        </g>
      ))}
    </svg>
  );
}
