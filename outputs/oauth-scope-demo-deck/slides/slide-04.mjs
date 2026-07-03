import { base, step, card, C } from './shared.mjs';

export async function slide04(presentation, ctx) {
  const slide = presentation.slides.add();
  base(slide, ctx, 'CALENDAR READ-ONLY', 'Clyde reads events to keep interview context current', 'Scope: https://www.googleapis.com/auth/calendar.readonly');
  step(slide, ctx, 1, 70, 252, 'Read upcoming events', 'Clyde lists the user’s primary calendar events, including title, start time, end time, attendees, and conferencing details when present.', C.green);
  step(slide, ctx, 2, 70, 378, 'Match to opportunities', 'Clyde matches events to known companies and roles so the app can show the right context before a call or interview.', C.green);
  step(slide, ctx, 3, 70, 504, 'Avoid duplicates', 'If Calendar already has the invite, Clyde suppresses duplicate “add meeting” suggestions from Gmail.', C.green);
  card(slide, ctx, 692, 270, 468, 246, 'What the user sees', 'Calendar event: “Virtual Onsite 1 - Kenny with Apollo”\n\nClyde action: “Add Virtual Onsite 1 - Kenny with Apollo to Clyde calendar.”\n\nThe user approves the Clyde-side record. Clyde does not edit Google Calendar.', C.green);
  return slide;
}
