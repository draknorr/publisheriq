# Sensitive Data Inventory - PublisherIQ

**Audit Date:** January 9, 2026
**Scope:** Complete inventory of PII, authentication data, and secrets across database and codebase

---

## Executive Summary

PublisherIQ stores moderate amounts of personally identifiable information (PII) primarily related to user authentication and waitlist management. The platform does **not** store payment/financial data or health/medical information. Authentication is delegated to Supabase, which manages sensitive auth tokens and session data.

### Data Volume Summary
| Data Type | Record Count |
|-----------|--------------|
| Authenticated Users | 5 |
| User Profiles | 5 |
| Waitlist Entries | 5 |
| Chat Query Logs | 100 |

---

## 1. Personally Identifiable Information (PII)

### 1.1 High-Risk PII (Direct Identifiers)

| Table | Column | Data Type | Purpose | Risk Level | Retention |
|-------|--------|-----------|---------|------------|-----------|
| `auth.users` | `email` | varchar | User authentication | **HIGH** | Account lifetime |
| `auth.users` | `phone` | text | Optional MFA | **HIGH** | Account lifetime |
| `public.user_profiles` | `email` | text | User contact | **HIGH** | Account lifetime |
| `public.user_profiles` | `full_name` | text | User display name | **HIGH** | Account lifetime |
| `public.waitlist` | `email` | text | Waitlist contact | **HIGH** | Until approved/rejected |
| `public.waitlist` | `full_name` | text | Waitlist applicant name | **HIGH** | Until approved/rejected |

### 1.2 Medium-Risk PII (Quasi-Identifiers)

| Table | Column | Data Type | Purpose | Risk Level | Retention |
|-------|--------|-----------|---------|------------|-----------|
| `public.user_profiles` | `organization` | text | Company affiliation | **MEDIUM** | Account lifetime |
| `public.waitlist` | `organization` | text | Company affiliation | **MEDIUM** | Until approved/rejected |
| `public.waitlist` | `how_i_plan_to_use` | text | Free-form user intent | **MEDIUM** | Until approved/rejected |

### 1.3 Low-Risk PII (Indirect Identifiers)

| Table | Column | Data Type | Purpose | Risk Level | Retention |
|-------|--------|-----------|---------|------------|-----------|
| `public.chat_query_logs` | `user_id` | uuid | Links queries to users | **LOW** | 7 days (auto-cleanup) |
| `public.chat_query_logs` | `query_text` | text | User's chat questions | **MEDIUM** | 7 days (auto-cleanup) |
| `public.credit_transactions` | `user_id` | uuid | Credit audit trail | **LOW** | Indefinite |
| `public.credit_reservations` | `user_id` | uuid | Pending credit holds | **LOW** | Short-term |
| `public.rate_limit_state` | `user_id` | uuid | Rate limiting | **LOW** | Session-based |

---

## 2. Authentication & Session Data

### 2.1 Supabase Auth Schema (Managed by Supabase)

| Table | Sensitive Columns | Risk Level | Notes |
|-------|-------------------|------------|-------|
| `auth.users` | `encrypted_password`, `confirmation_token`, `recovery_token`, `reauthentication_token`, `email_change_token_*`, `phone_change_token` | **CRITICAL** | Passwords are bcrypt hashed; tokens are time-limited |
| `auth.refresh_tokens` | `token`, `refresh_token_hmac_key` | **CRITICAL** | Session refresh tokens |
| `auth.sessions` | `ip`, `refresh_token_counter` | **HIGH** | Session tracking with IP address |
| `auth.identities` | `email` | **HIGH** | OAuth provider identities |
| `auth.mfa_factors` | `phone` | **HIGH** | MFA phone numbers |
| `auth.mfa_challenges` | `ip_address` | **HIGH** | MFA attempt tracking |
| `auth.audit_log_entries` | `ip_address` | **HIGH** | Auth event logging |
| `auth.flow_state` | `provider_access_token`, `provider_refresh_token` | **CRITICAL** | OAuth tokens |
| `auth.one_time_tokens` | `token_hash` | **CRITICAL** | Magic link/OTP tokens |

### 2.2 Application Session Management

| Location | Mechanism | Data Stored | Risk Level |
|----------|-----------|-------------|------------|
| Browser | HttpOnly Cookies | Supabase session JWT | **HIGH** |
| Browser | localStorage | Theme preference only (`publisheriq-theme`) | **LOW** |
| Server | Cookie parsing | Session validation via Supabase | **HIGH** |

