'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@/lib/utils';

interface Series {
  key: string;
  color: string;
  label: string;
}

export function AreaChartCard({
  data,
  series,
  height = 260,
  valueFormatter,
  className,
}: {
  data: Record<string, string | number>[];
  series: Series[];
  height?: number;
  valueFormatter?: (v: number) => string;
  className?: string;
}) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`grad-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            width={48}
            tickFormatter={(v) => (valueFormatter ? valueFormatter(Number(v)) : String(v))}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 10,
              fontSize: 12,
              boxShadow: '0 4px 12px rgb(17 24 39 / 0.08)',
              color: 'hsl(var(--popover-foreground))',
            }}
            formatter={(value: number, name: string) => [
              valueFormatter ? valueFormatter(value) : value,
              series.find((s) => s.key === name)?.label ?? name,
            ]}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: 'hsl(var(--card))',
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
