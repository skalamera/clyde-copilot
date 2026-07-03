import { base, step, card, C } from './shared.mjs';

export async function slide03(presentation, ctx) {
  const slide = presentation.slides.add();
  base(slide, ctx, 'GMAIL READ-ONLY', 'Clyde scans Gmail to find user-review actions', 'Scope: https://www.googleapis.com/auth/gmail.readonly');
  step(slide, ctx, 1, 70, 254, 'Read recent messages', 'Clyde lists recent Gmail messages for the connected user. The app focuses on recruiter, scheduling, and opportunity-update threads.', C.teal);
  step(slide, ctx, 2, 70, 380, 'Classify the thread', 'Clyde detects signals such as interview confirmation, request for availability, invite sent, role update, or rejection.', C.teal);
  step(slide, ctx, 3, 70, 506, 'Create a pending action', 'The user sees an action card before Clyde changes any opportunity, task, or Clyde calendar record.', C.teal);
  card(slide, ctx, 690, 268, 468, 260, 'Example from the app', 'Email: “I just sent an invite for Wednesday at 3:00pm EDT.”\n\nClyde suggestion: “Add interview meeting request to Clyde calendar.”\n\nEmail: “Let me know your availability for a 45-minute Zoom.”\n\nClyde suggestion: “Review availability request.”', C.amber);
  return slide;
}
