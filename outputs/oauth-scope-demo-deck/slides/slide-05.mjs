import { base, card, C } from './shared.mjs';

export async function slide05(presentation, ctx) {
  const slide = presentation.slides.add();
  base(slide, ctx, 'DATA FLOW', 'Google data becomes pending Clyde actions', 'The reviewer can follow the data from OAuth consent to user approval.');
  const items = [
    ['OAuth consent', 'User connects Google Sync and grants read-only Gmail and Calendar access.', C.teal],
    ['Read-only scan', 'Clyde reads message metadata, message snippets, selected thread content, and upcoming event fields.', C.blue],
    ['Local analysis', 'Clyde creates pending suggested actions inside the app. Duplicate company-level suggestions are collapsed.', C.amber],
    ['User decision', 'The user approves or dismisses each action. Clyde records only the approved Clyde-side result.', C.green],
  ];
  items.forEach(([title, body, color], index) => {
    const x = 62 + index * 300;
    card(slide, ctx, x, 268, 250, 236, title, body, color);
    if (index < 3) {
      ctx.addShape(slide, { x: x + 262, y: 384, w: 56, h: 2, fill: C.line });
      ctx.addShape(slide, { x: x + 312, y: 378, w: 12, h: 12, fill: C.line });
    }
  });
  ctx.addText(slide, { text: 'No Gmail sending. No Gmail deletion. No Google Calendar writes.', x: 286, y: 558, w: 708, h: 38, fontSize: 24, bold: true, align: 'center', color: C.ink, typeface: ctx.fonts.title });
  return slide;
}
