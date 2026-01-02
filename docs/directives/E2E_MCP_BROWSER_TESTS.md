# E2E Test Prompt - LMS Frontend (Agent Directive)

> **Purpose**: Guide for browser agent to execute end-to-end tests
> **Method**: Given/When/Then (Gherkin) + Backend Fixtures API
> **Tool**: MCP browser tools + fixtures.py
> **See also**: [HUMAN_TESTING.md](HUMAN_TESTING.md) pour tests avec humain dans la boucle

---

## URLs

| Environment | Frontend | API |
|-------------|----------|-----|
| Production | https://lms-viewer.matthieu-marielouise.workers.dev | https://lms-api.matthieu-marielouise.workers.dev |

---

## Fixtures

Backend endpoint `/api/test/seed` applies fixtures directly in DB.

| Fixture | Description |
|---------|-------------|
| `clean_slate` | Fresh user, no progress |
| `step3` | Steps 1-2 completed, on step 3 |
| `last_step` | Steps 1-5 completed, on last step |
| `completed` | Course finished, all badges |

### Apply Fixture

```bash
cd tpb_system/04.Execution/lms

# List fixtures
python3 scripts/tests/fixtures.py --list

# Apply (auto-detect user_id)
python3 scripts/tests/fixtures.py clean_slate

# Apply with specific user
python3 scripts/tests/fixtures.py step3 --user-id contact_xxx
```

### Validate DB State

```bash
# Verify state after test
python3 scripts/tests/validate_state.py fresh_user
python3 scripts/tests/validate_state.py video_resume
python3 scripts/tests/validate_state.py quiz_complete
python3 scripts/tests/validate_state.py step_progress
```

---

## Test Scenarios

### P1-01: Welcome Screen (Fresh User)

**Fixture:** `clean_slate`

```gherkin
Scenario: Welcome screen displays for new user
  Given fixture "clean_slate" is applied
  And I navigate to the frontend URL
  When the page loads
  Then I should see "Bienvenue dans l'Academy TPB"
  And XP should be 0
  And I should see course list in sidebar
```

---

### P1-02: Resume from Step 3

**Fixture:** `step3`

```gherkin
Scenario: Resume from last position
  Given fixture "step3" is applied
  When I navigate to the frontend
  Then I should see "Étape 3 / 6"
  And XP should be > 0
  And badges first_quiz and perfect_quiz should be earned
```

---

### P1-03: Course Completed

**Fixture:** `completed`

```gherkin
Scenario: Completed course shows end state
  Given fixture "completed" is applied
  When I navigate to the frontend
  Then I should see "Étape 6 / 6"
  And quiz should show "✅ Quiz réussi"
  And multiple badges should be displayed
```

---

## Test Execution Flow

```python
# 1. SETUP: Apply fixture
run_terminal_cmd("python3 scripts/tests/fixtures.py step3 --user-id contact_xxx")

# 2. NAVIGATE: Open browser
browser_navigate(url="https://lms-viewer.matthieu-marielouise.workers.dev")

# 3. WAIT: Let app load
browser_wait_for(time=3)

# 4. SNAPSHOT: Get state
snapshot = browser_snapshot()

# 5. VERIFY UI: Check expected elements
assert "Étape 3" in str(snapshot)

# 6. CHECK CONSOLE: No JS errors
console = browser_console_messages()
assert no errors in console
```

---

## Second Pareto Speedrun Features

### P2-01: URL par Step (GAP-203)

**Fixture:** `step3`

```gherkin
Scenario: URL includes step parameter
  Given fixture "step3" is applied
  When I navigate to the frontend
  Then URL should contain "?som=wge-onboarding&step=2"
  When I click "Suivant" to go to next step
  Then URL should update to "?step=3"
  When I press browser Back button
  Then I should return to step 2
```

---

### P2-02: Resume Video (GAP-102)

**Fixture:** `step3` (with video progress)

```gherkin
Scenario: Video resumes from last position
  Given fixture "step3" is applied (with video at 45s)
  When I navigate to the frontend
  And I open step with video
  Then video should seek to approximately 45 seconds
  And console should show "Resuming video at Xs"
```

---

### P2-03: Progress % in Signals (GAP-601)

**Manual API Test:**

```bash
curl -H "CF-Access-Client-Id: xxx" \
     -H "CF-Access-Client-Secret: xxx" \
     https://lms-api.matthieu-marielouise.workers.dev/api/signals/wge-onboarding

# Response should include:
# "course_progress": { "completed": 2, "total": 3, "percent": 67 }
```

---

### P2-04: Rate Limiting (GAP-1415)

**Manual Test:**

```bash
# Burst 150 requests
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://lms-api.matthieu-marielouise.workers.dev/api/health
done | sort | uniq -c

# Expected: ~100x 200, ~50x 429
```

---

### P2-05: Idempotency (GAP-711)

**Manual Test:**

```bash
# Same request with same idempotency key
KEY="test-$(date +%s)"
for i in 1 2 3; do
  curl -X POST \
    -H "X-Idempotency-Key: $KEY" \
    -H "CF-Access-Client-Id: xxx" \
    -H "CF-Access-Client-Secret: xxx" \
    -d '{"type":"VIDEO_PING","course_id":"test","class_id":"test","payload":{"position_sec":10,"duration_sec":100}}' \
    https://lms-api.matthieu-marielouise.workers.dev/api/events
done

# Second and third requests should return X-Idempotency-Cached: true
```

---

## Summary Table

| # | Test | Fixture | Key Assertion |
|---|------|---------|---------------|
| P1-01 | Welcome | clean_slate | XP=0, welcome message |
| P1-02 | Resume | step3 | Step 3, badges earned |
| P1-03 | Completed | completed | Step 6, quiz passed |
| P2-01 | URL par Step | step3 | URL has ?step=N, back/forward works |
| P2-02 | Resume Video | step3 | Video seeks to saved position |
| P2-03 | Progress % | step3 | signals.course_progress present |
| P2-04 | Rate Limiting | N/A | 429 after 100 requests |
| P2-05 | Idempotency | N/A | Cached response on duplicate |

---

## Validation Checklist

After EACH test:
- [ ] Fixture applied successfully
- [ ] UI shows expected state  
- [ ] Console has 0 JS errors
- [ ] Behavior matches Gherkin spec

---

*Last updated: 2024-12-29*
*Second Pareto Speedrun: 6 GAPs tested*
