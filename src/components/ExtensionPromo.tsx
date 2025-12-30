'use client';

import { motion } from 'framer-motion';
import { Check, Chrome, ExternalLink, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const EXTENSION_URL =
  'https://chrome.google.com/webstore/detail/ascentul-autofill/YOUR_EXTENSION_ID';
const DISMISSED_KEY = 'ascentul_extension_promo_dismissed';

interface AutofillFeature {
  label: string;
  available: boolean;
}

const autofillFeatures: AutofillFeature[] = [
  { label: 'First Name', available: true },
  { label: 'Last Name', available: true },
  { label: 'Resume', available: true },
  { label: 'Experience', available: true },
  { label: 'Education', available: true },
  { label: 'Location', available: true },
];

export function ExtensionPromo() {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    setIsDismissed(dismissed === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-white to-neutral-50 border-neutral-200">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left side - Content */}
          <div className="p-6 lg:p-8">
            <p className="text-sm text-primary-500 font-medium mb-2">Application Autofill</p>
            <h3 className="text-2xl lg:text-3xl font-bold text-neutral-900 mb-4">
              Fill Applications in Seconds
            </h3>
            <p className="text-neutral-600 mb-6 leading-relaxed">
              Save hours of tedious form filling with our Chrome Extension's autofill function. It
              works on thousands of sites across the web. Get started by setting up your application
              profile.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => router.push('/account/profile')}
                className="bg-primary-500 hover:bg-primary-600 text-white rounded-full px-6"
              >
                Edit Profile
              </Button>
              <Button
                variant="link"
                onClick={() => window.open(EXTENSION_URL, '_blank')}
                className="text-neutral-600 hover:text-primary-500"
              >
                or get the extension
              </Button>
            </div>
          </div>

          {/* Right side - Visual */}
          <div className="relative bg-neutral-100/50 p-6 lg:p-8 flex items-center justify-center min-h-[300px] lg:min-h-0">
            {/* Decorative background elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-100 rounded-full opacity-50" />
              <div className="absolute bottom-10 -left-10 w-32 h-32 bg-yellow-100 rounded-full opacity-50" />
            </div>

            {/* Mock job application form */}
            <div className="relative z-10 flex items-start gap-4">
              {/* Application form card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl shadow-lg p-4 w-56 border border-neutral-200"
              >
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-100">
                  <div className="w-2 h-2 rounded-full bg-primary-500" />
                  <span className="text-xs font-medium text-neutral-700">Apply for this Job</span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500 w-16">First Name</span>
                    <div className="flex-1 h-6 bg-neutral-50 rounded px-2 flex items-center">
                      <span className="text-xs text-neutral-700">Peter</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500 w-16">Last Name</span>
                    <div className="flex-1 h-6 bg-neutral-50 rounded px-2 flex items-center">
                      <span className="text-xs text-neutral-700">Roberts</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500 w-16">Email</span>
                    <div className="flex-1 h-6 bg-neutral-50 rounded px-2 flex items-center">
                      <span className="text-xs text-neutral-700 truncate">peter@gmail.com</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500 w-16">Phone</span>
                    <div className="flex-1 h-6 bg-neutral-50 rounded px-2 flex items-center">
                      <span className="text-xs text-neutral-700">(555) 123-4567</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Review Autofill popup */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-xl shadow-xl p-4 w-48 border border-neutral-200"
              >
                <h4 className="text-sm font-semibold text-neutral-900 mb-3">Review Autofill</h4>
                <p className="text-xs text-neutral-500 mb-3">Autofill details</p>

                <div className="space-y-2">
                  {autofillFeatures.map((feature) => (
                    <div key={feature.label} className="flex items-center justify-between">
                      <span className="text-xs text-neutral-700">{feature.label}</span>
                      <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chrome icon */}
                <div className="mt-4 flex justify-center">
                  <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center border border-neutral-100">
                    <Chrome className="w-6 h-6 text-[#4285F4]" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for sidebars or smaller spaces
 */
export function ExtensionPromoCompact() {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY + '_compact');
    setIsDismissed(dismissed === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY + '_compact', 'true');
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Card className="relative bg-gradient-to-r from-primary-50 to-white border-primary-100">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-primary-100 text-neutral-400 hover:text-neutral-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Chrome className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-neutral-900 mb-1">Autofill Applications</h4>
            <p className="text-xs text-neutral-600 mb-2">
              Fill job forms instantly with our Chrome extension
            </p>
            <Button
              size="sm"
              variant="link"
              className="h-auto p-0 text-xs text-primary-600 hover:text-primary-700"
              onClick={() => window.open(EXTENSION_URL, '_blank')}
            >
              Get Extension <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ExtensionPromo;
