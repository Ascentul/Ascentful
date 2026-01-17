'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// Email validation: requires user@domain.tld format with TLD of at least 2 characters
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface EmailEntry {
  id?: string;
  email: string;
  type: 'personal' | 'work';
  isPrimary?: boolean;
}

interface MultiEmailInputProps {
  value: EmailEntry[];
  onChange: (emails: EmailEntry[]) => void;
}

export function MultiEmailInput({ value, onChange }: MultiEmailInputProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailType, setNewEmailType] = useState<'personal' | 'work'>('personal');
  const [editingValues, setEditingValues] = useState<Record<number, string>>({});

  // Ensure at least one entry is primary when entries exist
  useEffect(() => {
    if (value.length > 0 && !value.some((entry) => entry.isPrimary)) {
      const normalized = value.map((entry, i) => ({
        ...entry,
        isPrimary: i === 0,
      }));
      onChange(normalized);
    }
  }, [value, onChange]);

  const addEmail = () => {
    const trimmedEmail = newEmail.trim();
    if (!trimmedEmail) return;

    // Basic email validation
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      toast({
        title: 'Invalid email address',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicates
    if (value.some((entry) => entry.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      toast({
        title: 'Duplicate email address',
        description: 'This email address is already added',
        variant: 'destructive',
      });
      return;
    }

    onChange([
      ...value,
      {
        id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        email: trimmedEmail,
        type: newEmailType,
        isPrimary: value.length === 0, // First email is primary by default
      },
    ]);

    setNewEmail('');
    setShowAddForm(false);
  };

  const removeEmail = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    // If we removed the primary email, make the first one primary
    if (value[index].isPrimary && updated.length > 0) {
      updated[0] = { ...updated[0], isPrimary: true };
    }
    onChange(updated);
  };

  const setPrimary = (index: number) => {
    const updated = value.map((email, i) => ({
      ...email,
      isPrimary: i === index,
    }));
    onChange(updated);
  };

  const updateEmail = (index: number, updates: Partial<EmailEntry>) => {
    const updated = [...value];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Existing emails */}
      {value.map((entry, index) => (
        <div
          key={entry.id || `email-${index}`}
          className="flex items-center gap-2 p-3 border rounded-lg bg-white"
        >
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={entry.email}
                onFocus={() => {
                  // Store the original value when editing starts
                  setEditingValues((prev) => ({ ...prev, [index]: entry.email }));
                }}
                onChange={(e) => updateEmail(index, { email: e.target.value })}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim();

                  // If emptied, revert to original value
                  if (!trimmed) {
                    const originalValue = editingValues[index] ?? entry.email;
                    updateEmail(index, { email: originalValue });
                    setEditingValues((prev) => {
                      const updated = { ...prev };
                      delete updated[index];
                      return updated;
                    });
                    return;
                  }

                  const isDuplicate = value.some(
                    (entry, i) =>
                      i !== index && entry.email.toLowerCase() === trimmed.toLowerCase(),
                  );
                  if (!EMAIL_REGEX.test(trimmed) || isDuplicate) {
                    toast({
                      title: isDuplicate ? 'Duplicate email address' : 'Invalid email address',
                      description: isDuplicate
                        ? 'This email address is already added'
                        : 'Please enter a valid email address',
                      variant: 'destructive',
                    });
                    // Revert to the original value
                    const originalValue = editingValues[index] ?? entry.email;
                    updateEmail(index, { email: originalValue });
                  }
                  // Clean up the stored value
                  setEditingValues((prev) => {
                    const updated = { ...prev };
                    delete updated[index];
                    return updated;
                  });
                }}
                className="rounded-control"
                placeholder="email@example.com"
              />
              <Select
                value={entry.type}
                onValueChange={(type: 'personal' | 'work') => updateEmail(index, { type })}
              >
                <SelectTrigger className="w-32 rounded-control">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="work">Work</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => setPrimary(index)}
                className="text-xs text-muted-foreground hover:text-primary-500"
              >
                {entry.isPrimary ? '✓ Primary' : 'Set as primary'}
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeEmail(index)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            aria-label="Remove email"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Add new email form */}
      {showAddForm && (
        <div className="p-3 border border-dashed rounded-lg space-y-2">
          <Label className="text-sm font-medium">Add Email</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 rounded-control"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addEmail();
                }
              }}
            />
            <Select
              value={newEmailType}
              onValueChange={(v: 'personal' | 'work') => setNewEmailType(v)}
            >
              <SelectTrigger className="w-32 rounded-control">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="work">Work</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={addEmail} size="sm" className="rounded-control">
              Add
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setNewEmail('');
              }}
              size="sm"
              className="rounded-control"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add email button */}
      {!showAddForm && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full rounded-control flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add email
        </Button>
      )}
    </div>
  );
}
