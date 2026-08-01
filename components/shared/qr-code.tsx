'use client';

import * as React from 'react';

/**
 * Deterministic pseudo-QR pattern generator.
 * Generates a grid of modules from the input string hash.
 * This is NOT a real scannable QR code — it's a visual placeholder
 * with the correct QR structure (finder patterns, alignment, data modules).
 */
function generateMatrix(data: string, size = 25): boolean[][] {
  // Hash the data into a seeded PRNG
  let seed = 0;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 31 + data.charCodeAt(i)) >>> 0;
  }
  function rand() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  // Fill data modules with pseudo-random pattern
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      matrix[r][c] = rand() > 0.5;
    }
  }

  // Finder patterns (3 corners) — 7x7 with inner 3x3
  function drawFinder(or: number, oc: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[or + r][oc + c] = isBorder || isInner;
      }
    }
    // Clear separator ring
    for (let i = 0; i < 8; i++) {
      if (or - 1 >= 0) matrix[or - 1]?.[oc + i] !== undefined && (matrix[or - 1][oc + i] = false);
      if (oc - 1 >= 0) matrix[or + i]?.[oc - 1] !== undefined && (matrix[or + i][oc - 1] = false);
    }
  }
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  return matrix;
}

export function QrCode({
  value,
  size = 200,
  className,
  fg = 'hsl(var(--foreground))',
  bg = 'hsl(var(--card))',
}: {
  value: string;
  size?: number;
  className?: string;
  fg?: string;
  bg?: string;
}) {
  const matrix = React.useMemo(() => generateMatrix(value), [value]);
  const gridSize = 25;
  const cellSize = size / gridSize;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="Código QR"
    >
      <rect width={size} height={size} fill={bg} rx="8" />
      {matrix.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill={fg}
              rx={cellSize * 0.12}
            />
          ) : null
        )
      )}
    </svg>
  );
}
