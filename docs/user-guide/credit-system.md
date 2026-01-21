# Credit System Guide

This guide explains how the credit system works in PublisherIQ, including credit costs, billing mechanics, and how to monitor usage.

---

## Overview

PublisherIQ uses a credit-based system for chat usage. Credits are consumed when you:

- Ask questions in the chat interface
- Use AI-powered search and analytics tools
- Process LLM tokens (input and output)

**Key Points:**
- New users receive a signup bonus of credits
- Credits are charged per chat message
- A minimum charge applies to each message
- Admins can grant additional credits

---

## Credit Costs

### Tool Costs (Per Call)

Each tool call in the chat consumes credits:

| Tool | Credits | Description |
|------|---------|-------------|
| `lookup_publishers` | 4 | Find publisher names in database |
| `lookup_developers` | 4 | Find developer names in database |
| `lookup_tags` | 4 | Discover available tags/genres |
| `lookup_games` | 4 | Find game names in database |
| `query_analytics` | 8 | Run structured Cube.js queries |
| `search_games` | 8 | Tag/genre-based game discovery |
| `search_by_concept` | 12 | Semantic concept search |
| `discover_trending` | 12 | Trend-based discovery |
| `find_similar` | 12 | Vector similarity search |

### Token Costs

LLM token usage is also charged:

| Token Type | Rate |
|------------|------|
| **Input tokens** | 2 credits per 1,000 tokens |
| **Output tokens** | 8 credits per 1,000 tokens |

**Note:** Token costs are rounded up to the nearest whole credit.

### Minimum Charge

Every chat message has a **minimum charge of 4 credits**, regardless of actual usage. This ensures operational viability even for simple queries.

---

## How Billing Works

### Reservation System

Credits use a "reserve-then-finalize" pattern:

1. **Reserve**: Before processing, 25 credits are reserved from your balance
2. **Process**: Chat message is processed, actual costs calculated
3. **Finalize**: Actual cost is charged, excess reservation is refunded

**Why this pattern?**
- Prevents users from exhausting credits mid-conversation
- Ensures fair billing based on actual usage
- Protects against edge cases where cost exceeds estimates

### Cost Calculation

The total cost for a chat message is:

```
Total = Tool Credits + Token Credits
Final = max(Total, Minimum Charge)
```

**Example 1: Simple lookup**
- 1 lookup_publishers call: 4 credits
- 500 input tokens: ceil(0.5 × 2) = 1 credit
- 300 output tokens: ceil(0.3 × 8) = 3 credits
- Total: 4 + 1 + 3 = 8 credits
- Final: max(8, 4) = **8 credits**

**Example 2: Complex query**
- 1 query_analytics call: 8 credits
- 1 find_similar call: 12 credits
- 1,500 input tokens: ceil(1.5 × 2) = 3 credits
- 800 output tokens: ceil(0.8 × 8) = 7 credits
- Total: 8 + 12 + 3 + 7 = 30 credits
- Final: max(30, 4) = **30 credits**

**Example 3: Minimal query**
- No tool calls: 0 credits
- 200 input tokens: ceil(0.2 × 2) = 1 credit
- 150 output tokens: ceil(0.15 × 8) = 2 credits
- Total: 0 + 1 + 2 = 3 credits
- Final: max(3, 4) = **4 credits** (minimum applied)

---

## Viewing Your Credit Balance

### In the Chat Interface

Your current credit balance is displayed in the chat interface header.

### After Each Message

The message completion includes credit information:

```
creditsCharged: 12
```

This shows exactly how many credits were consumed for that message.

### In Your Account

Navigate to your account page to see:
- Current balance
- Recent transactions
- Usage history

---

## Rate Limiting

To prevent abuse, there are rate limits on chat usage:

| Limit | Value |
|-------|-------|
| **Requests per minute** | 10 |
| **Requests per hour** | 100 |

If you hit a rate limit, you'll receive a `429 Too Many Requests` error with a `Retry-After` header indicating when you can try again.

---

## Getting More Credits

### Signup Bonus

New users receive an initial credit allocation upon account creation.

### Admin Grants

Administrators can grant credits through the admin panel:

1. Admin goes to `/admin/users`
2. Finds your account
3. Clicks **Adjust Credits**
4. Enters the amount and reason

### Future Plans

Additional methods for obtaining credits may be added in future releases.

---

## Credit Transaction Types

| Type | Description |
|------|-------------|
| `signup_bonus` | Initial credits upon account creation |
| `usage` | Credits consumed by chat |
| `refund` | Credits returned (error recovery) |
| `admin_adjustment` | Manual adjustment by administrator |

---

## Insufficient Credits

If you don't have enough credits:

1. **Balance check**: Before processing, your balance is checked
2. **Minimum required**: At least 4 credits required to use chat
3. **Error response**: If insufficient, you'll receive a `402 Payment Required` error

**Error Response:**
```json
{
  "error": "insufficient_credits",
  "message": "You don't have enough credits to use chat. Please contact your administrator.",
  "balance": 2
}
```

---

## Error Handling

### Reservation Refund

If an error occurs during processing:
- Reserved credits are automatically refunded
- No charge for failed requests
- Your balance remains unchanged

### Server Errors

If the server encounters an error:
- Credits are not charged
- Reserved credits are refunded
- Error is logged for investigation

---

## Best Practices for Credit Efficiency

### Ask Specific Questions

The more specific your question, the fewer tools and iterations needed.

**Less efficient:**
> "Tell me about puzzle games"

**More efficient:**
> "Show top 10 puzzle games with 90%+ reviews released in 2024"

### Combine Related Questions

Multiple questions in one message can be more efficient than separate messages (fewer minimum charges).

### Use Lookups First

When filtering by publisher or developer name, mention the specific name so the LLM can use efficient lookup tools.

**Less efficient:**
> "Games from that one company that made PUBG"

**More efficient:**
> "Games from Krafton"

### Watch Iteration Count

High iteration counts (4-5) indicate the LLM is struggling. Try rephrasing your question more clearly.

---

## Technical Details

### Credit Storage

Credits are stored as integers in the `user_profiles` table:

| Column | Type | Description |
|--------|------|-------------|
| `credit_balance` | integer | Current balance |

### Transaction Log

All credit transactions are recorded in `credit_transactions`:

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid | User reference |
| `type` | enum | Transaction type |
| `amount` | integer | Credits (positive = grant, negative = charge) |
| `description` | text | Human-readable description |
| `created_at` | timestamp | When transaction occurred |

### Reservation Table

Active reservations are tracked in `credit_reservations`:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Reservation ID |
| `user_id` | uuid | User reference |
| `amount` | integer | Credits reserved |
| `status` | enum | pending, completed, cancelled |
| `created_at` | timestamp | When reserved |

**Cleanup:** Stale reservations (older than 1 hour) are automatically cancelled and refunded by a scheduled job.

---

## Related Documentation

- [Chat Interface Guide](./chat-interface.md) - Using the chat system
- [Admin Panel Guide](./admin-panel.md) - Credit management for admins
- [Chat Query Examples](./chat-query-examples.md) - Efficient query patterns
