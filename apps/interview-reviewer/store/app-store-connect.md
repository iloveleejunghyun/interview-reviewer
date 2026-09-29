# Interview Reviewer: App Store Connect submission

Everything to paste into App Store Connect for version 1.0.0 (build 1).
Bundle ID `com.ai12.interviewreviewer` · Team `C8SX4X838D`.

## App information

| Field | Value |
|---|---|
| Name | Interview Reviewer |
| Subtitle (≤30) | AI feedback on real interviews |
| Primary category | Productivity |
| Secondary category | Business |
| Age rating | 4+ (answer "None" to every content question) |
| Privacy Policy URL | *(the hosted `privacy-policy.html`)* |
| Support URL | *(required; can be the same site)* |
| Availability | English-language storefronts; **exclude China mainland** (see docs/idea-validation.md) |

## Version 1.0.0

**Promotional text (≤170)**
Record your interview, then see every question you were asked, how you answered, and a stronger answer to use next time.

**Description**
```
You walk out of an interview and the questions start to blur. What exactly did they ask? What did you say? Interview Reviewer remembers for you, and tells you what to fix before the next one.

HOW IT WORKS
1. Tap Record and put your phone near the speaker (or on the table for in-person interviews). You can lock the screen; recording keeps going.
2. When the interview ends, tap Stop.
3. About a minute later you get a question-by-question review.

WHAT YOU GET
• Every question the interviewer asked, in order, with a timestamp
• A short summary of what you actually said
• A rating for each answer: Strong, OK, or Weak
• Specific things to improve
• A stronger version of your answer, built only from what you said. Where your answer needs details only you know, it leaves a [placeholder] for you to fill in, instead of inventing achievements.
• Your top 3 improvements and what went well

PRIVACY
No account needed. Before anything is recorded, the app tells you exactly which AI services process your audio and transcript, and nothing is sent unless you agree. Your recordings and reviews are stored on your phone.

Always get the interviewer's permission before recording.
```

**Keywords (≤100 chars)**
`interview,job interview,feedback,practice,recorder,transcribe,career,coach,answers,job search`

**Screenshots**: 6.9" display (1320×2868), in `store/screenshots/`, in this order:
1. `01-recording.png`
2. `02-home.png`
3. `03-review-summary.png`
4. `04-question-feedback.png`
5. `05-consent.png` (optional)

## App Privacy (privacy label)

Answer **Yes, we collect data**, then declare exactly these. Everything else: not collected.

| Data type | Purpose | Linked to user? | Used for tracking? |
|---|---|---|---|
| User Content → **Audio Data** | App Functionality | No | No |
| User Content → **Other User Content** (transcripts) | App Functionality | No | No |
| Usage Data → **Product Interaction** | Analytics | No | No |
| Identifiers → **Device ID** (PostHog's random install ID) | Analytics | No | No |

Notes:
- Audio and transcripts are sent to Volcengine and Baidu Qianfan for processing. Whether they keep copies is governed by their terms, so declaring these as collected is the conservative choice.
- The Device ID row is also conservative: it's a random ID the app creates, not the advertising identifier. If App Review questions it, it can be removed.
- No ATT prompt is needed: nothing is used for tracking.

## App Review information

**Sign-in required:** No.

**Notes for the reviewer**
```
Interview Reviewer records a job interview and uses AI to review the candidate's answers.

HOW TO TEST
1. Launch the app and answer the one-question survey.
2. Read the consent screen and tap Agree. It names the two AI services that process the audio and transcript (Volcengine and Baidu Qianfan) and what each does. Nothing is recorded or sent before the user agrees.
3. Tap "Record interview" and allow microphone access.
4. Play any mock job interview video (for example, search YouTube for "mock job interview") on another device, for AT LEAST 1 MINUTE, with the phone nearby. A few seconds of speech is not enough to review; the app will say so rather than produce an empty review.
5. Tap Stop. The interview appears in the list; after about a minute it shows "Review ready". Tap it to see the question-by-question review.

BACKGROUND AUDIO (UIBackgroundModes: audio)
Interviews last 30 to 90 minutes, and the phone is placed on a table with the screen locked. The audio background mode is used only to keep an active recording running when the screen locks. Recording starts and stops only when the user taps Record/Stop, and iOS shows the recording indicator the whole time. The app plays no background audio.

DATA
No account. Recordings, transcripts, and reviews are stored on the device. Audio is sent only to Volcengine for transcription and the transcript only to Baidu Qianfan for the review, both disclosed on the consent screen and in the privacy policy. Anonymous usage analytics (PostHog) contain no audio or transcript content.

The app also reminds users to get the interviewer's permission before recording.
```

**Export compliance:** handled by `ITSAppUsesNonExemptEncryption = false` in the build (HTTPS only).

## Before you press Submit

- [ ] Clean build, and version/build number checked in the uploaded build (1.0.0 / 1)
- [ ] Privacy policy URL loads in a browser
- [ ] Screenshots are the iPhone ones in `store/screenshots/`
- [ ] Availability excludes China mainland
