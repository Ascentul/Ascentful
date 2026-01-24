/**
 * Shared date formatting utilities
 * Uses browser's default locale for internationalization support
 */

/**
 * Check if a timestamp is today
 */
export const isDateToday = (timestamp: number): boolean => {
  const date = new Date(timestamp);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

/**
 * Check if a timestamp is tomorrow
 */
export const isDateTomorrow = (timestamp: number): boolean => {
  const date = new Date(timestamp);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return (
    targetDate.getTime() ===
    new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).getTime()
  );
};

/**
 * Check if a timestamp is yesterday
 */
export const isDateYesterday = (timestamp: number): boolean => {
  const date = new Date(timestamp);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return (
    targetDate.getTime() ===
    new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).getTime()
  );
};

/**
 * Format a date as relative time (e.g., "Today", "Yesterday", "3 days ago")
 * Useful for displaying when something was posted or last updated
 */
export const formatRelativeDate = (
  timestamp: number | string | Date | null | undefined,
): string => {
  if (!timestamp) return '';
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const ts = date.getTime();

    // Use calendar-based helpers for accurate Today/Yesterday detection
    if (isDateToday(ts)) return 'Today';
    if (isDateYesterday(ts)) return 'Yesterday';

    const now = new Date();
    const diffMs = now.getTime() - ts;
    if (diffMs < 0) return date.toLocaleDateString(); // Future date

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    const weeks = Math.floor(diffDays / 7);
    if (diffDays < 30) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    const months = Math.floor(diffDays / 30);
    if (diffDays < 365) return `${months} month${months === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
};

/**
 * Format a date with time for display (e.g., "Today, 2:30 PM" or "Dec 15, 2:30 PM")
 * Uses browser's default locale for internationalization
 */
export const formatDateWithTime = (timestamp: number): string => {
  const date = new Date(timestamp);

  if (isDateToday(timestamp)) {
    return `Today, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (isDateTomorrow(timestamp)) {
    return `Tomorrow, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (isDateYesterday(timestamp)) {
    return `Yesterday, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Format interview date for display (e.g., "Today, 2:30 PM" or "Dec 15, 2:30 PM")
 * Note: Intentionally omits "Yesterday" - past interviews show absolute dates
 * since relative past dates are less useful for scheduling context.
 */
export const formatInterviewDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };

  if (isDateToday(timestamp)) {
    return `Today, ${date.toLocaleTimeString(undefined, timeOptions)}`;
  }
  if (isDateTomorrow(timestamp)) {
    return `Tomorrow, ${date.toLocaleTimeString(undefined, timeOptions)}`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...timeOptions,
  });
};

/**
 * Format a duration/distance without directional suffix (e.g., "3 days", "2 weeks")
 * Useful for due dates where the caller adds "ago" or "in" context
 */
export const formatDuration = (timestamp: number, referenceTime: number = Date.now()): string => {
  const diff = Math.abs(referenceTime - timestamp);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) {
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  if (weeks > 0) {
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return 'less than an hour';
};

/**
 * Format a date for short display (e.g., "Dec 15" or "Dec 15, 2023")
 */
export const formatShortDate = (
  timestamp: number | string | Date | null | undefined,
  includeYear = false,
): string => {
  if (!timestamp) return '';
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
    };
    if (includeYear) {
      options.year = 'numeric';
    }
    return date.toLocaleDateString(undefined, options);
  } catch {
    return '';
  }
};

/**
 * Format a date for display with fallback text (e.g., "Dec 15, 2024" or "Not set")
 * Used in advisor detail views where null dates need explicit fallback text
 */
export const formatDateWithFallback = (
  timestamp: number | null | undefined,
  fallback = 'Not set',
): string => {
  if (!timestamp) return fallback;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a timestamp as compact relative time (e.g., "Just now", "5m ago", "2h ago", "3d ago")
 * Useful for notifications, activity feeds, and other UI elements where space is limited.
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  // Handle future timestamps
  if (diff < 0) return new Date(timestamp).toLocaleDateString();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};
