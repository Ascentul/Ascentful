/**
 * Work History Tab
 *
 * View and manage work experience entries.
 * Note: Full editing is done on the main Ascentul dashboard.
 */

import React from 'react';
import { useProfileStore } from '~/store/profileStore';
import type { WorkHistoryItem } from '~/types';

export default function WorkHistoryTab() {
  const { profile } = useProfileStore();
  const workHistory = profile?.workHistory || [];

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
    window.open('https://ascentul.io/dashboard/profile', '_blank');
  };

  return (
    <div className="tab-content">
      <div className="form-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Work Experience</h2>
          <button className="btn-secondary" onClick={openDashboard}>
            Edit on Dashboard
          </button>
        </div>

        {workHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💼</div>
            <h3>No work experience added</h3>
            <p>Add your work experience on the Ascentul dashboard to autofill job applications.</p>
            <button
              className="btn-primary"
              style={{ marginTop: '16px' }}
              onClick={openDashboard}
            >
              Add Work Experience
            </button>
          </div>
        ) : (
          <div className="item-list">
            {workHistory.map((job, index) => (
              <WorkHistoryCard key={index} job={job} formatDate={formatDate} />
            ))}
          </div>
        )}
      </div>

      <div className="form-section">
        <h2>Tips for Better Autofill</h2>
        <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
          <p>
            • <strong>Keep your work history current</strong> - Applications often ask for your
            most recent role
          </p>
          <p>
            • <strong>Include detailed descriptions</strong> - Some forms have fields for job
            responsibilities
          </p>
          <p>
            • <strong>Add accurate dates</strong> - Many ATS systems validate employment dates
          </p>
        </div>
      </div>
    </div>
  );
}

interface WorkHistoryCardProps {
  job: WorkHistoryItem;
  formatDate: (date?: string) => string;
}

function WorkHistoryCard({ job, formatDate }: WorkHistoryCardProps) {
  return (
    <div className="item-card">
      <div className="item-card-header">
        <div>
          <div className="item-card-title">{job.title || 'Untitled Position'}</div>
          <div className="item-card-subtitle">{job.company || 'Unknown Company'}</div>
        </div>
        <div className="item-card-date">
          {formatDate(job.startDate)} - {formatDate(job.endDate)}
        </div>
      </div>
      {job.description && (
        <div
          style={{
            fontSize: '13px',
            color: '#64748b',
            marginTop: '8px',
            whiteSpace: 'pre-line',
          }}
        >
          {job.description.length > 200
            ? job.description.substring(0, 200) + '...'
            : job.description}
        </div>
      )}
      {job.location && (
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
          📍 {job.location}
        </div>
      )}
    </div>
  );
}
