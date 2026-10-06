// The candidate's resume as text, extracted once from their PDF and sent with
// every review. An exact copy (minus contact details), not a summary: a
// summary drops details and can introduce mistakes. The PDF is not kept.
import { File, Paths } from 'expo-file-system';

import { textModel } from '../ai';

export type Background = {
  // Resume text without name/contact details.
  text: string;
  // Original file name, shown so the user knows which resume this came from.
  sourceName: string;
  updatedAt: number;
};

const file = () => new File(Paths.document, 'background.json');

// Plain text, not JSON: it's pasted into the review prompt as-is.
const RESUME_PROMPT = `Copy the text of this job candidate's resume exactly as written, so an interview coach can use it.

Rules:
- Copy every section, job, bullet point, number and date word for word. Do not summarize, shorten, reorder or reword anything, and never add anything.
- Remove only the candidate's name, email, phone number, street address and links (LinkedIn, GitHub, personal sites).
- Plain text. Keep section headings and put each bullet point on its own line starting with "- ".
- If the document is not a resume, reply with exactly: NOT_A_RESUME`;

export async function loadBackground(): Promise<Background | null> {
  const f = file();
  if (!f.exists) return null;
  try {
    const b = JSON.parse(await f.text()) as Background & { summary?: string };
    // Early test builds stored a summary under `summary`.
    return { ...b, text: b.text ?? b.summary ?? '' };
  } catch {
    return null;
  }
}

export function removeBackground() {
  const f = file();
  if (f.exists) f.delete();
}

// Throws with a user-facing message on failure; nothing is saved then.
export async function learnFromResume(pdf: File): Promise<Background> {
  const MAX_BYTES = 10 * 1024 * 1024;
  if ((pdf.size ?? 0) > MAX_BYTES) throw new Error('This file is larger than 10 MB. Please choose a smaller PDF.');

  const text = (
    await textModel.complete({
      system: RESUME_PROMPT,
      prompt: 'Copy the text of this resume.',
      files: [{ mimeType: 'application/pdf', base64: await pdf.base64() }],
    })
  ).trim();
  if (text === 'NOT_A_RESUME' || text.length < 40) {
    throw new Error("This doesn't look like a resume. Please choose your resume PDF.");
  }

  const background: Background = { text, sourceName: pdf.name, updatedAt: Date.now() };
  const f = file();
  if (!f.exists) f.create();
  f.write(JSON.stringify(background));
  return background;
}
