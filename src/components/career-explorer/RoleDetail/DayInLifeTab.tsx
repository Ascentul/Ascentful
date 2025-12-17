'use client';

import { Calendar, Clock, Coffee, Laptop, MessageSquare, Users } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DayInLifeTabProps {
  description?: string;
}

// Sample activities when no specific description is available
const DEFAULT_ACTIVITIES = [
  {
    time: 'Morning',
    icon: Coffee,
    activities: [
      'Review emails and prioritize daily tasks',
      'Team standup or check-ins',
      'Focus work on key deliverables',
    ],
  },
  {
    time: 'Midday',
    icon: MessageSquare,
    activities: [
      'Meetings with stakeholders',
      'Collaborative work sessions',
      'Documentation and planning',
    ],
  },
  {
    time: 'Afternoon',
    icon: Laptop,
    activities: [
      'Deep work on projects',
      'Code reviews or design feedback',
      'Learning and skill development',
    ],
  },
  {
    time: 'End of Day',
    icon: Calendar,
    activities: ['Wrap up ongoing tasks', 'Update project tracking', 'Plan for tomorrow'],
  },
];

export function DayInLifeTab({ description }: DayInLifeTabProps) {
  if (description) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />A Typical Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Default Day Structure */}
      {DEFAULT_ACTIVITIES.map((block, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <block.icon className="w-4 h-4 text-blue-500" />
              {block.time}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {block.activities.map((activity, actIdx) => (
                <li key={actIdx} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                  <span className="text-neutral-600">{activity}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {/* Note about generic content */}
      <Card className="bg-neutral-50 border-neutral-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-neutral-500">
              <p className="font-medium mb-1 text-neutral-600">About This Description</p>
              <p>
                This is a generalized overview. Actual daily activities may vary based on company,
                team, and specific role responsibilities.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
