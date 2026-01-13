# Chrome Extension Master Plan

**Version:** 1.2.0 (Target)
**Created:** January 2026
**Status:** Planning Phase
**Branch:** `feature/chrome-extension-v1.2`

---

## Executive Summary

This plan addresses all requirements for Chrome Web Store resubmission and adds the explicit "Track in Ascentful" button feature. The extension's core autofill and tracking functionality is already complete - this plan focuses on compliance, UX improvements, and the new tracking button.

---

## Part 1: Chrome Web Store Compliance (Critical)

### 1.1 Privacy Policy Integration

**Priority:** Critical
**Estimated Effort:** 2-3 hours

**Current State:** No privacy policy in extension
**Required:** Must be accessible from options page

**Implementation:**
- [ ] Create `src/options/PrivacyTab.tsx` component
- [ ] Add "Privacy & Terms" tab to options sidebar navigation
- [ ] Include in-extension privacy disclosure covering:
  - What data is collected (profile info, application history, job URLs)
  - Where data is stored (Chrome local storage + Ascentful backend)
  - How data is transmitted (HTTPS only to app.ascentful.io)
  - Data retention policy
  - User rights (view, export, delete)
  - Third-party sharing (none, except ATS form filling)
- [ ] Add link to full privacy policy at ascentful.io/privacy
- [ ] Add "I agree to Privacy Policy" checkbox on first run

**Files to Create:**
```
src/options/tabs/PrivacyTab.tsx
```

**Files to Modify:**
```
src/options/index.tsx (add Privacy tab to navigation)
```

---

### 1.2 First-Run Onboarding Experience

**Priority:** Critical
**Estimated Effort:** 4-5 hours

**Current State:** None - extension starts with blank state
**Required:** Clear explanation of functionality and data handling

**Implementation:**
- [ ] Create `src/components/Onboarding.tsx` modal component
- [ ] Show on first install (check `hasCompletedOnboarding` in storage)
- [ ] Multi-step wizard:
  1. **Welcome** - Brief intro to Ascentful Autofill
  2. **How It Works** - Visual explanation of autofill + tracking
  3. **Supported Platforms** - List of 14 ATS platforms
  4. **Your Data** - Privacy summary with link to full policy
  5. **Get Started** - Login prompt or "Continue to Setup"
- [ ] Store completion state in local storage
- [ ] Add "Reset Onboarding" option in settings (for testing)

**Files to Create:**
```
src/components/Onboarding.tsx
src/components/OnboardingStep.tsx
```

**Files to Modify:**
```
src/popup/index.tsx (show onboarding if not completed)
src/lib/storage.ts (add hasCompletedOnboarding flag)
```

---

### 1.3 External Link Verification

**Priority:** Critical
**Estimated Effort:** 30 minutes

**Current State:** Links to ascentful.io may be broken
**Required:** All external links must work

**Implementation:**
- [ ] Verify `https://ascentful.io` resolves
- [ ] Verify `https://ascentful.io/privacy` exists
- [ ] Verify `https://ascentful.io/terms` exists
- [ ] Verify `https://ascentful.io/help` exists
- [ ] Update any broken URLs in:
  - `src/options/index.tsx`
  - `src/popup/index.tsx`
  - Privacy policy content

---

### 1.4 Error Message Improvements

**Priority:** High
**Estimated Effort:** 2 hours

**Current State:** Technical error messages shown to users
**Required:** User-friendly, actionable messages

**Implementation:**
- [ ] Create error message mapping in `src/lib/errors.ts`
- [ ] Replace technical errors with friendly messages:

| Technical Error | User-Friendly Message |
|----------------|----------------------|
| `Network error` | "Unable to connect. Check your internet and try again." |
| `401 Unauthorized` | "Your session expired. Please sign in again." |
| `Profile not found` | "Please set up your profile in the Ascentful app first." |
| `ATS detection failed` | "We couldn't detect the application form. Try refreshing the page." |
| `Form fill failed` | "Some fields couldn't be filled automatically. Please complete them manually." |

- [ ] Add retry buttons where appropriate
- [ ] Log detailed errors to console for debugging

**Files to Create:**
```
src/lib/errors.ts
```

**Files to Modify:**
```
src/contents/index.ts (use friendly errors in toasts)
src/lib/api.ts (wrap errors with friendly messages)
src/popup/index.tsx (improve error states)
```

---

## Part 2: "Track in Ascentful" Button Feature

### 2.1 Feature Overview

**Priority:** High
**Estimated Effort:** 4-6 hours

**User Request:** After autofilling, show explicit "Track in Ascentful" button

**Current Behavior:**
1. User clicks autofill FAB
2. Form fills automatically
3. Application is tracked automatically (silently)
4. Toast shows "Application to {Company} tracked!"

**New Behavior:**
1. User clicks autofill FAB
2. Form fills automatically
3. **NEW:** Success UI appears with two clear options:
   - "Track in Ascentful" button (primary action)
   - "Don't Track" link (secondary, dismisses)
