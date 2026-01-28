'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { PlatformUsageData } from '../types';

interface PlatformUsageChartProps {
  data: PlatformUsageData[];
  title?: string;
  description?: string;
  height?: string;
}

const LINE_COLORS = {
  goals: '#4F46E5',
  applications: '#10B981',
  resumes: '#F59E0B',
  coverLetters: '#EF4444',
} as const;

export function PlatformUsageChart({
  data,
  title = 'Platform Usage',
  description = 'Monthly feature adoption and student engagement over the last 6 months',
  height = 'h-80',
}: PlatformUsageChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={height}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="goals"
              stroke={LINE_COLORS.goals}
              strokeWidth={2}
              name="Goals Set"
            />
            <Line
              type="monotone"
              dataKey="applications"
              stroke={LINE_COLORS.applications}
              strokeWidth={2}
              name="Applications"
            />
            <Line
              type="monotone"
              dataKey="resumes"
              stroke={LINE_COLORS.resumes}
              strokeWidth={2}
              name="Resumes"
            />
            <Line
              type="monotone"
              dataKey="coverLetters"
              stroke={LINE_COLORS.coverLetters}
              strokeWidth={2}
              name="Cover Letters"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
