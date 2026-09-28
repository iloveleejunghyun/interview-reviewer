# AI Interview Reviewer — Idea Validation

*Refined from "App Idea Validation Framework" · 2026-09-27 · @Yuan Wan*

Items marked **[ASSUMPTION]** are accepted for the test without being checked with users. Items marked **[DECIDE]** need a decision before building.

---

## Stage 1 — Problem

**Target user**
English-speaking job seekers in an **active search**: people who expect at least 2 interviews in the next 2 weeks. They want to know what went wrong in the last interview so they do better in the next one.
- Market: English-language App Store storefronts (US, UK, Canada, Australia, etc.). **China mainland storefront excluded** at launch.
- Recording setup: **the phone is used only for recording. The interview happens in person, or on another device (laptop) playing through its speaker.** [ASSUMPTION] See Risk 1.

**Problem** (without mentioning AI or the app)
After an interview, candidates can't remember exactly which questions they were asked or what they answered. So they can't tell what to improve, and they repeat the same mistakes in the next interview. The workarounds that capture everything take several manual steps and some know-how, so most people skip them.

**Current workarounds**
1. Recall the questions afterwards and ask a chatbot for better answers. Questions get forgotten, and the chatbot only sees the candidate's memory of their answer, not the actual answer.
2. Record with one app, transcribe with another, paste the transcript into ChatGPT, and write a good prompt. This captures everything, but it's 3–4 tools and needs prompt skill.
3. Do nothing. This is probably the most common, and it's the real competitor.

**Frequency / severity**
Episodic but intense. During a search, a candidate may have several interviews a week for a few weeks, and none between searches. Each interview is high-stakes: a job offer depends on it.
→ This shapes the metric (Stage 2) and later monetization: usage clusters inside a job search, so long-term retention isn't the right measure.

---

## Stage 2 — Core hypothesis

**Core hypothesis**
If job seekers in an active search can get a question-by-question review of a real interview just by recording it, **at least 20% of activated users will review a second real interview within 14 days of their first.**

**Definitions**
- **Activated user:** reviewed one real interview, meaning the review screen was opened for a recording longer than 10 minutes.
- **Eligible user:** an activated user who, at onboarding, said they expect at least one more interview in the next 2 weeks. The metric is calculated on eligible users only. A user with no further interview can't repeat, and that says nothing about the product.

**Primary behavior**
Record → transcript → review → **record the next interview.**

