# Sensitive Data Cheatsheet
## Where PII and Secrets Live in PublisherIQ

---

## PII Locations

### Database Tables

| Table | Sensitive Columns | Row Count | Notes |
|-------|-------------------|-----------|-------|
| `user_profiles` | `email`, `full_name`, `organization` | 5 | Core user data |
| `waitlist` | `email`, `full_name`, `organization`, `how_i_plan_to_use` | 5 | Access requests |
| `chat_query_logs` | `query_text`, `user_id` | 100 | User prompts may contain PII |
| `auth.users` | `email`, `phone`, `encrypted_password` | 5 | Supabase managed |
| `auth.sessions` | `ip`, `user_agent` | Varies | Supabase managed |

### What's NOT Sensitive (Public Game Data)
- `apps` - Game metadata (public Steam data)
- `publishers`, `developers` - Company names (public)
- `daily_metrics`, `review_histogram` - Analytics (public)
- All junction tables - Relationships (public)

---

## Secret Locations

### Environment Files

| File | Secrets Present | Notes |
|------|-----------------|-------|
| `/.env` | `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, `STEAM_API_KEY` | Worker config |
| `/apps/admin/.env.local` | `OPENAI_API_KEY`, `CUBE_API_SECRET`, `QDRANT_API_KEY`, `SUPABASE_SERVICE_KEY` | Dashboard config |

### Deployment Secrets (Not in Files)

| Platform | Secrets |
|----------|---------|
| Fly.io | `CUBEJS_DB_PASS`, `CUBEJS_API_SECRET` |
| Railway | `SUPABASE_SERVICE_KEY` |
| GitHub Actions | All worker secrets |
| Vercel | All dashboard secrets |

---

## Secret Classification

| Secret | Risk if Leaked | Access Granted |
|--------|----------------|----------------|
| `SUPABASE_SERVICE_KEY` | CRITICAL | Full database admin (bypasses RLS) |
| `DATABASE_URL` | CRITICAL | Direct PostgreSQL access |
| `OPENAI_API_KEY` | HIGH | API charges, model access |
| `CUBE_API_SECRET` | HIGH | Analytics query access |
| `QDRANT_API_KEY` | MEDIUM | Vector DB read/write |
| `STEAM_API_KEY` | LOW | Rate-limited Steam API |

---

## Data Flow Exposure Points

### Data Sent to External Services

| Service | Data Sent | Purpose |
|---------|-----------|---------|
| OpenAI | Game descriptions, user queries | Embeddings, chat |
| Qdrant | Game/publisher/developer embeddings | Vector search |
| Supabase | All data | Primary storage |
| Cube.js | Analytics queries | Semantic layer |

### Data Returned to Users

| Endpoint | Data Returned | Auth Required |
|----------|---------------|---------------|
| `/api/chat/stream` | Query results, entity data | Yes (credit system) |
| `/api/insights/*` | CCU analytics | No |
| Public pages | Game/publisher info | No |

---

## Retention Policies

| Data Type | Retention | Deletion Method |
|-----------|-----------|-----------------|
| `chat_query_logs` | 7 days | Automatic cleanup |
| `ccu_snapshots` | 30 days | Automatic cleanup |
| `user_profiles` | Forever | Manual (BLOCKED - see known issues) |
| `waitlist` | Forever | Manual |
| `credit_transactions` | Forever | Audit log (intentional) |

---

## GDPR/CCPA Considerations

### User Rights Status

| Right | Supported | Notes |
|-------|-----------|-------|
| Access (see my data) | Partial | No self-service UI |
| Rectification (fix my data) | Partial | Can update profile |
| Erasure (delete my data) | NO | FK constraint blocks deletion |
| Portability (export my data) | No | Not implemented |

### Data Processing

| Processing Activity | Legal Basis | Notes |
|--------------------|-------------|-------|
| Account creation | Consent | Via waitlist/signup |
| Chat analytics | Legitimate interest | Anonymized after 7 days |
| Email for auth | Contract | Required for magic link |

---

## Audit Logging

### What's Logged

| Event | Table | Logged Fields |
|-------|-------|---------------|
| Chat queries | `chat_query_logs` | query, tools, timing, user_id |
| Credit changes | `credit_transactions` | amount, type, admin_id |
| Sync jobs | `sync_jobs` | job_type, status, errors |

### What's NOT Logged
- User login/logout events
- Profile changes
- Admin actions (except credits)
- Data access attempts

---

## Quick Security Checklist

### Before Production
- [ ] Fix waitlist RLS policy (exposes all entries)
- [ ] Fix chat_query_logs RLS policy (exposes all queries)
- [ ] Revoke DELETE/TRUNCATE from anon role
- [ ] Verify no secrets in git history
- [ ] Enable FK constraint fix for user deletion

### Ongoing
- [ ] Rotate API keys periodically
- [ ] Monitor for unusual access patterns
- [ ] Keep Supabase RLS policies updated
- [ ] Review chat_query_logs for PII

---

## Emergency Contacts

### If Secrets Are Leaked

1. **SUPABASE_SERVICE_KEY**: Regenerate in Supabase dashboard → Settings → API
2. **DATABASE_URL**: Regenerate database password in Supabase
3. **OPENAI_API_KEY**: Revoke at platform.openai.com
4. **QDRANT_API_KEY**: Regenerate in Qdrant Cloud console

### If PII Is Exposed

1. Document the exposure (what, when, how)
2. Assess scope (how many users affected)
3. Notify affected users if required
4. File breach notification if required (depends on jurisdiction)

---

## Access Control Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     PUBLIC ACCESS                           │
│  Game data, publisher/developer info, analytics             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  AUTHENTICATED ACCESS                        │
│  Own profile, own chat logs, own credit history             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN ACCESS                             │
│  All user profiles, all waitlist, all chat logs             │
│  Credit adjustments, waitlist approvals                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   SERVICE KEY ACCESS                         │
│  Full database (bypasses RLS)                               │
│  ONLY for server-side workers and API routes                │
└─────────────────────────────────────────────────────────────┘
```
