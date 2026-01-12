'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { Building2, GraduationCap, Loader2 } from 'lucide-react';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';

export interface AutofillFieldsSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

export const AutofillFieldsSection = forwardRef<AutofillFieldsSectionRef, {}>((_, ref) => {
  const { user: clerkUser } = useUser();
  const [isSaving] = useState(false);

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // No-op save since this section is display-only
  const handleSave = useCallback(async () => {}, []);

  useImperativeHandle(
    ref,
    () => ({
      handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  // Handle loading state (undefined = still loading)
  if (convexUser === undefined) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Handle error/not found state (null = query completed but user not found)
  if (convexUser === null) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Unable to load profile data</p>
      </div>
    );
  }

  // Helper to display value or "Missing"
  const displayValue = (value: string | undefined | null) => {
    return value ? (
      <span className="text-slate-900">{value}</span>
    ) : (
      <span className="text-slate-400 italic">Missing</span>
    );
  };

  // Parse first and last name from full name
  const nameParts = convexUser.name?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Get primary phone number
  const primaryPhone =
    convexUser.phones?.find((p) => p.isPrimary)?.phone || convexUser.phones?.[0]?.phone;

  // Get work history from user record
  const workHistory = convexUser.work_history || [];

  // Get education history
  const educationHistory = convexUser.education_history || [];

  // Get social links
  const linkedinUrl = convexUser.linkedin_url;
  const githubUrl = convexUser.github_url;
  const twitterUrl = convexUser.twitter_url;
  const dribbbleUrl = convexUser.dribbble_url;
  const customLinks = convexUser.custom_links || [];

  // Get resume
  const profileResume = convexUser.profile_resume;

  return (
    <div className="space-y-6">
      {/* Intro text */}
      <p className="text-slate-600">
        The information in the sections below will be used when autofilling application forms via
        our chrome extension. The more information you add, the more fields will be filled out when
        using the feature.
      </p>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Basic Info</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">First Name</td>
                    <td className="px-4 py-3 text-sm text-right">{displayValue(firstName)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">Last Name</td>
                    <td className="px-4 py-3 text-sm text-right">{displayValue(lastName)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">Bio</td>
                    <td className="px-4 py-3 text-sm text-right">{displayValue(convexUser.bio)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">Email</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {displayValue(convexUser.email)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">Phone</td>
                    <td className="px-4 py-3 text-sm text-right">{displayValue(primaryPhone)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">
                      Current Location
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {displayValue(convexUser.location)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">
                      US Work Authorization
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {convexUser.work_authorization !== undefined ? (
                        <span className="text-slate-900">
                          {convexUser.work_authorization ? 'Yes' : 'No'}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Missing</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">
                      Req. Visa Sponsorship
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {convexUser.requires_sponsorship !== undefined ? (
                        <span className="text-slate-900">
                          {convexUser.requires_sponsorship ? 'Yes' : 'No'}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Missing</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Resume */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Resume</h3>
            <div className="border border-slate-200 rounded-xl p-4">
              {profileResume ? (
                <div className="text-sm text-slate-700">
                  {profileResume.title || profileResume.file_name || 'Resume uploaded'}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">None added...</p>
              )}
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Links</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Social Links */}
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600 italic">Social Links</span>
              </div>
              <table className="w-full">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-[#0A66C2]">LinkedIn</td>
                    <td className="px-4 py-3 text-sm text-right">{displayValue(linkedinUrl)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">GitHub</td>
                    <td className="px-4 py-3 text-sm text-right">{displayValue(githubUrl)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-[#1DA1F2]">Twitter</td>
                    <td className="px-4 py-3 text-sm text-right">{displayValue(twitterUrl)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-[#EA4C89]">Dribbble</td>
                    <td className="px-4 py-3 text-sm text-right">{displayValue(dribbbleUrl)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Other Links */}
              <div className="px-4 py-2 bg-slate-50 border-t border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600 italic">Other Links</span>
              </div>
              <div className="px-4 py-3">
                {customLinks.length > 0 ? (
                  <div className="space-y-2">
                    {customLinks.map((link) => (
                      <div key={link.id} className="text-sm">
                        <span className="font-medium text-slate-700">{link.title}:</span>{' '}
                        <span className="text-slate-600">{link.url}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">None added...</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Work Experience */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Work Experience</h3>
            {workHistory.length > 0 ? (
              <div className="space-y-3">
                {workHistory.map((exp) => (
                  <div key={exp.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[#0C29AB]">{exp.company}</h4>
                        <p className="text-sm text-slate-600">{exp.role}</p>
                        <p className="text-sm text-slate-500">
                          {exp.start_date} to {exp.is_current ? '-' : exp.end_date}
                        </p>
                      </div>
                    </div>
                    {exp.summary && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{exp.summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-slate-400 text-sm">None added...</p>
              </div>
            )}
          </div>

          {/* Education */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Education</h3>
            {educationHistory.length > 0 ? (
              <div className="space-y-3">
                {educationHistory.map((edu) => (
                  <div key={edu.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[#0C29AB]">{edu.school}</h4>
                        <p className="text-sm text-slate-600">
                          {edu.field_of_study}
                          {edu.degree && ` - ${edu.degree}`}
                        </p>
                      </div>
                    </div>
                    {edu.achievements && edu.achievements.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <ul className="space-y-1">
                          {edu.achievements.map((achievement, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-slate-700 flex items-center gap-2"
                            >
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                              {achievement}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-slate-400 text-sm">None added...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

AutofillFieldsSection.displayName = 'AutofillFieldsSection';