**Cookie Configuration (from `apps/admin/src/lib/supabase/client.ts`):**
- Domain: `.publisheriq.app`
- SameSite: `lax`
- Secure: `true`
- Path: `/`

---

## 3. API Keys & Secrets Inventory

### 3.1 Root Environment (`.env`)

| Variable | Purpose | Classification | Exposure Risk |
|----------|---------|----------------|---------------|
| `DATABASE_URL` | Direct PostgreSQL connection | **CRITICAL** | Full DB access |
| `SUPABASE_URL` | Supabase project URL | **LOW** | Public-facing |
| `SUPABASE_SERVICE_KEY` | Supabase admin API key | **CRITICAL** | Bypasses RLS |
| `STEAM_API_KEY` | Steam Web API access | **MEDIUM** | Rate limits, no PII |

### 3.2 Admin Dashboard Environment (`apps/admin/.env.local`)

| Variable | Purpose | Classification | Exposure Risk |
|----------|---------|----------------|---------------|
| `AUTH_PASSWORD` | Dashboard authentication | **HIGH** | Deprecated (now using Supabase auth) |
| `SUPABASE_URL` | Supabase project URL | **LOW** | Public-facing |
| `SUPABASE_SERVICE_KEY` | Supabase admin API key | **CRITICAL** | Bypasses RLS |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-side Supabase URL | **LOW** | Intentionally public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase key | **LOW** | RLS-protected |
| `OPENAI_API_KEY` | LLM API access | **HIGH** | Usage charges |
| `CUBE_API_URL` | Cube.js endpoint | **LOW** | Internal service |
| `CUBE_API_SECRET` | Cube.js JWT signing | **HIGH** | Query access |
| `QDRANT_URL` | Vector database URL | **LOW** | Service endpoint |
| `QDRANT_API_KEY` | Vector database API key | **MEDIUM** | Read access to embeddings |
| `VERCEL_OIDC_TOKEN` | Vercel deployment auth | **MEDIUM** | Deployment access |
| `LLM_PROVIDER` | Provider selection | **LOW** | Configuration only |
| `USE_CUBE_CHAT` | Feature flag | **LOW** | Configuration only |

### 3.3 PICS Service Environment (`services/pics-service/.env`)

| Variable | Purpose | Classification | Exposure Risk |
|----------|---------|----------------|---------------|
| `SUPABASE_URL` | Supabase project URL | **LOW** | Public-facing |
| `SUPABASE_SERVICE_KEY` | Supabase admin API key | **CRITICAL** | Bypasses RLS |
| `MODE` | Service mode | **LOW** | Configuration only |
| `PORT` | Health check port | **LOW** | Configuration only |

### 3.4 Cube.js Environment (`packages/cube/.env`)

| Variable | Purpose | Classification | Exposure Risk |
|----------|---------|----------------|---------------|
| `CUBEJS_DB_HOST` | Database host | **MEDIUM** | Network target |
| `CUBEJS_DB_PORT` | Database port | **LOW** | Configuration |
| `CUBEJS_DB_NAME` | Database name | **LOW** | Configuration |
| `CUBEJS_DB_USER` | Database user | **MEDIUM** | Access credential |
| `CUBEJS_DB_PASS` | Database password | **CRITICAL** | DB authentication |
| `CUBEJS_API_SECRET` | JWT signing secret | **HIGH** | API authentication |

---

## 4. Data Classification Matrix

| Classification | Definition | Examples | Protection Requirements |
|----------------|------------|----------|------------------------|
| **CRITICAL** | Direct database/API access; breach = full compromise | `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, `CUBEJS_DB_PASS`, auth tokens | Encrypted at rest, never logged, restricted access |
| **HIGH** | Direct PII or elevated privileges | Email, full name, `OPENAI_API_KEY`, session cookies | Access controls, encryption in transit, audit logging |
| **MEDIUM** | Indirect identifiers or limited-scope credentials | Organization, `STEAM_API_KEY`, `QDRANT_API_KEY` | Standard security practices |
| **LOW** | Non-sensitive configuration | Public URLs, feature flags, theme preferences | Basic access controls |

---

## 5. Data Flow Analysis

### 5.1 User Registration Flow
```
User Input (email, name)
    -> Waitlist table (stores PII)
    -> Admin approval
    -> Supabase auth.users (creates account)
    -> user_profiles (copies email, name)
```

### 5.2 Chat Query Flow
```
User question
    -> chat_query_logs (stores query_text, user_id)
    -> LLM (OpenAI - query sent externally)
    -> Response (no PII stored)
    -> Auto-cleanup after 7 days
