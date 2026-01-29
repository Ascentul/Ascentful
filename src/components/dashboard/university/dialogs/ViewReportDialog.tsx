'use client';

import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { Download, Eye, FileText, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface ViewReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportName: string;
  reportType: string;
  clerkId: string | undefined;
}

interface ReportData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export function ViewReportDialog({
  open,
  onOpenChange,
  reportName,
  reportType,
  clerkId,
}: ViewReportDialogProps) {
  const { toast } = useToast();
  const { getToken } = useClerkAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch report data when dialog opens
  const fetchReportData = useCallback(async () => {
    if (!clerkId) return;

    setIsLoading(true);
    setError(null);
    setReportData(null);

    try {
      const token = await getToken({ template: 'convex' });
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch('/api/university/export-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clerkId,
          reportType,
          reportName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to load report (${response.status})`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) errorMessage = errorData.error;
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMessage);
      }

      const csvText = await response.text();
      const lines = csvText.split('\n').filter((line) => line.trim());

      if (lines.length === 0) {
        setReportData({ headers: [], rows: [], totalRows: 0 });
        return;
      }

      // Parse CSV - handle quoted values and escaped quotes
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            // Check for escaped quote ("")
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++; // Skip the next quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const allRows = lines.slice(1).map(parseCSVLine);
      const previewRows = allRows.slice(0, 10); // Show first 10 rows

      setReportData({
        headers,
        rows: previewRows,
        totalRows: allRows.length,
      });
    } catch (err) {
      console.error('Failed to fetch report:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, [clerkId, getToken, reportName, reportType]);

  useEffect(() => {
    if (open && clerkId) {
      fetchReportData();
    }
  }, [open, clerkId, fetchReportData]);

  const handleDownload = async () => {
    if (!clerkId) return;

    setIsDownloading(true);
    try {
      const token = await getToken({ template: 'convex' });
      if (!token) {
        toast({
          title: 'Authentication required',
          description: 'Please log in again to download reports.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/university/export-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clerkId,
          reportType,
          reportName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Download failed';
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) errorMessage = errorData.error;
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `${reportName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}`;
      a.download = `${filename}.csv`;
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        window.URL.revokeObjectURL(url);
        a.remove();
      }

      toast({
        title: 'Download complete',
        description: `${reportName} downloaded successfully.`,
      });
    } catch (err) {
      console.error('Download error:', err);
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {reportName}
          </DialogTitle>
          <DialogDescription>{reportType} - Preview of report data</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading report...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-destructive font-medium">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchReportData}>
                Try Again
              </Button>
            </div>
          ) : reportData ? (
            reportData.headers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No data available in this report.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {reportData.headers.map((header, idx) => (
                          <TableHead key={idx} className="whitespace-nowrap">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.rows.map((row, rowIdx) => (
                        <TableRow key={rowIdx}>
                          {row.map((cell, cellIdx) => (
                            <TableCell key={cellIdx} className="max-w-[200px] truncate">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {reportData.totalRows > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Showing 10 of {reportData.totalRows} rows. Download the full report for all
                    data.
                  </p>
                )}
              </div>
            )
          ) : null}
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button onClick={handleDownload} disabled={isDownloading || isLoading}>
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