4. If "Track in Ascentful" clicked → application saved + confirmation
5. Toast shows success with link to view in Ascentful

---

### 2.2 Post-Autofill Success Modal

**Implementation:**
- [ ] Create `src/contents/components/TrackingPrompt.tsx`
- [ ] Show after successful form fill (replace current auto-track)
- [ ] Design:
  ```
  ┌─────────────────────────────────────────┐
  │  ✓ Form filled successfully!            │
  │                                          │
  │  Company: Acme Corp                      │
  │  Position: Software Engineer             │
  │                                          │
  │  ┌─────────────────────────────────┐    │
  │  │   Track in Ascentful            │    │  ← Primary button
  │  └─────────────────────────────────┘    │
  │                                          │
  │  Don't track this application            │  ← Text link
  └─────────────────────────────────────────┘
  ```
- [ ] Auto-dismiss after 10 seconds if no action (with countdown)
- [ ] Remember preference "Always track automatically" checkbox

**Files to Create:**
```
src/contents/components/TrackingPrompt.tsx
src/contents/components/TrackingPrompt.css
```

**Files to Modify:**
```
src/contents/index.ts (show TrackingPrompt after fill instead of auto-track)
src/lib/storage.ts (add autoTrackApplications preference)
```

---

### 2.3 Tracking Confirmation Flow

**Implementation:**
- [ ] When "Track in Ascentful" clicked:
  1. Show brief loading state on button
  2. Call `api.logApplication()` with job data
  3. On success: Show checkmark + "Tracked!" message
  4. Add "View in Ascentful" link that opens app
  5. Auto-dismiss after 3 seconds
- [ ] When "Don't Track" clicked:
  1. Dismiss prompt immediately
  2. Don't save application
  3. No further action needed

---

### 2.4 Settings for Auto-Track Behavior

**Implementation:**
- [ ] Add setting in `src/options/tabs/PreferencesTab.tsx`:
  ```
  Application Tracking
  ─────────────────────
  ☐ Automatically track all applications after autofill
    (Skip the "Track in Ascentful" prompt)
  ```
- [ ] Store preference in local storage
- [ ] If enabled, revert to current auto-track behavior
- [ ] If disabled (default), show TrackingPrompt

**Files to Modify:**
```
src/options/tabs/PreferencesTab.tsx (add auto-track toggle)
src/lib/storage.ts (add autoTrackApplications setting)
src/contents/index.ts (check setting before showing prompt)
```

---

## Part 3: Technical Debt & Improvements

### 3.1 Authentication Hardening

**Priority:** Medium
**Estimated Effort:** 3-4 hours

**Current Issue:** Simple base64 CSRF state tokens
**Improvement:** Use PKCE (Proof Key for Code Exchange)

**Implementation:**
- [ ] Generate cryptographic code_verifier (43-128 chars)
- [ ] Create code_challenge via SHA256(code_verifier)
- [ ] Pass code_challenge in auth request
- [ ] Verify code_verifier on callback
- [ ] Store verifier in session storage only

**Files to Modify:**
```
src/store/authStore.ts (implement PKCE flow)
src/background/index.ts (verify PKCE on callback)
```

---

### 3.2 Rate Limiting & Debouncing

**Priority:** Medium
**Estimated Effort:** 1-2 hours

**Current Issue:** No protection against rapid clicks
**Improvement:** Debounce autofill clicks, rate limit API calls

**Implementation:**
- [ ] Add 2-second debounce to FAB click handler
- [ ] Disable FAB during fill operation (already done, verify)
- [ ] Add rate limiting to API client (max 10 requests/minute)
- [ ] Show "Please wait..." if rate limited

**Files to Modify:**
```
src/contents/index.ts (add debounce)
src/lib/api.ts (add rate limiting)
```

---

### 3.3 LinkedIn Selector Resilience

**Priority:** Medium
**Estimated Effort:** 4-6 hours

**Current Issue:** LinkedIn Easy Apply selectors break frequently
**Improvement:** More robust detection with fallbacks

**Implementation:**
- [ ] Add multiple selector strategies for each field
- [ ] Implement visual element detection (button colors, positions)
- [ ] Add manual field mapping UI if auto-detection fails
- [ ] Log selector failures for future improvements

**Files to Modify:**
```
src/lib/ATSHandlers/LinkedInHandler.ts
```

---

### 3.4 Offline Sync Improvements

**Priority:** Low
**Estimated Effort:** 2-3 hours

**Current Issue:** Silent failure after 5 retries
**Improvement:** Better user feedback on sync status

**Implementation:**
- [ ] Show sync status indicator in popup header
- [ ] Badge shows "!" if sync failed after all retries
- [ ] Add "Retry Sync" button in popup
- [ ] Store failed applications with error reason
- [ ] Allow manual deletion of stuck items

