/**
 * Education Tab
 *
 * View and manage education history entries.
 * Note: Full editing is done on the main Ascentul dashboard.
 */

import React from 'react';
import { useProfileStore } from '~/store/profileStore';
import type { EducationHistoryItem } from '~/types';

export default function EducationTab() {
  const { profile } = useProfileStore();
  const educationHistory = profile?.educationHistory || [];

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'Present';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const openDashboard = () => {
    window.open('https://ascentful.io/dashboard/profile', '_blank');
  };

  return (
    <div className="tab-content">
      <div className="form-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Education History</h2>
          <button className="btn-secondary" onClick={openDashboard}>
            Edit on Dashboard
          </button>
        </div>

        {educationHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎓</div>
            <h3>No education added</h3>
            <p>Add your education history on the Ascentul dashboard to autofill job applications.</p>
            <button
              className="btn-primary"
              style={{ marginTop: '16px' }}
              onClick={openDashboard}
            >
              Add Education
            </button>
          </div>
        ) : (
          <div className="item-list">
            {educationHistory.map((edu, index) => (
              <EducationCard key={index} education={edu} formatDate={formatDate} />
            ))}
          </div>
        )}
      </div>

      <div className="form-section">
        <h2>Tips for Education Fields</h2>
        <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
          <p>
            • <strong>Include your GPA</strong> if it's above 3.0 (or equivalent)
          </p>
          <p>
            • <strong>Add relevant coursework</strong> - Some applications ask for this
          </p>
          <p>
            • <strong>List certifications</strong> - These are often asked for separately
          </p>
        </div>
      </div>
    </div>
  );
}

interface EducationCardProps {
  education: EducationHistoryItem;
  formatDate: (date?: string) => string;
}

function EducationCard({ education, formatDate }: EducationCardProps) {
  return (
    <div className="item-card">
      <div className="item-card-header">
        <div>
          <div className="item-card-title">{education.school || 'Unknown School'}</div>
          <div className="item-card-subtitle">
            {[education.degree, education.fieldOfStudy].filter(Boolean).join(' in ') ||
              'Degree not specified'}
          </div>
        </div>
        <div className="item-card-date">
          {formatDate(education.startDate)} - {formatDate(education.endDate)}
        </div>
      </div>
      {education.gpa && (
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
          GPA: {education.gpa}
        </div>
      )}
      {education.activities && (
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
          Activities: {education.activities}
        </div>
      )}
      {education.location && (
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
          📍 {education.location}
        </div>
      )}
    </div>
  );
}
