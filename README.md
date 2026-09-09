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

Apply up to 12 enabled/disabled limits together, covering seconds, minutes, hours, days and calendar months. Use calendar or sliding windows for each rule; months support actual calendar windows only.

- Date ranges, fixed UTC offsets and random or evenly spaced baseline traffic.
- Baseline amount as a total or requests per minute/hour/day.
- Up to 12 peak windows, with additional request amounts and daily, weekday, weekend or specific-date recurrence.
- Overnight, overlapping and partially included peaks.
- Count only accepted requests or all attempts, including rejections.
- Daily/hourly traffic chart, per-rule bottleneck analysis and paginated request log.
- Every violated limit and earliest availability assuming no new traffic.
- JSON plan save/load and CSV export of all rows matching the active status filter.

The default busy-week plan generates **28,000 requests**: 2,000 baseline requests/day, 800 extra requests at 12:00–13:00 and 1,200 at 18:00–18:30, over seven days. Five rules evaluate that traffic.

The cap is **100,000 requests / 366 days**, without hidden sampling. All active quota rules are evaluated atomically against one shared counter set. The quota workspace is independent of the Spike Arrest workspace.

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

## Lite edition

Open [lite.html](https://kaandikec.com/ApigeeRateLimitCalculator/lite.html) for a simpler Edge Private Cloud Spike Arrest calculator. Three primary inputs cover rate, MP count and request interval. Request count, UseEffectiveCount and routing live under More options. Every request has a selectable explanation, and three examples illustrate steady traffic, overload and simultaneous arrivals.

Lite is a separate, self-contained HTML file with no runtime dependencies. Download HTML preserves settings and removes the download button and full-lab navigation from the offline copy. The full lab remains available at the main URL.

## Appearance

Both editions include matching light and dark palettes. The header button cycles System → Light → Dark; System is the default and reacts to operating-system changes. Preferences are shared between editions through browser local storage and synchronized across tabs. Storage restrictions do not prevent switching themes. Offline HTML retains its selected mode, with System continuing to follow the device. Theme changes do not rerun simulations.

## Target settings helper

The Full Spike Arrest workspace includes **Suggest settings for a target**. Enter a maximum allowance per second, minute, hour, day, week or month and the available MP count. The helper proposes rounded-down shared/per-MP smoothing rates, traffic intervals and separate Quota configuration guidance. Applying a recommendation creates a 40-request steady Edge scenario; it does not deploy policies or alter the quota planner. Rates are nominal averages, not strict distributed window guarantees.

The target helper also supports **Random arrivals across the selected period**. It distributes the exact target count (maximum 10,000) uniformly in that duration with a selectable seed, previews rejections at the recommended rate, and applies the same sample as custom timestamps. Random mode generates a seed for each new sample; Fixed mode repeats it. The helper does not increase the rate to accommodate bursts or present a single sample as a forecast.

## Edge Quota XML generation

In Quotas / Peak traffic, generate one policy per enabled rule and copy/download each XML file, or download the complete file set and request-flow Steps as JSON. Sliding maps to rollingwindow; Calendar maps to default UTC boundaries. The UI and XML explain non-UTC alignment differences, per-MP second counters, distributed synchronous longer counters and sequential policy execution. This produces configuration files, not a deployed proxy or an exact reproduction of the atomic simulation.

**Download all as ZIP** exports individual XML files in `policies/`, a request-flow fragment, README notes and a JSON manifest. It works offline with no additional dependencies. The archive is not a complete Apigee proxy bundle.
