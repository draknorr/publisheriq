# Steam Game Change Intelligence Research

Last updated: March 13, 2026

## Summary

This memo answers a narrow question: what data can PublisherIQ acquire to detect meaningful changes to a Steam game's market presentation or product direction, and what needs to be snapshotted over time to support reliable before/after analysis.

Bottom line:

- Yes, this is possible.
- No, there is not one public "give me the full history of every Steam game change" endpoint.
- SteamDB-style history is best understood as a continuous collection and diffing problem, not as a single-source API problem.
- For arbitrary competitor games, the highest-value bundle is: current Storefront state + Steam News / announcements + PICS / build-change signals + price/review/CCU time series.
- For games you own in Steamworks, you can add much stronger marketing and commercial evidence: wishlist history, traffic breakdown, update visibility performance, and deeper build/manifests access.

This document is intentionally written for multiple use cases:

- Internal product/data teams deciding whether to build change tracking.
- Marketing firms looking for likely clients or campaign opportunities.
- Publishers / BD teams looking for signable or rescue candidates.
- Investors / analysts looking for execution maturity, strategic shifts, or growth inflections.
- Adjacent service providers such as PR, porting, localization, QA, and community teams.

## Key Conclusions

### Collectible Now From Public / Current Sources

- Public store metadata and media from the Storefront `appdetails` endpoint, including descriptions, languages, screenshots, movies, header / capsule image URLs, pricing, categories, genres, release-date text, DLC/package references, and platform flags. Valve exposes the endpoint publicly, but it is effectively a public endpoint rather than a well-documented partner doc surface. Example response: [Storefront appdetails example](https://store.steampowered.com/api/appdetails?appids=730&cc=us&l=english).
- App inventory and incremental change hints from [`IStoreService/GetAppList`](https://partner.steamgames.com/doc/webapi/IStoreService), including `last_modified` and `price_change_number`.
- Public news / announcement records from [`ISteamNews/GetNewsForApp`](https://partner.steamgames.com/doc/webapi/ISteamNews) and the public announcement surfaces documented in [Events and Announcements](https://partner.steamgames.com/doc/marketing/event_tools).
- Current PICS app metadata and change-feed access through Steam client protocol tooling such as [SteamKit](https://github.com/SteamRE/SteamKit), including store tags, genres, categories, release state, `store_asset_mtime`, `buildid`, `timeupdated`, languages, content descriptors, and Steam Deck compatibility. This is practical and already used by this repo's PICS service, but it is not a standard public Web API.
- Price, review, owner, and CCU response metrics from the repo's existing ingestion stack and database.

### Collectible Only If You Store History Over Time

- Description / copy rewrites.
- Header, capsule, screenshot, trailer, and background changes.
- Tag / genre / category drift.
- Release-date precision changes, including "Coming Soon" -> quarter -> exact date patterns.
- Build cadence history and branch state over time.
- Before/after deltas around updates, discounts, content drops, and relaunches.
- Announcement edits after publication.
- Store-page state at the time of a specific event.

In other words: many high-value competitor signals exist as current state, but you only get true historical intelligence if you retain snapshots or diffs.

### Owner-Only / Not Realistically Available For Arbitrary Competitor Games

- Wishlist counts and wishlist history from [Wishlist Reporting](https://partner.steamgames.com/doc/marketing/wishlist/reporting).
- Traffic and impression breakdown from [Visibility on Steam](https://partner.steamgames.com/doc/marketing/visibility).
- Update Visibility Round setup and performance from [Update Visibility Rounds](https://partner.steamgames.com/doc/marketing/visibility/update_rounds).
- Unreleased-app announcement access via `GetNewsForAppAuthed` in [`ISteamNews`](https://partner.steamgames.com/doc/webapi/ISteamNews).
- Depot manifests, file lists, and deeper patch-note generation that require ownership. SteamDB's FAQ explicitly notes that downloading manifests requires ownership and that ownership is what enables depot-file tracking and automatic patch-note generation on their side: [SteamDB FAQ](https://steamdb.info/faq/).

## Definitions And Evidence Rules

Throughout this document:

- `Official` means a Valve / Steamworks documented or first-party served surface.
- `Public but undocumented` means publicly reachable without partner credentials, but not fully documented in partner docs.
- `Unofficial but practical` means protocol- or third-party-driven acquisition that is widely used in practice but not a standard official Web API.
- `Native history available` means the source itself can return older records without your own snapshots.
- `Snapshot required` means the source is mainly current-state unless you retain your own history.
- `Repo-specific observation` means the claim is about PublisherIQ's current code/docs, not about Steam globally.
- `Inference` means the conclusion is reasoned from the available evidence rather than directly stated by a source.

## Current Repo Coverage Audit

### What PublisherIQ Already Captures As Current State

Repo-specific observation:

- [`packages/ingestion/src/apis/storefront.ts`](../../packages/ingestion/src/apis/storefront.ts) parses and can access:
  - name, type, release-date text, `coming_soon`, price, discount, categories, genres, platforms, developers, publishers, DLC references, parent app, Workshop flag, and delisted state.
- [`packages/ingestion/src/apis/steam-web.ts`](../../packages/ingestion/src/apis/steam-web.ts) already contains:
  - `fetchSteamAppList()`
  - `fetchAppNews()`
  - The news helper exists but is not currently wired into a persistence worker.
- [`services/pics-service/src/extractors/common.py`](../../services/pics-service/src/extractors/common.py) extracts:
  - release state
  - `store_asset_mtime`
  - `last_update_timestamp` -> `last_content_update`
  - `current_build_id`
  - store tags / genres / categories
  - platform and controller support
  - Steam Deck compatibility
  - content descriptors
  - languages
  - associations such as developer / publisher / franchise
- [`services/pics-service/src/workers/change_monitor.py`](../../services/pics-service/src/workers/change_monitor.py) runs a change-monitor loop keyed by a PICS change number and re-fetches changed app IDs.
- [`packages/database/src/types.ts`](../../packages/database/src/types.ts) shows the latest-state `apps` table currently stores fields including:
  - `current_price_cents`
  - `current_discount_percent`
  - `release_date`
  - `release_date_raw`
  - `release_state`
  - `store_asset_mtime`
  - `last_content_update`
  - `current_build_id`
  - `pics_review_score`
  - `pics_review_percentage`
  - `platforms`
  - `controller_support`
  - `content_descriptors`
  - `languages`

### What PublisherIQ Already Stores Historically

Repo-specific observation:

- `daily_metrics`: longitudinal review counts, review score / percentage, owners, price, discount, and some daily CCU peaks. See [`packages/database/src/types.ts`](../../packages/database/src/types.ts) and [`docs/developer-guide/architecture/sync-pipeline.md`](../developer-guide/architecture/sync-pipeline.md).
- `review_deltas`: sparse-plus-interpolated review-velocity history. See [`packages/ingestion/src/workers/reviews-worker.ts`](../../packages/ingestion/src/workers/reviews-worker.ts).
- `review_histogram`: monthly review-bucket history. See [`packages/ingestion/src/workers/histogram-worker.ts`](../../packages/ingestion/src/workers/histogram-worker.ts).
- `ccu_snapshots`: short-horizon CCU history. Important caveat: internal docs say snapshots older than 30 days are aggregated into `daily_metrics` and deleted. See [`docs/developer-guide/architecture/database-schema.md`](../developer-guide/architecture/database-schema.md).
- `pics_sync_state`: a single rolling `last_change_number`, not a historical audit log of changes.

### What The Repo Does Not Yet Store Historically

Repo-specific observation:

- No persisted Steam News / announcement history table, even though the fetch helper exists.
- No general Storefront snapshot archive.
- No PICS snapshot archive keyed by change number.
- No asset hash history for capsules, screenshots, trailers, or backgrounds.
- No structured diff history for description / tag / genre / category changes.
- No depot / branch history table.
- No file-level patch history.
- No raw payload archive for `appdetails`, `ISteamNews`, or PICS appinfo.
- No event-performance ingestion from Steamworks analytics.

### Important Existing Caveats

- The repo already treats `store_asset_mtime` carefully. Internal reference docs define it as store-page creation time from PICS, but an internal report cautions that it should be treated as a store-page visibility proxy rather than a guaranteed customer-facing go-live timestamp. See [`docs/reference/pics-data-fields.md`](./pics-data-fields.md) and [`docs/reports/indie-io-intelligence-report-2026-03-13.md`](../reports/indie-io-intelligence-report-2026-03-13.md).
- The repo already has enough demand-response history to evaluate effects after the fact. What it lacks is durable "what changed on the page / appinfo" history.

## Acquisition Surface Matrix

The table below focuses on the highest-value acquisition surfaces for change intelligence.

| Signal | Source | Access method | Official / unofficial | Competitor-app usable | Native history available | Requires your own snapshots | Value for marketing-push detection | Value for direction-change detection | Main caveat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| App inventory plus incremental change hints | [`IStoreService/GetAppList`](https://partner.steamgames.com/doc/webapi/IStoreService) | Steam Web API key | Official | Yes | Limited | Yes | Low | Low to medium | `last_modified` and `price_change_number` only indicate something changed, not what changed |
| Current store-page copy, media, pricing, and merchandising state | [Storefront `appdetails` example](https://store.steampowered.com/api/appdetails?appids=730&cc=us&l=english) | Public Storefront endpoint | Public but undocumented | Yes | No | Yes | High | High | Public current-state only; no native diff/history |
| Public announcement / news history | [`ISteamNews/GetNewsForApp`](https://partner.steamgames.com/doc/webapi/ISteamNews) | Public Web API | Official | Yes | Partial | Usually | High | Medium | Only reflects what the team publishes; not all meaningful changes get posts |
| Community announcement surfaces and RSS | [Events and Announcements](https://partner.steamgames.com/doc/marketing/event_tools) | Public pages + RSS | Official | Yes | Partial | Usually | High | Medium | Published posts can be edited after publishing; RSS and page formats are secondary representations |
| Discount cadence and launch / sale timing | [Discounts](https://partner.steamgames.com/doc/marketing/discounts), Storefront, repo price sync | Storefront + current price sync + Web API hinting | Mixed official/public | Yes | Partial | Yes | High | Medium | Discounts are observable, but campaign context often requires announcements or asset changes too |
| Review response | [`ISteamUserReviews` style summary via repo worker](../../packages/ingestion/src/workers/reviews-worker.ts), [Review Histogram](../../packages/ingestion/src/workers/histogram-worker.ts) | Public reviews endpoints + repo history | Official/public | Yes | Partial | Already partially stored | Medium | Weak direct, strong corroboration | Reviews are outcome signals, not direct evidence of what changed |
| CCU response | Steam current-player API + repo `ccu_snapshots` | Public Steam player-count endpoint + repo history | Official/public | Yes | No | Yes | Medium | Weak direct, strong corroboration | Great for impact analysis, weak for causal attribution alone |
| Current PICS appinfo metadata | [SteamKit](https://github.com/SteamRE/SteamKit), repo PICS service | Steam client protocol via SteamKit | Unofficial but practical | Yes | No | Yes | Medium | High | Strong metadata surface, but not a simple official public API |
| PICS change feed / change numbers | [SteamKit](https://github.com/SteamRE/SteamKit), [`services/pics-service/src/workers/change_monitor.py`](../../services/pics-service/src/workers/change_monitor.py) | Poll `get_changes_since(...)` style feed | Unofficial but practical | Yes | Only while continuously monitoring | Yes | Low | Medium to high | Tells you that something changed, not necessarily what changed |
| Public-branch build and content-update state | [`docs/reference/pics-data-fields.md`](./pics-data-fields.md), repo PICS service | PICS fields such as `depots.branches.public.buildid` and `timeupdated` | Unofficial but practical | Yes | No | Yes | Low | High | Strong technical/lifecycle signal, weak marketing signal by itself |
| SteamDB visible histories | [SteamDB FAQ](https://steamdb.info/faq/) and public SteamDB pages | Third-party website | Unofficial | Yes | Yes, on the site | If building your own system, yes | Medium to high | Medium to high | SteamDB explicitly says there is no API and says to get data from Steam directly if possible |
| Wishlist history | [Wishlist Reporting](https://partner.steamgames.com/doc/marketing/wishlist/reporting) | Steamworks reporting portal | Official owner-only | No | Yes | Optional export | Very high | Medium | Strong commercial signal, but only for apps you own |
| Traffic / impressions / feature placements | [Visibility on Steam](https://partner.steamgames.com/doc/marketing/visibility) | Steamworks traffic analytics | Official owner-only | No | Yes | Optional export | Very high | Medium | Not available for competitor games |
| Update Visibility Round setup and performance | [Update Visibility Rounds](https://partner.steamgames.com/doc/marketing/visibility/update_rounds) | Steamworks marketing admin | Official owner-only | No | Yes | Optional export | Very high | Medium | Only usable for owned apps; not a general competitor-data source |
| Depot manifests and file-level patch diffing | [Builds](https://partner.steamgames.com/doc/store/application/builds), [SteamDB FAQ](https://steamdb.info/faq/) | Steamworks / SteamKit / ownership-gated tools | Mixed official/unofficial | Usually no | Partial | Often | Low | Very high | Ownership is the gating factor for deeper file/manifests access |

## What SteamDB Proves, And What It Does Not

Sourced facts from SteamDB's FAQ:

- SteamDB says it uses [SteamKit](https://github.com/SteamRE/SteamKit) and mostly relies on Steam's own update system to know which applications and packages changed: [SteamDB FAQ](https://steamdb.info/faq/).
- SteamDB says getting depot manifests requires ownership.
- SteamDB says, in short, there is no API for SteamDB and that if you need Steam data, you should get it directly from Steam using Web API or libraries like SteamKit.
- SteamDB explicitly says not to scrape without permission.

Inference:

- The visible SteamDB histories for app/package changes, build changes, price history, and "change detected outside of PICS" strongly imply continuous polling, event retention, and historical diff storage.
- SteamDB is best treated as evidence that this category of intelligence can be built, not as the primary acquisition dependency for PublisherIQ.

## Signal Taxonomy And Interpretation

The mistake to avoid is treating any single signal as "proof." The useful unit is usually a signal family or a repeated multi-signal pattern.

### 4.1 Signal Families

#### Merchandising / Storefront

Signals:

- description, short-description, or "about the game" rewrites
- new or reordered screenshots
- new trailer / movie assets
- header / capsule / background changes
- release-date display changing from vague to precise
- demo, DLC, or package-structure changes
- visible accolades or copy framing changes

Why it matters:

- This is the clearest public evidence of a marketing refresh or positioning change.
- It is often the first visible evidence that a team is reframing the audience, tone, or value proposition.

Best sources:

- Storefront `appdetails`
- live public store page
- asset URLs plus content hashing

#### Commercialization

Signals:

- price increases or decreases
- launch discount setup
- recurring discount cadence
- unusually deep discounts
- F2P conversion or package-model change
- DLC versus base-game packaging shifts

Why it matters:

- This often captures monetization strategy, lifecycle pressure, or a deliberate demand-generation push.

Best sources:

- Storefront `appdetails`
- `IStoreService/GetAppList.price_change_number`
- repo price history if persisted

#### Development Cadence

Signals:

- public build ID changes
- `last_content_update` changes
- announcement rhythm around patches
- review / CCU movement after updates
- Early Access -> 1.0 transition

Why it matters:

- This separates dormant titles from live products.
- It is a strong clue for relaunch setup, active development, or stabilization work.

Best sources:

- PICS / SteamKit
- Steam News
- repo `ccu_snapshots`, `review_deltas`, `daily_metrics`

#### Platform And Audience Expansion

Signals:

- new supported languages
- controller-support changes
- Steam Deck category changes
- platform support expansion
- franchise / publisher / developer association changes
- content-descriptor changes

Why it matters:

- These changes often reflect audience broadening, porting, compliance work, or professionalization.

Best sources:

- PICS appinfo
- Storefront `supported_languages`
- repo PICS tables

#### Communications / Publicity

Signals:

- announcement cadence
- event type (major update, patch notes, sale event, cross-promo)
- featured event usage
- RSS feed activity
- festival / sale participation messaging
- teaser posts in advance of updates

Why it matters:

- For public competitor analysis, this is the closest thing to a marketing-operations feed.

Best sources:

- [Events and Announcements](https://partner.steamgames.com/doc/marketing/event_tools)
- [`ISteamNews`](https://partner.steamgames.com/doc/webapi/ISteamNews)
- public announcement pages

#### Demand Response

Signals:

- review velocity spikes
- CCU spikes
- sustained versus collapsing post-spike retention
- owner / review conversion shifts
- demand movement after discounts, updates, or store refreshes

Why it matters:

- These are not direct change signals, but they are essential for measuring whether the visible change mattered.

Best sources:

- repo `daily_metrics`
- repo `review_deltas`
- repo `ccu_snapshots`

#### Secondary Signal Families Worth Adding Later

These are useful, but were not the core focus of this memo:

- review-text topic drift and bug-topic clustering
- achievement-schema changes and completion-rate shifts
- Workshop ecosystem size / growth
- follower growth if exposed through public surfaces or third-party capture
- external press / creator coverage synchronized with Steam changes
- cross-store or cross-platform launch coordination outside Steam

These are best treated as phase-4 enrichment rather than MVP change detection.

### 4.2 Interpretation Framework

Use the following fields when turning raw signals into an interpretation layer:

- `Intent class`: marketing, product, monetization, lifecycle, platform expansion, distress, experimentation
- `Evidence strength`: strong / medium / weak
- `Expected lag`: immediate / short-lag / long-lag
- `Persistence`: one-off / sustained
- `Required corroboration`: what other family should confirm it
- `False positive risk`: how the signal can mislead if viewed alone

Examples:

| Signal | Intent class | Evidence strength | Expected lag | Persistence | Required corroboration | False positive risk |
| --- | --- | --- | --- | --- | --- | --- |
| Capsule / header change | Marketing | Medium | Immediate | Usually one-off | Announcement or discount timing | Could be routine cleanup, localization, or art polish only |
| Description rewrite plus tag drift | Product / positioning | Strong | Short-lag | Sustained | Build cadence or updated media | Could reflect copy cleanup rather than real design change |
| Build ID change alone | Product | Medium | Immediate | Repeats over time | Announcement or downstream demand | Could be minor hotfix / backend-only |
| Deep discount alone | Monetization / lifecycle | Medium | Immediate | One-off or repeated | Announcement, visibility, or retention response | Could be seasonal routine rather than strategic change |
| New languages plus Steam Deck improvement | Platform expansion | Strong | Long-lag | Sustained | Store copy or release notes | Could be incremental compliance rather than go-to-market shift |
| Review spike after announcement | Marketing / product | Medium | Short-lag | Variable | CCU change and store diffs | Review movement could be coincidental or press-driven |

### 4.3 Composite Patterns

Composite patterns are where this gets actionable.

#### New Marketing Push

Typical bundle:

- fresh announcement or major update post
- asset refresh
- discount or sale participation
- CCU and review spike inside a tight event window

Likely meaning:

- The team is actively trying to expand reach or re-engage lapsed users.

Who should care:

- marketing agencies
- PR firms
- publishers

Minimum corroboration:

- at least one public comms signal plus one merchandising or commercial signal

#### Major Repositioning

Typical bundle:

- description rewrite
- screenshot / trailer swap
- tag / genre drift
- release-date messaging or package changes

Likely meaning:

- The team is changing audience targeting, genre framing, or go-to-market narrative.

Who should care:

- publishers / BD
- investors / analysts
- creative agencies

Minimum corroboration:

- copy/media change plus taxonomy drift or new technical/product evidence

#### 1.0 / Relaunch Setup

Typical bundle:

- rising build cadence
- pre-launch announcements
- artwork override usage
- launch discount timing
- exact release-date lock-in

Likely meaning:

- A major lifecycle beat is approaching.

Who should care:

- agencies
- publishers
- investors
- porting / QA / localization vendors

Minimum corroboration:

- development cadence plus comms / commercialization evidence

#### Commercial Stress

Typical bundle:

- repeated discounts
- weak retention after each spike
- limited content cadence
- stale store assets
- no meaningful announcement program

Likely meaning:

- The team may be searching for demand without enough product or marketing leverage.

Who should care:

- publishers seeking rescue candidates
- agencies pitching turnaround work
- investors assessing execution risk

Minimum corroboration:

- repeated commercial signals plus weak downstream demand quality

#### Hidden Upside

Typical bundle:

- strong reviews or rising review velocity
- consistent build cadence
- weak store presentation and weak announcement discipline

Likely meaning:

- The game or team may be under-marketed relative to product quality.

Who should care:

- marketing firms
- publishers / BD

Minimum corroboration:

- product and demand strength paired with clearly weak communications / merchandising

#### Post-Signing / External-Support Activation

Typical bundle:

- publisher / association changes
- more polished assets
- stronger announcement cadence
- better discount timing
- clearer major-beat packaging

Likely meaning:

- The project may have brought in outside help: publisher, agency, platform partner, or internal GTM resources.

Who should care:

- competitor intelligence teams
- service firms
- investors

Minimum corroboration:

- association or organizational shift plus improved public execution

### 4.4 Persona-Specific Lenses

#### Marketing Agencies / Firms

The most valuable pattern is not "game changed" but "good prospect with bad go-to-market execution."

High-value indicators:

- strong review quality or active development cadence, but stale store assets and weak announcement rhythm
- a major beat approaching, but little visible pre-launch or pre-update setup
- meaningful update response in reviews / CCU, followed by no amplification through discounts, media refresh, or follow-up events
- repeated repositioning attempts without coherent campaign packaging
- dormant game waking up with build activity and announcements, but still lacking polished marketing infrastructure

Agency-specific lead archetypes:

| Archetype | What you would see |
| --- | --- |
| Under-marketed good product | positive reviews, active updates, weak assets and weak comms |
| Relaunch candidate | new build cadence, refreshed copy/media, date precision tightening, discount setup |
| Eventization gap | updates ship, but no major announcement packaging or visibility usage |
| Creative refresh need | repeated copy changes or trailer swaps with no consistent identity |
| Community-management gap | active patch cadence with thin or reactive public communication |

#### Publishers / BD Teams

High-value indicators:

- signable growth candidate: strong product signals, weak commercial execution
- rescue candidate: decent sentiment, poor retention, price pressure, stale positioning
- platform-expansion candidate: language / controller / Steam Deck / platform movement suggests broader potential
- franchise maturation signal: new DLC cadence, stronger associations, clearer long-term merchandising

What BD should ask:

- Is the core product better than the current market presentation?
- Is the team shipping, but not merchandising?
- Is there evidence of strategic coherence across updates, pricing, and messaging?

#### Investors / Analysts

High-value indicators:

- execution maturity: consistent updates, coherent messaging, disciplined beats
- strategic pivot: taxonomy drift, audience broadening, monetization change
- discount dependency: demand appears only during price events
- operating discipline: can the team convert product beats into sustained engagement rather than one-day spikes?

Investor caution:

- Steam page traffic alone is not the same as algorithmic visibility; Valve explicitly says store-page traffic alone is not a visibility factor in [Visibility on Steam](https://partner.steamgames.com/doc/marketing/visibility).
- Wishlists matter commercially, but Valve also says wishlists are mostly not a direct algorithmic visibility factor outside exceptions such as Popular Upcoming; they are still important because launch and 20%+ discount emails are sent to wishlisters. See [Visibility on Steam](https://partner.steamgames.com/doc/marketing/visibility) and [Wishlist Reporting](https://partner.steamgames.com/doc/marketing/wishlist/reporting).

#### Adjacent Service Providers

Examples:

- QA / live-ops firms: frequent build churn, bug-fix cadence, negative review-topic instability
- porting firms: controller, language, Steam Deck, and platform expansion signals
- PR firms: major beats with weak narrative packaging or thin press-style announcements
- community firms: active updates but weak cadence of player-facing communication
- localization firms: major content beats paired with thin language support

### 4.5 Opportunity / Lead Scoring

To operationalize this for outbound or diligence workflows, score opportunities on five dimensions:

- `Need`: how clearly the signals show an execution gap
- `Capacity`: whether the team appears active and resourced enough to buy help or capitalize on help
- `Timing`: whether a meaningful beat is near-term
- `Evidence quality`: how many signal families agree
- `Observed outcome`: whether previous changes actually moved demand

Suggested qualitative rubric:

| Dimension | Low | Medium | High |
| --- | --- | --- | --- |
| Need | little visible gap | some mismatch between product and execution | obvious execution gap or relaunch need |
| Capacity | dormant, collapsing, or abandoned | active but uncertain | active cadence and credible commercial motion |
| Timing | no visible beat | possible beat forming | major update, release, DLC, or campaign window soon |
| Evidence quality | one noisy signal | two signal families align | three or more families align |
| Observed outcome | no response to prior changes | mixed response | clear positive response to prior beats |

Persona-specific weighting:

- Agencies should overweight `Need` and `Timing`.
- Publishers / BD should overweight `Need`, `Capacity`, and `Evidence quality`.
- Investors should overweight `Capacity`, `Observed outcome`, and strategic coherence.
- Service providers should weight the dimension most relevant to their category, such as localization breadth or build instability.

## High-Value External Facts That Change The Interpretation

These official facts materially shape how change intelligence should be read:

- Valve requires new products to have a Coming Soon page up for at least two weeks before release, and states that wishlisters receive an email when the game releases: [Coming Soon](https://partner.steamgames.com/doc/store/coming_soon).
- Valve explicitly allows temporary artwork overrides for major updates / seasonal events / new content, while base capsule assets cannot contain sales copy or miscellaneous promotional text: [Store Graphical Asset Rules](https://partner.steamgames.com/doc/store/assets/rules).
- Valve recommends pairing major updates with announcements, discounts, and update visibility where appropriate: [Updating Your Game](https://partner.steamgames.com/doc/store/updates).
- Update Visibility Rounds start at five rounds per product, can run for up to 30 days or 1M home-page impressions, and require a recent community announcement posted within the last 30 days: [Update Visibility Rounds](https://partner.steamgames.com/doc/marketing/visibility/update_rounds).
- `IStoreService/GetAppList` returns `last_modified` and `price_change_number`, both of which are useful lightweight change triggers: [IStoreService Interface](https://partner.steamgames.com/doc/webapi/IStoreService).
- `ISteamNews/GetNewsForApp` is a public news API for an app's posts; the publisher-authed variant can return info for unreleased games you own: [ISteamNews Interface](https://partner.steamgames.com/doc/webapi/ISteamNews).
- Steamworks wishlist reporting tracks additions, purchases, and deletions for users who had the game wishlisted: [Wishlist Reporting](https://partner.steamgames.com/doc/marketing/wishlist/reporting).

These are not implementation details; they directly affect what kinds of inferred stories are defensible.

## Before / After Methodology

To replicate SteamDB-like change intelligence for competitor games, the minimum viable system is:

### 1. Store Versioned Current-State Snapshots

Store, at minimum:

- normalized Storefront payload snapshots
- normalized PICS appinfo snapshots
- observed timestamps
- source name
- raw payload hash

Recommended key:

- `(appid, source, observed_at)` plus a stable content hash

### 2. Compute Structured Diffs

For each new snapshot, compute diffs for:

- copy fields
- price / discount
- release-date text
- tags / genres / categories
- languages
- controller / Steam Deck / platforms
- DLC / package references
- build ID / last content update
- asset URLs and asset hashes

This matters because "something changed" is not actionable enough. You want change records such as:

- `description_rewritten`
- `capsule_changed`
- `discount_started`
- `buildid_changed`
- `tags_shifted`
- `release_date_became_exact`

### 3. Version Media Assets

For visible media:

- capture the URL
- download or hash the resolved content
- record first seen / last seen

This is especially important because marketing refreshes often show up as media changes before or alongside explicit announcements.

### 4. Persist Announcement Records

For Steam News / community announcements:

- persist title
- body / HTML or normalized text
- publish timestamp
- author
- feed name / label / tags
- edit detection if body changes later

This is required because Steam's docs explicitly note that published events can be edited later and those edits may appear immediately to players: [Events and Announcements](https://partner.steamgames.com/doc/marketing/event_tools).

### 5. Join Changes To Outcome Windows

For every detected change event, compute outcome windows using existing repo history:

- `T-7d`, `T-30d` baseline
- `T+1d`, `T+7d`, `T+30d` response
- review delta
- CCU delta
- price / discount context

This is the step that turns "change tracking" into "change intelligence."

## Recommended Build Order

### Phase 1: Highest ROI

- Persist Steam News / announcement history.
- Snapshot normalized Storefront state.
- Snapshot normalized PICS current state keyed by observed time and change number.
- Compute first-pass diffs for:
  - copy
  - tags / genres / categories
  - price / discount
  - release-date text
  - build ID
  - last content update
- Join all diff events to existing review / CCU / price history.

Why first:

- This gets most of the value for both competitor intelligence and agency / BD lead finding.

### Phase 2: Media And Merchandising History

- Hash and version capsule, header, screenshot, trailer, and background assets.
- Add media-diff events such as new trailer, screenshot set refresh, capsule swap.
- Add store-page rendering capture if you need exact visual before/after.

Why second:

- This is where a lot of marketing refresh and repositioning evidence lives.

### Phase 3: Deeper Lifecycle And Commercial Signals

- Track public-branch build cadence more explicitly.
- Add sale / featuring participation inference where publicly visible.
- Add owner-only Steamworks exports for owned titles:
  - wishlist history
  - traffic / impressions
  - update visibility performance

Why third:

- Strong value, but split between competitor-usable and owner-only workflows.

### Phase 4: Optional Enrichment

- review-text topic modeling
- achievement / Workshop enrichment
- external press / creator coverage matching
- cross-platform / cross-store coordination

## Best-ROI Use Cases By Audience

### Best ROI For Marketing-Push Detection

- announcement ingestion
- price / discount history
- media hashing
- release-date text diffs
- CCU / review response windows

### Best ROI For Direction-Change Detection

- description and short-description diffs
- tag / genre / category drift
- build cadence and public-branch changes
- language / controller / Steam Deck changes
- DLC / package / monetization changes

### Best ROI For Marketing Firms Prospecting For Clients

- identify games with strong product signals but weak merchandising / comms
- identify relaunch windows and major update setup
- identify under-amplified demand spikes
- identify teams with active development but low public marketing sophistication

### Best ROI For Publishers / BD / Investors

- separate "good game, weak GTM" from "weak game, high discount dependency"
- watch for strategic pivots and professionalization
- monitor whether major beats produce durable retention or only temporary spikes

## Example `/chat` Prompts

These example prompts assume PublisherIQ adds the change-intelligence features described in this memo: historical Storefront / PICS snapshots, structured diffs, announcement history, media hashing, and event-to-outcome analysis.

The prompts are intentionally phrased the way an operator might actually use a chat product rather than as rigid API calls.

### Competitive And Change Detection

1. "Show me the biggest Steam store-page changes for `Hades II` in the last 90 days."
2. "What changed on the Steam page for `No Rest for the Wicked` before and after its last major update?"
3. "Which upcoming games changed their release-date messaging from vague to exact in the last 30 days?"
4. "Find games that changed tags or genres materially in the last 6 months and summarize what likely shifted."
5. "Which games added new screenshots, trailers, or capsule art in the last 14 days but did not post an announcement?"

### Marketing Push Detection

6. "Find games that look like they started a new marketing push in the last 30 days."
7. "Which games had the strongest combined signal of announcement + discount + asset refresh this month?"
8. "Show me games that used a likely relaunch pattern: new trailer, store-copy rewrite, and discount within 21 days."
9. "Which titles had a major Steam announcement recently, but weak downstream CCU or review response?"
10. "Find games that appear to be teasing a big update before it ships."

### Agency / Client Prospecting

11. "Find games with strong review quality and active development cadence but weak storefront merchandising."
12. "Which live-service or frequently updated games look under-marketed and could be good agency prospects?"
13. "Show me dormant games that appear to be waking up again and may need launch or relaunch marketing support."
14. "Rank possible marketing-agency leads by need, timing, and evidence quality."
15. "Find games where updates are shipping, but public communication and eventization are weak."

### Publisher / BD Workflows

16. "Find signable indie games where product quality looks stronger than go-to-market execution."
17. "Which games look like rescue candidates: heavy discounting, weak retention, but still decent sentiment?"
18. "Show me games that may be preparing for a 1.0 launch, console push, or platform-expansion beat."

### Investor / Strategy Workflows

19. "Which studios or games show evidence of a strategic pivot in audience, monetization, or genre positioning?"
20. "Find titles where recent major updates produced sustained demand rather than a one-day spike, and explain why."

### Notes On Prompt Design

These examples imply a few chat capabilities that do not exist yet in the current repo:

- time-bounded diff retrieval such as "what changed in the last 30 days"
- before / after comparisons across snapshots
- composite-pattern detection such as "marketing push" or "relaunch pattern"
- lead scoring for agency / BD use cases
- causal-style outcome summaries that join change events to CCU / review / price windows

If these features are implemented, this prompt set would be a good starting point for both product QA and demo scenarios.

## Practical Do / Do Not Guidance

Do:

- Treat SteamDB as proof of feasibility and as a validation surface.
- Build your own retained history from Steam-first sources.
- Use multiple signal families before making claims about "new marketing push" or "change in direction."
- Use demand-response history to score whether a change was effective.

Do not:

- Depend on SteamDB scraping as your primary ingestion path.
- Treat a PICS change number as a meaningful business event without a diff.
- Treat store-page traffic as a proxy for visibility quality.
- Treat a single discount or single build change as strategy proof by itself.

## Source Appendix

### Primary Valve / Steam Sources

- [Steamworks: IStoreService Interface](https://partner.steamgames.com/doc/webapi/IStoreService)
- [Steamworks: ISteamNews Interface](https://partner.steamgames.com/doc/webapi/ISteamNews)
- [Steamworks: Coming Soon](https://partner.steamgames.com/doc/store/coming_soon)
- [Steamworks: Store Graphical Asset Rules](https://partner.steamgames.com/doc/store/assets/rules)
- [Steamworks: Events and Announcements](https://partner.steamgames.com/doc/marketing/event_tools)
- [Steamworks: Visibility on Steam](https://partner.steamgames.com/doc/marketing/visibility)
- [Steamworks: Update Visibility Rounds](https://partner.steamgames.com/doc/marketing/visibility/update_rounds)
- [Steamworks: Discounts](https://partner.steamgames.com/doc/marketing/discounts)
- [Steamworks: Wishlist Reporting](https://partner.steamgames.com/doc/marketing/wishlist/reporting)
- [Steamworks: Updating Your Game](https://partner.steamgames.com/doc/store/updates)
- [Steamworks: Builds](https://partner.steamgames.com/doc/store/application/builds)
- [Public Storefront appdetails example](https://store.steampowered.com/api/appdetails?appids=730&cc=us&l=english)
- [Public Steam News example](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=2&maxlength=250)

### SteamDB / SteamKit

- [SteamDB FAQ](https://steamdb.info/faq/)
- [SteamKit](https://github.com/SteamRE/SteamKit)

### PublisherIQ Repo Sources

- [`packages/ingestion/src/apis/steam-web.ts`](../../packages/ingestion/src/apis/steam-web.ts)
- [`packages/ingestion/src/apis/storefront.ts`](../../packages/ingestion/src/apis/storefront.ts)
- [`services/pics-service/src/extractors/common.py`](../../services/pics-service/src/extractors/common.py)
- [`services/pics-service/src/workers/change_monitor.py`](../../services/pics-service/src/workers/change_monitor.py)
- [`packages/database/src/types.ts`](../../packages/database/src/types.ts)
- [`docs/reference/pics-data-fields.md`](./pics-data-fields.md)
- [`docs/reference/data-gaps-analysis.md`](./data-gaps-analysis.md)
- [`docs/reference/data-sources-comprehensive.md`](./data-sources-comprehensive.md)
- [`docs/developer-guide/architecture/database-schema.md`](../developer-guide/architecture/database-schema.md)
- [`docs/developer-guide/architecture/sync-pipeline.md`](../developer-guide/architecture/sync-pipeline.md)
- [`docs/reports/indie-io-intelligence-report-2026-03-13.md`](../reports/indie-io-intelligence-report-2026-03-13.md)
