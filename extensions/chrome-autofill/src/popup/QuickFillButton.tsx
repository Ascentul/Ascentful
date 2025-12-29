/**
 * QuickFillButton Component
 *
 * Primary action button that triggers autofill on the current page.
 */

import { useState, useEffect, useRef } from 'react';
import type { ATSDetectionResult, ATSPlatform } from '~/types';

type FillStatus = 'idle' | 'detecting' | 'ready' | 'filling' | 'success' | 'error' | 'not-supported';

// Type-safe ATS pattern configuration
const ATS_PATTERNS: Array<{ pattern: RegExp; platform: ATSPlatform; displayName: string }> = [
  { pattern: /greenhouse\.io/i, platform: 'greenhouse', displayName: 'Greenhouse' },
  { pattern: /lever\.co/i, platform: 'lever', displayName: 'Lever' },
  { pattern: /myworkdayjobs\.com/i, platform: 'workday', displayName: 'Workday' },
  { pattern: /linkedin\.com\/jobs/i, platform: 'linkedin', displayName: 'LinkedIn' },
  { pattern: /indeed\.com\/(viewjob|apply)/i, platform: 'indeed', displayName: 'Indeed' },
  { pattern: /taleo\.net/i, platform: 'taleo', displayName: 'Taleo' },
  { pattern: /icims\.com/i, platform: 'icims', displayName: 'iCIMS' },
  { pattern: /smartrecruiters\.com/i, platform: 'smartrecruiters', displayName: 'SmartRecruiters' },
];

export function QuickFillButton() {
  const [status, setStatus] = useState<FillStatus>('detecting');
  const [atsInfo, setAtsInfo] = useState<ATSDetectionResult | null>(null);
  const [message, setMessage] = useState<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Detect ATS on current page via content script
    detectATS();
  }, []);

  const detectATS = async () => {
    setStatus('detecting');

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id || !tab.url) {
        setStatus('not-supported');
        setMessage('Unable to detect page');
        return;
      }

      // Check if URL matches any known ATS patterns
      const url = tab.url.toLowerCase();
      const match = ATS_PATTERNS.find((p) => p.pattern.test(url));

      if (match) {
        setAtsInfo({
          detected: true,
          platform: match.platform,
          confidence: 0.9,
        });
        setStatus('ready');
        setMessage(`${match.displayName} detected`);
      } else {
        setStatus('not-supported');
        setMessage('Not a supported job application page');
      }
    } catch (error) {
      console.error('[Ascentful] ATS detection error:', error);
      setStatus('not-supported');
      setMessage('Unable to detect ATS');
    }
  };

  const handleFill = async () => {
    // Capture current platform to avoid stale closure in setTimeout callbacks
    const currentPlatform = atsInfo?.platform;
    setStatus('filling');

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        throw new Error('No active tab');
      }

      // Send message to content script to fill the form
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM' });

      if (response?.success) {
        setStatus('success');
        setMessage(`Filled ${response.filledFields || 'all'} fields!`);

        // Reset after 3 seconds
        timeoutRef.current = setTimeout(() => {
          setStatus('ready');
          setMessage(`${currentPlatform} detected`);
        }, 3000);
      } else {
        throw new Error(response?.error || 'Fill failed');
      }
    } catch (error) {
      console.error('[Ascentul] Fill error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Fill failed');

      // Reset after 3 seconds
      timeoutRef.current = setTimeout(() => {
        setStatus('ready');
        setMessage(`${currentPlatform} detected`);
      }, 3000);
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case 'detecting':
        return (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Detecting...</span>
          </>
        );
      case 'filling':
        return (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Filling form...</span>
          </>
        );
      case 'success':
        return (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Filled!</span>
          </>
        );
      case 'error':
        return (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>Try again</span>
          </>
        );
      case 'not-supported':
        return (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>Not supported</span>
          </>
        );
      default:
        return (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>Fill Application</span>
          </>
        );
    }
  };

  const getButtonStyles = () => {
    const base =
      'w-full py-3 px-4 font-medium rounded-card transition-all flex items-center justify-center gap-2';

    switch (status) {
      case 'success':
        return `${base} bg-success-500 text-white`;
      case 'error':
        return `${base} bg-danger-500 text-white hover:bg-danger-500/90`;
      case 'not-supported':
        return `${base} bg-neutral-200 text-neutral-500 cursor-not-allowed`;
      case 'detecting':
      case 'filling':
        return `${base} bg-primary-500 text-white cursor-wait`;
      default:
        return `${base} bg-primary-500 text-white hover:bg-primary-700 shadow-card hover:shadow-card-hover`;
    }
  };

  const isDisabled = ['detecting', 'filling', 'not-supported', 'success'].includes(status);

  return (
    <div>
      <button onClick={handleFill} disabled={isDisabled} className={getButtonStyles()}>
        {getButtonContent()}
      </button>
      {message && (
        <p
          className={`mt-2 text-xs text-center ${
            status === 'error' ? 'text-danger-500' : 'text-neutral-500'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export default QuickFillButton;
