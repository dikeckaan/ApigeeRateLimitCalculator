# API Rate Limit Lab

An English-language, offline, single-HTML simulator for Apigee Spike Arrest, general rate limiting algorithms, multi-window quotas and scheduled peak traffic.

**Live site:** https://kaandikec.com/ApigeeRateLimitCalculator/

**Complete user guide:** https://kaandikec.com/ApigeeRateLimitCalculator/#guide

## Run locally

Open `index.html` in a modern browser. No server, installation, API key, CDN or internet connection is required. The application never calls a real API or uploads simulation data.

The hosted **Download HTML** button creates a standalone copy containing both workspaces, the complete guide and current settings. Seeds are saved as Fixed for repeatable replay. The downloaded copy does not include the HTML download button; other exports remain available.

## Spike Arrest / Algorithms

- Simplified Edge smoothing and ideal X / hybrid shared sliding-window models.
- Rate (`ps` / `pm`), Message Processor count and UseEffectiveCount.
- Steady, periodic burst, jitter and custom timestamp traffic with a start offset.
- Round-robin, single-MP and seeded random routing.
- Per-request 200 / 429 results, decision reasons and model wait times.
- Time histogram, MP load analysis and status filters.
- Edge, shared sliding window, fixed window and token bucket comparisons on identical traffic.
- JSON scenario save/load and complete CSV export.

Try **Window boundary**: at `2ps`, requests at `998, 999, 1000, 1001 ms` produce four accepts in fixed window and two in shared sliding window.

## Quotas / Peak traffic

Apply up to 12 enabled/disabled limits together, covering seconds, minutes, hours, days, weeks and calendar months. Use calendar or sliding windows for each rule; months support actual calendar windows only.

- Date ranges, fixed UTC offsets and random or evenly spaced baseline traffic.
- Baseline amount as a total or requests per minute/hour/day.
- Up to 12 peak windows, with additional request amounts and daily, weekday, weekend or specific-date recurrence.
- Overnight, overlapping and partially included peaks.
- Count only accepted requests or all attempts, including rejections.
- Daily/hourly traffic chart, per-rule bottleneck analysis and paginated request log.
- Every violated limit and earliest availability assuming no new traffic.
- JSON plan save/load and CSV export of all rows matching the active status filter.

The default busy-week plan generates **28,000 requests**: 2,000 baseline requests/day, 800 extra requests at 12:00–13:00 and 1,200 at 18:00–18:30, over seven days. Five rules evaluate that traffic.

The cap is **100,000 requests / 366 days**, without hidden sampling. All active quota rules are evaluated atomically against one shared counter set. Use **Copy plan to Quotas / Peak traffic** to copy the source limits and Spike Arrest settings. Destination traffic, dates, peaks and seed are preserved. Copies remain independently editable; the last transfer can be undone. An optional upstream Spike Arrest stage runs before the atomic quota checks. Spike Arrest rejections never reach quotas; later quota rejections still consume Spike Arrest capacity.

## Random and fixed seeds

**Random per simulation** is the default for new configurations. A browser-generated seed is visible after each relevant recalculation or quota run. **Fixed / repeatable** enables manual seed entry and keeps traffic stable while comparing configurations. **New seed** draws a fresh value and recalculates while preserving the selected mode.

Switching Random to Fixed retains the displayed seed. Saved JSON and HTML snapshots intentionally use Fixed mode so they reproduce that sample. The live workspace keeps its selected mode. Older v2/v3 JSON files without `seedMode` remain compatible and are interpreted as Fixed.

## Detailed user guide

The in-app **User guide** includes 20 searchable chapters, a table of contents, direct chapter links, seven worked experiments, JSON examples, a glossary and troubleshooting. It is included in every offline HTML snapshot and has a print layout.

The guide covers every input, request-generation formulas, algorithm boundaries, MP capacity, quota accounting, time zones, calendar months, peak recurrence/proration, seed modes, exports and practical limits. Open `#guide` or a chapter such as `#guide-seeds` on the hosted page.

