import type { CSSProperties } from 'react';

export default function Segmented<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}
      style={{ ['--seg-count' as string]: String(options.length), ['--seg-index' as string]: String(idx) } as CSSProperties}>
      <span className="seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.key} type="button" role="tab" aria-selected={o.key === value}
          className={o.key === value ? 'seg-item active' : 'seg-item'} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}