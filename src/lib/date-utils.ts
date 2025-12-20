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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
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
