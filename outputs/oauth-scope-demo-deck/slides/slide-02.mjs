import { base, card, C } from './shared.mjs';

export async function slide02(presentation, ctx) {
  const slide = presentation.slides.add();
  base(slide, ctx, 'OAUTH CLIENT', 'The Google data is used by Clyde desktop Google Sync', 'Client ID from the Clyde desktop app configuration: 186934404244-p69m7rbeie0nen66gvomufiodoeviv54.apps.googleusercontent.com');
  card(slide, ctx, 74, 250, 520, 250, 'Clyde desktop app', 'A signed-in user connects Google Sync from Clyde settings. Clyde reads Gmail and Calendar data, creates pending review actions, and lets the user approve or dismiss each suggestion.', C.teal);
  card(slide, ctx, 686, 250, 520, 250, 'Requested scopes', 'https://www.googleapis.com/auth/gmail.readonly\n\nhttps://www.googleapis.com/auth/calendar.readonly\n\nBoth scopes are read-only and support the Google Sync feature shown in this demo.', C.green);
  ctx.addText(slide, { text: 'The website and billing API do not use Gmail or Calendar data.', x: 344, y: 560, w: 592, h: 36, fontSize: 22, bold: true, align: 'center', color: C.ink, typeface: ctx.fonts.title });
  return slide;
}
