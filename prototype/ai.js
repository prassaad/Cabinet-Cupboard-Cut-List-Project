/* Cabinet Design Copilot — chat agent over the app's own functions.
   Talks to OpenAI via the local /api/chat proxy (keeps the API key server-side).
   The agent's "skills" are the tools below; each maps to a window.Cabinet.* call. */
'use strict';

const AI_MODEL = 'o3-mini';   // OpenAI reasoning model; good at multi-step tool routing for design + costing

const SYSTEM = `You are the Design Copilot built into a Cabinet & Cupboard cut-list app.
You can READ and MODIFY a single cabinet design by calling tools.

Conventions:
- All dimensions are in millimetres unless the user clearly says inches (then convert to mm yourself before calling tools).
- A cabinet has width, height, depth and material thickness. It may have a back panel, up to 2 doors, plus internal shelves (horizontal) and dividers (vertical).
- "Evenly spaced" shelves/dividers: just call add_shelves / add_dividers with the count; spacing is automatic.
- To confine shelves to a bay between two dividers, pass from_mm/to_mm (X range). To confine dividers to a vertical band, pass from_mm/to_mm (Y range).
- Before answering a cost or quantity question, call get_cut_list or estimate_bom — never guess numbers.
- When you change the design, call get_state once at the end if you need to confirm the result.

Style: concise and practical, like a workshop assistant. Confirm what you changed in one short sentence. When you present a cut list or BOM, use a compact Markdown table. Offer one helpful next step when relevant.`;

