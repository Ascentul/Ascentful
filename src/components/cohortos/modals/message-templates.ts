// Shared message templates for CohortOS modals

export type EmailTemplateKey =
  | 'quick-checkin'
  | 'survey-reminder'
  | 'interview-followup'
  | 'blocker-resolution'
  | 'custom';

export type SmsTemplateKey = 'quick-checkin' | 'survey-reminder' | '14-day-checkin' | 'custom';

export interface EmailTemplate {
  subject: string;
  body: string;
}

export const emailTemplates: Record<Exclude<EmailTemplateKey, 'custom'>, EmailTemplate> = {
  'quick-checkin': {
    subject: 'Checking in on your internship search',
    body: `Hi {{first_name}},

Just wanted to check in and see how your internship search is going.

How are things progressing? Have you had any interviews recently, or are there any challenges you're facing that I can help with?

Feel free to reply to this email or book some time on my calendar if you'd like to chat.

Best,
Kazah Mims
Director of Career Advancement`,
  },
  'survey-reminder': {
    subject: 'Quick reminder: Internship Status Survey',
    body: `Hi {{first_name}},

We haven't received your response to our internship status survey yet. It only takes 2 minutes and helps us support you better.

Your input is valuable - it helps us understand where you are in your search and how we can best assist you.

[Complete Survey]

Thank you!

Kazah Mims
Director of Career Advancement`,
  },
  'interview-followup': {
    subject: 'How did your interview go?',
    body: `Hi {{first_name}},

I saw that you had an interview recently - congratulations on making it to that stage!

I'd love to hear how it went. Did you feel prepared? Is there anything specific you'd like to debrief or practice for next time?

Let me know if you'd like to schedule a quick call to discuss.

Best,
Kazah Mims
Director of Career Advancement`,
  },
  'blocker-resolution': {
    subject: "Let's resolve your internship search blocker",
    body: `Hi {{first_name}},

I noticed you've flagged a blocker in your internship search. I want to make sure we address this and get you back on track.

Can you share more details about what's holding you back? Whether it's resume concerns, interview prep, networking challenges, or something else, I'm here to help.

Let's schedule a time to discuss - I have availability this week.

Best,
Kazah Mims
Director of Career Advancement`,
  },
};

export const smsTemplates: Record<Exclude<SmsTemplateKey, 'custom'>, string> = {
  'quick-checkin': `Hi {{first_name}}, just checking in on your internship search. How's it going? Reply or book time: [link] - Kazah`,
  'survey-reminder': `Hi {{first_name}}, quick reminder to complete the internship survey. Takes 2 min: [link] - Pepperdine Career Services`,
  '14-day-checkin': `Hi {{first_name}}, we haven't heard from you in a while. Any updates on your internship search? Let us know how we can help! - Kazah`,
};

export const emailTemplateOptions = [
  { value: 'quick-checkin', label: 'Quick Check-in' },
  { value: 'survey-reminder', label: 'Survey Reminder' },
  { value: 'interview-followup', label: 'Interview Follow-up' },
  { value: 'blocker-resolution', label: 'Blocker Resolution' },
  { value: 'custom', label: 'Custom Message' },
];

export const smsTemplateOptions = [
  { value: 'quick-checkin', label: 'Quick Check-in' },
  { value: 'survey-reminder', label: 'Survey Reminder' },
  { value: '14-day-checkin', label: '14-Day Check-in' },
  { value: 'custom', label: 'Custom Message' },
];

// Helper to personalize a message with student data
export function personalizeMessage(
  message: string,
  firstName: string,
  additionalReplacements?: Record<string, string>,
): string {
  let result = message.replace(/\{\{first_name\}\}/g, firstName);

  if (additionalReplacements) {
    Object.entries(additionalReplacements).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });
  }

  return result;
}
