'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { Loader2, Users } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CohortMomentumChartProps {
  universityId?: Id<'universities'>;
}

const COLORS = {
  green: '#10b981', // emerald-500
  yellow: '#f59e0b', // amber-500
  red: '#ef4444', // red-500
};

export function CohortMomentumChart({ universityId }: CohortMomentumChartProps) {
  const { user: clerkUser } = useUser();
  const userUniversityId = clerkUser?.publicMetadata?.university_id as string | undefined;
  const effectiveUniversityId =
    universityId || (userUniversityId as Id<'universities'> | undefined);

  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const data = useQuery(
    api.momentum.getMomentumByDepartment,
    effectiveUniversityId
      ? {
          universityId: effectiveUniversityId,
          departmentId:
            selectedDepartment !== 'all' ? (selectedDepartment as Id<'departments'>) : undefined,
        }
      : 'skip',
  );

  if (!effectiveUniversityId) {
    return null;
  }

  if (data === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Momentum by Cohort
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Transform data for stacked bar chart
  const chartData = data.byDepartment.map((dept) => ({
    name: dept.departmentName.replace('School of ', '').replace('College of ', ''),
    'On Track': dept.green,
    'Needs Attention': dept.yellow,
    Stalled: dept.red,
    total: dept.total,
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);

    return (
      <div className="bg-white border border-neutral-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.fill }} />
            <span>{entry.name}:</span>
            <span className="font-medium">{entry.value}</span>
            <span className="text-neutral-400">
              ({total > 0 ? Math.round((entry.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
        <div className="border-t mt-2 pt-2 text-neutral-500">Total: {total} students</div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Momentum by Cohort
            </CardTitle>
            <CardDescription>
              Distribution of student momentum signals across departments
            </CardDescription>
          </div>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {data.departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name.replace('School of ', '').replace('College of ', '')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold">{data.totals.total}</p>
            <p className="text-xs text-muted-foreground">Total Students</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{data.totals.green}</p>
            <p className="text-xs text-muted-foreground">On Track</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{data.totals.yellow}</p>
            <p className="text-xs text-muted-foreground">Needs Attention</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{data.totals.red}</p>
            <p className="text-xs text-muted-foreground">Stalled</p>
          </div>
        </div>

        {/* Stacked bar chart */}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="On Track" stackId="a" fill={COLORS.green} cursor="pointer" />
            <Bar dataKey="Needs Attention" stackId="a" fill={COLORS.yellow} cursor="pointer" />
            <Bar dataKey="Stalled" stackId="a" fill={COLORS.red} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>

        {/* Stalled students callout */}
        {data.totals.red > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              <span className="font-medium">{data.totals.red} students</span> are stalled and
              require attention ({Math.round((data.totals.red / data.totals.total) * 100)}% of
              total)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