## CSV / Limit advisor

Import a flat Edge request log or aggregate traffic CSV. The advisor supports automatic column aliases plus manual mapping, CSV/TSV delimiters, ISO/Unix timestamps, and explicit invalid-row handling. Included example files demonstrate both row types.

- Exclude API proxies, developers, paths, apps, HTTP statuses or environments using exact/prefix/contains/* wildcard rules.
- Normalize URL origins and query strings before path matching; inspect an exclusion audit with overlap-aware totals.
- Analyze shared traffic or a selected API, developer, API+developer, app or path group.
- Size candidates from complete calendar-bucket peaks, P99 or P95 plus configurable headroom.
- Inspect standalone and combined calendar-counter replay counts.
- Export a JSON analysis or recommendation CSV without raw traffic rows.

Coarse source buckets never produce finer-period recommendations. Missing periods in the declared coverage count as zero; partial periods do not determine percentiles. A full month is required for monthly sizing. These are generic calendar limits, not validated Edge smoothing policies or production guarantees.

Imported CSV and results remain in memory and are intentionally excluded from offline HTML snapshots. **Clear imported data** removes the current import. The advisor accepts up to 15 MB / 100,000 rows / 366 days and does not expand aggregate request counts into fabricated events.

Open directly: https://kaandikec.com/ApigeeRateLimitCalculator/#advisor

## Model scope

This is not an Apigee runtime emulator or a load-testing client. A 200 means the model allows a request, not that the backend succeeds. A 429 represents a model violation; actual HTTP responses depend on runtime and fault rules.

Edge uses a simplified one-token smoothing model; real bucket capacity, bursts and rounding can differ. X / hybrid uses an ideal shared window without distributed synchronization delays. The quota planner does not emulate sequential Apigee policy execution, StartTime details or per-Identifier behavior. Fixed time zone offsets do not include daylight saving transitions.

The model assumes no prior traffic, one Identifier, MessageWeight=1 and a fixed MP count. Retries, backend latency, queues and concurrency are outside its scope. Input caps are simulator limits, not published Apigee service limits.

## Tests

Node.js 22.13+:

```sh
npm ci
npm test
```

jsdom is a development-only dependency; the deployed application has no runtime dependencies. Tests cover boundary decisions, random traffic, quota accounting, month transitions and leap years, overnight peaks, validation, JSON/CSV exports, offline snapshots, guide navigation/search and seed modes.

GitHub Pages publishes the `main` branch at `/`. `.nojekyll` enables direct static-file serving.

## Original backup

The original pre-development file is preserved unchanged at [`backups/spike-arrest-v1.html`](backups/spike-arrest-v1.html), including its original language.

SHA-256: `226a51538c7472dbac465405247a700a923799695546288b13137841259df081`

## References

- [Apigee Edge SpikeArrest](https://docs.apigee.com/api-platform/reference/policies/spike-arrest-policy)
- [Apigee X / hybrid SpikeArrest](https://docs.cloud.google.com/apigee/docs/api-platform/reference/policies/spike-arrest-policy)
- [Apigee Quota policy](https://docs.cloud.google.com/apigee/docs/api-platform/reference/policies/quota-policy)
- [General rate limiting algorithms](https://redis.io/tutorials/howtos/ratelimiting/)

### Edge Private Cloud workflow (v3.3)

Edge Private Cloud is the primary/default product. The first workspace includes a simultaneous limit plan with second, minute, hour, day, week and month quotas and a combined preview using the selected Spike Arrest traffic. Calendar weeks reset Sunday at 00:00 in the selected fixed offset; sliding weeks last seven days. UTC matches Edge default weekly alignment.

SpikeArrest Rate remains ps/pm; longer periods are separate quota rules. Shared second-window quotas are a generic planning model (Edge second quotas do not support distributed counters). The planner does not emulate full sequential Edge Quota flows, synchronization or StartTime semantics. Source scenario JSON, destination plan JSON and the offline HTML preserve the new settings.

Pre-change backup: `backups/rate-limit-lab-v3.2.html`.
