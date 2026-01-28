# Command Palette Filter System — Product & UX Specification

## Overview

A unified filter interface accessed via `⌘K` (or `Ctrl+K`) that serves as the primary entry point for all filtering operations. The palette supports multiple "views" that morph based on user intent, combining quick search with deep browsing capabilities.

---

## Core Principles

1. **Keyboard-first, mouse-friendly** — Power users can navigate entirely via keyboard; casual users can click through
2. **Progressive disclosure** — Start simple, reveal complexity on demand
3. **Contextual morphing** — The palette changes shape/size based on what the user is doing
4. **Persistent state** — Selections persist across view changes within a session
5. **Immediate feedback** — Show filter parsing, result counts, and selections in real-time

---

## Information Architecture

```
Command Palette
├── Home View (default)
│   ├── Search Input (parses filters + searches content)
│   ├── Quick Presets (4-6 saved filter combinations)
│   ├── Navigation: "Browse All Tags" → Tags View
│   ├── Trending Tags (6-8 frequently used/growing)
│   └── Metric Filters (quick access to top 4-5)
│
└── Tags View (expanded)
    ├── Back Navigation → Home View
    ├── Match Mode Toggle (AND/OR)
    ├── Tag Search (filters within tags only)
    ├── Selected Tags Bar (shows current selections)
    └── Accordion Categories
        ├── Category 1 (expandable)
        │   └── Tag Grid (2-column, with counts)
        ├── Category 2...
        └── Category N...
```

---

## View Specifications

### Home View

**Purpose:** Quick access to common filters, search, and navigation to deeper views.

**Dimensions:** Standard modal width (~500-560px), height adapts to content (max ~60-70vh)

**Sections (top to bottom):**

1. **Search Input**
   - Placeholder: "Search filters, tags, or type ccu > 50000..."
   - Parses structured filter syntax (see Filter Syntax below)
   - Searches across tags, presets, and metric filter names
   - Shows parsed filter preview when syntax is valid

2. **Parsed Filter Preview** (conditional)
   - Only appears when search input contains valid filter syntax
   - Shows: "Add filter: [Filter Name] [operator] [value]"
   - Press Enter to add, or click the row
   - Visual differentiation (success/green styling)

3. **Quick Presets**
   - 2x2 or 1x4 grid of saved filter combinations
   - Each shows: icon/emoji, name, short description
   - Click to apply preset and close palette

4. **Browse Tags Navigation**
   - Prominent card/button that navigates to Tags View
   - Shows badge with selected tag count if > 0
   - Chevron or arrow indicating navigation

5. **Trending Tags**
   - Horizontal chip/pill layout
   - 6-8 tags that are frequently used or growing
   - Click to toggle selection (stays in Home View)
   - Visual indicator for selected state

6. **Metric Filters**
   - Vertical list of 4-5 most common metric filters
   - Shows filter name and shortcut code
   - Click to populate search input with `[shortcut] > ` syntax

**Keyboard Behavior:**
- `↑↓` Navigate between sections/items
- `Enter` Select focused item or apply parsed filter
- `Escape` Close palette
- Typing focuses search input

---

### Tags View

**Purpose:** Full browsing and selection of tags across all categories.

**Dimensions:** Wider than Home View (~700-800px) to accommodate two-column tag grid. Smooth width transition when entering/exiting.

**Sections (top to bottom):**

1. **Header Bar**
   - Back button (← or chevron) → returns to Home View
   - Title: "Tags & Categories"
   - Subtitle: "[N] selected" or "Select tags to filter results"
   - Match Mode Toggle: `[Match ALL]` `[Match ANY]` buttons

2. **Tag Search**
   - Filters visible tags across all categories
   - Placeholder: "Filter tags..."
   - Does not affect selected tags, only visibility

3. **Selected Tags Bar** (conditional)
   - Only appears when tags are selected
   - Horizontal scrollable list of selected tag chips
   - Each chip shows tag name + remove (×) button
   - Shows first 5, then "+N more" if overflow
   - "Clear all" action at end

