'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { ChartDataPoint } from '../types';

interface DistributionPieChartProps {
  data: ChartDataPoint[];
  title: string;
  description: string;
  height?: string;
  outerRadius?: number;
  showLegend?: boolean;
  emptyMessage?: string;
  tooltipFormatter?: (
    value: number,
    name: string,
    props: { payload: ChartDataPoint },
  ) => [string, string];
  labelFormatter?: (entry: { value: number }) => string;
}

const DEFAULT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444'];

export function DistributionPieChart({
  data,
  title,
  description,
  height = 'h-80',
  outerRadius = 80,
  showLegend = true,
  emptyMessage = 'No data available',
  tooltipFormatter,
  labelFormatter = ({ value }) => `${value}%`,
}: DistributionPieChartProps) {
  const hasData = data && data.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={height}>
        {!hasData ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={outerRadius}
                label={labelFormatter}
                labelLine={true}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
              {tooltipFormatter ? <Tooltip formatter={tooltipFormatter as any} /> : <Tooltip />}
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