**Thresholds** (fixed now; don't change them after seeing data)

| Result (eligible activated users) | Decision |
|---|---|
| ≥ 20% review a 2nd real interview within 14 days | **GO** |
| 10–20% | **RETEST ONCE**: interview 5 users about why, change one thing, rerun. Only one retest. |
| < 10% | **KILL** unless there is a strong alternative signal (see Stage 7) |

**Measurement window**
14 days per user. The test ends at 100 installs or 30 days, whichever comes first.

---

## Stage 3 — Alternatives

| Type | Examples | What they do well | Gap for this user |
|---|---|---|---|
| General recording + transcription | Otter, Rev, Speakwise, Apple Voice Memos (built-in transcription) | Reliable recording, good transcripts, generic summaries | Summarize "the meeting"; no question-by-question interview review or better answers |
| Interview **practice** apps | Google Interview Warmup, Yoodli, Interview AI, Big Interview | Structured feedback, STAR coaching | Practice questions only, not the user's **real** interview |
| Live interview "copilots" | Final Round AI, Interview Sidekick | Real-time answer suggestions | Different job (help during the interview); ethically contested; not our category |
| Recruiter-side tools | Metaview, Ashby AI Notetaker, Fireflies | Interview transcripts and summaries | Built for the employer, not the candidate |
| DIY | Recorder + ChatGPT + prompts | Flexible, cheap | 3–4 steps plus prompt skill |

**Why existing solutions fail this user**
No single tool goes from "I just had a real interview" to "here's each question, what I said, and what a stronger answer looks like."

**Why now**
Cheap, accurate long-form speech recognition that tells speakers apart, plus LLMs good enough to pull questions out of a messy conversation and critique the answers. Two years ago this needed a human coach.

**Evidence of demand: missing, and the gap to close first.**
Before building, spend 1–2 hours on:
- Reddit (r/jobs, r/cscareerquestions, r/interviews): do people share "interview debrief" prompts, or complain about forgetting questions?
- US App Store search for "interview review", "interview recorder" and "interview feedback": what exists, and how many ratings do they have?
- Ask 5 English-speaking job seekers: "Did you review your last interview? How?" and "Were you on headphones or speaker?" The second question tests Risk 1.

---

## Stage 4 — Experiment and MVP

**MVP features** (each passes the deletion test)
1. **Reliable long recording:** 30–90 min, keeps running **with the screen locked** and survives interruptions. Saved locally first, then uploaded. The phone sits locked on the table, so background recording is required, not optional. It needs the iOS background-audio setting, which App Review looks at closely; the review notes should explain it.
2. **A setup tip on the record screen:** "Put this phone near the speaker. Don't use headphones on your interview device." One line of text; this is what makes the recording-only assumption work.
3. **Reliable transcription with speaker separation (interviewer vs. me).** Use a file-transcription API, which handles long files, not streaming. Without speaker separation, the app can't tell questions from answers.
4. **Interview review:** a list of the questions asked; for each, a short summary of what the user said, what was weak, and a stronger answer. This is the core product.
5. **Consent gate** (from the framework) naming each AI vendor, plus a one-line reminder: "Make sure the interviewer agrees to being recorded."
6. **One onboarding question:** "How many interviews do you expect in the next 2 weeks?" (0 / 1 / 2+). This is what makes the metric measurable.
7. **Event tracking with PostHog** for the funnel below. No backend needed.

**Backlog** (deliberately not building)
- Upload a resume
- "Discuss for more details" (chat)
- Practice / mock interviews
- Sales, public speaking and general speaking review
- Importing audio files
- Export / share, history search
- Android
- Chinese-language version

**Never:** live answers during the interview. It's a different product, ethically risky, and risky for App Review.

**Acquisition channel**
iOS App Store in English-language storefronts. Organic posts come first: Reddit job-search communities, LinkedIn, and your own network. They're free and well-targeted. Apple Search Ads come second, only if organic doesn't reach 100 installs.

**Test budget**
¥1,000 (≈ US$140), covering ads **and** AI API costs. US cost per install for paid search is typically several dollars, so the budget alone buys only a few dozen installs → organic channels have to do most of the work. Set a spending cap in each AI vendor console, since the key ships inside the app.

**Target sample size**
100 installs → roughly 30–40 activated → roughly 20–30 eligible. At that size, 20% is about 5 people, so treat the result as **directional**, not statistically significant. Decide now to accept that.

**Funnel tracked**
Store impression → product page view → install → consent agreed → first recording > 10 min → transcript OK → review opened → **second real interview reviewed within 14 days**
(The steps up to install come from App Store Connect; the rest from PostHog.)

**Development time**
- 10 hours for **this app**, on top of the framework.
- The framework (monorepo, shared packages, TestFlight pipeline) is a separate, reusable investment. Track it separately so it doesn't eat this app's budget.
- The calendar also needs App Store review time: about 10 days last time, plus one rejection round.

---

## Analytics: PostHog

- **Why PostHog:** it supports Expo with no custom native code; its dependencies are only Expo packages. It has US or EU hosting, funnels and retention charts built in, and a free tier far larger than this test needs.
- **The key is safe to ship:** unlike the AI keys, a PostHog project key is meant to be public. It can only send events, not read data.
- **No App Tracking Transparency prompt:** use an anonymous ID generated by the app (the SDK default), with no IDFA and no cross-app tracking. Turn off session replay and automatic screen capture; they aren't needed for the funnel and would expand the privacy disclosure.
- **Privacy label:** declare "Usage Data → Product Interaction", not linked to identity and not used for tracking. PostHog is disclosed in the privacy policy and the privacy label, not on the AI consent screen, so `consent_declined` can still be counted.
- **Events (9 in total):** `onboarding_answered {expected_interviews}`, `consent_agreed`, `consent_declined`, `recording_started`, `recording_finished {duration_sec}`, `transcript_succeeded` / `transcript_failed {reason}`, `review_opened {interview_index}`.

---

## Key risks

1. **Headphones (accepted assumption).** An iPhone can't record audio from another app's call, so the phone must hear the interview through a speaker or in person. Users on headphones will get a one-sided recording. Mitigations: the setup tip (MVP 2), and the `transcript_failed` / speaker-count data will show how often this happens. If it's frequent, "import an audio file" moves from the backlog to the MVP.
2. **Chinese AI vendors for English users (accepted for now).** Volcengine (transcription) and Qianfan (review) stay for the test and will be replaced later. Before building, check two things on one real English recording: (a) English accuracy with speaker separation (interviewer vs. me); (b) that the review model handles long English transcripts well. The consent gate and privacy policy must say plainly that audio is processed by these China-based providers. Some English-speaking users will decline at that screen, so track `consent_declined` too. All AI calls go through one `ai-client` module, so switching vendors later changes one module, not the app.
3. **Paid acquisition cost.** See the Test budget section. Plan on organic channels.
4. **Privacy.** The recording contains the interviewer's voice: a third party's personal information, sent to AI vendors. The consent gate covers the user, and the reminder covers the interviewer. If EU/UK storefronts are included, the privacy policy must cover GDPR basics (what's sent, retention, deletion).
5. **Transcript quality.** Phone on a table, laptop speaker, varied accents. Test one real 30-minute recording through the chosen vendor before committing to it.
6. **Developing from China.** Most English-market AI and analytics services need a foreign card for billing, and may need a VPN to reach from mainland China during development. Check both before building.

---

## Decisions needed

1. ~~AI vendors~~ → **Volcengine + Qianfan for now**, to be replaced later behind the `ai-client` module (decided). Still check English quality on one real recording before building.
2. ~~Event tracking~~ → **PostHog** (decided).
3. ~~Storefront~~ → **English-language storefronts, China mainland excluded** (decided). This also avoids China's generative-AI filing requirement.

---

## Stages 5–7

Unchanged from the framework. Stage 7 adds one pre-agreed alternative signal worth a pivot rather than a kill: **users repeatedly open old reviews before new interviews**, even without recording new ones. That would point to "interview notebook / prep" instead of "interview recorder".

---

## One-page founder checklist

| # | Question | Answer |
|---|---|---|
| 1 | Target user | English-speaking job seekers in an active search (≥2 interviews expected in 2 weeks) |
| 2 | Problem | Can't remember the questions or their own answers after an interview, so can't improve before the next one |
| 3 | Current alternative | Nothing; recall + chatbot; or recorder + transcription + ChatGPT + prompts |
| 4 | Evidence | **Not yet collected.** Reddit/App Store search + 5 user conversations (Stage 3) |
| 5 | Core hypothesis | ≥20% of eligible activated users review a 2nd real interview within 14 days |
| 6 | Primary metric | Second real interview reviewed within 14 days of the first |
| 7 | Success threshold | ≥20% |
| 8 | Failure threshold | <10% (10–20% = one retest) |
| 9 | MVP | Locked-screen long recording, speaker tip, speaker-separated transcript, question-by-question review, consent, 1 onboarding question, PostHog events |
| 10 | Backlog | Resume, chat, practice mode, other speaking scenarios, import, export, Android, Chinese version |
| 11 | Development limit | 10 h for the app (framework tracked separately) |
| 12 | Test plan | iOS English storefronts; organic (Reddit/LinkedIn) first; ¥1,000 incl. API costs; 100 installs or 30 days |
| 13 | Decision commitment | Kill at <10% unless the pre-agreed alternative signal appears |
| 14 | Likely biases | Adding the resume/chat features back in; prompt-tuning before real users; counting downloads as validation; blaming acquisition when activation is weak |
