'use client';

/**
 * Advisor Availability Management Page
 *
 * Allows advisors to set their weekly availability schedule.
 * Students can then book sessions from these available time slots.
 */

import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const label = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return { value: time, label };
});

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export default function AvailabilityPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Queries
  const availability = useQuery(api.advisor_availability.getMyAvailability, {});
  const pendingBookings = useQuery(api.advisor_availability.getPendingBookings, {});

  const isLoading = availability === undefined;

  // Group availability by day
  const availabilityByDay = DAYS_OF_WEEK.map((day) => ({
    ...day,
    slots: availability?.filter((s) => s.day_of_week === day.value) || [],
  }));

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Availability</h1>
            <p className="text-muted-foreground">Set your weekly schedule for student bookings</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Time Slot
              </Button>
            </DialogTrigger>
            <AddSlotDialog onClose={() => setIsAddDialogOpen(false)} />
          </Dialog>
        </div>

        {/* Pending Bookings Alert */}
        {pendingBookings && pendingBookings.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-orange-900">
                      {pendingBookings.length} Pending Booking Request
                      {pendingBookings.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-orange-700">
                      Students are waiting for your confirmation
                    </p>
                  </div>
                </div>
                <a href="#bookings">
                  <Button variant="outline" size="sm">
                    View Requests
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Schedule
            </CardTitle>
            <CardDescription>Your availability for each day of the week</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {availabilityByDay.map((day) => (
                  <DayRow key={day.value} day={day} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Requests */}
        <div id="bookings">
          <BookingRequestsSection />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Day Row Component
// ============================================================================

interface AvailabilitySlot {
  _id: Id<'advisor_availability'>;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

function DayRow({ day }: { day: { value: number; label: string; slots: AvailabilitySlot[] } }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border bg-slate-50/50">
      <div className="w-28 flex-shrink-0">
        <p className="font-medium">{day.label}</p>
      </div>
      <div className="flex-1">
        {day.slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No availability set</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {day.slots.map((slot) => (
              <SlotBadge key={slot._id} slot={slot} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SlotBadge({ slot }: { slot: AvailabilitySlot }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const deleteSlot = useMutation(api.advisor_availability.deleteAvailabilitySlot);
  const toggleSlot = useMutation(api.advisor_availability.toggleAvailabilitySlot);

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteSlot({ slotId: slot._id });
    } catch (error) {
      console.error('Failed to delete slot:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete availability slot. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      await toggleSlot({ slotId: slot._id });
    } catch (error) {
      console.error('Failed to toggle slot:', error);
      toast({
        title: 'Error',
        description: 'Failed to update availability slot. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
        slot.is_active
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-slate-100 text-slate-500 border border-slate-200'
      }`}
    >
      <span className={slot.is_active ? '' : 'line-through'}>
        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
      </span>
      <span className="text-xs opacity-70">({slot.slot_duration_minutes}m)</span>
      <button
        onClick={handleToggle}
        disabled={isToggling}
        className="p-0.5 hover:bg-white/50 rounded"
        title={slot.is_active ? 'Disable' : 'Enable'}
      >
        {isToggling ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : slot.is_active ? (
          <Power className="h-3 w-3" />
        ) : (
          <PowerOff className="h-3 w-3" />
        )}
      </button>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="p-0.5 hover:bg-red-100 rounded text-red-600"
        title="Delete"
      >
        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ============================================================================
// Add Slot Dialog
// ============================================================================

function AddSlotDialog({ onClose }: { onClose: () => void }) {
  const [dayOfWeek, setDayOfWeek] = useState<string>('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [duration, setDuration] = useState<string>('30');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSlot = useMutation(api.advisor_availability.addAvailabilitySlot);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate time ordering
    if (startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await addSlot({
        dayOfWeek: parseInt(dayOfWeek),
        startTime,
        endTime,
        slotDurationMinutes: parseInt(duration),
      });
      onClose();
    } catch (err) {
      console.error('Failed to add slot:', err);
      setError('Failed to add availability slot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add Availability</DialogTitle>
        <DialogDescription>
          Set a time block when you're available for student sessions
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Day of Week</Label>
          <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map((day) => (
                <SelectItem key={day.value} value={day.value.toString()}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time.value} value={time.value}>
                    {time.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>End Time</Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time.value} value={time.value}>
                    {time.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Session Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Students will book sessions of this duration from your available time
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm p-2 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            'Add Availability'
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============================================================================
// Booking Requests Section
// ============================================================================

function BookingRequestsSection() {
  const bookings = useQuery(api.advisor_availability.getPendingBookings, {});

  if (!bookings || bookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Booking Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No pending booking requests</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Booking Requests
          <Badge variant="secondary">{bookings.length}</Badge>
        </CardTitle>
        <CardDescription>Pending session requests from students</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {bookings.map((booking) => (
          <BookingRequestCard key={booking._id} booking={booking} />
        ))}
      </CardContent>
    </Card>
  );
}

interface BookingRequest {
  _id: Id<'session_bookings'>;
  student: { id: Id<'users'>; name: string; email: string } | null;
  requested_start: number;
  requested_end: number;
  session_type: string;
  student_note?: string;
  status: string;
  created_at: number;
}

function BookingRequestCard({ booking }: { booking: BookingRequest }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const confirmBooking = useMutation(api.advisor_availability.confirmBooking);
  const declineBooking = useMutation(api.advisor_availability.declineBooking);

  const startDate = new Date(booking.requested_start);
  const endDate = new Date(booking.requested_end);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getSessionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      career_planning: 'Career Planning',
      resume_review: 'Resume Review',
      mock_interview: 'Mock Interview',
      application_strategy: 'Application Strategy',
      general_advising: 'General Advising',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      await confirmBooking({ bookingId: booking._id });
    } catch (error) {
      console.error('Failed to confirm booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to confirm booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDecline = async () => {
    if (isDeclining) return;
    setIsDeclining(true);
    try {
      await declineBooking({ bookingId: booking._id });
    } catch (error) {
      console.error('Failed to decline booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to decline booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border bg-white">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{booking.student?.name || 'Unknown Student'}</p>
            <Badge variant="outline">{getSessionTypeLabel(booking.session_type)}</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(startDate)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                {formatTime(startDate)} - {formatTime(endDate)}
              </span>
            </div>
          </div>
          {booking.student_note && (
            <p className="text-sm text-muted-foreground italic">"{booking.student_note}"</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDecline}
            disabled={isDeclining || isConfirming}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {isDeclining ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isConfirming || isDeclining}>
            {isConfirming ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
