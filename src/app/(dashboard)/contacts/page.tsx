'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Eye,
  Linkedin,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCircle2,
  Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { UpgradeModal } from '@/components/modals/UpgradeModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  _id: string;
  name: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  saved?: boolean;
  notes?: string;
  tags?: string[];
  relationship?: string;
  last_contact?: number;
  updated_at: number;
  created_at?: number;
}

interface FollowUp {
  _id: string;
  contact_id?: string;
  type: string;
  description?: string;
  due_at?: number;
  status?: string;
  notes?: string;
  created_at: number;
}

interface Interaction {
  _id: string;
  contact_id: string;
  user_id: string;
  notes?: string;
  interaction_date: number;
  created_at: number;
}

export default function ContactsPage() {
  const { user: clerkUser } = useUser();
  const { user: authUser, hasPremium } = useAuth();
  const { toast } = useToast();
  const isFreeUser = !hasPremium; // Use Clerk Billing subscription check

  const contactsData = useQuery(
    api.contacts.getUserContacts,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  ) as Contact[] | undefined;

  const followupsData = useQuery(
    api.contact_interactions.getNeedFollowup,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  ) as FollowUp[] | undefined;

  const createContactMutation = useMutation(api.contacts.createContact);
  const updateContactMutation = useMutation(api.contacts.updateContact);
  const deleteContactMutation = useMutation(api.contacts.deleteContact);
  const logInteractionMutation = useMutation(api.contact_interactions.logInteraction);
  const createFollowupMutation = useMutation(api.contact_interactions.createContactFollowup);
  const updateFollowupMutation = useMutation(api.contact_interactions.updateContactFollowup);

  const [creating, setCreating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    company: '',
    position: '',
    email: '',
    phone: '',
    linkedin_url: '',
    relationship: '',
    notes: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'companies' | 'followup'>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  // Detail view state
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('info');

  // Query interactions and follow-ups for the detail contact
  const contactInteractions = useQuery(
    api.contact_interactions.getContactInteractions,
    detailContact && clerkUser?.id
      ? { clerkId: clerkUser.id, contactId: detailContact._id as any }
      : 'skip',
  ) as Interaction[] | undefined;

  const contactFollowups = useQuery(
    api.contact_interactions.getContactFollowups,
    detailContact && clerkUser?.id
      ? { clerkId: clerkUser.id, contactId: detailContact._id as any }
      : 'skip',
  ) as FollowUp[] | undefined;

  // Interaction logging
  const [showLogInteraction, setShowLogInteraction] = useState(false);
  const [interactionNotes, setInteractionNotes] = useState('');
  const [interactionContact, setInteractionContact] = useState<Contact | null>(null);

  // Follow-up scheduling
  const [showScheduleFollowup, setShowScheduleFollowup] = useState(false);
  const [followupContact, setFollowupContact] = useState<Contact | null>(null);
  const [followupType, setFollowupType] = useState('follow_up');
  const [followupDescription, setFollowupDescription] = useState('');
  const [followupDueDate, setFollowupDueDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');

  const createContact = async () => {
    if (!form.full_name.trim()) return;

    // Check free user limit (1 contact max)
    if (isFreeUser && contactsData && contactsData.length >= 1) {
      setShowUpgradeModal(true);
      return;
    }

    setCreating(true);
    try {
      if (!clerkUser?.id) return;
      const result = await createContactMutation({
        clerkId: clerkUser.id,
        name: form.full_name,
        company: form.company || undefined,
        position: form.position || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        linkedin_url: form.linkedin_url || undefined,
        relationship: form.relationship || undefined,
        notes: form.notes || undefined,
      });

      // Wait a brief moment for Convex to propagate the change
      await new Promise((resolve) => setTimeout(resolve, 100));

      setForm({
        full_name: '',
        company: '',
        position: '',
        email: '',
        phone: '',
        linkedin_url: '',
        relationship: '',
        notes: '',
      });
      setShowAdd(false);
      toast({
        title: 'Contact added',
        description: 'Your contact has been added successfully.',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to add contact. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const updateContact = async () => {
    if (!clerkUser?.id || !editingContact) return;
    setCreating(true);
    try {
      await updateContactMutation({
        clerkId: clerkUser.id,
        contactId: editingContact._id as any,
        updates: {
          name: form.full_name,
          company: form.company || undefined,
          position: form.position || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          linkedin_url: form.linkedin_url || undefined,
          relationship: form.relationship || undefined,
          notes: form.notes || undefined,
        },
      });

      // Build the updated contact object for local state update
      const updatedContact: Contact = {
        ...editingContact,
        name: form.full_name,
        company: form.company || undefined,
        position: form.position || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        linkedin_url: form.linkedin_url || undefined,
        relationship: form.relationship || undefined,
        notes: form.notes || undefined,
        updated_at: Date.now(),
      };

      // Update the detail view if it's showing this contact
      if (detailContact && detailContact._id === editingContact._id) {
        setDetailContact(updatedContact);
        setDetailNotes(form.notes || '');
      }

      // Close the edit dialog
      setShowAdd(false);

      // Clear editing state
      setEditingContact(null);
      setForm({
        full_name: '',
        company: '',
        position: '',
        email: '',
        phone: '',
        linkedin_url: '',
        relationship: '',
        notes: '',
      });

      toast({
        title: 'Contact updated',
        description: 'Your contact has been updated successfully.',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update contact. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteContact = async () => {
    if (!clerkUser?.id || !deleteId) return;
    try {
      await deleteContactMutation({
        clerkId: clerkUser.id,
        contactId: deleteId as any,
      });
      toast({
        title: 'Contact deleted',
        description: 'Your contact has been deleted successfully.',
        variant: 'success',
      });
      setDeleteId(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete contact. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openDetail = (contact: Contact) => {
    setDetailContact(contact);
    setDetailNotes(contact.notes || '');
    setActiveDetailTab('info');
  };

  const startEdit = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      full_name: contact.name,
      company: contact.company || '',
      position: contact.position || '',
      email: contact.email || '',
      phone: contact.phone || '',
      linkedin_url: contact.linkedin_url || '',
      relationship: contact.relationship || '',
      notes: contact.notes || '',
    });
    setShowAdd(true);
  };

  const openLogInteraction = (contact: Contact) => {
    setInteractionContact(contact);
    setInteractionNotes('');
    setShowLogInteraction(true);
  };

  const logInteraction = async () => {
    if (!clerkUser?.id || !interactionContact) return;
    try {
      const noteDate = new Intl.DateTimeFormat('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date());

      await logInteractionMutation({
        clerkId: clerkUser.id,
        contactId: interactionContact._id as any,
        notes: interactionNotes || undefined,
        noteDate,
      });
      toast({
        title: 'Interaction logged',
        description: 'Your interaction has been recorded.',
        variant: 'success',
      });
      setShowLogInteraction(false);
      setInteractionContact(null);
      setInteractionNotes('');

      // If the detail modal is open for this contact, switch to interactions tab
      if (detailContact && detailContact._id === interactionContact._id) {
        setActiveDetailTab('interactions');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to log interaction.',
        variant: 'destructive',
      });
    }
  };

  const openScheduleFollowup = (contact: Contact) => {
    setFollowupContact(contact);
    setFollowupType('follow_up');
    setFollowupDescription('');
    setFollowupDueDate('');
    setFollowupNotes('');
    setShowScheduleFollowup(true);
  };

  const scheduleFollowup = async () => {
    if (!clerkUser?.id || !followupContact || !followupDueDate) return;
    try {
      await createFollowupMutation({
        clerkId: clerkUser.id,
        contactId: followupContact._id as any,
        type: followupType,
        description: followupDescription,
        due_at: new Date(followupDueDate).getTime(),
        notes: followupNotes || undefined,
      });
      toast({
        title: 'Follow-up scheduled',
        description: 'Your follow-up has been scheduled successfully.',
        variant: 'success',
      });
      setShowScheduleFollowup(false);
      setFollowupContact(null);

      // If the detail modal is open for this contact, switch to follow-ups tab
      if (detailContact && detailContact._id === followupContact._id) {
        setActiveDetailTab('followups');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to schedule follow-up.',
        variant: 'destructive',
      });
    }
  };

  const completeFollowup = async (followupId: string) => {
    if (!clerkUser?.id) return;
    try {
      await updateFollowupMutation({
        clerkId: clerkUser.id,
        followupId: followupId as any,
        updates: { status: 'done' },
      });
      toast({
        title: 'Follow-up completed',
        description: 'The follow-up has been marked as completed.',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to complete follow-up.',
        variant: 'destructive',
      });
    }
  };

  const saveDetailNotes = async () => {
    if (!clerkUser?.id || !detailContact) return;
    try {
      await updateContactMutation({
        clerkId: clerkUser.id,
        contactId: detailContact._id as any,
        updates: {
          notes: detailNotes,
        },
      });
      toast({ title: 'Notes saved', variant: 'success' });
      setDetailContact({ ...detailContact, notes: detailNotes });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to save notes.',
        variant: 'destructive',
      });
    }
  };

  // Filter contacts
  const filteredContacts = useMemo(() => {
    let filtered = contactsData || [];

    // Filter by relationship
    if (relationshipFilter && relationshipFilter !== 'all') {
      filtered = filtered.filter((c) => c.relationship === relationshipFilter);
    }

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.email?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    return filtered;
  }, [contactsData, relationshipFilter, searchTerm]);

  // Group contacts by company
  const companiesData = useMemo(() => {
    const companies: Record<string, Contact[]> = {};
    filteredContacts.forEach((contact) => {
      const companyName = contact.company || 'No Company';
      if (!companies[companyName]) {
        companies[companyName] = [];
      }
      companies[companyName].push(contact);
    });
    return Object.entries(companies).sort((a, b) => b[1].length - a[1].length);
  }, [filteredContacts]);

  // Get contacts needing follow-up
  const contactsNeedingFollowup = useMemo(() => {
    if (!followupsData || !contactsData) return [];

    const contactMap = new Map(contactsData.map((c) => [c._id, c]));
    const followupContacts: Array<Contact & { followup: FollowUp }> = [];

    followupsData.forEach((followup) => {
      if (followup.contact_id) {
        const contact = contactMap.get(followup.contact_id);
        if (contact) {
          followupContacts.push({ ...contact, followup });
        }
      }
    });

    return followupContacts.sort((a, b) => (a.followup.due_at || 0) - (b.followup.due_at || 0));
  }, [followupsData, contactsData]);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="w-full">
      <div className="w-full rounded-3xl bg-white p-5 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Network Hub</h1>
            <p className="text-muted-foreground">
              Manage your professional network and foster strategic relationships
            </p>
          </div>
          <Button
            className="bg-primary-500 hover:bg-primary-700"
            onClick={() => {
              if (isFreeUser && contactsData && contactsData.length >= 1) {
                setShowUpgradeModal(true);
                return;
              }
              setEditingContact(null);
              setShowAdd(true);
              setForm({
                full_name: '',
                company: '',
                position: '',
                email: '',
                phone: '',
                linkedin_url: '',
                relationship: '',
                notes: '',
              });
            }}
            disabled={creating}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Contact
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search contacts by name, company, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full md:w-64">
              <Select value={relationshipFilter} onValueChange={setRelationshipFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Relationships</SelectItem>
                  <SelectItem value="Client">Client</SelectItem>
                  <SelectItem value="Colleague">Colleague</SelectItem>
                  <SelectItem value="Mentor">Mentor</SelectItem>
                  <SelectItem value="Recruiter">Recruiter</SelectItem>
                  <SelectItem value="Friend">Friend</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab('all');
              setExpandedCompany(null);
            }}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            All Contacts
          </Button>
          <Button
            variant={activeTab === 'companies' ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab('companies');
              setExpandedCompany(null);
            }}
            className="flex items-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            Companies
          </Button>
          <Button
            variant={activeTab === 'followup' ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab('followup');
              setExpandedCompany(null);
            }}
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Need Follow-up
            {contactsNeedingFollowup.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {contactsNeedingFollowup.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Add/Edit Contact Dialog */}
      <Dialog
        open={showAdd}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setEditingContact(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <Label htmlFor="relationship">Relationship</Label>
                <Select
                  value={form.relationship}
                  onValueChange={(value) => setForm({ ...form, relationship: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Client">Client</SelectItem>
                    <SelectItem value="Colleague">Colleague</SelectItem>
                    <SelectItem value="Mentor">Mentor</SelectItem>
                    <SelectItem value="Recruiter">Recruiter</SelectItem>
                    <SelectItem value="Friend">Friend</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="Software Engineer"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                value={form.linkedin_url}
                onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Add notes about this contact..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={editingContact ? updateContact : createContact}
              disabled={creating || !form.full_name.trim()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingContact ? 'Update Contact' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Dialog */}
      <Dialog open={!!detailContact} onOpenChange={(open) => !open && setDetailContact(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center text-xl font-bold">
                {detailContact?.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl">{detailContact?.name}</DialogTitle>
                {detailContact?.position && detailContact?.company && (
                  <p className="text-sm text-muted-foreground">
                    {detailContact.position} @ {detailContact.company}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (detailContact) {
                    // Use the current detailContact state which includes any unsaved note changes
                    startEdit(detailContact);
                  }
                }}
              >
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </div>
          </DialogHeader>

          <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab}>
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="interactions">Interactions</TabsTrigger>
              <TabsTrigger value="followups">Follow-ups</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Contact Information</div>

                {detailContact?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${detailContact.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {detailContact.email}
                    </a>
                  </div>
                )}

                {detailContact?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{detailContact.phone}</span>
                  </div>
                )}

                {detailContact?.linkedin_url && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={detailContact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      LinkedIn Profile
                    </a>
                  </div>
                )}
              </div>

              {detailContact?.relationship && (
                <div className="pt-4 border-t">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Relationship</div>
                  <Badge variant="secondary">{detailContact.relationship}</Badge>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Follow-up Information
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Last Contact:</span>
                  <span>
                    {detailContact?.last_contact ? formatDate(detailContact.last_contact) : 'Never'}
                  </span>
                </div>
                {detailContact?.last_contact && (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto mt-2 text-red-600"
                    onClick={() => detailContact && openScheduleFollowup(detailContact)}
                  >
                    Needs follow-up
                  </Button>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => detailContact && openLogInteraction(detailContact)}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Log Interaction
                </Button>
                <Button
                  onClick={() => detailContact && openScheduleFollowup(detailContact)}
                  variant="outline"
                  className="flex-1"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Follow-up
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="interactions" className="mt-4 space-y-3">
              {contactInteractions === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : contactInteractions.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No interactions recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {contactInteractions.map((interaction) => (
                    <Card key={interaction._id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {new Date(interaction.interaction_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {interaction.notes && (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {interaction.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="followups" className="mt-4 space-y-3">
              {contactFollowups === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : contactFollowups.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No follow-ups scheduled yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {contactFollowups.map((followup) => (
                    <Card key={followup._id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline" className="capitalize">
                              {followup.type.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Due: {formatDate(followup.due_at)}
                            </span>
                            {followup.status === 'done' && (
                              <Badge variant="secondary" className="text-xs">
                                Completed
                              </Badge>
                            )}
                          </div>
                          {followup.description && (
                            <p className="text-sm font-medium mb-1">{followup.description}</p>
                          )}
                          {followup.notes && (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {followup.notes}
                            </p>
                          )}
                        </div>
                        {followup.status !== 'done' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => completeFollowup(followup._id)}
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-3 mt-4">
              <Textarea
                placeholder="Add notes about this contact..."
                value={detailNotes}
                onChange={(e) => setDetailNotes(e.target.value)}
                rows={8}
              />
              <div className="flex justify-end">
                <Button onClick={saveDetailNotes}>Save Notes</Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDetailContact(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Interaction Dialog */}
      <Dialog open={showLogInteraction} onOpenChange={setShowLogInteraction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Interaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Contact</Label>
              <p className="text-sm font-medium mt-1">{interactionContact?.name}</p>
            </div>
            <div>
              <Label htmlFor="interaction_notes">Notes</Label>
              <Textarea
                id="interaction_notes"
                placeholder="What did you discuss?"
                value={interactionNotes}
                onChange={(e) => setInteractionNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={logInteraction}>Log Interaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Follow-up Dialog */}
      <Dialog open={showScheduleFollowup} onOpenChange={setShowScheduleFollowup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Contact</Label>
              <p className="text-sm font-medium mt-1">{followupContact?.name}</p>
            </div>
            <div>
              <Label htmlFor="followup_type">Type</Label>
              <Select value={followupType} onValueChange={setFollowupType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="followup_description">Description</Label>
              <Input
                id="followup_description"
                placeholder="Brief description"
                value={followupDescription}
                onChange={(e) => setFollowupDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="followup_due_date">Due Date *</Label>
              <Input
                id="followup_due_date"
                type="date"
                value={followupDueDate}
                onChange={(e) => setFollowupDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="followup_notes">Notes</Label>
              <Textarea
                id="followup_notes"
                placeholder="Additional notes"
                value={followupNotes}
                onChange={(e) => setFollowupNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={scheduleFollowup} disabled={!followupDueDate}>
              Schedule Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteContact} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contacts Table */}
      {contactsData === undefined ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* All Contacts Tab */}
          {activeTab === 'all' && (
            <>
              {filteredContacts.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    {contactsData?.length === 0
                      ? 'No contacts yet. Add your first contact to start building your network.'
                      : 'No contacts found matching your search.'}
                  </p>
                  {contactsData?.length === 0 && (
                    <Button onClick={() => setShowAdd(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Contact
                    </Button>
                  )}
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Relationship</TableHead>
                        <TableHead>Last Contact</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map((contact) => (
                        <TableRow
                          key={contact._id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openDetail(contact)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-semibold">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-blue-600 hover:underline">
                                  {contact.name}
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  {contact.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {contact.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {contact.company && contact.position ? (
                              <div>
                                <div className="font-medium">{contact.position}</div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {contact.company}
                                </div>
                              </div>
                            ) : contact.position ? (
                              <div className="font-medium">{contact.position}</div>
                            ) : contact.company ? (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {contact.company}
                              </div>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {contact.relationship ? (
                              <Badge variant="secondary">{contact.relationship}</Badge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {formatDate(contact.last_contact)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openDetail(contact)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => startEdit(contact)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openLogInteraction(contact)}>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Log Interaction
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openScheduleFollowup(contact)}>
                                  <Calendar className="h-4 w-4 mr-2" />
                                  Schedule Follow-up
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteId(contact._id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </>
          )}

          {/* Companies Tab */}
          {activeTab === 'companies' && (
            <>
              {companiesData.length === 0 ? (
                <Card className="p-8 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No companies found</h3>
                  <p className="text-muted-foreground">
                    Add contacts with company information to see them organized here.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {companiesData.map(([company, contacts]) => {
                    const isExpanded = expandedCompany === company;
                    return (
                      <Card key={company} className="overflow-hidden">
                        <div
                          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                          onClick={() => setExpandedCompany(isExpanded ? null : company)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{company}</h3>
                              <p className="text-sm text-muted-foreground">
                                {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon">
                            {isExpanded ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="18 15 12 9 6 15"></polyline>
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="6 9 12 15 18 9"></polyline>
                              </svg>
                            )}
                          </Button>
                        </div>

                        {isExpanded && (
                          <div className="border-t bg-muted/20">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Contact</TableHead>
                                  <TableHead>Position</TableHead>
                                  <TableHead>Relationship</TableHead>
                                  <TableHead>Last Contact</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {contacts.map((contact) => (
                                  <TableRow
                                    key={contact._id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => openDetail(contact)}
                                  >
                                    <TableCell>
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-semibold">
                                          {contact.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <div className="font-medium text-blue-600 hover:underline">
                                            {contact.name}
                                          </div>
                                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                                            {contact.email && (
                                              <span className="flex items-center gap-1">
                                                <Mail className="h-3 w-3" />
                                                {contact.email}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {contact.position ? (
                                        <div className="font-medium">{contact.position}</div>
                                      ) : (
                                        '—'
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {contact.relationship ? (
                                        <Badge variant="secondary">{contact.relationship}</Badge>
                                      ) : (
                                        '—'
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                        {formatDate(contact.last_contact)}
                                      </div>
                                    </TableCell>
                                    <TableCell
                                      className="text-right"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button size="sm" variant="ghost">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => openDetail(contact)}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            View Contact
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => startEdit(contact)}>
                                            <Pencil className="h-4 w-4 mr-2" />
                                            Edit Contact
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => openLogInteraction(contact)}
                                          >
                                            <MessageSquare className="h-4 w-4 mr-2" />
                                            Log Interaction
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => openScheduleFollowup(contact)}
                                          >
                                            <Calendar className="h-4 w-4 mr-2" />
                                            Schedule Follow-up
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => setDeleteId(contact._id)}
                                            className="text-red-600"
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Need Follow-up Tab */}
          {activeTab === 'followup' && (
            <>
              {contactsNeedingFollowup.length === 0 ? (
                <Card className="p-8 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                  <p className="text-muted-foreground">No pending follow-ups at the moment.</p>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contactsNeedingFollowup.map((item) => (
                        <TableRow key={item._id}>
                          <TableCell
                            className="font-medium text-blue-600 hover:underline cursor-pointer"
                            onClick={() => openDetail(item)}
                          >
                            {item.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.followup.type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(item.followup.due_at)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.followup.description || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => completeFollowup(item.followup._id)}
                            >
                              Complete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Upgrade Modal for Free User Limits */}
      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} feature="contact" />
    </div>
  );
}
