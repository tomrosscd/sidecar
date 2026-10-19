// prompts.js
// DOM-free helpers. Prompt data is loaded at runtime from prompts.json.

function getCmpText(timeframe, comparison) {
  if (!comparison || comparison === 'none') return null;
  if (comparison === 'yoy') return 'the same period last year';
  if (comparison !== 'prev') return comparison; // custom text passed directly
  const m = {
    'last 7 days':'the previous 7 days','last 14 days':'the previous 14 days',
    'last 30 days':'the previous 30 days','last 60 days':'the previous 60 days',
    'last 90 days':'the previous 90 days','last quarter':'the previous quarter',
    'last 6 months':'the previous 6 months','last 12 months':'the previous 12 months'
  };
  return m[timeframe] || 'the previous comparable period';
}

// Sidekick often shows a query's result as a report card that holds only the first 5 rows ("+N more"), and the
// export cannot read the rest. Asking for the table in the reply puts every row in the message text.
const FULL_TABLES_NOTE =
  'If the answer includes tables, write each one as a complete markdown table in your reply: every row, with no ' +
  'truncation, no "top N" cut-off and no summary of rows. Do not leave data only in a report card or a download.';

function buildPrompt(promptObj, timeframe, comparison, { fullTables = false } = {}) {
  const tf = 'the ' + timeframe;
  const cmp = getCmpText(timeframe, comparison);
  let t = (promptObj.body || '').replace(/\{\{TF\}\}/g, tf);
  if (cmp) {
    t = t.replace(/\{\{CMP\}\}/g, cmp);
  } else {
    t = t
      .replace(/, compared to \{\{CMP\}\}/gi, '')
      .replace(/ and compare it to \{\{CMP\}\}/gi, '')
      .replace(/ compared to \{\{CMP\}\}/gi, '')
      .replace(/\{\{CMP\}\}/g, 'the previous comparable period');
  }
  return fullTables ? `${t.trim()}\n\n${FULL_TABLES_NOTE}` : t;
}
