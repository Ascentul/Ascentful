/**
 * Profile Tab
 *
 * Edit basic profile information used for autofill.
 */

import React, { useState, useEffect } from 'react';
import { useProfileStore } from '~/store/profileStore';

export default function ProfileTab() {
  const { profile, updateProfile, isSyncing } = useProfileStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedinUrl: '',
    githubUrl: '',
    websiteUrl: '',
    currentTitle: '',
    currentCompany: '',
    summary: '',
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        location: profile.location || '',
        linkedinUrl: profile.linkedinUrl || '',
        githubUrl: profile.githubUrl || '',
        websiteUrl: profile.websiteUrl || '',
        currentTitle: profile.currentTitle || '',
        currentCompany: profile.currentCompany || '',
        summary: profile.summary || '',
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await updateProfile(formData);
      setIsDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveStatus('error');
    }
  };

  return (
    <div className="tab-content">
      {/* Basic Info */}
      <div className="form-section">
        <h2>Basic Information</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john@example.com"
              disabled
            />
            <span className="form-help">Email cannot be changed here</span>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="San Francisco, CA"
            />
          </div>
        </div>
      </div>

      {/* Professional Info */}
      <div className="form-section">
        <h2>Current Position</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="currentTitle">Job Title</label>
            <input
              type="text"
              id="currentTitle"
              name="currentTitle"
              value={formData.currentTitle}
              onChange={handleChange}
              placeholder="Software Engineer"
            />
          </div>
          <div className="form-group">
            <label htmlFor="currentCompany">Company</label>
            <input
              type="text"
              id="currentCompany"
              name="currentCompany"
              value={formData.currentCompany}
              onChange={handleChange}
              placeholder="Acme Inc."
            />
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="form-section">
        <h2>Professional Links</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="linkedinUrl">LinkedIn URL</label>
            <input
              type="url"
              id="linkedinUrl"
              name="linkedinUrl"
              value={formData.linkedinUrl}
              onChange={handleChange}
              placeholder="https://linkedin.com/in/johndoe"
            />
          </div>
          <div className="form-group">
            <label htmlFor="githubUrl">GitHub URL</label>
            <input
              type="url"
              id="githubUrl"
              name="githubUrl"
              value={formData.githubUrl}
              onChange={handleChange}
              placeholder="https://github.com/johndoe"
            />
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group">
            <label htmlFor="websiteUrl">Personal Website</label>
            <input
              type="url"
              id="websiteUrl"
              name="websiteUrl"
              value={formData.websiteUrl}
              onChange={handleChange}
              placeholder="https://johndoe.com"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="form-section">
        <h2>Professional Summary</h2>
        <div className="form-row single">
          <div className="form-group">
            <label htmlFor="summary">Summary / Cover Letter Default</label>
            <textarea
              id="summary"
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              placeholder="Brief professional summary that can be used for cover letters and application forms..."
              rows={4}
            />
            <span className="form-help">
              This will be used when forms ask for a summary or cover letter
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="btn-group">
        <button className="btn-primary" onClick={handleSave} disabled={!isDirty || isSyncing || saveStatus === 'saving'}>
          {isSyncing || saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
        </button>
        {saveStatus === 'error' && (
          <span style={{ color: '#ef4444', fontSize: '14px', alignSelf: 'center' }}>
            Failed to save. Please try again.
          </span>
        )}
      </div>
    </div>
  );
}
