# Vendor Finder Workflow Spec

## The Problem

User needs to find a service provider (e.g., endodontist, contractor, accountant). This requires:
1. Understanding what they're looking for
2. Finding candidates
3. Researching each candidate
4. Analyzing and comparing options
5. Making a decision

**Current state:** The workflow searches, builds a list, fetches websites, finds reviews, but:
- The final output is unclear - just a list with scattered data
- No clear analysis or recommendation
- Information is fragmented, not synthesized
- No comparison view to help decide
- Reviews are superficial (search snippets, not actual reviews)
- No clear "here's what I found, here's what I recommend"

---

## User Story

> "I need an endodontist in Cambridge. Find me good options, tell me what people say about them, and help me decide who to call."

The workflow should act like a smart assistant who:
1. Understands the search (location, specialty, any constraints)
2. Finds real candidates (not aggregator sites)
3. Researches each one properly (not just scraping snippets)
4. Synthesizes findings into a useful report
5. Gives a clear recommendation with reasoning

---

## Proposed Workflow Stages

### Stage 1: Understand Requirements
**Goal:** Clarify exactly what we're looking for

**Input:**
- Query: "endodontist"
- Location: "Cambridge, MA"
- Requirements: "weekend hours, takes Delta Dental"

**Output:**
- Structured criteria with search strategy
- Clear confirmation of what we're searching for

**Checkpoint:** User confirms criteria before we start searching

---

### Stage 2: Find Candidates
**Goal:** Build a list of real, specific vendors (not directories)

**Method:**
1. Multiple targeted searches
2. Filter out aggregators, directories, irrelevant results
3. Dedupe by actual business

**Output:**
- 5-15 real vendor candidates
- For each: name, website, brief description, location

**Checkpoint:** User reviews list, can remove any they don't want researched

---

### Stage 3: Deep Research (per vendor)
**Goal:** Get real information about each vendor

**For each vendor, gather:**
1. **From their website:**
   - Services offered
   - Location/hours
   - Insurance accepted
   - Staff/credentials
   - Any specialties

2. **From Yelp (if applicable):**
   - Star rating
   - Review count
   - Key positive themes
   - Key negative themes
   - 2-3 representative quotes

3. **From Google Reviews:**
   - Star rating
   - Review count
   - Key themes

4. **From Reddit/forums (if found):**
   - Community sentiment
   - Any red flags or strong endorsements

**Output per vendor:**
```
Dr. Smith Endodontics
━━━━━━━━━━━━━━━━━━━━
📍 123 Main St, Cambridge
🕐 Mon-Fri 8-5, Sat 9-1
💰 Accepts: Delta Dental, Aetna, BCBS

⭐ 4.7/5 (127 reviews on Yelp)
⭐ 4.5/5 (89 reviews on Google)

✅ Strengths:
   • "Painless procedure" (mentioned 15x)
   • "Great with anxious patients"
   • Modern equipment

⚠️ Concerns:
   • "Long wait times" (mentioned 8x)
   • "Parking is difficult"

💬 Sample Reviews:
   "Had a root canal here and barely felt anything..."
```

---

### Stage 4: Analysis & Recommendation
**Goal:** Synthesize findings and help user decide

**Output:**

```
## Summary

I researched 8 endodontists in Cambridge, MA.

### Top Recommendation: Dr. Smith Endodontics
Why: Highest ratings, accepts your insurance, has Saturday hours.
Only caveat: Parking is limited - plan to arrive early.

### Strong Alternative: Cambridge Dental Specialists
Why: Slightly lower ratings but never mentioned wait times.
Good if: You prioritize efficiency over ambiance.

### Avoid: QuickRoot Dental
Why: Multiple recent reviews mention billing issues.

## Quick Comparison

| Name           | Rating | Accepts Delta | Sat Hours | Wait Time |
|----------------|--------|---------------|-----------|-----------|
| Dr. Smith      | 4.7    | ✓             | ✓         | Long      |
| Cambridge DS   | 4.3    | ✓             | ✗         | Short     |
| EndoExperts    | 4.5    | ✗             | ✓         | Medium    |
```

**Checkpoint:** User reviews final report

---

## What Gets Saved as Asset

### Option A: Full Research Report (Document)
A complete markdown document with:
- Search criteria
- All vendor profiles
- Analysis and recommendations
- Comparison table

### Option B: Vendor Comparison Table (Table)
Interactive table with:
- All vendors as rows
- Key attributes as columns
- Sortable/filterable in table view

### Option C: Both
- Report saved as document asset
- Table saved as data asset

**Recommendation:** Save both. User can reference the detailed report or quickly scan the table.

---

## Key Improvements Needed

### 1. Better Review Collection
**Current:** Searches for "Company yelp reviews" and parses snippets
**Better:**
- Use Yelp API if available
- Actually visit Yelp/Google pages and extract review data
- Get real review counts and ratings, not guesses from snippets

### 2. Real Analysis
**Current:** Lists vendors with their data, no synthesis
**Better:**
- Dedicated analysis step that:
  - Identifies patterns across vendors
  - Makes specific recommendations
  - Explains trade-offs
  - Highlights red flags

### 3. Better UI
**Current:** Card view showing raw data
**Better:**
- Clear visual hierarchy (recommendation at top)
- Comparison table
- Expandable detail sections
- Color-coded ratings/sentiment

### 4. Smarter Filtering
**Current:** All vendors go through all steps
**Better:**
- Let user exclude vendors at checkpoint
- Don't waste time researching vendors user isn't interested in

### 5. Clear Deliverable
**Current:** "Here's some vendors with data"
**Better:** "Here's my recommendation and why, here's the full research"

---

## Revised Graph Structure

```
[understand_requirements]
        ↓
[requirements_checkpoint] ← user confirms
        ↓
[find_candidates]
        ↓
[candidates_checkpoint] ← user can exclude vendors
        ↓
[deep_research] ← researches remaining vendors in parallel
        ↓
[analyze_and_recommend] ← NEW: LLM synthesizes findings
        ↓
[final_checkpoint] ← user reviews report, can save
```

---

## Questions to Discuss

1. **How many vendors to research deeply?**
   - Current: All of them
   - Proposal: Top 10, or let user select at checkpoint

2. **How to handle vendors with no reviews?**
   - Skip them? Note "no reviews found"? Research harder?

3. **Should we try to get pricing info?**
   - Often not available online for services like medical
   - Note when we can't find it

4. **What if search finds no good candidates?**
   - Expand search radius?
   - Suggest alternative search terms?
   - Just report "couldn't find much"?

5. **Parallel vs sequential research?**
   - Current: Sequential (slow but predictable)
   - Parallel: Faster but harder to show progress

---

## Implementation Priority

1. **Add analysis step** - This is the biggest gap. Even with current data, we should synthesize it.

2. **Fix review collection** - Actually visit review sites instead of parsing search snippets.

3. **Improve checkpoint UX** - Let user select/deselect vendors before deep research.

4. **Better final output** - Clear recommendation, comparison table, proper formatting.

5. **Asset saving** - Save both report and table.