**Files to Modify:**
```
src/popup/index.tsx (add sync status indicator)
src/background/index.ts (improve retry logic)
src/lib/storage.ts (store failure reasons)
```

---

### 3.5 Bundle Size Optimization

**Priority:** Low
**Estimated Effort:** 3-4 hours

**Current State:**
- popup.js: 180KB
- options.js: 183KB
- contents.js: 52KB

**Target:**
- popup.js: <100KB
- options.js: <100KB
- contents.js: <40KB

**Implementation:**
- [ ] Analyze bundle with `plasmo build --analyze`
- [ ] Lazy load options page tabs
- [ ] Tree-shake unused Lucide icons
- [ ] Consider lighter toast library
- [ ] Split common chunks

**Files to Modify:**
```
package.json (add analyze script)
plasmo.config.ts (optimize build settings)
```

---

## Part 4: Testing & Quality Assurance

### 4.1 Manual Testing Checklist

Before submission, test on each platform:

- [ ] **Greenhouse** - Standard fields + custom questions
- [ ] **Lever** - Multi-step forms
- [ ] **Workday** - Login-gated applications
- [ ] **LinkedIn Easy Apply** - Modal flow
- [ ] **Indeed** - Various job types
- [ ] **Taleo** - Legacy forms
- [ ] **iCIMS** - Iframe-heavy pages
- [ ] **SmartRecruiters** - Modern forms
- [ ] **Glassdoor** - Linked applications
- [ ] **ZipRecruiter** - Quick apply
- [ ] **Monster** - Traditional forms
- [ ] **Wellfound** - Startup applications
- [ ] **Dice** - Tech jobs
- [ ] **Unknown ATS** - Fallback behavior

### 4.2 Test Scenarios

For each platform, verify:
- [ ] Job detection works (title, company extracted)
- [ ] Autofill button appears
- [ ] Form fills correctly
- [ ] TrackingPrompt shows after fill
- [ ] "Track in Ascentful" creates application
- [ ] "Don't Track" dismisses without saving
- [ ] Error states handled gracefully

### 4.3 Edge Cases

- [ ] Offline mode → queue applications
- [ ] Expired token → prompt re-login
- [ ] No profile data → friendly error
- [ ] Partial fill → notify which fields failed
- [ ] Page navigation during fill → cleanup properly

---

## Part 5: Submission Checklist

### Pre-Submission

- [ ] All critical items from Part 1 complete
- [ ] Privacy policy accessible in extension
- [ ] First-run onboarding implemented
- [ ] External links verified working
- [ ] Error messages user-friendly
- [ ] TrackingPrompt feature complete
- [ ] Manual testing passed on 5+ platforms
- [ ] Build passes without errors
- [ ] Version bumped to 1.2.0

### Chrome Web Store Listing

- [ ] Update description to mention privacy practices
- [ ] Add screenshots showing:
  1. Autofill button on job page
  2. TrackingPrompt after fill
  3. Side panel with tracked applications
  4. Options page with privacy info
- [ ] Update promotional images if needed
- [ ] Prepare privacy policy URL for store listing

### Submission

- [ ] Export production build: `pnpm build`
- [ ] Create zip from `build/chrome-mv3-prod/`
- [ ] Submit to Chrome Web Store
- [ ] Monitor review status
- [ ] Respond promptly to any reviewer questions

---

## Implementation Order

### Phase 1: Critical Compliance (Days 1-2)
1. Privacy Policy Tab
2. First-Run Onboarding
3. External Link Verification
4. Error Message Improvements

### Phase 2: Track Button Feature (Days 3-4)
1. TrackingPrompt Component
2. Post-Autofill Flow Changes
3. Auto-Track Settings
4. Testing on Major Platforms

### Phase 3: Polish & Submit (Days 5-6)
1. Manual Testing All Platforms
2. Bundle Optimization (if time)
3. Final Build & Verification
4. Chrome Web Store Submission

---

## File Change Summary

### New Files to Create
```
src/options/tabs/PrivacyTab.tsx
src/components/Onboarding.tsx
src/components/OnboardingStep.tsx
src/contents/components/TrackingPrompt.tsx
src/contents/components/TrackingPrompt.css
src/lib/errors.ts
```

### Files to Modify
```
src/options/index.tsx
src/popup/index.tsx
src/contents/index.ts
src/lib/storage.ts
src/lib/api.ts
src/store/authStore.ts (optional - PKCE)
src/background/index.ts (optional - PKCE)
package.json (version bump)
```

---

## Success Criteria

1. **Chrome Web Store Approval** - Extension passes review
2. **User Clarity** - Users understand what data is collected
3. **Explicit Tracking** - Users have clear "Track in Ascentful" action
4. **Reliability** - Autofill works on 90%+ of tested applications
5. **Error Recovery** - Users can recover from any error state

---

## Notes

- The core autofill functionality is already solid
- Application tracking already works - just making it more explicit
- Focus on compliance first, features second
- Keep changes minimal to reduce review risk