// OpenAI function-tool format: { type:'function', function:{ name, description, parameters } }
const fn = (name, description, parameters) => ({ type: 'function', function: { name, description, parameters } });
const TOOLS = [
  fn('get_state', 'Read current cabinet dimensions, doors, component counts and sheet settings.', { type: 'object', properties: {} }),
  fn('get_cut_list', 'Return the full parts cut list plus totals (parts, board area, edge tape, sheets needed, utilisation).', { type: 'object', properties: {} }),
  fn('estimate_bom', 'Return a priced bill of materials including inferred hardware (hinges, handles, shelf pins, screws). Prices are optional overrides.', { type: 'object', properties: { currency: { type: 'string' }, prices: { type: 'object', description: 'Optional unit prices: sheet, tapePerM, hinge, handle, shelfPin, screwsPerCabinet' } } }),
  fn('set_dimensions', 'Set cabinet size. Any field may be omitted to leave it unchanged.', { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' }, depth: { type: 'number' }, thickness: { type: 'number' }, back: { type: 'boolean', description: 'include back panel' } } }),
  fn('apply_preset', 'Apply a size preset.', { type: 'object', properties: { preset: { type: 'string', enum: ['base', 'wall', 'tall'] } }, required: ['preset'] }),
  fn('set_doors', 'Set number of doors (0, 1 or 2) and optional reveal gap in mm.', { type: 'object', properties: { count: { type: 'integer', minimum: 0, maximum: 2 }, reveal: { type: 'number' } }, required: ['count'] }),
  fn('add_shelves', 'Add N evenly spaced horizontal shelves. Optional from_mm/to_mm limit the X span (e.g. one bay).', { type: 'object', properties: { count: { type: 'integer', minimum: 1 }, from_mm: { type: 'number' }, to_mm: { type: 'number' } }, required: ['count'] }),
  fn('add_dividers', 'Add N evenly spaced vertical dividers. Optional from_mm/to_mm limit the Y span.', { type: 'object', properties: { count: { type: 'integer', minimum: 1 }, from_mm: { type: 'number' }, to_mm: { type: 'number' } }, required: ['count'] }),
  fn('clear_components', 'Remove all shelves and dividers.', { type: 'object', properties: {} }),
  fn('set_sheet', 'Set sheet stock size and saw kerf (mm).', { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' }, kerf: { type: 'number' } } }),
  fn('set_grain_lock', 'Lock grain direction (no part rotation when nesting).', { type: 'object', properties: { locked: { type: 'boolean' } }, required: ['locked'] }),
  fn('set_banding', 'Set which edges get banding for a part type. edges from L1,L2 (length edges) and W1,W2 (width edges).', { type: 'object', properties: { part: { type: 'string', enum: ['Side', 'TopBottom', 'Shelf', 'Divider', 'Door', 'Back'] }, edges: { type: 'array', items: { type: 'string', enum: ['L1', 'L2', 'W1', 'W2'] } } }, required: ['part', 'edges'] }),
];

function runTool(name, input) {
  const C = window.Cabinet;
  try {
    switch (name) {
      case 'get_state': return C.getState();
      case 'get_cut_list': return C.getCutList();
      case 'estimate_bom': return C.estimateBOM(input || {});
      case 'set_dimensions': return C.setDimensions(input || {}) || { ok: true, state: C.getState() };
      case 'apply_preset': return C.applyPreset(input.preset) ?? { ok: true, state: C.getState() };
      case 'set_doors': C.setDoors(input.count, input.reveal); return { ok: true };
      case 'add_shelves': return C.addShelves(input.count, input.from_mm, input.to_mm);
      case 'add_dividers': return C.addDividers(input.count, input.from_mm, input.to_mm);
      case 'clear_components': return C.clearComponents();
      case 'set_sheet': C.setSheet(input || {}); return { ok: true };
      case 'set_grain_lock': C.setGrainLock(input.locked); return { ok: true };
      case 'set_banding': return C.setBanding(input.part, input.edges);
      default: return { error: `unknown tool ${name}` };
    }
  } catch (e) { return { error: String(e && e.message || e) }; }
}

// ---------- Chat plumbing ----------
const byId = (id) => document.getElementById(id);
const fab = byId('ai-fab'), panel = byId('ai-panel'), log = byId('ai-log');
const form = byId('ai-form'), input = byId('ai-input'), sendBtn = byId('ai-send');
const messages = [{ role: 'system', content: SYSTEM }];   // OpenAI-format conversation
let busy = false;

const openPanel = () => { panel.classList.remove('hidden'); fab.classList.add('hidden'); input.focus(); if (!log.childElementCount) greet(); };
const closePanel = () => { panel.classList.add('hidden'); fab.classList.remove('hidden'); };
fab.addEventListener('click', openPanel);
byId('ai-close').addEventListener('click', closePanel);

function greet() {
  addBubble('bot', "Hi — I'm your Design Copilot. Tell me what to build or ask about cost.\n\nTry: \"Make an 1800×2100 wardrobe, 2 doors, 5 evenly spaced shelves\" or \"How many sheets and what's the BOM cost?\"");
}

function clearChat() {
  messages.length = 0;
  messages.push({ role: 'system', content: SYSTEM });
  log.innerHTML = '';
  greet();
}
byId('ai-clear').addEventListener('click', clearChat);
// The app's Reset button also wipes the conversation (it runs alongside app.js's own reset()).
byId('btn-reset').addEventListener('click', clearChat);

// minimal & safe Markdown: escape, then bold + simple tables + line breaks
function mdToHtml(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = src.split('\n');
  let html = '', i = 0;
  while (i < lines.length) {
    if (/^\s*\|.*\|\s*$/.test(lines[i]) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const rows = []; let j = i;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) { rows.push(lines[j]); j++; }
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]);
      let t = '<table><thead><tr>' + head.map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>';
      for (let r = 2; r < rows.length; r++) t += '<tr>' + cells(rows[r]).map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
      html += t + '</tbody></table>'; i = j; continue;
    }
    html += esc(lines[i]).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + (i < lines.length - 1 ? '<br>' : ''); i++;
  }
  return html;
}

function addBubble(kind, text) {
  const el = document.createElement('div');
  el.className = 'ai-msg ' + (kind === 'user' ? 'user' : kind === 'err' ? 'err' : 'bot');
  el.innerHTML = kind === 'bot' ? mdToHtml(text) : text.replace(/</g, '&lt;');
  log.appendChild(el); log.scrollTop = log.scrollHeight; return el;
}
function addToolChip(name) {
  const el = document.createElement('div'); el.className = 'ai-tool';
  el.innerHTML = `<span class="dot"></span> ${name.replace(/_/g, ' ')}`;
  log.appendChild(el); log.scrollTop = log.scrollHeight;
}

// When the AI mutates the design, briefly highlight the Sizes/Components panel fields it set.
const FLASH = {
  set_dimensions: ['in-w', 'in-h', 'in-d', 'in-t', 'in-back'],
  apply_preset: ['in-preset', 'in-w', 'in-h', 'in-d'],
  set_doors: ['in-doors', 'in-reveal'],
  set_sheet: ['in-sw', 'in-sh', 'in-kerf'],
  set_grain_lock: ['in-grain'],
  set_banding: ['band-grid'],
  add_shelves: ['card-components'], add_dividers: ['card-components'], clear_components: ['card-components'],
};
function flashEl(el) {
  const t = el.closest('label') || el;
  t.classList.remove('ai-flash'); void t.offsetWidth; t.classList.add('ai-flash');   // restart the animation
}
function flashForTool(name) {
  (FLASH[name] || []).forEach(id => { const el = byId(id); if (el) flashEl(el); });
}

async function callLLM() {
  // o3-mini is a reasoning model: use max_completion_tokens and omit temperature.
  const r = await fetch('/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: AI_MODEL, max_completion_tokens: 4000, tools: TOOLS, tool_choice: 'auto', messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error?.message || data.error || `API ${r.status}`);
  return data.choices[0].message;   // { role:'assistant', content, tool_calls? }
}

async function runConversation() {
  for (let step = 0; step < 8; step++) {
    const msg = await callLLM();
    messages.push(msg);                       // push the assistant message verbatim (carries tool_calls)
    if (msg.content && msg.content.trim()) addBubble('bot', msg.content.trim());
    const calls = msg.tool_calls || [];
    if (!calls.length) return;
    for (const tc of calls) {
      addToolChip(tc.function.name);
      let args = {}; try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* leave {} */ }
      const out = runTool(tc.function.name, args);
      if (!out || !out.error) flashForTool(tc.function.name);   // highlight the panel fields the AI just set
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out) });
    }
  }
  addBubble('bot', '(Stopped after several steps — ask me to continue if needed.)');
}

async function send(text) {
  if (busy || !text.trim()) return;
  busy = true; sendBtn.disabled = true;
  addBubble('user', text);
  messages.push({ role: 'user', content: text });
  const typing = document.createElement('div'); typing.className = 'ai-typing'; typing.textContent = 'thinking…';
  log.appendChild(typing); log.scrollTop = log.scrollHeight;
  try { await runConversation(); }
  catch (e) { addBubble('err', '⚠ ' + (e.message || e) + '\n(Is the backend running with OPENAI_API_KEY set?)'); }
  finally { typing.remove(); busy = false; sendBtn.disabled = false; input.focus(); }
}

form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value; input.value = ''; send(t); });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
