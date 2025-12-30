/**
 * Contacts Store
 *
 * Manages contacts state for the extension side panel.
 * Handles fetching, creating, and searching contacts.
 */

import { create } from 'zustand';
import type { Contact } from '~/types';
import { api } from '~/lib/api';

interface ContactsState {
  // Data
  contacts: Contact[];

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;

  // Search
  searchQuery: string;

  // Cache
  lastFetched: number | null;
}

interface ContactsActions {
  // Fetch contacts
  fetchContacts: (forceRefresh?: boolean) => Promise<void>;

  // Create contact
  createContact: (contact: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    linkedinUrl?: string;
    notes?: string;
  }) => Promise<Contact | null>;

  // Search
  setSearchQuery: (query: string) => void;
  getFilteredContacts: () => Contact[];

  // Get contact by ID
  getContact: (id: string) => Contact | null;

  // Clear error
  clearError: () => void;

  // Reset store
  reset: () => void;
}

type ContactsStore = ContactsState & ContactsActions;

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

const initialState: ContactsState = {
  contacts: [],
  isLoading: false,
  isCreating: false,
  error: null,
  searchQuery: '',
  lastFetched: null,
};

export const useContactsStore = create<ContactsStore>((set, get) => ({
  ...initialState,

  fetchContacts: async (forceRefresh = false) => {
    const { lastFetched, isLoading } = get();

    // Skip if already loading
    if (isLoading) return;

    // Use cache if fresh
    if (!forceRefresh && lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await api.getContacts();

      if (response.success && response.data) {
        set({
          contacts: response.data.contacts,
          lastFetched: Date.now(),
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: response.error || 'Failed to fetch contacts',
        });
      }
    } catch (error) {
      console.error('[ContactsStore] Failed to fetch contacts:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contacts',
      });
    }
  },

  createContact: async (contactData) => {
    set({ isCreating: true, error: null });

    try {
      const response = await api.createContact(contactData);

      if (response.success && response.data?.contact) {
        const newContact = response.data.contact;

        set((state) => ({
          contacts: [newContact, ...state.contacts],
          isCreating: false,
        }));

        return newContact;
      } else {
        set({
          isCreating: false,
          error: response.error || 'Failed to create contact',
        });
        return null;
      }
    } catch (error) {
      console.error('[ContactsStore] Failed to create contact:', error);
      set({
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create contact',
      });
      return null;
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  getFilteredContacts: () => {
    const { contacts, searchQuery } = get();

    if (!searchQuery) {
      // Create a copy before sorting to avoid mutating store state
      return [...contacts].sort((a, b) => b.createdAt - a.createdAt);
    }

    const query = searchQuery.toLowerCase();
    // filter() already creates a new array, so sort() is safe here
    return contacts
      .filter((contact) => {
        return (
          contact.name.toLowerCase().includes(query) ||
          contact.company?.toLowerCase().includes(query) ||
          (contact.title || contact.position)?.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  getContact: (id: string) => {
    const { contacts } = get();
    return contacts.find((c) => c.id === id) || null;
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));

export default useContactsStore;
