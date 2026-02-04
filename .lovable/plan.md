

# Fix Verification Page: Rebrand to X and Fix Twitter API

## Overview
There are two issues with the verification page:
1. **Branding Issue**: The page still references "Twitter" but it's now called "X"
2. **API Issue**: The Twitter/X API verification returns 401 Unauthorized due to incorrect OAuth signature generation

---

## Issue 1: Update Branding from Twitter to X

### Current State
- The page uses the `Twitter` icon from lucide-react (old logo)
- Text references "Twitter" and "Tweet" throughout
- Links go to `twitter.com` (which works but should use `x.com`)

### Changes Required

**File: `src/pages/Claim.tsx`**
- Replace `Twitter` icon import with a custom X logo SVG (lucide-react doesn't have an X logo)
- Update text: "Complete Twitter verification" → "Complete X verification"
- Update text: "Post a Tweet" → "Post on X"
- Update text: "Open Twitter to tweet" → "Open X to post"
- Update placeholder: "https://twitter.com/..." → "https://x.com/..."
- Update intent URL: `twitter.com/intent/tweet` → `x.com/intent/tweet`

**Additional files to update for consistency:**
- `src/components/landing/Footer.tsx` - Update Twitter link and icon
- `src/components/landing/JoinSection.tsx` - Update step 3 branding
- `src/components/landing/HowItWorks.tsx` - Update step icon and text
- `src/pages/Bots.tsx` - Update bot profile Twitter links

---

## Issue 2: Fix Twitter API 401 Unauthorized Error

### Root Cause
The edge function logs show:
```
Twitter API error: 401 - {"title": "Unauthorized", "type": "about:blank", "status": 401, "detail": "Unauthorized"}
```

The OAuth 1.0a signature is being generated incorrectly. According to Twitter API requirements:
- For GET requests, query parameters should NOT be included in the signature base string separately when they're already in the URL
- The current implementation may have issues with how parameters are being encoded

### Solution
Update the OAuth signature generation in `supabase/functions/bot-verify/index.ts`:

1. **Fix OAuth signature for GET requests**: The signature should only include OAuth parameters, not query parameters, for GET requests when using Twitter API v2
2. **Add better error logging**: Include more details in the error response to help debug issues
3. **Handle x.com URLs**: Ensure both `twitter.com` and `x.com` URLs are properly handled (already working)

### Technical Implementation

```text
bot-verify/index.ts changes:
├── Update generateOAuthHeader to handle GET requests correctly
├── Only include oauth_* params in signature (not query params)
├── Add detailed logging for debugging
└── Return more helpful error messages
```

---

## Implementation Steps

### Step 1: Update Frontend Branding
1. Create a simple X logo SVG component
2. Update `Claim.tsx`:
   - Replace Twitter icon with X icon
   - Update all "Twitter" text to "X"
   - Update "tweet" references to "post"
   - Update URLs from `twitter.com` to `x.com`

### Step 2: Fix OAuth Signature in Edge Function
1. Update `bot-verify/index.ts` to fix OAuth 1.0a signature generation
2. The issue is that query parameters shouldn't be part of the signature base for this endpoint
3. Deploy the updated function

### Step 3: Update Other Components for Consistency
1. Update Footer, JoinSection, HowItWorks, and Bots page
2. Replace all Twitter references with X

---

## Testing Plan

After implementation:
1. Visit a claim page (e.g., `/claim/2ec688aa348f68edf45c001600fd03fb`)
2. Verify the X branding appears correctly
3. Test the "Open X to post" link opens x.com correctly
4. Submit a real X post URL and verify the API call succeeds
5. Check edge function logs for any remaining errors

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Claim.tsx` | Replace Twitter with X branding, update URLs |
| `src/components/landing/Footer.tsx` | Update X link and icon |
| `src/components/landing/JoinSection.tsx` | Update step 3 text |
| `src/components/landing/HowItWorks.tsx` | Update step 3 text |
| `src/pages/Bots.tsx` | Update profile links to x.com |
| `supabase/functions/bot-verify/index.ts` | Fix OAuth signature generation |

