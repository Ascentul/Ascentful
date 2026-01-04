'use client';

/**
 * Student Advisor Session Booking - Book a Session Page
 *
 * Allows students to book a session with their advisor by selecting
 * from available time slots and providing session details.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const SESSION_TYPES = [
  { value: 'career_planning', label: 'Career Planning' },
  { value: 'resume_review', label: 'Resume Review' },
  { value: 'mock_interview', label: 'Mock Interview' },
  { value: 'application_strategy', label: 'Application Strategy' },
  { value: 'general_advising', label: 'General Advising' },
  { value: 'other', label: 'Other' },
] as const;

type SessionType = (typeof SESSION_TYPES)[number]['value'];

export default function BookSessionPage() {
  return (
    <StudentUniversityGate>
      <BookSessionContent />
    </StudentUniversityGate>
  );
}

function BookSessionContent() {
  const { user } = useUser();
  const router = useRouter();
  const clerkId = user?.id;

  // State
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Start from Monday of current week
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    today.setDate(diff);
    return today;
  });
  const [selectedSlot, setSelectedSlot] = useState<{
    start: number;
    end: number;
    dayLabel: string;
    timeLabel: string;
  } | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>('general_advising');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Queries
  const advisor = useQuery(api.student_advisor_hub.getMyAdvisor, clerkId ? { clerkId } : 'skip');
  const availability = useQuery(
    api.student_advisor_hub.getAdvisorAvailability,
    clerkId ? { clerkId } : 'skip',
  );
  const existingBookings = useQuery(
    api.student_advisor_hub.getMyBookings,
    clerkId ? { clerkId, filter: 'all' } : 'skip',
  );

  // Mutation
  const createBooking = useMutation(api.student_advisor_hub_mutations.createBooking);

  const isLoading = advisor === undefined || availability === undefined;

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(selectedWeekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  // Navigate weeks
  const goToPreviousWeek = () => {
    const newDate = new Date(selectedWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedWeekStart(newDate);
    setSelectedSlot(null);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedWeekStart(newDate);
    setSelectedSlot(null);
  };

  // Check if a week is in the past
  const isPastWeek = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(selectedWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    return endOfWeek < today;
  };

  // Generate available time slots for a day
  const getSlotsForDay = (date: Date) => {
    if (!availability) return [];

    const dayOfWeek = date.getDay();
    const dayAvailability = availability.filter((a) => a.day_of_week === dayOfWeek);

    if (dayAvailability.length === 0) return [];

    const slots: { start: number; end: number; label: string }[] = [];
    const now = Date.now();

    dayAvailability.forEach((avail) => {
      const [startHour, startMin] = avail.start_time.split(':').map(Number);
      const [endHour, endMin] = avail.end_time.split(':').map(Number);
      const duration = avail.slot_duration_minutes || 30;

      let currentHour = startHour;
      let currentMin = startMin;

      while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
        const slotStart = new Date(date);
        slotStart.setHours(currentHour, currentMin, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + duration);

        // Only add future slots
        if (slotStart.getTime() > now) {
          // Check if slot conflicts with existing bookings
          const hasConflict = existingBookings?.some(
            (b) =>
              (b.status === 'pending' || b.status === 'confirmed') &&
              b.requested_start < slotEnd.getTime() &&
              b.requested_end > slotStart.getTime(),
          );

          if (!hasConflict) {
            slots.push({
              start: slotStart.getTime(),
              end: slotEnd.getTime(),
              label: slotStart.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              }),
            });
          }
        }

        // Move to next slot
        currentMin += duration;
        if (currentMin >= 60) {
          currentHour += Math.floor(currentMin / 60);
          currentMin = currentMin % 60;
        }
      }
    });

    return slots;
  };

  const handleSubmit = async () => {
    if (!selectedSlot || !clerkId || isSubmitting) return;

    setIsSubmitting(true);
    setBookingError(null);
    try {
      await createBooking({
        clerkId,
        requestedStart: selectedSlot.start,
        requestedEnd: selectedSlot.end,
        sessionType,
        studentNote: note || undefined,
      });
      setBookingSuccess(true);
    } catch (error) {
      console.error('Failed to create booking:', error);
      setBookingError(
        'Failed to book session. The time slot may no longer be available. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (bookingSuccess) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Booking Requested!</h2>
              <p className="text-muted-foreground mb-6">
                Your session request has been sent to your advisor. You'll be notified once they
                confirm.
              </p>
              <div className="space-y-2">
                <Link href="/student/advisor/sessions">
                  <Button className="w-full">View My Sessions</Button>
                </Link>
                <Link href="/student/advisor">
                  <Button variant="outline" className="w-full">
                    Back to Advisor Hub
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 shadow-sm">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (!advisor) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/student/advisor/sessions">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Book a Session</h1>
          </div>

          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Advisor Assigned</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                You need to be assigned an advisor before you can book sessions. Contact your
                university career center to get connected.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/student/advisor/sessions">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Book a Session</h1>
            <p className="text-muted-foreground">Schedule time with {advisor.advisorName}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Select a Time
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToPreviousWeek}
                      disabled={isPastWeek()}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[140px] text-center">
                      {selectedWeekStart.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      -{' '}
                      {new Date(
                        selectedWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000,
                      ).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <Button variant="outline" size="icon" onClick={goToNextWeek}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {availability?.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Your advisor hasn't set up their availability yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day) => {
                      const slots = getSlotsForDay(day);
                      const isToday = day.toDateString() === new Date().toDateString();

                      return (
                        <div key={day.toISOString()} className="min-h-[200px]">
                          <div
                            className={`text-center p-2 rounded-t-lg ${
                              isToday ? 'bg-primary-100 text-primary-700' : 'bg-slate-100'
                            }`}
                          >
                            <p className="text-xs font-medium">
                              {day.toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                            <p className="text-lg font-bold">{day.getDate()}</p>
                          </div>
                          <div className="space-y-1 p-1">
                            {slots.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">
                                No slots
                              </p>
                            ) : (
                              slots.slice(0, 6).map((slot) => {
                                const isSelected = selectedSlot?.start === slot.start;
                                return (
                                  <button
                                    key={slot.start}
                                    onClick={() =>
                                      setSelectedSlot({
                                        start: slot.start,
                                        end: slot.end,
                                        dayLabel: day.toLocaleDateString('en-US', {
                                          weekday: 'long',
                                          month: 'short',
                                          day: 'numeric',
                                        }),
                                        timeLabel: slot.label,
                                      })
                                    }
                                    className={`w-full text-xs py-1.5 px-2 rounded transition-colors ${
                                      isSelected
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {slot.label}
                                  </button>
                                );
                              })
                            )}
                            {slots.length > 6 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="w-full text-xs py-1.5 px-2 rounded text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-1">
                                    <span>+{slots.length - 6} more</span>
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-48 p-2 max-h-64 overflow-y-auto"
                                  align="start"
                                >
                                  <p className="text-xs font-medium text-muted-foreground mb-2">
                                    All slots for{' '}
                                    {day.toLocaleDateString('en-US', {
                                      weekday: 'long',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </p>
                                  <div className="space-y-1">
                                    {slots.map((slot) => {
                                      const isSelected = selectedSlot?.start === slot.start;
                                      return (
                                        <button
                                          key={slot.start}
                                          onClick={() =>
                                            setSelectedSlot({
                                              start: slot.start,
                                              end: slot.end,
                                              dayLabel: day.toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                month: 'short',
                                                day: 'numeric',
                                              }),
                                              timeLabel: slot.label,
                                            })
                                          }
                                          className={`w-full text-xs py-1.5 px-2 rounded transition-colors ${
                                            isSelected
                                              ? 'bg-primary-600 text-white'
                                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                          }`}
                                        >
                                          {slot.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Details</CardTitle>
                <CardDescription>
                  {selectedSlot
                    ? `${selectedSlot.dayLabel} at ${selectedSlot.timeLabel}`
                    : 'Select a time slot to continue'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Session Type</Label>
                  <Select
                    value={sessionType}
                    onValueChange={(v) => setSessionType(v as SessionType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Note for Advisor (Optional)</Label>
                  <Textarea
                    placeholder="What would you like to discuss?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>

                {bookingError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={!selectedSlot || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Request Session'
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Your advisor will confirm the session once submitted
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
