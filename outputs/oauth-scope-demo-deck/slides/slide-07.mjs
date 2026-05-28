import { base, card, C } from './shared.mjs';

export async function slide07(presentation, ctx) {
  const slide = presentation.slides.add();
  base(slide, ctx, 'SCOPE LIMITS', 'Clyde requests the minimum Google access needed', 'The requested scopes match the demonstrated product behavior.');
  card(slide, ctx, 82, 234, 520, 268, 'Allowed by requested scopes', 'Read Gmail messages relevant to Clyde suggestions.\n\nRead upcoming Google Calendar events for interview and meeting context.\n\nUse the data to create Clyde-side suggested actions and context.', C.green);
  card(slide, ctx, 678, 234, 520, 268, 'Outside requested scopes', 'Clyde does not send, modify, delete, or label Gmail messages.\n\nClyde does not create, edit, or delete Google Calendar events.\n\nClyde does not sell Google user data or use it for advertising.', C.red);
  ctx.addText(slide, { text: 'Reviewer takeaway: Gmail and Calendar data are used only to help the user review scheduling and opportunity actions inside Clyde.', x: 178, y: 560, w: 924, h: 56, fontSize: 24, bold: true, align: 'center', color: C.ink, typeface: ctx.fonts.title });
  return slide;
}
