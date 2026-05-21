const fs = require('fs');
let jsx = fs.readFileSync('src/renderer/App.jsx', 'utf8');

// 1. In ActiveCaptureView, add liveLevels as prop and render meters
const activeCaptureSig = /function ActiveCaptureView\(\{([^\}]*)\}\) \{/;
jsx = jsx.replace(activeCaptureSig, "function ActiveCaptureView({, liveLevels}) {");

// We want to insert the meters just above the AssistantCards in the sidebar
const activeCardsRegex = /<AssistantCards cards=\{cards\} variant="active" \/>/;
const metersHtml = "<div className=\"meters\" data-testid=\"liveVoiceMeters\" style={{ gridTemplateColumns: '1fr', margin: '0' }}>\n" +
"            {liveLevels?.length ? liveLevels.map((source) => (\n" +
"              <div className={meter \} key={source.id || source.label} style={{ padding: '8px' }}>\n" +
"                <div style={{ marginBottom: '4px' }}>\n" +
"                  <strong style={{ fontSize: '0.8rem' }}>{source.label || 'Audio'}</strong>\n" +
"                  <span style={{ fontSize: '0.7rem' }}>{Math.round(source.rms || 0)} RMS</span>\n" +
"                </div>\n" +
"                <div className=\"meter-track\" style={{ height: '4px' }}>\n" +
"                  <span style={{ width: \% }} />\n" +
"                </div>\n" +
"              </div>\n" +
"            )) : (\n" +
"              <div className=\"meter empty\" style={{ padding: '8px' }}>\n" +
"                <div style={{ marginBottom: '4px' }}>\n" +
"                  <strong style={{ fontSize: '0.8rem' }}>Audio levels</strong>\n" +
"                  <span style={{ fontSize: '0.7rem' }}>Start capture to monitor sources</span>\n" +
"                </div>\n" +
"                <div className=\"meter-track\" style={{ height: '4px' }}><span /></div>\n" +
"              </div>\n" +
"            )}\n" +
"          </div>\n" +
"          <AssistantCards cards={cards} variant=\"active\" />";

jsx = jsx.replace(activeCardsRegex, metersHtml);

// Pass liveLevels to ActiveCaptureView when rendering
jsx = jsx.replace(/<ActiveCaptureView([\s\S]*?)onToggleCaptureProtection=\{toggleCaptureProtection\}/, '<ActiveCaptureView={liveLevels}\n            onToggleCaptureProtection={toggleCaptureProtection}');

// 2. Remove LivePanel usage from App.jsx and replace live-grid with full-width context panel
const liveGridRegex = /<section className="live-grid">[\s\S]*?<\/section>/;
const newLiveGrid = "<section className=\"context-full-width\">\n" +
"              <ContextPanel\n" +
"                mode={mode}\n" +
"                settings={settings}\n" +
"                entities={entities}\n" +
"                calendarEvents={calendarEvents}\n" +
"              />\n" +
"            </section>";

jsx = jsx.replace(liveGridRegex, newLiveGrid);

fs.writeFileSync('src/renderer/App.jsx', jsx);

// Update CSS
let css = fs.readFileSync('src/renderer/App.css', 'utf8');
css += "\n.context-full-width .context-panel { padding: 0; }\n";
css += "\n.context-full-width .suggestion-box { background: rgba(1, 8, 14, 0.4); }\n";
fs.writeFileSync('src/renderer/App.css', css);
