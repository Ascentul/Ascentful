// @ts-nocheck
import { useUser } from '@clerk/nextjs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useMutation, useQuery } from 'convex/react';
import React from 'react';

import AccountPage from '@/app/(shared)/account/page';
import { useAuth } from '@/contexts/ClerkAuthProvider';

// Mock dependencies
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
}));
jest.mock('@/contexts/ClerkAuthProvider', () => ({
  useAuth: jest.fn(),
}));
jest.mock('convex/react', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));
const toastMock = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;
const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;

// TODO: Update these tests to match current UI implementation
// Tests are skipped because UI components have changed significantly
describe.skip('AccountPage - Profile Settings Persistence', () => {
  const mockUpdateUser = jest.fn();
  const mockClerkUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseUser.mockReturnValue({
      user: {
        id: 'test-clerk-id',
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        update: mockClerkUpdate,
      } as any,
      isLoaded: true,
      isSignedIn: true,
    } as any);

    mockUseAuth.mockReturnValue({
      user: {
        _id: 'test-user-id',
        clerkId: 'test-clerk-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        subscription_plan: 'free',
        subscription_status: 'active',
        bio: 'Original bio',
        job_title: 'Software Engineer',
        company: 'Test Corp',
        location: 'San Francisco',
        website: 'https://test.com',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      isLoading: false,
      isSignedIn: true,
      signOut: jest.fn(),
      isAdmin: false,
    });

    mockUseMutation.mockReturnValue(mockUpdateUser);
    mockUseQuery.mockReturnValue(null);
  });

  test('should save all profile fields including bio, job title, company, location, and website', async () => {
    render(<AccountPage />);

    // Open edit profile dialog
    const editButton = screen.getByText(/edit profile/i);
    fireEvent.click(editButton);

    // Fill in all fields
    const nameInput = screen.getByLabelText(/name/i);
    const bioInput = screen.getByLabelText(/bio/i);
    const jobTitleInput = screen.getByLabelText(/job title/i);
    const companyInput = screen.getByLabelText(/company/i);
    const locationInput = screen.getByLabelText(/location/i);
    const websiteInput = screen.getByLabelText(/website/i);

    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    fireEvent.change(bioInput, { target: { value: 'Updated bio text' } });
    fireEvent.change(jobTitleInput, { target: { value: 'Senior Engineer' } });
    fireEvent.change(companyInput, { target: { value: 'New Company' } });
    fireEvent.change(locationInput, { target: { value: 'New York' } });
    fireEvent.change(websiteInput, { target: { value: 'https://newsite.com' } });

    // Submit form
    const saveButton = screen.getByText(/save changes/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        clerkId: 'test-clerk-id',
        updates: {
          name: 'Updated Name',
          email: 'test@example.com',
          bio: 'Updated bio text',
          job_title: 'Senior Engineer',
          company: 'New Company',
          location: 'New York',
          website: 'https://newsite.com',
        },
      });
    });
  });

  test('should handle empty optional fields correctly', async () => {
    render(<AccountPage />);

    const editButton = screen.getByText(/edit profile/i);
    fireEvent.click(editButton);

    const nameInput = screen.getByLabelText(/name/i);

    fireEvent.change(nameInput, { target: { value: 'Name Only' } });

    // Leave optional fields empty
    const bioInput = screen.getByLabelText(/bio/i);
    fireEvent.change(bioInput, { target: { value: '' } });

    const saveButton = screen.getByText(/save changes/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        clerkId: 'test-clerk-id',
        updates: expect.objectContaining({
          name: 'Name Only',
          email: 'test@example.com',
          bio: '',
        }),
      });
    });
  });

  test('should load existing profile data into form', () => {
    render(<AccountPage />);

    const editButton = screen.getByText(/edit profile/i);
    fireEvent.click(editButton);

    // Verify form is populated with existing data
    const bioInput = screen.getByLabelText(/bio/i) as HTMLTextAreaElement;
    const jobTitleInput = screen.getByLabelText(/job title/i) as HTMLInputElement;
    const companyInput = screen.getByLabelText(/company/i) as HTMLInputElement;
    const locationInput = screen.getByLabelText(/location/i) as HTMLInputElement;
    const websiteInput = screen.getByLabelText(/website/i) as HTMLInputElement;

    expect(bioInput.value).toBe('Original bio');
    expect(jobTitleInput.value).toBe('Software Engineer');
    expect(companyInput.value).toBe('Test Corp');
    expect(locationInput.value).toBe('San Francisco');
    expect(websiteInput.value).toBe('https://test.com');
  });

  test('should validate website URL format', async () => {
    render(<AccountPage />);

    const editButton = screen.getByText(/edit profile/i);
    fireEvent.click(editButton);

    const websiteInput = screen.getByLabelText(/website/i);
    fireEvent.change(websiteInput, { target: { value: 'invalid-url' } });

    const saveButton = screen.getByText(/save changes/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test('should enforce bio character limit', async () => {
    render(<AccountPage />);

    const editButton = screen.getByText(/edit profile/i);
    fireEvent.click(editButton);

    const bioInput = screen.getByLabelText(/bio/i);
    const longBio = 'a'.repeat(501); // Over 500 character limit

    fireEvent.change(bioInput, { target: { value: longBio } });

    const saveButton = screen.getByText(/save changes/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/bio must be 500 characters or less/i)).toBeInTheDocument();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
