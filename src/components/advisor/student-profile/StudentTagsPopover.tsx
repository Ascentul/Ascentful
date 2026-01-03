'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { Check, Plus, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface StudentTagsPopoverProps {
  studentId: Id<'users'>;
  tags: string[];
}

// Predefined tag options
const PREDEFINED_TAGS = ['At-risk', 'International', 'Athlete', 'First-gen', 'Honors'];

const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 20;

export function StudentTagsPopover({ studentId, tags }: StudentTagsPopoverProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const updateTags = useMutation(api.advisor_students.updateStudentTags);

  const handleAddTag = async (tag: string) => {
    if (!clerkId || tags.includes(tag) || tags.length >= MAX_TAGS) return;

    setIsUpdating(true);
    try {
      await updateTags({
        clerkId,
        studentId,
        tags: [...tags, tag.trim().slice(0, MAX_TAG_LENGTH)],
      });
      setCustomTag('');
      toast.success(`Added tag: ${tag}`);
    } catch (error) {
      console.error('Failed to add tag:', error);
      toast.error('Failed to add tag');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!clerkId) return;

    setIsUpdating(true);
    try {
      await updateTags({
        clerkId,
        studentId,
        tags: tags.filter((t) => t !== tagToRemove),
      });
      toast.success(`Removed tag: ${tagToRemove}`);
    } catch (error) {
      console.error('Failed to remove tag:', error);
      toast.error('Failed to remove tag');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCustomTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTag.trim()) {
      handleAddTag(customTag.trim());
    }
  };

  const availablePredefinedTags = PREDEFINED_TAGS.filter((t) => !tags.includes(t));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Display existing tags */}
      {tags.map((tag) => (
        <Badge
          key={tag}
          className="gap-1 text-xs cursor-pointer bg-neutral-900 text-white hover:bg-neutral-800"
          onClick={() => handleRemoveTag(tag)}
        >
          <Tag className="h-3 w-3" />
          {tag}
          <X className="h-3 w-3 ml-0.5" />
        </Badge>
      ))}

      {/* Add tag popover */}
      {tags.length < MAX_TAGS && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <div className="text-sm font-medium">Add student tag</div>

              {/* Predefined tags */}
              {availablePredefinedTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {availablePredefinedTags.map((tag) => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleAddTag(tag)}
                      disabled={isUpdating}
                    >
                      {tags.includes(tag) ? (
                        <Check className="h-3 w-3 mr-1" />
                      ) : (
                        <Plus className="h-3 w-3 mr-1" />
                      )}
                      {tag}
                    </Button>
                  ))}
                </div>
              )}

              {/* Custom tag input */}
              <form onSubmit={handleCustomTagSubmit} className="flex gap-2">
                <Input
                  placeholder="Custom tag..."
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value.slice(0, MAX_TAG_LENGTH))}
                  className="h-8 text-xs"
                  disabled={isUpdating}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8"
                  disabled={!customTag.trim() || isUpdating}
                >
                  Add
                </Button>
              </form>

              <p className="text-xs text-muted-foreground">
                Max {MAX_TAGS} tags, {MAX_TAG_LENGTH} chars each
              </p>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