4. **Accordion Categories**
   - Each category is a collapsible section
   - **Header row shows:**
     - Category icon
     - Category name
     - Selected count badge (if > 0 selected in category)
     - Tag count (e.g., "12 tags")
     - Expand/collapse chevron
   - **Expanded content shows:**
     - 2-column grid of tags
     - Each tag shows: checkbox/indicator, name, trending badge (if applicable), count
     - Click tag to toggle selection
   - Default: First 2 categories expanded, rest collapsed
   - Remember expansion state during session

5. **Footer**
   - Keyboard hints (optional)
   - "Done" button to close palette

**Keyboard Behavior:**
- `Escape` Returns to Home View (not close)
- `↑↓` Navigate between tags within expanded category
- `Space` or `Enter` Toggle tag selection
- `Tab` Move between categories

---

## Filter Syntax Parsing

The search input should recognize and parse structured filter expressions:

### Supported Formats

```
[shortcut] > [value]     →  Greater than
[shortcut] < [value]     →  Less than
[shortcut] >= [value]    →  Greater than or equal
[shortcut] <= [value]    →  Less than or equal
[shortcut] = [value]     →  Equals
[shortcut]:[value]       →  Equals (alternative syntax)
```

### Examples

```
ccu > 50000              →  Peak CCU greater than 50,000
growth > 10              →  7d Growth greater than 10%
score >= 85              →  Review Score at least 85%
price < 20               →  Price under $20
genre:action             →  Genre equals Action
```

### Shortcut Mapping

Define shortcuts for each metric filter:

| Shortcut | Filter |
|----------|--------|
| `ccu` | Peak CCU |
| `owners` | Total Owners |
| `reviews` | Review Count |
| `price` | Price |
| `score` | Review Score |
| `growth` | 7d CCU Growth |
| `growth30` | 30d CCU Growth |
| `momentum` | Momentum Score |

When a valid filter is parsed:
1. Show preview bar below search input
2. Display human-readable interpretation
3. Allow Enter to add filter
4. Clear search input after adding

---

## State Management

### Filter State Shape

```typescript
interface FilterState {
  // Tag selections
  selectedTags: string[];           // Array of tag IDs
  tagMatchMode: 'all' | 'any';      // AND vs OR logic
  
  // Metric filters
  metricFilters: {
    [filterId: string]: {
      operator: '>' | '<' | '>=' | '<=' | '=';
      value: number | string;
    };
  };
  
  // Active preset (if any)
  activePreset: string | null;
  
  // UI state
  recentTags: string[];             // Last 10 used tags
  expandedCategories: string[];     // Currently expanded accordion sections
}
```

### State Persistence

- **Session:** Expanded categories, recent tags
- **URL:** Selected tags, metric filters, match mode (for shareability)
- **User preferences:** Saved presets/views

---

## Interaction Flows

### Flow 1: Quick Tag Selection

```
User presses ⌘K
  → Home View opens
  → User sees "Roguelike" in Trending Tags
  → User clicks "Roguelike"
  → Tag toggles selected (chip visual change)
  → User presses Escape
  → Palette closes, filter applied
```

### Flow 2: Metric Filter via Syntax

```
User presses ⌘K
  → Home View opens
  → User types "ccu > 50000"
  → Parsed filter preview appears: "Add filter: Peak CCU > 50,000"
  → User presses Enter
  → Filter added, search input clears
  → User presses Escape
  → Palette closes, filter applied
```

### Flow 3: Deep Tag Browsing

```
User presses ⌘K
  → Home View opens
  → User clicks "Browse All Tags"
  → Palette morphs wider, Tags View appears
  → User clicks "Sub-Genre" category to expand
  → User checks "Roguelike", "Roguelite", "Souls-like"
  → User toggles Match Mode to "ANY"
  → User clicks "Done"
  → Palette closes, filter applied: (Roguelike OR Roguelite OR Souls-like)
```

