/* Column definitions and the sample board. Plain script, no modules,
   so index.html works when opened straight from the filesystem. */

const COLUMNS = [
  { id: 'progress', name: 'In progress', title: 'IN PROGRESS', color: 'var(--c-blue)' },
  { id: 'review',   name: 'In review',   title: 'IN REVIEW',   color: 'var(--c-pink)' },
  { id: 'rtbc',     name: 'RTBC',        title: 'RTBC',        color: 'var(--c-teal)' },
  { id: 'blocked',  name: 'Blocked',     title: 'BLOCKED',     color: 'var(--c-amber)' },
  { id: 'credit',   name: 'No credit',   title: 'MERGED · NO CREDIT', color: 'var(--c-purple)' },
  { id: 'done',     name: 'Done',        title: 'DONE',        color: 'var(--c-gray)' },
];

/* columns that used to exist, so saved cards land somewhere sensible */
const COLUMN_ALIASES = {
  next: 'progress',
  awaiting: 'review',
};

const FLAG_COLORS = {
  warn: 'var(--c-amber)',
  ok:   'var(--c-green)',
  info: 'var(--c-blue)',
  bad:  'var(--c-red)',
};

const SAMPLE_CARDS = [
  {
    id: 'c1', column: 'progress', project: 'one_line_installer', issue: '3601382', role: 'DEV',
    title: 'Default option: pick a project name if it already exists',
    last: 'Aug 14 · commented, joined the issue fork; assigned to me',
    next: 'continue the work',
  },
  {
    id: 'c2', column: 'progress', project: 'ai', issue: '3536912', role: 'DEV',
    title: 'Suggest Tags automator should work with Tagify',
    url: 'https://www.drupal.org/project/ai/-/work_items/3536912',
    flagText: 'act fast · maintainer may finish it', flagTone: 'warn',
    last: 'Aug 12 · reviewer said "bump tagify and this is RTBC"',
    next: '/do:assign me, then 1-3h: bump tagify to ^2.0 in composer.json and verify FJ tests against tagify 2',
  },
  {
    id: 'c3', column: 'progress', project: 'ai', issue: '3585987', role: 'DEV',
    title: 'Automator FWA buttons give no user feedback',
    url: 'https://www.drupal.org/project/ai/-/work_items/3585987',
    flagText: 'heavy · multi-day adoption', flagTone: 'warn',
    last: 'Aug 9 · MR is 95 commits behind with real conflicts, no tests, author gone',
    next: 'only pick up if a big adoption is wanted - needs a fresh 1.x port',
  },
  {
    id: 'c4', column: 'blocked', project: 'canvas', issue: '3591924', role: 'DEV (PLANNED)',
    title: 'Canvas Agent that answers general questions',
    url: 'https://www.drupal.org/project/canvas/-/work_items/3591924',
    flagText: 'blocked by canvas !1488', flagTone: 'bad',
    last: 'Aug 10 · !1488 (#3591919) hardcodes the agent in the controller until it lands',
    next: 'wait for !1488, then pick up; the YAML/prompt/token-context part could start early at rebase risk',
  },
  {
    id: 'c5', column: 'review', project: 'one_line_installer', issue: '3601385', role: 'DEV',
    title: '--config-url: accept a drupal.org project URL',
    flagText: '10 days, no reviewer', flagTone: 'warn',
    last: 'Aug 7 · my MR !30, mergeable, pipeline green, needsReview; zero comments so far',
    next: 'no sprint label, so it is off the sprint board - ask a sprint lead to pull it in, or nudge in Slack',
  },
  {
    id: 'c6', column: 'rtbc', project: 'ai', issue: '3568246', role: 'REVIEW',
    title: 'Toolbar chatbot replays fold-out animation on reload',
    flagText: 'rtbc · Aug 17', flagTone: 'ok',
    last: 'Aug 17 · review posted, state::rtbc set',
    next: 'wait for a maintainer to merge MR !1428',
  },
  {
    id: 'c15', column: 'rtbc', project: 'one_line_installer', issue: '3599120', role: 'DEV',
    title: 'Print the resolved install path before writing anything',
    flagText: 'rtbc · Aug 15 · 3 days waiting', flagTone: 'ok',
    last: 'Aug 15 · second reviewer set RTBC on MR !28',
    next: 'ping the maintainer if it is still unmerged by Friday',
  },
  {
    id: 'c7', column: 'review', project: 'canvas', issue: '3591919', role: 'REVIEW',
    title: 'Run the agent selected in configuration',
    last: 'Aug 13 · reviewed MR !1488; now needsWork, author (shqshqnk) reworking',
    next: 're-review when fixes are pushed',
  },
  {
    id: 'c8', column: 'review', project: 'gemini_provider', issue: '3589188', role: 'REPORTER',
    title: 'chat() executes function calls in-provider',
    last: 'Jul 29 · bug filed, no response yet',
    next: 'consider adding a repro or an MR',
  },
  {
    id: 'c9', column: 'review', project: 'gemini_provider', issue: '3589189', role: 'REPORTER',
    title: 'Tool-result turns rejected when building the request',
    last: 'Jul 29 · bug filed, no response yet',
    next: 'consider adding a repro or an MR',
  },
  {
    id: 'c10', column: 'credit', project: 'ai', issue: '3574112', role: 'DEV',
    title: 'Provider settings form loses the API key on save',
    flagText: 'merged · no credit yet', flagTone: 'warn',
    last: 'Aug 11 · MR !1391 merged into 1.2.x, issue closed without credit',
    next: 'ask the maintainer to grant issue credit before it drops off their radar',
  },
  {
    id: 'c11', column: 'done', project: 'one_line_installer', issue: '3596004', role: 'DEV',
    title: 'Fail early with a clear error when PHP is too old',
    flagText: 'merged · Aug 5', flagTone: 'ok',
    last: 'Aug 5 · MR !22 merged, credited',
    next: 'nothing - closed as fixed',
  },
  {
    id: 'c12', column: 'done', project: 'canvas', issue: '3588431', role: 'REVIEW',
    title: 'Agent picker shows disabled agents',
    flagText: 'merged · Jul 30', flagTone: 'ok',
    last: 'Jul 30 · reviewed, RTBC, maintainer merged same day',
    next: 'nothing - closed as fixed',
  },
  {
    id: 'c13', column: 'done', project: 'gemini_provider', issue: '3583770', role: 'REPORTER',
    title: 'Streaming responses drop the last chunk',
    flagText: 'fixed by maintainer', flagTone: 'ok',
    last: 'Jul 22 · maintainer fixed it from my repro',
    next: 'nothing - closed as fixed',
  },
  {
    id: 'c14', column: 'credit', project: 'ai', issue: '3579006', role: 'DEV',
    title: 'Docs: document the automator chain settings',
    flagText: 'merged · no credit yet', flagTone: 'warn',
    last: 'Jul 18 · docs page published, no credit on the issue',
    next: 'comment on the issue asking for credit',
  },
];
