'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

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

export interface PhoneEntry {
  id?: string;
  phone: string;
  type: 'mobile' | 'home' | 'work';
  isPrimary?: boolean;
}

interface MultiPhoneInputProps {
  value: PhoneEntry[];
  onChange: (phones: PhoneEntry[]) => void;
}

export function MultiPhoneInput({ value, onChange }: MultiPhoneInputProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneType, setNewPhoneType] = useState<'mobile' | 'home' | 'work'>('mobile');
  const [editingValues, setEditingValues] = useState<Record<number, string>>({});

  const addPhone = () => {
    if (!newPhone.trim()) return;

    // Basic phone validation (allow various formats)
    const phoneRegex = /^[\d\s\-\(\)\+\.]+$/;
    if (!phoneRegex.test(newPhone)) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicates (normalize by removing non-digit characters)
    const normalizedNewPhone = newPhone.replace(/\D/g, '');
    if (value.some((entry) => entry.phone.replace(/\D/g, '') === normalizedNewPhone)) {
      toast({
        title: 'Duplicate phone number',
        description: 'This phone number is already added',
        variant: 'destructive',
      });
      return;
    }

    onChange([
      ...value,
      {
        id: `phone-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        phone: newPhone.trim(),
        type: newPhoneType,
        isPrimary: value.length === 0, // First phone is primary by default
      },
    ]);

    setNewPhone('');
    setShowAddForm(false);
  };

  const removePhone = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    // If we removed the primary phone, make the first one primary
    if (value[index].isPrimary && updated.length > 0) {
      updated[0] = { ...updated[0], isPrimary: true };
    }
    onChange(updated);
  };

  const setPrimary = (index: number) => {
    const updated = value.map((phone, i) => ({
      ...phone,
      isPrimary: i === index,
    }));
    onChange(updated);
  };

  const updatePhone = (index: number, updates: Partial<PhoneEntry>) => {
    const updated = [...value];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const isPhoneDuplicate = (phone: string, excludeIndex?: number) => {
    const normalized = phone.replace(/\D/g, '');
    return value.some(
      (entry, i) => i !== excludeIndex && entry.phone.replace(/\D/g, '') === normalized,
    );
  };

  return (
    <div className="space-y-3">
      {/* Existing phones */}
      {value.map((entry, index) => (
        <div
          key={entry.id || `phone-${index}`}
          className="flex items-center gap-2 p-3 border rounded-lg bg-white"
        >
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="tel"
                value={entry.phone}
                onFocus={() => {
                  // Store the original value when editing starts
                  setEditingValues((prev) => ({ ...prev, [index]: entry.phone }));
                }}
                onChange={(e) => updatePhone(index, { phone: e.target.value })}
                onBlur={(e) => {
                  const phoneRegex = /^[\d\s\-\(\)\+\.]+$/;
                  const isDuplicate = isPhoneDuplicate(e.target.value, index);
                  if (e.target.value && (!phoneRegex.test(e.target.value) || isDuplicate)) {
                    toast({
                      title: isDuplicate ? 'Duplicate phone number' : 'Invalid phone number',
                      description: isDuplicate
                        ? 'This phone number is already added'
                        : 'Please enter a valid phone number',
                      variant: 'destructive',
                    });
                    // Revert to the original value
                    const originalValue = editingValues[index] || entry.phone;
                    updatePhone(index, { phone: originalValue });
                  }
                  // Clean up the stored value
                  setEditingValues((prev) => {
                    const updated = { ...prev };
                    delete updated[index];
                    return updated;
                  });
                }}
                className="rounded-control"
                placeholder="+1 (555) 123-4567"
              />
              <Select
                value={entry.type}
                onValueChange={(type: 'mobile' | 'home' | 'work') => updatePhone(index, { type })}
              >
                <SelectTrigger className="w-32 rounded-control">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="home">Home</SelectItem>
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
            onClick={() => removePhone(index)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            aria-label="Remove phone number"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Add new phone form */}
      {showAddForm && (
        <div className="p-3 border border-dashed rounded-lg space-y-2">
          <Label className="text-sm font-medium">Add Phone</Label>
          <div className="flex gap-2">
            <Input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="flex-1 rounded-control"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPhone();
                }
              }}
            />
            <Select
              value={newPhoneType}
              onValueChange={(v: 'mobile' | 'home' | 'work') => setNewPhoneType(v)}
            >
              <SelectTrigger className="w-32 rounded-control">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="work">Work</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={addPhone} size="sm" className="rounded-control">
              Add
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setNewPhone('');
              }}
              size="sm"
              className="rounded-control"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add phone button */}
      {!showAddForm && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full rounded-control flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add phone
        </Button>
      )}
    </div>
  );
}
