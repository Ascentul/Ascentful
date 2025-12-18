'use client';

import { Award, ExternalLink, Star } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RoleCertification } from '@/lib/career-explorer/types';

interface CertificationsTabProps {
  certifications: RoleCertification[];
}

export function CertificationsTab({ certifications }: CertificationsTabProps) {
  const requiredCerts = certifications.filter((c) => c.required);
  const optionalCerts = certifications.filter((c) => !c.required);

  if (certifications.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Award className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No specific certifications required</p>
        <p className="text-sm mt-2">This role may not require formal certifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Required Certifications */}
      {requiredCerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-red-500" />
              Required Certifications
              <Badge variant="destructive" className="ml-auto text-xs">
                Must Have
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {requiredCerts.map((cert, idx) => (
                <li key={idx} className="border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm text-neutral-800">{cert.name}</div>
                      {cert.issuer && (
                        <div className="text-xs text-neutral-500 mt-0.5">
                          Issued by {cert.issuer}
                        </div>
                      )}
                    </div>
                    {cert.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => window.open(cert.url, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Optional Certifications */}
      {optionalCerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Recommended Certifications
              <Badge variant="secondary" className="ml-auto text-xs">
                Helpful
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {optionalCerts.map((cert, idx) => (
                <li key={idx} className="border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm text-neutral-700">{cert.name}</div>
                      {cert.issuer && (
                        <div className="text-xs text-neutral-500 mt-0.5">
                          Issued by {cert.issuer}
                        </div>
                      )}
                    </div>
                    {cert.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => window.open(cert.url, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Certification Tip */}
      <Card className="bg-primary-50 border-primary-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Award className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-primary-700">
              <p className="font-medium mb-1">Plan Your Certifications</p>
              <p>
                Add certifications to your career path to track progress. Some certifications may
                require prerequisites or work experience.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