```

### 5.3 Authentication Flow
```
Magic link request
    -> Supabase sends email
    -> User clicks link (token in URL fragment)
    -> Session established via cookies
    -> IP logged in auth.sessions
```

---

## 6. Payment & Financial Data

**Finding:** No payment or financial data is stored.

- The "credits" system is internal accounting (integer balance)
- No credit card numbers, bank accounts, or payment tokens
- No integration with Stripe, PayPal, or other payment processors
- Credit transactions are non-financial (token usage tracking only)

---

## 7. Health & Medical Data

**Finding:** No health or medical data is stored.

- PublisherIQ is a gaming analytics platform
- No HIPAA-relevant fields identified
- No health-related data collection

---

## 8. Third-Party Data Sharing

| Third Party | Data Shared | Purpose | Data Protection |
|-------------|-------------|---------|-----------------|
| **Supabase** | All database content | Hosting, authentication | SOC 2 Type II, encryption at rest |
| **OpenAI** | Chat query text | LLM processing | DPA available, no training on API data |
| **Qdrant Cloud** | Game/publisher embeddings | Vector search | EU-based, SOC 2 |
| **Vercel** | Application logs | Hosting | SOC 2 Type II |
| **Railway** | PICS service logs | Python service hosting | SOC 2 |
| **Fly.io** | Cube.js queries | Analytics hosting | SOC 2 |

---

## 9. Risk Assessment Summary

| Risk Area | Current Status | Risk Level | Recommendation |
|-----------|----------------|------------|----------------|
| PII Storage | Limited to essential data | **MEDIUM** | Document retention policy |
| Auth Tokens | Managed by Supabase | **LOW** | Supabase handles security |
| API Keys | Stored in env files | **MEDIUM** | Consider secrets manager |
| Chat Logs | 7-day retention | **LOW** | Current policy is appropriate |
| Third-Party Sharing | OpenAI receives queries | **MEDIUM** | Review DPA, consider anonymization |
| Password Storage | Bcrypt via Supabase | **LOW** | Industry standard |
| Session Management | Secure cookies | **LOW** | Proper configuration verified |

---

## 10. Recommendations

### High Priority
1. **Secrets Management**: Migrate from `.env` files to a secrets manager (Vercel environment variables are already used for production)
2. **Data Retention Policy**: Document and implement formal retention for waitlist data after approval/rejection
3. **Query Anonymization**: Consider hashing or anonymizing user queries before sending to OpenAI

### Medium Priority
4. **IP Address Logging**: Review necessity of IP logging in Supabase auth (managed by Supabase)
5. **Access Audit**: Implement periodic review of users with `SUPABASE_SERVICE_KEY` access
6. **Encryption Documentation**: Document encryption-at-rest status for all data stores

### Low Priority
7. **Data Minimization**: Review if `organization` field is necessary in user_profiles
8. **Backup Encryption**: Verify database backup encryption settings
9. **Log Aggregation**: Centralize logging to detect unauthorized data access

---

## 11. Compliance Considerations

| Regulation | Applicability | Notes |
|------------|---------------|-------|
| **GDPR** | Yes (if EU users) | Email, name require consent; right to deletion needed |
| **CCPA** | Yes (if CA users) | Same as GDPR; disclose data collection |
| **SOC 2** | Recommended | Third-party vendors are SOC 2 certified |
| **HIPAA** | No | No health data collected |
| **PCI-DSS** | No | No payment data collected |

---

## Appendix A: Raw Database Query Results

### PII-Related Columns in Public Schema
```
     table_name      |     column_name     | data_type
---------------------+---------------------+-----------
 apps                | name                | text
 chat_query_logs     | user_id             | uuid
 credit_reservations | user_id             | uuid
 credit_transactions | admin_user_id       | uuid
 credit_transactions | user_id             | uuid
 developers          | name                | text
 franchises          | name                | text
 publishers          | name                | text
 rate_limit_state    | user_id             | uuid
 user_profiles       | email               | text
 user_profiles       | full_name           | text
 waitlist            | email               | text
 waitlist            | full_name           | text
```

### Auth Schema Sensitive Columns
```
    table_name     |         column_name
-------------------+-----------------------------
 audit_log_entries | ip_address
 flow_state        | provider_access_token
 flow_state        | provider_refresh_token
 identities        | email
 mfa_challenges    | ip_address
 mfa_factors       | phone
 one_time_tokens   | token_hash
 refresh_tokens    | token
 sessions          | ip
 sessions          | refresh_token_hmac_key
 users             | confirmation_token
 users             | email
 users             | encrypted_password
 users             | phone
 users             | recovery_token
```
