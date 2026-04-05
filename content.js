(() => {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────
  const GEMINI_MODEL = 'gemini-3-flash-preview';
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const SYSTEM_PROMPT = `You are a Stitch Prompt Engineer. Your job is to take a user's rough or casual UI design prompt and transform it into a polished, structured prompt optimised for Google Stitch (stitch.withgoogle.com).

CRITICAL RULES:
1. PRESERVE every specific detail the user mentioned — names, colours, brands, features, content, purpose. Never discard user intent.
2. Output ONLY the enhanced prompt text. No preamble, no explanation, no markdown fences, no commentary.
3. Use plain language (not XML, JSON, or code). Stitch works best with natural language.
4. Keep the total prompt under 2500 characters. Stitch omits components from prompts over ~5000 chars, so be precise and concise.
5. Do NOT include instructions like "Generate a UI" — Stitch already knows to do that.

ENHANCEMENT TECHNIQUES — apply all that are relevant:

A) STRUCTURE: Organise into clear sections using this format:
   [One-line summary of the page's purpose and visual vibe]

   DESIGN SYSTEM:
   - Platform: Web or Mobile, Desktop-first or Mobile-first
   - Theme: Light/Dark, plus 2-3 mood adjectives
   - Background: Descriptive Name (#hexcode)
   - Primary Accent: Descriptive Name (#hexcode) for [functional role]
   - Text Primary: Descriptive Name (#hexcode)
   - Additional tokens as needed (secondary colours, button radius, font style)

   PAGE STRUCTURE:
   1. [Section Name]: [Description with specific components]
   2. [Section Name]: [Description]
   ...

B) UI/UX KEYWORDS: Replace vague terms with precise component names:
   - "menu at the top" → "navigation bar with logo and menu items"
   - "button" → "primary call-to-action button"
   - "list of items" → "card grid layout" or "vertical list with thumbnails"
   - "picture area" → "hero section with full-width image"
   - "form" → "form with labelled input fields and submit button"

C) VIBE AMPLIFICATION: Expand terse adjectives into richer descriptions:
   - "modern" → "clean, minimal, with generous whitespace"
   - "professional" → "sophisticated, trustworthy, with subtle shadows and structured layout"
   - "fun" → "vibrant, playful, with rounded corners and bold colours"
   - "brutalist" → "raw, bold, high-contrast, with heavy typography and stark geometric shapes"

D) COLOUR HANDLING: If the user mentions brand colours or a colour scheme, look up or infer plausible hex values. If they mention a real organisation, use known brand colours. Format as: Descriptive Name (#hex) for functional role.

E) IMAGERY GUIDANCE: If relevant, describe the style or content of images (e.g. "Action photography of players in match situations, high energy, natural lighting").

F) PLATFORM INFERENCE: If the user doesn't specify, infer from context. Default to Web, Desktop-first unless it's clearly a mobile app.

Remember: the user will paste your output directly into Stitch. It must be clean, structured, and ready to use.`;

  // ─── State ────────────────────────────────────────────────────────
  let injected = false;
  let injectedBtn = null;           // cached reference — avoids repeated querySelector
  let retryCount = 0;
  const MAX_RETRIES = 30;
  const RETRY_INTERVAL = 400;
  let debounceTimer = null;
  let currentAbortController = null;

  // ─── Utilities ────────────────────────────────────────────────────

  function showToast(message, type = 'info') {
    let toast = document.querySelector('.spo-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'spo-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `spo-toast spo-toast--${type}`;
    requestAnimationFrame(() => {
      toast.classList.add('spo-toast--visible');
    });
    setTimeout(() => {
      toast.classList.remove('spo-toast--visible');
    }, 3500);
  }

  function getApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['geminiApiKey'], (result) => {
        resolve(result.geminiApiKey || null);
      });
    });
  }

  // ─── Editor interaction ───────────────────────────────────────────

  function findEditor() {
    return document.querySelector('.tiptap.ProseMirror[contenteditable="true"]');
  }

  function getEditorText(editor) {
    if (!editor) return '';
    const paragraphs = editor.querySelectorAll('p');
    if (paragraphs.length > 0) {
      return Array.from(paragraphs)
        .map(p => p.textContent)
        .join('\n')
        .trim();
    }
    return editor.textContent.trim();
  }

  function setEditorText(editor, text) {
    if (!editor) return;

    editor.innerHTML = '';

    text.split('\n').forEach(line => {
      const p = document.createElement('p');
      if (line.trim() === '') {
        p.innerHTML = '<br>';
      } else {
        p.textContent = line;
      }
      editor.appendChild(p);
    });

    // Single well-formed InputEvent — covers both 'input' and 'change' listeners
    editor.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
    }));
  }

  // ─── Gemini API call ──────────────────────────────────────────────

  async function optimisePrompt(userPrompt, apiKey) {
    // Cancel any in-flight request before starting a new one
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.9,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: currentAbortController.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const candidates = data?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No response generated. Check your API key and quota.');
    }

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error('Empty response from Gemini.');
    }

    let resultText = '';
    for (const part of parts) {
      if (part.text && !part.thought) {
        resultText += part.text;
      }
    }

    return resultText.trim();
  }

  // ─── Button creation ──────────────────────────────────────────────

  function createSparkleSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'spo-sparkle');
    svg.setAttribute('viewBox', '0 0 18 18');
    svg.setAttribute('fill', 'currentColor');
    svg.innerHTML = `<path d="M9 1.8c-.075 0-.138.025-.188.075-.05.05-.087.113-.112.188-.2.787-.513 1.544-.938 2.269-.412.737-.9 1.394-1.462 1.968-.575.575-1.231 1.069-1.969 1.481C3.606 8.194 2.85 8.5 2.063 8.7c-.075.025-.138.063-.188.113-.05.05-.075.112-.075.187s.025.138.075.188c.05.05.113.087.188.112.787.2 1.544.506 2.269.919.725.412 1.381.906 1.969 1.481.575.575 1.05 1.231 1.462 1.969.412.725.719 1.481.919 2.269.025.075.063.137.113.187.05.05.112.075.187.075s.138-.025.188-.075c.05-.05.087-.112.112-.187.2-.788.506-1.544.919-2.269.412-.725.906-1.381 1.481-1.969.575-.575 1.225-1.069 1.95-1.481.737-.413 1.5-.719 2.287-.919.075-.025.138-.063.188-.112.05-.05.075-.113.075-.188s-.025-.137-.075-.187c-.05-.05-.113-.088-.188-.113-.787-.2-1.55-.506-2.287-.919-.725-.412-1.375-.906-1.95-1.481-.575-.574-1.069-1.231-1.481-1.968C9.506 3.544 9.2 2.787 9 2.063c-.025-.075-.063-.138-.113-.188C8.838 1.825 8.775 1.8 8.7 1.8H9z"/>`;
    return svg;
  }

  function createButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'spo-optimise-btn spo-optimise-btn--idle';
    btn.setAttribute('data-spo', 'true');
    btn.title = 'Optimise this prompt for better Stitch results using Gemini 3 Flash';

    btn.appendChild(createSparkleSVG());
    const label = document.createElement('span');
    label.textContent = 'Optimise';
    label.className = 'spo-label';
    btn.appendChild(label);

    btn.addEventListener('click', handleOptimise);
    return btn;
  }

  function setBtnState(btn, state, labelText) {
    btn.className = `spo-optimise-btn spo-optimise-btn--${state}`;
    const label = btn.querySelector('.spo-label');

    btn.querySelector('.spo-spinner')?.remove();
    btn.querySelector('.spo-sparkle')?.remove();

    if (state === 'loading') {
      const spinner = document.createElement('div');
      spinner.className = 'spo-spinner';
      btn.insertBefore(spinner, label);
    } else {
      btn.insertBefore(createSparkleSVG(), label);
    }

    if (label) label.textContent = labelText;
  }

  // ─── Main handler ─────────────────────────────────────────────────

  async function handleOptimise(e) {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget;
    const editor = findEditor();

    if (!editor) {
      showToast('Could not find the Stitch editor.', 'error');
      return;
    }

    const userPrompt = getEditorText(editor);
    if (!userPrompt || userPrompt.length < 5) {
      showToast('Type a prompt first, then optimise it.', 'error');
      return;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      showToast('No API key set. Click the extension icon to add your Gemini key.', 'error');
      setBtnState(btn, 'nokey', 'No key');
      setTimeout(() => setBtnState(btn, 'idle', 'Optimise'), 2500);
      return;
    }

    const originalPrompt = userPrompt;
    setBtnState(btn, 'loading', 'Optimising…');

    try {
      const optimised = await optimisePrompt(userPrompt, apiKey);

      if (!optimised || optimised.length < 10) {
        throw new Error('Gemini returned an unexpectedly short response.');
      }

      setEditorText(editor, optimised);
      setBtnState(btn, 'success', 'Done ✓');
      showToast('Prompt optimised. Review it, then generate.', 'success');
      btn.dataset.originalPrompt = originalPrompt;

    } catch (err) {
      if (err.name === 'AbortError') {
        // Silently ignore — a newer request superseded this one
        return;
      }

      console.error('[Stitch Prompt Optimiser]', err);
      setBtnState(btn, 'error', 'Error');

      let msg = err.message;
      if (msg.includes('API key not valid')) {
        msg = 'Invalid API key. Click the extension icon to update it.';
      } else if (msg.includes('quota')) {
        msg = 'API quota exceeded. Check your Google AI Studio billing.';
      } else if (msg.includes('429') || msg.includes('Resource has been exhausted')) {
        msg = 'Rate limited. Wait a moment and try again.';
      }
      showToast(msg, 'error');
    }

    setTimeout(() => setBtnState(btn, 'idle', 'Optimise'), 3000);
  }

  // ─── Model selection ──────────────────────────────────────────────

  function findModelButton() {
    for (const btn of document.querySelectorAll('button[aria-haspopup="menu"]')) {
      const text = btn.textContent;
      if (text.includes('Flash') || text.includes('Pro')) return btn;
    }
    return null;
  }

  function waitForElement(selector, timeout) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) { resolve(existing); return; }

      let timer;
      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearTimeout(timer);
          obs.disconnect();
          resolve(el);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      timer = setTimeout(() => {
        obs.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  async function selectDefaultModel() {
    const modelBtn = findModelButton();
    if (!modelBtn) return;

    // Skip if already on a 3.1 model
    const currentLabel = modelBtn.querySelector('.whitespace-nowrap')?.textContent?.trim() ?? '';
    if (currentLabel.includes('3.1')) return;

    modelBtn.click();

    const firstItem = await waitForElement('[role="menuitem"]', 2000);
    if (!firstItem) {
      // Menu didn't open — nothing to do
      return;
    }

    // Brief pause for all items to render
    await new Promise(r => setTimeout(r, 50));

    const items = document.querySelectorAll('[role="menuitem"]');
    for (const item of items) {
      if (item.textContent.includes('Thinking with 3.1 Pro')) {
        item.click();
        return;
      }
    }

    // Item not found — close the menu
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }

  // ─── Injection logic ──────────────────────────────────────────────

  function findActionBar() {
    const generateBtn = document.querySelector('button[aria-label="Generate designs"]');
    if (generateBtn) {
      let parent = generateBtn.closest('.flex.gap-2.flex-wrap.items-center.justify-between');
      if (parent) return parent;

      parent = generateBtn.parentElement;
      while (parent) {
        if (parent.classList.contains('flex') &&
            (parent.classList.contains('justify-between') || parent.classList.contains('items-center'))) {
          if (parent.querySelectorAll('button').length >= 3) return parent;
        }
        parent = parent.parentElement;
      }
    }

    const radioGroup = document.querySelector('[role="radiogroup"]');
    if (radioGroup) {
      const parent = radioGroup.closest('.flex.gap-2.flex-wrap.items-center.justify-between');
      if (parent) return parent;
    }

    for (const btn of document.querySelectorAll('button[aria-haspopup="menu"]')) {
      if (btn.textContent.includes('Pro') || btn.textContent.includes('Flash')) {
        const parent = btn.closest('.flex.gap-2.flex-wrap.items-center.justify-between');
        if (parent) return parent;
      }
    }

    return null;
  }

  function tryInject() {
    if (injected) return;

    const actionBar = findActionBar();
    if (!actionBar) {
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        setTimeout(tryInject, RETRY_INTERVAL);
      }
      return;
    }

    if (actionBar.querySelector('[data-spo]')) {
      injected = true;
      return;
    }

    const btn = createButton();
    const leftGroup = actionBar.querySelector('.flex.items-center.gap-2.flex-wrap');
    if (leftGroup) {
      leftGroup.appendChild(btn);
    } else {
      actionBar.prepend(btn);
    }

    injectedBtn = btn;
    injected = true;
    console.log('[Stitch Prompt Optimiser] Button injected.');

    // Auto-select preferred model — delayed so the UI is fully settled
    setTimeout(selectDefaultModel, 300);
  }

  // ─── Observer ─────────────────────────────────────────────────────
  // Debounced so it fires at most once per 150 ms regardless of how many
  // DOM mutations the SPA produces in a single frame.

  function checkInjection() {
    if (!injected) {
      tryInject();
      return;
    }
    // Use cached ref instead of a full DOM scan
    if (injectedBtn && !document.contains(injectedBtn)) {
      injected = false;
      injectedBtn = null;
      retryCount = 0;
      tryInject();
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkInjection, 150);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'complete') {
    tryInject();
  } else {
    window.addEventListener('load', tryInject);
  }
  tryInject();

})();
