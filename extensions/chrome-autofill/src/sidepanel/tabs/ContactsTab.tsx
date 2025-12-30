/**
 * Contacts Tab
 *
 * Shows networking contacts with quick add functionality.
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { ContactCard } from '../components/ContactCard';
import { QuickAddContactForm } from '../components/QuickAddContactForm';
import { useContactsStore } from '~/store/contactsStore';

export function ContactsTab() {
  const {
    contacts,
    isLoading,
    fetchContacts,
    createContact,
    searchQuery,
    setSearchQuery,
    getFilteredContacts,
  } = useContactsStore();
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleCreateContact = async (data: {
    name: string;
    company?: string;
    title?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    notes?: string;
  }) => {
    const contact = await createContact({
      ...data,
      position: data.title, // Map title to position for API
    });
    if (contact) {
      setShowAddForm(false);
    }
  };

  const sortedContacts = getFilteredContacts();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-sm text-neutral-500">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with Add Button */}
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-900">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Contact
          </button>
        </div>

        {/* Search */}
        <div className="mt-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <svg
                className="h-6 w-6 text-neutral-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-sm text-neutral-500">
              {searchQuery ? 'No contacts match your search' : 'No contacts yet'}
            </p>
            {!searchQuery && (
              <p className="mt-1 text-xs text-neutral-400">
                Add contacts to track your professional network
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedContacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Add Form Modal */}
      {showAddForm && (
        <QuickAddContactForm
          onSubmit={handleCreateContact}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
