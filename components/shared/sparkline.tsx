'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight inline sparkline — no chart library needed.
 * Draws a smooth area line from a numeric series.
 */
export function Sparkline({
  data,
  className,
  stroke = 'hsl(var(--primary))',
  fill = 'hsl(var(--primary) / 0.08)',
  width = 120,
  height = 36,
}: {
  data: number[];
  className?: string;
  stroke?: string;
  fill?: string;
  width?: number;
  height?: number;
}) {
  const path = React.useMemo(() => {
    if (!data || data.length === 0) return { line: '', area: '' };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1 || 1);
    const points = data.map((d, i) => {
      const x = i * stepX;
      const y = height - ((d - min) / range) * (height - 4) - 2;
      return [x, y] as const;
    });
    const line = points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ');
    const area = `${line} L ${width} ${height} L 0 ${height} Z`;
    return { line, area };
  }, [data, width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden="true"
    >
      <path d={path.area} fill={fill} stroke="none" />
      <path
        d={path.line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
