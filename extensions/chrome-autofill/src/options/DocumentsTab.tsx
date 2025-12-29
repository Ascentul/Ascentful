/**
 * Documents Tab
 *
 * View and select resumes for autofill.
 * Manage which resume is used as the default.
 */

import React from 'react';
import { useProfileStore } from '~/store/profileStore';
import type { Resume } from '~/types';

export default function DocumentsTab() {
  const { profile, selectedResumeId, setSelectedResume } = useProfileStore();
  const resumes = profile?.resumes || [];

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'Unknown date';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Unknown date';
    }
  };

  const openDashboard = () => {
    window.open('https://ascentul.io/resumes', '_blank');
  };

  const handleSelectResume = async (resumeId: string) => {
    await setSelectedResume(resumeId);
  };

  return (
    <div className="tab-content">
      <div className="form-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Your Resumes</h2>
          <button className="btn-secondary" onClick={openDashboard}>
            Manage Resumes
          </button>
        </div>

        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
          Select which resume to use for autofill. The selected resume's data will be used when
          filling out job applications.
        </p>

        {resumes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <h3>No resumes found</h3>
            <p>
              Create a resume on the Ascentul dashboard to use its data for autofilling
              applications.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: '16px' }}
              onClick={openDashboard}
            >
              Create Resume
            </button>
          </div>
        ) : (
          <div className="item-list">
            {resumes.map((resume) => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                isSelected={selectedResumeId === resume.id}
                onSelect={() => handleSelectResume(resume.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      <div className="form-section">
        <h2>How Resumes Work</h2>
        <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
          <p>
            • <strong>Selected resume data is used for autofill</strong> - Work history, education,
            and skills from your selected resume will populate job application forms.
          </p>
          <p>
            • <strong>Profile data takes priority</strong> - Contact information (name, email,
            phone) always comes from your profile, not the resume.
          </p>
          <p>
            • <strong>Resume file uploads</strong> - When applications require uploading a resume
            file, you'll still need to manually upload from your computer.
          </p>
        </div>
      </div>
    </div>
  );
}

interface ResumeCardProps {
  resume: Resume;
  isSelected: boolean;
  onSelect: () => void;
  formatDate: (timestamp?: number) => string;
}

function ResumeCard({ resume, isSelected, onSelect, formatDate }: ResumeCardProps) {
  return (
    <div
      className={`resume-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      style={{ cursor: 'pointer' }}
    >
      <div className="resume-icon">📄</div>
      <div className="resume-info">
        <div className="resume-name">{resume.name || 'Untitled Resume'}</div>
        <div className="resume-date">
          Last updated: {formatDate(resume.updatedAt || resume.createdAt)}
        </div>
      </div>
      <div className="resume-actions">
        {isSelected ? (
          <span
            style={{
              padding: '4px 12px',
              background: '#5371ff',
              color: 'white',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '500',
            }}
          >
            Selected
          </span>
        ) : (
          <button
            className="btn-secondary"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            Select
          </button>
        )}
      </div>
    </div>
  );
}
