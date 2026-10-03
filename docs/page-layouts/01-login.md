# 01 · Login

**Purpose:** get the single user in. No sign-up, no social login.
**Route:** `/login` (public). Any other route redirects here when logged out; after login, return to the original route.

## Wireframe
```
┌──────────────────────────────────────┐
│                                      │
│          🐔  Batch Audit             │
│      Sonali farm records             │
│                                      │
│  Email                               │
│  ┌────────────────────────────────┐  │
│  │ you@example.com                │  │
│  └────────────────────────────────┘  │
│  Password                            │
│  ┌────────────────────────────┬───┐  │
│  │ ••••••••                   │ 👁 │  │
│  └────────────────────────────┴───┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │            Log in              │  │
│  └────────────────────────────────┘  │
│                                      │
│  ⚠ Email or password is wrong        │  (only on error)
└──────────────────────────────────────┘
```

## Data
`supabase.auth.signInWithPassword({ email, password })`.

## Actions
- Log in → `/` (or the redirect target).
- Show/hide password.

## Validation & states
- Both fields required. Button shows a spinner and is disabled while signing in.
- Error: "Email or password is wrong". Network error: "No connection. Try again."
- "Forgot password?" emails a reset link (`resetPasswordForEmail`) to `/reset-password`, where the new password is set with `updateUser`. Add `<site>/reset-password` to Supabase → Auth → URL Configuration → Redirect URLs.
