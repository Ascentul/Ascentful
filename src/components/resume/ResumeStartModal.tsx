'use client';

import { CloudUpload, FileText, User } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { CreateResumeFunnel } from '@/components/resume-builder/funnel';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface ResumeStartModalProps {
  open: boolean;
  onClose: () => void;
  onSelectCreate: () => void;
  onSelectUpload: (file: File) => void;
  onSelectAI?: () => void;
}

type StartSource = 'profile' | 'upload' | 'blank';

export function ResumeStartModal({ open, onClose }: ResumeStartModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFunnel, setShowFunnel] = useState(false);
  const [startSource, setStartSource] = useState<StartSource>('profile');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedContent, setUploadedContent] = useState<any>(null);
  const [isParsingUpload, setIsParsingUpload] = useState(false);

  const handleSelectProfile = () => {
    setStartSource('profile');
    setShowFunnel(true);
  };

  const handleSelectBlank = () => {
    setStartSource('blank');
    setShowFunnel(true);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsParsingUpload(true);

    try {
      // Extract text from file
      const formData = new FormData();
      formData.append('file', file);

      const extractResponse = await fetch('/api/resumes/extract', {
        method: 'POST',
        body: formData,
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract text from resume');
      }

      const { text } = await extractResponse.json();

      if (!text || text.trim().length === 0) {
        // Still proceed with funnel, but with empty content
        setUploadedContent(null);
      } else {
        // Parse the extracted text
        const parseResponse = await fetch('/api/resumes/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeText: text }),
        });

        if (parseResponse.ok) {
          const { data: parsedData } = await parseResponse.json();

          // Convert parsed data to resume format
          setUploadedContent({
            contactInfo: parsedData.personalInfo || {
              name: '',
              email: '',
              phone: '',
              location: '',
            },
            summary: parsedData.summary || '',
            skills: parsedData.skills || [],
            experience: parsedData.experience || [],
            education: parsedData.education || [],
            projects: parsedData.projects || [],
            achievements: parsedData.achievements || [],
          });
        }
      }

      setStartSource('upload');
      setShowFunnel(true);
    } catch (error) {
      console.error('Error parsing upload:', error);
      // Still proceed with funnel
      setStartSource('upload');
      setShowFunnel(true);
    } finally {
      setIsParsingUpload(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClose = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowFunnel(false);
    setUploadedFile(null);
    setUploadedContent(null);
    onClose();
  };

  const handleFunnelClose = () => {
    setShowFunnel(false);
    setUploadedFile(null);
    setUploadedContent(null);
    onClose();
  };

  // Show the funnel if active
  if (showFunnel) {
    return (
      <CreateResumeFunnel
        open={true}
        onClose={handleFunnelClose}
        startSource={startSource}
        uploadedContent={uploadedContent}
        uploadedFile={uploadedFile}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="px-8 py-10">
          {/* Title */}
          <DialogTitle className="text-center text-3xl font-semibold text-slate-900 mb-2">
            How do you want to start?
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500 mb-8">
            All options lead to the same powerful editor
          </DialogDescription>

          {/* Options - 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Start from Profile (Recommended) */}
            <button
              type="button"
              onClick={handleSelectProfile}
              disabled={isParsingUpload}
              className="relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-primary-200 bg-primary-50/30 hover:border-primary-500 hover:bg-primary-50/50 hover:shadow-lg hover:shadow-primary-100 transition-all min-h-[240px] group"
            >
              {/* Recommended Badge */}
              <div className="absolute top-3 left-3">
                <span className="bg-primary-500 text-white text-xs font-semibold px-2.5 py-1 rounded-md">
                  Recommended
                </span>
              </div>

              {/* Icon */}
              <div className="mb-5">
                <User
                  className="h-10 w-10 text-primary-500 group-hover:text-primary-600 transition-colors"
                  strokeWidth={1.5}
                />
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Start from my profile</h3>

              {/* Description */}
              <p className="text-sm text-slate-500 text-center max-w-[200px]">
                Pre-fill with your career profile data
              </p>
            </button>

            {/* Upload Resume Option */}
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isParsingUpload}
              className="relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-slate-200 hover:border-primary-500 hover:bg-primary-50/30 hover:shadow-lg hover:shadow-primary-100 transition-all min-h-[240px] group"
            >
              {/* Badge */}
              <div className="absolute top-3 left-3">
                <span className="bg-green-500 text-white text-xs font-semibold px-2.5 py-1 rounded-md">
                  Saves 90% time
                </span>
              </div>

              {/* Icon */}
              <div className="mb-5">
                {isParsingUpload ? (
                  <div className="h-10 w-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CloudUpload
                    className="h-10 w-10 text-slate-400 group-hover:text-primary-500 transition-colors"
                    strokeWidth={1.5}
                  />
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {isParsingUpload ? 'Parsing...' : 'Upload a resume'}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-500 text-center max-w-[200px]">
                Import and format your existing resume
              </p>
            </button>

            {/* Blank Resume Option */}
            <button
              type="button"
              onClick={handleSelectBlank}
              disabled={isParsingUpload}
              className="relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-slate-200 hover:border-primary-500 hover:bg-primary-50/30 hover:shadow-lg hover:shadow-primary-100 transition-all min-h-[240px] group"
            >
              {/* Icon */}
              <div className="mb-5">
                <FileText
                  className="h-10 w-10 text-slate-400 group-hover:text-primary-500 transition-colors"
                  strokeWidth={1.5}
                />
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Blank resume</h3>

              {/* Description */}
              <p className="text-sm text-slate-500 text-center max-w-[200px]">
                Start fresh with an empty template
              </p>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
