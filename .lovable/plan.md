

# Plan: Fix Claim URL and Add Twitter API Verification

## Overview
This plan addresses two issues:
1. **Claim URL 404** - The registration generates URLs pointing to a non-existent domain
2. **Twitter verification** - Currently trust-based; needs actual Twitter API integration

---

## Part 1: Fix Claim URL Generation

### Problem
The `bot-register` edge function defaults to `https://theclawgov.com` when no origin header is present. Since AI agents call the API directly (not from a browser), there's no origin header, so they get broken claim URLs.

### Solution
Update the claim URL to use the actual deployed app URL.

**Changes:**
- `supabase/functions/bot-register/index.ts`: Change the fallback URL from `theclawgov.com` to your preview URL (or eventually your published/custom domain)
- `public/skill.md`: Update documentation to reflect the correct claim URL format

---

## Part 2: Twitter API Verification Bot

### Current Flow (Trust-Based)
1. User pastes any tweet URL
2. System marks bot as verified without checking the tweet

### New Flow (API-Verified)
1. User pastes tweet URL
2. System calls Twitter API to fetch the tweet
3. System validates tweet contains `@ClawGov verify:{claim_code}`
4. System validates tweet author matches the URL
5. Only then mark bot as verified

### Required Twitter API Credentials
You'll need a Twitter Developer account with these credentials:
- `TWITTER_CONSUMER_KEY` (API Key)
- `TWITTER_CONSUMER_SECRET` (API Secret)
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`

### Changes

#### 1. Add Twitter API Secrets
Request the 4 Twitter credentials from you via the secrets tool.

#### 2. Update `bot-verify` Edge Function
Modify the verification function to:
- Use the Twitter API endpoint `https://api.x.com/2/tweets/{tweet_id}`
- Fetch the tweet content
- Validate that:
  - The tweet text contains `@ClawGov verify:{claim_code}` (case-insensitive)
  - The tweet author's username matches the URL
- Only proceed with verification if validation passes

#### 3. Error Handling
Add clear error messages:
- "Tweet not found" - if Twitter returns 404
- "Tweet does not contain verification code" - if text doesn't match
- "Tweet author mismatch" - if username doesn't match URL

---

## Technical Details

### Twitter API Request
```text
GET https://api.x.com/2/tweets/{tweet_id}
    ?expansions=author_id
    &tweet.fields=text
    &user.fields=username
```

Requires OAuth 1.0a signature with all 4 credentials.

### OAuth Implementation
Use Deno's crypto APIs to generate OAuth 1.0a signatures, or use a helper library. The signature must include:
- oauth_consumer_key
- oauth_token
- oauth_signature_method (HMAC-SHA1)
- oauth_timestamp
- oauth_nonce
- oauth_version (1.0)

### Edge Function Structure
```text
bot-verify/index.ts
  |
  +-- Validate inputs (claim_code, tweet_url)
  +-- Extract tweet ID from URL
  +-- Fetch tweet from Twitter API
  +-- Validate tweet content contains verification code
  +-- Validate tweet author matches URL handle
  +-- Update bot status to verified
  +-- Create gazette entry
```

---

## Implementation Steps

1. **Update bot-register** - Fix the claim URL to use actual app URL
2. **Request Twitter credentials** - You provide the 4 API keys
3. **Update bot-verify** - Add Twitter API integration with OAuth
4. **Test end-to-end** - Verify a bot with a real tweet

---

## Alternative: Skip Twitter API (Simpler)

If you don't want to set up Twitter API credentials, we can keep the current trust-based system but:
- Fix the claim URL (Part 1)
- Add clear instructions that verification is manual/trust-based
- Consider adding a @ClawGov Twitter account later to manually verify via mentions

---

## Questions Before Proceeding

Do you have a Twitter Developer account with API access? The credentials needed are:
- API Key (Consumer Key)
- API Secret (Consumer Secret)  
- Access Token
- Access Token Secret

If not, I can help you set one up, or we can proceed with just fixing the claim URL for now.

