import { base, card, pill, C } from './shared.mjs';

export async function slide01(presentation, ctx) {
  const slide = presentation.slides.add();
  base(slide, ctx, 'REVIEW VIDEO STORYBOARD', 'How Clyde uses Google OAuth data', 'A short demo deck for Gmail read-only and Calendar read-only scope review.');
  pill(slide, ctx, 'OAuth client: Clyde desktop app', 52, 242, 300, C.teal);
  pill(slide, ctx, 'Feature: Google Sync', 374, 242, 220, C.blue);
  card(slide, ctx, 52, 326, 354, 196, 'Gmail read-only', 'Clyde reads recent recruiting and work-related email threads to suggest review actions. Example actions: mark an opportunity as advanced, add a requested meeting, or review an availability request.', C.teal);
  card(slide, ctx, 462, 326, 354, 196, 'Calendar read-only', 'Clyde reads upcoming calendar events to show interview context, avoid duplicate meeting suggestions, and import confirmed events into Clyde after user approval.', C.green);
  card(slide, ctx, 872, 326, 354, 196, 'User approval', 'Clyde shows suggested actions before changing Clyde records. The app does not send email, edit Gmail, or edit Google Calendar with these scopes.', C.amber);
  return slide;
}