### Flow 4: Search Within Tags

```
User presses ⌘K
  → Home View opens
  → User clicks "Browse All Tags"
  → Tags View appears
  → User types "pixel" in tag search
  → Only "Pixel Art" tag visible (in Art Style category)
  → User clicks to select
  → User clears search to see all tags again
  → User clicks "Done"
```

---

## Component Hierarchy

```
<CommandPalette>
  <Backdrop />                          // Click to close
  <PaletteContainer>                    // Animated width/height
    {view === 'home' && (
      <HomeView>
        <SearchInput />
        <ParsedFilterPreview />         // Conditional
        <PresetGrid />
        <BrowseTagsCard />
        <TrendingTags />
        <MetricFilterList />
        <Footer />
      </HomeView>
    )}
    {view === 'tags' && (
      <TagsView>
        <Header>
          <BackButton />
          <Title />
          <MatchModeToggle />
        </Header>
        <TagSearch />
        <SelectedTagsBar />             // Conditional
        <AccordionContainer>
          {categories.map(cat => (
            <AccordionCategory>
              <CategoryHeader />
              <TagGrid />               // Conditional on expanded
            </AccordionCategory>
          ))}
        </AccordionContainer>
        <Footer />
      </TagsView>
    )}
  </PaletteContainer>
</CommandPalette>
```

---

## Visual Behavior Notes

### Transitions

- **View switch:** Width should animate smoothly (200-300ms ease-out)
- **Accordion expand:** Height animates, content fades in
- **Tag selection:** Subtle background/border change, optional micro-animation
- **Parsed filter preview:** Slides down from search input

### Responsive Considerations

- On narrow viewports (< 640px), consider full-width palette
- Tags View may need single-column tag grid on mobile
- Touch targets minimum 44px for tag checkboxes

### Accessibility

- Focus trap within palette when open
- Aria labels for all interactive elements
- Announce filter additions to screen readers
- Support reduced motion preferences

---

## Active Filters Display (Outside Palette)

When filters are active, display them above the data table:

```
┌─────────────────────────────────────────────────────────────────┐
│ Active Filters                                    Matching ALL  │
│ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐          │
│ │ Roguelike  × │ │ Action     × │ │ Peak CCU > 50K × │  Clear  │
│ └──────────────┘ └──────────────┘ └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

- Each filter as a removable chip/pill
- Color-code by category (tags) vs type (metrics)
- Show match mode indicator
- "Clear all" action
- Click any chip to re-open palette with that filter focused

---

## Data Requirements

### Tags Data Structure

```typescript
interface TagCategory {
  id: string;
  label: string;
  icon: string;           // Icon identifier
  color: string;          // Color theme identifier
  tags: Tag[];
}

interface Tag {
  id: string;
  label: string;
  count: number;          // Games with this tag
  trending?: boolean;     // Show trending indicator
}
```

### Presets Data Structure

```typescript
interface Preset {
  id: string;
  label: string;
  icon: string;           // Emoji or icon
  description: string;
  filters: FilterState;   // The filters this preset applies
}
```

---

## Implementation Notes

1. **Filter counts should update** based on current filter state (show impact of each additional tag)

2. **URL synchronization** — All filter state should reflect in URL params for bookmarking/sharing

3. **Debounce search** — 150-300ms debounce on tag search to avoid excessive filtering

4. **Category expansion memory** — Remember which categories user expanded during session

5. **Recent tags tracking** — Store last 10 selected tags for quick access in Home View

6. **Keyboard shortcut hint** — Show ⌘K hint near the main search/filter trigger on the page

---

## Success Metrics

- Time to apply first filter (target: < 3 seconds for known filter)
- Filter discovery rate (users exploring Tags View)
- Preset usage rate
- Keyboard vs mouse interaction ratio (target: 40%+ keyboard for power users)
