'use client';

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@/lib/utils';

export function BarChartCard({
  data,
  dataKey,
  color = 'hsl(var(--chart-1))',
  height = 260,
  valueFormatter,
  className,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  color?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
  className?: string;
}) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 10,
              fontSize: 12,
              boxShadow: '0 4px 12px rgb(17 24 39 / 0.08)',
              color: 'hsl(var(--popover-foreground))',
            }}
            formatter={(value: number) => [
              valueFormatter ? valueFormatter(value) : value,
              '',
            ]}
          />
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={[5, 5, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
