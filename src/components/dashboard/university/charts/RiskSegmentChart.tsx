'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { RiskSegmentData } from '../types';

interface RiskSegmentChartProps {
  data: RiskSegmentData[];
  title?: string;
  description?: string;
  height?: string;
  outerRadius?: number;
}

const RISK_COLORS = {
  'High Risk': '#EF4444',
  'Medium Risk': '#F59E0B',
  'Low Risk': '#10B981',
} as const;

export function RiskSegmentChart({
  data,
  title = 'At-Risk Students Segment',
  description = 'Distribution of students by risk level',
  height = 'h-80',
  outerRadius = 80,
}: RiskSegmentChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={height}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="segment"
              cx="50%"
              cy="50%"
              outerRadius={outerRadius}
              label={({ value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
              labelLine={true}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.color ||
                    RISK_COLORS[entry.segment as keyof typeof RISK_COLORS] ||
                    '#6B7280'
                  }
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
