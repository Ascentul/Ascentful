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

import type { ActivityData } from '../types';

interface WeeklyActivityChartProps {
  data: ActivityData[];
  title?: string;
  description?: string;
  height?: string;
}

const BAR_COLORS = {
  logins: '#4F46E5',
  assignments: '#10B981',
} as const;

export function WeeklyActivityChart({
  data,
  title = 'Weekly Activity',
  description = 'Daily logins and assignment submissions',
  height = 'h-80',
}: WeeklyActivityChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={height}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="logins" fill={BAR_COLORS.logins} name="Logins">
              <LabelList dataKey="logins" position="top" />
            </Bar>
            <Bar dataKey="assignments" fill={BAR_COLORS.assignments} name="Assignments">
              <LabelList dataKey="assignments" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
