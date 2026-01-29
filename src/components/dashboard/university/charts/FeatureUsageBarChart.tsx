'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { FeatureUsageData } from '../types';

interface FeatureUsageBarChartProps {
  data: FeatureUsageData[];
  title?: string;
  description?: string;
  height?: string;
  barColor?: string;
  rotateLabels?: boolean;
}

export function FeatureUsageBarChart({
  data,
  title = 'Top Features Used',
  description = 'Most frequently accessed career tools',
  height = 'h-80',
  barColor = '#4F46E5',
  rotateLabels = true,
}: FeatureUsageBarChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={height}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: rotateLabels ? 80 : 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="feature"
              angle={rotateLabels ? -45 : 0}
              textAnchor={rotateLabels ? 'end' : 'middle'}
              height={rotateLabels ? 100 : 30}
            />
            <YAxis />
            <Tooltip />
            <Bar dataKey="usage" fill={barColor} name="Total Count">
              <LabelList dataKey="usage" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
