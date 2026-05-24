// Tool definitions + executors for the browser agent.
// Definitions follow Anthropic Messages API tool schema.
//
// Most tools accept an optional `tab_id` to operate on a specific tab without
// switching the active tab — useful for cross-tab workflows.

export const ALL_TOOLS = [
  // ===== Reading =====
  {
    name: 'get_page',
    description: 'Read a tab: URL, title, visible text, and clickable elements with #ref-N selectors. Use FIRST to understand a page. Set full=true to also include hidden/structural elements. focus="main" trims sidebar/recommendation noise on YouTube/Twitter/GitHub.',
    input_schema: {
      type: 'object',
      properties: {
        max_chars: { type: 'integer', description: 'Max chars of text (default 4000).' },
        tab_id: { type: 'integer', description: 'Optional tab id. Default = active tab.' },
        full: { type: 'boolean', description: 'Include all elements, not just visible (default false).' },
        focus: { type: 'string', enum: ['auto', 'main', 'main-content', 'focused', 'full-page'],
                 description: 'auto (default) — main-content for SPAs, full-page elsewhere. main / main-content / focused — primary content only (drops sidebar). full-page — entire body.' },
      },
    },
  },
  {
    name: 'read_tab',
    description: 'Like get_page but for a SPECIFIC tab without switching to it. Use to compare multiple tabs.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        max_chars: { type: 'integer' },
      },
      required: ['tab_id'],
    },
  },
  {
    name: 'find_element',
    description: 'Search for elements matching a query (text, aria-label, placeholder). Returns matching #ref-N selectors. Useful when get_page truncates the list.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Substring to match (case-insensitive).' },
        tab_id: { type: 'integer' },
        limit: { type: 'integer', description: 'Max results (default 20).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'extract_links',
    description: 'Extract all links from a tab as a structured list (text, href). Use for crawling/list extraction.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        contains: { type: 'string', description: 'Filter: substring in URL or text.' },
        limit: { type: 'integer', description: 'Default 50.' },
      },
    },
  },
  {
    name: 'get_console',
    description: 'Read recent JS console messages from a tab. Useful for debugging.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        limit: { type: 'integer', description: 'Default 30.' },
      },
    },
  },

  // ===== Interaction =====
  {
    name: 'click',
    description: 'Click an element. Provide CSS selector or #ref-N from get_page. Default timeout is fast (600ms) — pass timeout_ms higher for slow-loading targets. Set wait_navigation=true to auto-wait for SPA / full nav settle after click (saves a roundtrip vs separate wait_for_navigation call).',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        tab_id: { type: 'integer' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Default left.' },
        timeout_ms: { type: 'integer', description: 'Max wait for element to appear (default 600).' },
        wait_navigation: { type: 'boolean', description: 'Wait for tab to complete + SPA settle if URL changes after click (default false).' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'hover',
    description: 'Hover over an element (triggers menus, tooltips). Useful for UI that reveals on hover.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'type',
    description: 'Type text into an input/textarea/contenteditable. Optionally press Enter after.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text: { type: 'string' },
        press_enter: { type: 'boolean' },
        clear: { type: 'boolean', description: 'Clear existing value first (default true).' },
        tab_id: { type: 'integer' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'key_press',
    description: 'Send a keyboard shortcut to an element or the page. Examples: "Enter", "Escape", "Tab", "Control+a", "Control+c", "Meta+v", "ArrowDown".',
    input_schema: {
      type: 'object',
      properties: {
        keys: { type: 'string', description: 'Key combo. Use + to combine modifiers.' },
        selector: { type: 'string', description: 'Optional element to focus first.' },
        tab_id: { type: 'integer' },
      },
      required: ['keys'],
    },
  },
  {
    name: 'select_option',
    description: 'Select an option in a <select> dropdown by value or visible text.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        value: { type: 'string', description: 'Match by option value or innerText.' },
        tab_id: { type: 'integer' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'fill_form',
    description: 'Fill multiple form fields at once. Faster than calling type() N times. Each field: {selector, value, type?:"text"|"check"|"radio"|"select"}',
    input_schema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
              value: { type: 'string' },
              type: { type: 'string', enum: ['text', 'check', 'radio', 'select'] },
            },
            required: ['selector', 'value'],
          },
        },
        tab_id: { type: 'integer' },
        submit: { type: 'boolean', description: 'Submit the form after filling (default false).' },
      },
      required: ['fields'],
    },
  },
  {
    name: 'scroll',
    description: 'Scroll the page or a specific element.',
    input_schema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom', 'into_view'] },
        amount: { type: 'integer', description: 'Pixels for up/down (default 600).' },
        selector: { type: 'string', description: 'Required for "into_view". Optional otherwise — scrolls inside element.' },
        tab_id: { type: 'integer' },
      },
      required: ['direction'],
    },
  },

  // ===== Page-level =====
  {
    name: 'wait_for',
    description: 'Wait until a CSS selector appears (or element\'s text matches) — up to 10s. Use after click that triggers async load instead of fixed wait().',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text_contains: { type: 'string', description: 'Optional: also require this text inside the element.' },
        timeout_ms: { type: 'integer', description: 'Max 10000.' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'wait',
    description: 'Sleep N milliseconds (max 5000). Prefer wait_for when checking for content.',
    input_schema: {
      type: 'object',
      properties: { ms: { type: 'integer' } },
    },
  },
  {
    name: 'navigate',
    description: 'Navigate a tab to a URL. Waits for page load.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['url'],
    },
  },
  {
    name: 'back',
    description: 'Go back in tab history.',
    input_schema: { type: 'object', properties: { tab_id: { type: 'integer' } } },
  },
  {
    name: 'forward',
    description: 'Go forward in tab history.',
    input_schema: { type: 'object', properties: { tab_id: { type: 'integer' } } },
  },
  {
    name: 'reload',
    description: 'Reload a tab. Optional bypass_cache: true for a hard refresh.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        bypass_cache: { type: 'boolean' },
      },
    },
  },
  {
    name: 'screenshot',
    description: 'PNG screenshot of the visible viewport. Use when DOM is insufficient (visual layout, images, canvas).',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
    },
  },
  {
    name: 'execute_js',
    description: 'Run arbitrary JavaScript in the page context and return the result. Use for complex queries DOM tools cannot express. The code is wrapped in an async function — use return to get the value back.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JS body. Use return to send a value back. Must be JSON-serializable.' },
        tab_id: { type: 'integer' },
      },
      required: ['code'],
    },
  },

  // ===== Tab management =====
  {
    name: 'list_tabs',
    description: 'List all open tabs in the current window with id, url, title, active flag, audible flag.',
    input_schema: {
      type: 'object',
      properties: {
        all_windows: { type: 'boolean', description: 'Include tabs from all windows (default false).' },
      },
    },
  },
  {
    name: 'switch_tab',
    description: 'Activate a tab by id (focus its window too).',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
      required: ['tab_id'],
    },
  },
  {
    name: 'new_tab',
    description: 'Open a new tab. The new tab becomes active. Returns its id.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        background: { type: 'boolean', description: 'Open in background (do not activate, default false).' },
      },
    },
  },
  {
    name: 'close_tab',
    description: 'Close a tab. Without tab_id closes the active tab.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
    },
  },
  {
    name: 'duplicate_tab',
    description: 'Duplicate a tab.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
    },
  },

  // ===== Combo tools (save turns) =====
  {
    name: 'click_and_read',
    description: 'COMBO: Click an element, wait for the page to settle, then read the new state. Faster than calling click + wait + get_page separately. Auto-detects SPA navigation (YouTube/Twitter/etc) and waits for primary content to mount. Use this when you click something and need to see what changed.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        wait_ms: { type: 'integer', description: 'Settle time before reading (default 800).' },
        max_chars: { type: 'integer' },
        tab_id: { type: 'integer' },
        focus: { type: 'string', enum: ['auto', 'main', 'main-content', 'focused', 'full-page'],
                 description: 'Forwarded to get_page. Default auto.' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'navigate_and_read',
    description: 'COMBO: Navigate to a URL and immediately return its content. Faster than navigate + get_page. Auto SPA settle for known sites.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        max_chars: { type: 'integer' },
        tab_id: { type: 'integer' },
        focus: { type: 'string', enum: ['auto', 'main', 'main-content', 'focused', 'full-page'],
                 description: 'Forwarded to get_page. Default auto.' },
      },
      required: ['url'],
    },
  },

  // ===== Network log capture =====
  {
    name: 'network_log',
    description: 'Capture recent network requests (fetch / XHR) made by the page. Returns method, URL, status, response size, duration. Use to inspect API calls a webapp makes — useful for scraping hidden APIs or debugging.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        limit: { type: 'integer', description: 'Max entries (default 30, max 100).' },
        filter: { type: 'string', description: 'Optional substring filter on URL.' },
        clear: { type: 'boolean', description: 'If true, clear the buffer after returning. Default false.' },
      },
    },
  },
  {
    name: 'network_response',
    description: 'Get the full response body of a recent network request, identified by index from network_log. Useful when network_log shows interesting URL and you want the data.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        index: { type: 'integer', description: 'Index from network_log (0-based).' },
        max_chars: { type: 'integer', description: 'Truncate body (default 8000).' },
      },
      required: ['index'],
    },
  },

  // ===== Screenshot diff =====
  {
    name: 'screenshot_compare',
    description: 'Take a screenshot now and compare with one taken earlier (by snapshot_id from screenshot_snapshot). Returns diff percentage, region of changes, and a side-by-side annotated image. Useful for visual regression / verifying UI changes.',
    input_schema: {
      type: 'object',
      properties: {
        snapshot_id: { type: 'string', description: 'ID returned by screenshot_snapshot.' },
        tab_id: { type: 'integer' },
        threshold: { type: 'number', description: 'Pixel similarity threshold 0-1, default 0.05.' },
      },
      required: ['snapshot_id'],
    },
  },
  {
    name: 'screenshot_snapshot',
    description: 'Take a baseline screenshot and store it in memory under a snapshot_id (returned). Use later with screenshot_compare to detect changes.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        label: { type: 'string', description: 'Optional human-readable label.' },
      },
    },
  },

  // ===== Multi-window control =====
  {
    name: 'list_windows',
    description: 'List all Chrome windows with their id, focused state, type, and number of tabs.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'new_window',
    description: 'Open a new Chrome window. Optionally with a starting URL and as popup/normal type.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        type: { type: 'string', enum: ['normal', 'popup'], description: 'Default normal.' },
        focused: { type: 'boolean', description: 'Default true.' },
      },
    },
  },
  {
    name: 'focus_window',
    description: 'Bring a window to the front by id.',
    input_schema: {
      type: 'object',
      properties: { window_id: { type: 'integer' } },
      required: ['window_id'],
    },
  },
  {
    name: 'close_window',
    description: 'Close a window and all its tabs.',
    input_schema: {
      type: 'object',
      properties: { window_id: { type: 'integer' } },
      required: ['window_id'],
    },
  },
  {
    name: 'move_tab',
    description: 'Move a tab to a different window or position. Useful for organizing tabs across windows.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        window_id: { type: 'integer', description: 'Target window. Omit to keep in current window.' },
        index: { type: 'integer', description: 'Position in target window. -1 = end. Default -1.' },
      },
      required: ['tab_id'],
    },
  },

  // ===== Batch & helpers (perf) =====
  {
    name: 'batch',
    description: 'Run a sequence of tool calls in one round-trip. Each step is {tool, input}. Stops on first error unless continue_on_error=true. Massively reduces latency for repeated patterns (e.g. fill 19 fields).',
    input_schema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string' },
              input: { type: 'object' },
            },
            required: ['tool'],
          },
        },
        continue_on_error: { type: 'boolean' },
      },
      required: ['steps'],
    },
  },
  {
    name: 'page_summary',
    description: 'Compact version of get_page: only landmarks (headings, main inputs, primary buttons, navigation), much smaller than full text. Use to quickly orient on a page.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        max_chars: { type: 'integer', description: 'Default 1500.' },
      },
    },
  },
  {
    name: 'scroll_until',
    description: 'Scroll the page until an element matching selector OR a piece of text is visible. Auto-stops at end of page. Use for infinite-scroll lists or finding off-screen items.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for.' },
        text: { type: 'string', description: 'Text to find on page (alternative to selector).' },
        max_scrolls: { type: 'integer', description: 'Cap iterations (default 20).' },
        tab_id: { type: 'integer' },
      },
    },
  },
  {
    name: 'dom_snapshot',
    description: 'Return a compact JSON tree of the visible DOM (tag + key attributes only, no styling/text). Better than get_page text when you need structural reasoning. Limited to N nodes.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        max_nodes: { type: 'integer', description: 'Default 200.' },
        root_selector: { type: 'string', description: 'Optional: snapshot a subtree.' },
      },
    },
  },

  // ===== Direct DOM property access =====
  {
    name: 'get_value',
    description: 'Get the value of an input/textarea/select. Direct access without parsing get_page text.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'get_attribute',
    description: 'Get a specific attribute of an element (href, data-*, aria-*, etc).',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        attribute: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['selector', 'attribute'],
    },
  },
  {
    name: 'get_text',
    description: 'Get the inner text of an element. Useful for reading values, status, etc without get_page.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },

  // ===== Storage tools =====
  {
    name: 'read_storage',
    description: 'Read localStorage and/or sessionStorage of a tab. Returns key/value pairs. Useful for debugging webapps.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        kind: { type: 'string', enum: ['local', 'session', 'both'], description: 'Default both.' },
      },
    },
  },
  {
    name: 'write_storage',
    description: 'Write a key to localStorage or sessionStorage.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['local', 'session'] },
        key: { type: 'string' },
        value: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['kind', 'key', 'value'],
    },
  },
  {
    name: 'read_cookies',
    description: 'Read cookies for the current tab\'s domain (or a given URL). Returns name/value/domain/path/secure flags.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL whose cookies to fetch (default = current tab URL).' },
        tab_id: { type: 'integer' },
      },
    },
  },

  // ===== Clipboard =====
  {
    name: 'clipboard_read',
    description: 'Read text from the system clipboard.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'clipboard_write',
    description: 'Write text to the system clipboard.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },

  // ===== Element-level screenshot =====
  {
    name: 'element_screenshot',
    description: 'Capture a screenshot cropped to a specific element. Useful for verifying UI components without the full viewport.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },

  // ===== Scratchpad (cross-call memory within a session) =====
  {
    name: 'scratchpad_set',
    description: 'Save a string under a key in the per-session scratchpad. Use to remember values across tool calls (e.g. extracted IDs, intermediate state).',
    input_schema: {
      type: 'object',
      properties: { key: { type: 'string' }, value: { type: 'string' } },
      required: ['key', 'value'],
    },
  },
  {
    name: 'scratchpad_get',
    description: 'Read a value from the scratchpad.',
    input_schema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
    },
  },
  {
    name: 'scratchpad_list',
    description: 'List all scratchpad keys with previews.',
    input_schema: { type: 'object', properties: {} },
  },

  // ===== Persistent notes (cross-session) =====
  {
    name: 'note_save',
    description: 'Save a note (text) to persistent storage that survives sessions. Different from scratchpad which is in-memory only.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'note_get',
    description: 'Read a persistent note by key.',
    input_schema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
    },
  },
  {
    name: 'note_list',
    description: 'List all persistent notes (key + size + age).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'note_delete',
    description: 'Delete a persistent note.',
    input_schema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
    },
  },

  // ===== Page diff =====
  {
    name: 'get_page_diff',
    description: 'Take a get_page snapshot and compare with the previous snapshot of the same tab. Returns what text/elements were added/removed/changed. Useful for tracking page evolution after actions.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        max_chars: { type: 'integer' },
      },
    },
  },

  // ===== Iframes =====
  {
    name: 'list_frames',
    description: 'List all iframes in a tab with id, url, name. Use frame_id to scope subsequent tool calls (get_page, click, etc) to a specific iframe.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
    },
  },

  // ===== XPath / text helper =====
  {
    name: 'find_by_text',
    description: 'Scan visible elements for one matching the given text. Returns CSS selector, XPath, and #ref-N for stable interaction. Better than guessing #ref from get_page.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to find (case-insensitive substring).' },
        tag: { type: 'string', description: 'Optional tag filter: button, a, input, etc.' },
        tab_id: { type: 'integer' },
      },
      required: ['text'],
    },
  },

  // ===== Drag and drop =====
  {
    name: 'drag_drop',
    description: 'Drag an element to another. Fires HTML5 drag events (dragstart, dragenter, dragover, drop, dragend). Use for reordering lists, file upload zones (programmatic), kanban boards.',
    input_schema: {
      type: 'object',
      properties: {
        from_selector: { type: 'string' },
        to_selector: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['from_selector', 'to_selector'],
    },
  },

  // ===== Mouse-coordinate operations =====
  {
    name: 'mouse_drag',
    description: 'Drag from one point to another using mouse events (mousedown→mousemove→mouseup). Lower-level than drag_drop. Use for canvas, drawing apps, sliders.',
    input_schema: {
      type: 'object',
      properties: {
        from_x: { type: 'integer' },
        from_y: { type: 'integer' },
        to_x: { type: 'integer' },
        to_y: { type: 'integer' },
        steps: { type: 'integer', description: 'Intermediate mousemove count (default 10).' },
        tab_id: { type: 'integer' },
      },
      required: ['from_x', 'from_y', 'to_x', 'to_y'],
    },
  },
  {
    name: 'double_click',
    description: 'Fire dblclick on an element. Faster than batch.',
    input_schema: {
      type: 'object',
      properties: { selector: { type: 'string' }, tab_id: { type: 'integer' } },
      required: ['selector'],
    },
  },
  {
    name: 'triple_click',
    description: 'Click 3x rapidly to select line/paragraph.',
    input_schema: {
      type: 'object',
      properties: { selector: { type: 'string' }, tab_id: { type: 'integer' } },
      required: ['selector'],
    },
  },

  // ===== Page text (article-mode) =====
  {
    name: 'get_page_text',
    description: 'Pure article-style text extraction without element list. Smaller output than get_page. Best for reading long content.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        max_chars: { type: 'integer', description: 'Default 8000.' },
      },
    },
  },

  // ===== scroll_to =====
  {
    name: 'scroll_to',
    description: 'Scroll to a specific X,Y coordinate, or to top/bottom. Use for precise positioning when scroll/scroll_until are not enough.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'integer' },
        y: { type: 'integer' },
        position: { type: 'string', enum: ['top', 'bottom'], description: 'Quick shortcut.' },
        tab_id: { type: 'integer' },
      },
    },
  },

  // ===== Zoom =====
  {
    name: 'set_zoom',
    description: 'Set zoom level for a tab. 1.0 = 100%. Range 0.25 to 5.0.',
    input_schema: {
      type: 'object',
      properties: {
        zoom: { type: 'number' },
        tab_id: { type: 'integer' },
      },
      required: ['zoom'],
    },
  },
  {
    name: 'get_zoom',
    description: 'Get current zoom level of a tab.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
    },
  },

  // ===== Window resize =====
  {
    name: 'resize_window',
    description: 'Change browser window dimensions. Useful for testing responsive layouts. Provide width+height OR state (maximized/minimized/normal/fullscreen).',
    input_schema: {
      type: 'object',
      properties: {
        window_id: { type: 'integer', description: 'Default = current window.' },
        width: { type: 'integer' },
        height: { type: 'integer' },
        state: { type: 'string', enum: ['normal', 'minimized', 'maximized', 'fullscreen'] },
      },
    },
  },

  // ===== File upload =====
  {
    name: 'upload_image',
    description: 'Upload a file (image / PDF / any binary) to an input[type=file] or drop target. Source: chat attachment (preferred), URL, or base64. Programmatically attaches via DataTransfer.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for input[type=file] or drop target.' },
        attachment_index: { type: 'integer', description: 'Index from list_chat_attachments. Takes precedence over base64 / url. Use this when user attached a file in chat.' },
        url: { type: 'string', description: 'File URL. Required if no attachment_index and no base64.' },
        base64: { type: 'string', description: 'Base64-encoded data (without data: prefix). Used only if attachment_index not given.' },
        filename: { type: 'string', description: 'Override filename. Defaults to attachment name or "image.png".' },
        mime: { type: 'string', description: 'Override MIME. Defaults to attachment mime or "image/png".' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },

  // ===== Chat attachment access (user-supplied files) =====
  {
    name: 'list_chat_attachments',
    description: 'List files/images the user attached in the most recent message of this conversation. Returns [{index, filename, mime, size, kind}]. Use before get_chat_attachment / upload_image(attachment_index=...).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_chat_attachment',
    description: 'Return the user-attached file as base64 (no data: prefix). Use list_chat_attachments first to discover available files. For images/PDFs the model already sees the content via vision/document blocks; this tool exposes the raw bytes for upload pipelines.',
    input_schema: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: 'Attachment index from list_chat_attachments. Default 0.' },
      },
    },
  },

  // ===== Plan with approval =====
  {
    name: 'update_plan',
    description: 'Show a structured plan to the user and ask for approval before continuing. Steps array each has {title, status?, note?}. Returns user\'s decision (approved/rejected/edited).',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Plan title.' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'skipped'] },
              note: { type: 'string' },
            },
            required: ['title'],
          },
        },
      },
      required: ['steps'],
    },
  },

  // ===== GIF capture =====
  {
    name: 'gif_capture',
    description: 'Capture N screenshot frames at an interval and download as a GIF-style sequence (saved as a folder of PNGs since GIF encoder is heavy). Use for recording browser activity.',
    input_schema: {
      type: 'object',
      properties: {
        frames: { type: 'integer', description: 'Number of frames (max 30, default 10).' },
        interval_ms: { type: 'integer', description: 'Time between frames (default 500).' },
        tab_id: { type: 'integer' },
      },
    },
  },

  // ===== Web search & external content =====
  {
    name: 'web_search',
    description: 'Search the web and return top results (title, url, snippet). Use this BEFORE navigating — saves turns. Faster than opening Google in a tab.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', description: 'Max results (default 8, max 15).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'youtube_transcript',
    description: 'Fetch the auto-generated transcript of a YouTube video. Provide a YouTube URL or video id. Useful for summarizing videos without watching them.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'YouTube URL or video id.' },
        lang: { type: 'string', description: 'ISO language code (default "en").' },
      },
      required: ['url'],
    },
  },
  {
    name: 'read_pdf',
    description: 'Fetch a PDF from a URL and extract its text content. Best-effort, works for most non-scanned PDFs.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        max_chars: { type: 'integer', description: 'Default 20000.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'fetch_url',
    description: 'Fetch any URL and return its text content (HTML stripped to readable text). Use for raw content access without opening a tab. JSON URLs are returned formatted. Pass use_cookies=true to send cookies from the current browser — enables scraping behind-login pages.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        max_chars: { type: 'integer', description: 'Default 12000.' },
        use_cookies: { type: 'boolean', description: 'Send cookies from the browser (for behind-login URLs).' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], description: 'HTTP method (default GET).' },
        headers: { type: 'object', description: 'Custom headers as {key: value}.' },
        body: { type: 'string', description: 'Request body for POST/PUT/PATCH.' },
        tab_id: { type: 'integer', description: 'Tab to inherit cookie context from (default: any tab matching domain).' },
      },
      required: ['url'],
    },
  },

  // ===== File system actions =====
  {
    name: 'download_file',
    description: 'Download a file from a URL to the user\'s Downloads folder. By default WAITS up to timeout_ms for completion and returns final state. Set wait=false to fire-and-forget.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        filename: { type: 'string', description: 'Optional filename suggestion.' },
        wait: { type: 'boolean', description: 'Wait until download terminal state (default true).' },
        timeout_ms: { type: 'integer', description: 'Max wait time in ms (default 8000).' },
      },
      required: ['url'],
    },
  },
  {
    name: 'download_status',
    description: 'Check status of a download by id. Returns {state: in_progress|complete|interrupted, filename, bytes_received, total_bytes, error}.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Download id returned from download_file.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'save_text',
    description: 'Save arbitrary text content to a file in the user\'s Downloads folder.',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['filename', 'content'],
    },
  },

  // ===== Smart wait =====
  {
    name: 'wait_for_idle',
    description: 'Wait until network activity stops (no requests for 500ms). Use after click/navigate that triggers async content load. Better than fixed wait().',
    input_schema: {
      type: 'object',
      properties: {
        timeout_ms: { type: 'integer', description: 'Max wait, default 8000.' },
        tab_id: { type: 'integer' },
      },
    },
  },

  // ===== Memory =====
  {
    name: 'remember',
    description: 'Store a persistent fact about the user that you should recall in future conversations (preferences, projects, names, context). Use sparingly for important things only.',
    input_schema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'A concise statement, e.g. "User prefers Indonesian" or "User\'s project is X".' },
        category: { type: 'string', description: 'Optional: profile, preference, project, etc.' },
      },
      required: ['fact'],
    },
  },
  {
    name: 'forget',
    description: 'Remove a previously stored memory by its id (shown in recall results).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'recall_memories',
    description: 'List all stored memories. Memories are also auto-injected into the system prompt, so you typically don\'t need to call this — it\'s for managing them.',
    input_schema: { type: 'object', properties: {} },
  },

  // ===== Knowledge base =====
  {
    name: 'search_kb',
    description: 'Search the user\'s knowledge base (files they uploaded as persistent context). Returns matching file excerpts.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', description: 'Default 5.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_kb',
    description: 'List files in the user\'s knowledge base.',
    input_schema: { type: 'object', properties: {} },
  },

  // ===== OCR / Text recognition =====
  {
    name: 'ocr_image',
    description: 'Extract text from an image using Claude vision. Pass either a tab_id (screenshots that tab) or a selector (element_screenshot first), or a data_url. Use when text is in image/canvas/SVG and unreachable via DOM.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer', description: 'Tab to screenshot (default: active).' },
        selector: { type: 'string', description: 'CSS selector or #ref-N to crop to.' },
        data_url: { type: 'string', description: 'Or pass a data:image/... URL directly.' },
        prompt: { type: 'string', description: 'Optional extra instruction (e.g. "extract phone numbers only").' },
      },
    },
  },

  // ===== Advanced cookie management =====
  {
    name: 'set_cookie',
    description: 'Set a cookie. Useful to inject auth tokens. Domain inferred from URL if omitted.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL the cookie is for.' },
        name: { type: 'string' },
        value: { type: 'string' },
        domain: { type: 'string' },
        path: { type: 'string' },
        secure: { type: 'boolean' },
        http_only: { type: 'boolean' },
        same_site: { type: 'string', enum: ['no_restriction', 'lax', 'strict'] },
        expires_in: { type: 'integer', description: 'Seconds from now until expiry.' },
      },
      required: ['url', 'name', 'value'],
    },
  },
  {
    name: 'delete_cookie',
    description: 'Delete a single cookie by name+url.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['url', 'name'],
    },
  },
  {
    name: 'clear_cookies',
    description: 'Delete ALL cookies for a domain. Useful for clean re-login or testing.',
    input_schema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'e.g. "example.com" — clears all subdomains too.' },
        url: { type: 'string', description: 'Or pass URL; domain extracted automatically.' },
      },
    },
  },
  {
    name: 'export_cookies',
    description: 'Export cookies in Netscape format (works with curl --cookie-jar / wget --load-cookies).',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        tab_id: { type: 'integer' },
      },
    },
  },

  // ===== Performance profiling =====
  {
    name: 'perf_profile',
    description: 'Measure page performance: load timing, paint metrics (FCP, LCP), resource breakdown, JS memory. Use after navigation or on load issue debugging.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        include_resources: { type: 'boolean', description: 'Include per-resource timing (default false, can be huge).' },
      },
    },
  },

  // ===== Accessibility / WCAG audit =====
  {
    name: 'a11y_audit',
    description: 'Run WCAG 2.1 accessibility checks: missing alt text, unlabeled inputs, heading hierarchy, color contrast (computed style sample), ARIA misuse, focusable hidden elements. Returns issues with severity.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        severity: { type: 'string', enum: ['all', 'error', 'warning'], description: 'Filter (default: all).' },
      },
    },
  },

  // ===== API mocking =====
  {
    name: 'mock_api_start',
    description: 'Intercept matching network requests and return canned responses. Useful to test UI under different API states. Requires debugger permission. Multiple rules can be active.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        url_pattern: { type: 'string', description: 'URL pattern (supports * wildcard). e.g. "*/api/users/*".' },
        status: { type: 'integer', description: 'HTTP status to return (default 200).' },
        body: { type: 'string', description: 'Response body (string or JSON).' },
        content_type: { type: 'string', description: 'Default: application/json.' },
        delay_ms: { type: 'integer', description: 'Artificial delay before responding.' },
      },
      required: ['url_pattern'],
    },
  },
  {
    name: 'mock_api_stop',
    description: 'Stop all mocked routes on a tab and detach debugger.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
      },
    },
  },

  // ===== Attach file inline to chat =====
  {
    name: 'attach_file',
    description: 'Send a file directly to the user\'s chat (instead of downloading). Use when generating output the user wants to see/save: PDFs, CSVs, JSON exports, images, code snippets as files. The file shows up inline in the chat with a download button.',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'e.g. "report.csv", "data.json", "screenshot.png"' },
        content: { type: 'string', description: 'File contents. UTF-8 string by default, or base64 if encoding=base64.' },
        mime_type: { type: 'string', description: 'e.g. "text/csv", "application/json", "image/png" (default: text/plain).' },
        encoding: { type: 'string', enum: ['utf8', 'base64'], description: 'utf8 (default) or base64 for binary files.' },
        caption: { type: 'string', description: 'Optional one-line caption shown above the file.' },
      },
      required: ['filename', 'content'],
    },
  },

  // ===== Watch element (observer) =====
  {
    name: 'watch_element',
    description: 'Wait for a selector to appear, disappear, or change. More efficient than polling wait_for. Returns when the change happens or timeout.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or #ref-N.' },
        change: { type: 'string', enum: ['appear', 'disappear', 'text_change', 'attribute_change'], description: 'What to wait for. Default: appear.' },
        timeout_ms: { type: 'integer', description: 'Max wait (default 10000).' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },

  // ===== Real keyboard via CDP =====
  {
    name: 'cdp_key',
    description: 'Send keyboard event via CDP Input.dispatchKeyEvent — produces isTrusted=true events that pass through more security checks than regular type. Use when standard type/key_press doesn\'t work (e.g. some web games, secure inputs).',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type, OR a key combo like "ctrl+a", "Enter", "ArrowDown".' },
        tab_id: { type: 'integer' },
      },
      required: ['text'],
    },
  },

  // ===== Read-only mode =====
  {
    name: 'set_readonly',
    description: 'Lock the session into read-only mode (no clicks, types, or navigation). Useful for demos or audits where the agent should only observe. Pass enabled=false to unlock.',
    input_schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'true = lock, false = unlock.' },
      },
      required: ['enabled'],
    },
  },

  // ===== Stable refs =====
  {
    name: 'stable_ref',
    description: 'Create a stable ref to an element that survives across get_page calls. Returns a $stable-N selector you can reuse. Use when you need to remember an element across multiple steps.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or #ref-N to capture.' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },

  // ===== Tab group =====
  {
    name: 'group_tabs',
    description: 'Group multiple tabs into a colored Chrome tab group. Useful when researching to keep related tabs together.',
    input_schema: {
      type: 'object',
      properties: {
        tab_ids: { type: 'array', items: { type: 'integer' }, description: 'Tabs to group.' },
        title: { type: 'string', description: 'Group label.' },
        color: { type: 'string', enum: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'], description: 'Group color.' },
      },
      required: ['tab_ids'],
    },
  },

  // ===== Virtual workspace (sandbox storage, separate from Downloads) =====
  {
    name: 'workspace_write',
    description: 'Write a file to MoonBridge\'s virtual workspace (persists across sessions, not the user\'s Downloads). Use to store intermediate results, drafts, or notes the agent will reuse later.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Virtual path like "research/notes.md" or "data.json".' },
        content: { type: 'string', description: 'File contents (utf-8 or base64).' },
        encoding: { type: 'string', enum: ['utf8', 'base64'], description: 'Default utf8.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'workspace_read',
    description: 'Read a file from the virtual workspace.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'workspace_list',
    description: 'List all files in the virtual workspace, optionally filtered by path prefix.',
    input_schema: {
      type: 'object',
      properties: { prefix: { type: 'string', description: 'e.g. "research/" to list only that folder.' } },
    },
  },
  {
    name: 'workspace_delete',
    description: 'Delete a file (or all files matching prefix) from the virtual workspace.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Exact path to delete.' },
        prefix: { type: 'string', description: 'Or pass prefix to delete all matching.' },
      },
    },
  },

  // ===== Cross-tab diff =====
  {
    name: 'diff_tabs',
    description: 'Compare two tabs (DOM text, structure, or metadata). Useful for QA regression — load same page in two states and see what changed.',
    input_schema: {
      type: 'object',
      properties: {
        tab_a: { type: 'integer' },
        tab_b: { type: 'integer' },
        mode: { type: 'string', enum: ['text', 'structure', 'meta'], description: 'text=visible text diff (default), structure=DOM tree shape, meta=title/url/headers' },
        max_chars: { type: 'integer', description: 'Default 8000.' },
      },
      required: ['tab_a', 'tab_b'],
    },
  },

  // ===== Auth detection =====
  {
    name: 'check_auth',
    description: 'Detect whether the user is logged in to a site (heuristic: looks for login forms, "sign in" links, user avatar, etc). Use BEFORE actions that need auth, to avoid acting on a guest tab.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
    },
  },

  // ===== Worker / SW console =====
  {
    name: 'worker_console',
    description: 'Capture console logs from web workers and service workers (not just main thread). Returns recent log entries.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        limit: { type: 'integer', description: 'Max entries (default 50).' },
      },
    },
  },

  // ===== Health check =====
  {
    name: 'health_check',
    description: 'Get MoonBridge\'s current runtime state: tab count, network buffer status, workspace size, readonly mode, navigation rate-limit budget, mock rules active, debugger attached. Use to diagnose issues before/after complex operations.',
    input_schema: { type: 'object', properties: {} },
  },

  // ===== Conditional action =====
  {
    name: 'conditional_action',
    description: 'Try a chain of tool calls until one succeeds. Useful when target element might be one of several selectors (different layouts / A-B variants / shadow vs light DOM).',
    input_schema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          description: 'Actions to try in order. Each: {tool: "click", input: {selector: "#btn"}}',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string' },
              input: { type: 'object' },
            },
            required: ['tool', 'input'],
          },
        },
      },
      required: ['actions'],
    },
  },

  // ===== AI-requested round 4 tools =====
  {
    name: 'get_element_info',
    description: 'All-in-one element inspector. Returns text, value, all attributes, position (rect), visibility, key computed styles, parent path. Replaces multiple get_text/get_value/get_attribute calls.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'smart_click',
    description: 'Click an element by natural-language description. Tries text match, aria-label, role, placeholder. Use when you don\'t know exact selector. e.g. "login button", "submit form".',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Natural language — what to click.' },
        tab_id: { type: 'integer' },
      },
      required: ['description'],
    },
  },
  {
    name: 'smart_type',
    description: 'Type into a field identified by label/placeholder/aria-label. e.g. field="email", text="user@x.com" → finds the email input automatically.',
    input_schema: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'Field label/placeholder/aria-label keyword.' },
        text: { type: 'string' },
        tab_id: { type: 'integer' },
        press_enter: { type: 'boolean' },
      },
      required: ['field', 'text'],
    },
  },
  {
    name: 'wait_for_navigation',
    description: 'Wait until the tab navigates to a new URL and finishes loading. Use after clicks that trigger navigation.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        url_contains: { type: 'string', description: 'Optional substring to match in new URL.' },
        timeout_ms: { type: 'integer', description: 'Default 10000.' },
      },
    },
  },
  {
    name: 'wait_for_element_state',
    description: 'Wait until element reaches state: visible, hidden, enabled, disabled, stable (no DOM change for 200ms).',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        state: { type: 'string', enum: ['visible', 'hidden', 'enabled', 'disabled', 'stable'] },
        timeout_ms: { type: 'integer', description: 'Default 5000.' },
        tab_id: { type: 'integer' },
      },
      required: ['selector', 'state'],
    },
  },
  {
    name: 'extract_table',
    description: 'Parse an HTML <table> into JSON rows. Auto-detects header from <thead>/<th>. Returns array of {col1: val, col2: val, ...}.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Table selector. Default: first table on page.' },
        tab_id: { type: 'integer' },
        max_rows: { type: 'integer', description: 'Default 100.' },
      },
    },
  },
  {
    name: 'extract_form_data',
    description: 'Get all form fields with current values, labels, types, validation state. Useful for form auditing or pre-fill detection.',
    input_schema: {
      type: 'object',
      properties: {
        form_selector: { type: 'string', description: 'Form selector. Default: all forms.' },
        tab_id: { type: 'integer' },
      },
    },
  },
  {
    name: 'extract_list',
    description: 'Extract repeating patterns (cards, posts, products). Specify container + item selector + named field selectors.',
    input_schema: {
      type: 'object',
      properties: {
        container: { type: 'string', description: 'Parent selector.' },
        item: { type: 'string', description: 'Item selector within container.' },
        fields: { type: 'object', description: 'Map of {fieldName: selector} relative to item.' },
        tab_id: { type: 'integer' },
        max_items: { type: 'integer', description: 'Default 50.' },
      },
      required: ['item'],
    },
  },
  {
    name: 'extract_metadata',
    description: 'Get page metadata: OpenGraph, Twitter cards, JSON-LD, canonical URL, lang, description, favicon.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
    },
  },
  {
    name: 'extract_contacts',
    description: 'Find emails, phone numbers, and addresses on the page using regex patterns.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
    },
  },
  {
    name: 'extract_images',
    description: 'List all images on the page with src, alt, dimensions. Optionally filter by min size.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        min_size: { type: 'integer', description: 'Min width/height in px (default 50).' },
      },
    },
  },
  {
    name: 'wait_for_request',
    description: 'Wait until a network request matching pattern completes. Returns request + response data. Requires CDP attach.',
    input_schema: {
      type: 'object',
      properties: {
        url_contains: { type: 'string' },
        method: { type: 'string', description: 'GET, POST, etc. Default any.' },
        timeout_ms: { type: 'integer', description: 'Default 10000.' },
        tab_id: { type: 'integer' },
      },
      required: ['url_contains'],
    },
  },
  {
    name: 'block_resources',
    description: 'Block resource types (image, font, media, stylesheet, script, xhr, fetch) for a tab. Speeds up scraping or simulates poor network. Pass empty array to unblock.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        types: { type: 'array', items: { type: 'string' }, description: 'Resource types to block.' },
        url_patterns: { type: 'array', items: { type: 'string' }, description: 'Or specific URL wildcards.' },
      },
    },
  },
  {
    name: 'get_visible_text',
    description: 'Extract ONLY text the user can actually see (excludes hidden/script/style/off-screen). More accurate than get_page text for content extraction.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        max_chars: { type: 'integer', description: 'Default 10000.' },
      },
    },
  },
  {
    name: 'find_clickable',
    description: 'List ALL interactive elements (buttons, links, inputs) with their visible label and position. Better than get_page for click planning.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        limit: { type: 'integer', description: 'Default 80.' },
      },
    },
  },
  {
    name: 'pdf_export',
    description: 'Save current page as PDF. Requires CDP. Returns filename in Downloads folder.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        filename: { type: 'string' },
        landscape: { type: 'boolean' },
      },
    },
  },
  {
    name: 'element_exists',
    description: 'Quick check whether a selector matches anything. Returns boolean. Faster than find_element.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'count_elements',
    description: 'Count elements matching selector.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'scroll_to_element',
    description: 'Smooth-scroll an element into view. Optionally specify alignment (start/center/end).',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        block: { type: 'string', enum: ['start', 'center', 'end', 'nearest'], description: 'Default center.' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'highlight_element',
    description: 'Visually flash an element with a colored outline (debug aid). Auto-removes after duration.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        color: { type: 'string', description: 'CSS color. Default red.' },
        duration_ms: { type: 'integer', description: 'Default 2000.' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'scroll_through_page',
    description: 'Auto-scroll from top to bottom in steps to trigger lazy-loaded content (infinite scroll, image lazy load, etc).',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        step_px: { type: 'integer', description: 'Pixels per step (default 500).' },
        delay_ms: { type: 'integer', description: 'Pause between steps (default 300).' },
        max_scrolls: { type: 'integer', description: 'Safety cap (default 30).' },
      },
    },
  },
  {
    name: 'retry_with_backoff',
    description: 'Retry a tool call with exponential backoff on failure. Useful for flaky network calls or eventual-consistency UIs.',
    input_schema: {
      type: 'object',
      properties: {
        tool: { type: 'string' },
        input: { type: 'object' },
        max_attempts: { type: 'integer', description: 'Default 3.' },
        backoff_ms: { type: 'integer', description: 'Initial delay (default 500). Doubles each attempt.' },
      },
      required: ['tool', 'input'],
    },
  },
  {
    name: 'auth_save',
    description: 'Snapshot cookies + localStorage + sessionStorage for current tab\'s domain into a named slot. Restore later with auth_restore to skip login.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Slot name, e.g. "github_main".' },
        tab_id: { type: 'integer' },
      },
      required: ['name'],
    },
  },
  {
    name: 'auth_restore',
    description: 'Restore a previously saved auth snapshot to current tab\'s domain. Reload page after to apply.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['name'],
    },
  },
  {
    name: 'auth_list',
    description: 'List all saved auth snapshots.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'export_data',
    description: 'Export an array of records to CSV or JSON, attached inline to chat.',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'array', description: 'Array of objects.' },
        format: { type: 'string', enum: ['csv', 'json'], description: 'Default csv.' },
        filename: { type: 'string', description: 'Default export.csv/json.' },
      },
      required: ['data'],
    },
  },
  {
    name: 'ai_summarize',
    description: 'Use Claude to summarize the current page text. Length: short (1 para) | medium (3-4) | long (full breakdown).',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        length: { type: 'string', enum: ['short', 'medium', 'long'], description: 'Default medium.' },
      },
    },
  },

  // ===== Round 5 — Final wishlist items =====
  {
    name: 'ai_describe_page',
    description: 'Take a screenshot and use vision to describe what is ON the page (including canvas, charts, images, non-DOM content). Use when DOM extraction misses visual content.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        focus: { type: 'string', description: 'What to focus the description on (e.g. "charts and graphs only").' },
      },
    },
  },
  {
    name: 'ai_find_element',
    description: 'Find an element on the page by natural-language intent. Returns selector candidates ranked by AI. Use when smart_click finds wrong target.',
    input_schema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'e.g. "the price of the first product"' },
        tab_id: { type: 'integer' },
      },
      required: ['intent'],
    },
  },
  {
    name: 'ai_extract_data',
    description: 'Extract structured data from page using AI + schema. Provide description + JSON schema, AI returns matching structured output. Game changer for scraping.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'What to extract, e.g. "all products with name, price, rating".' },
        schema: { type: 'object', description: 'Target shape (JSON schema-ish), e.g. {products: [{name: "string", price: "number"}]}.' },
        tab_id: { type: 'integer' },
        max_chars: { type: 'integer', description: 'Source text limit (default 20000).' },
      },
      required: ['description'],
    },
  },
  {
    name: 'get_accessibility_tree',
    description: 'Get the full ARIA accessibility tree via CDP. Returns semantic structure with roles, labels, states. Better than DOM for AI navigation.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        max_nodes: { type: 'integer', description: 'Default 200.' },
      },
    },
  },
  {
    name: 'get_page_structure',
    description: 'Hierarchical page outline: header / nav / main / sections / footer. Identifies semantic landmarks even if site uses divs instead of semantic HTML.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer' } },
    },
  },
  {
    name: 'monitor_url',
    description: 'Watch a tab for URL changes matching a pattern. Returns when match happens or timeout. Useful for OAuth callback waits.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        pattern: { type: 'string', description: 'URL substring to wait for, e.g. "/callback".' },
        timeout_ms: { type: 'integer', description: 'Default 30000.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'monitor_console',
    description: 'Capture console output (log, warn, error) for a window of time, then return collected entries. Optional level filter.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        level: { type: 'string', enum: ['all', 'log', 'warn', 'error'], description: 'Default error.' },
        duration_ms: { type: 'integer', description: 'Capture window (default 5000).' },
      },
    },
  },
  {
    name: 'monitor_network',
    description: 'Capture network activity for a duration, return summary. Filters by URL substring/method.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        url_contains: { type: 'string' },
        method: { type: 'string' },
        duration_ms: { type: 'integer', description: 'Default 5000.' },
      },
    },
  },
  {
    name: 'conditional_step',
    description: 'If-then-else workflow: check a condition (selector exists, URL matches, or text present), then run one branch.',
    input_schema: {
      type: 'object',
      properties: {
        if: {
          type: 'object',
          description: 'Condition: {selector, exists?: true|false} OR {url_contains: "..."} OR {text_contains: "..."}',
        },
        then: {
          type: 'array',
          items: { type: 'object', properties: { tool: { type: 'string' }, input: { type: 'object' } } },
        },
        else: {
          type: 'array',
          items: { type: 'object', properties: { tool: { type: 'string' }, input: { type: 'object' } } },
        },
        tab_id: { type: 'integer' },
      },
      required: ['if'],
    },
  },
  {
    name: 'loop_until',
    description: 'Repeat a sequence of tool calls until a condition becomes true (or max_iterations hit). Useful for "scroll until X appears" or "click next until Y".',
    input_schema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: { type: 'object', properties: { tool: { type: 'string' }, input: { type: 'object' } } },
        },
        until: {
          type: 'object',
          description: 'Stop condition: {selector, exists}, {url_contains}, or {text_contains}.',
        },
        max_iterations: { type: 'integer', description: 'Default 10.' },
        delay_ms: { type: 'integer', description: 'Pause between iterations (default 500).' },
        tab_id: { type: 'integer' },
      },
      required: ['steps', 'until'],
    },
  },
  {
    name: 'download_all_images',
    description: 'Bulk download all images on the page (or matching selector) to Downloads folder.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'integer' },
        selector: { type: 'string', description: 'Default: img elements page-wide.' },
        folder: { type: 'string', description: 'Subfolder name in Downloads.' },
        min_size: { type: 'integer', description: 'Min width/height (default 100).' },
      },
    },
  },
  {
    name: 'db_set',
    description: 'Insert/update a record in a virtual table (key-value DB on top of workspace). Schema-less.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name, e.g. "leads".' },
        id: { type: 'string', description: 'Record id (any unique string).' },
        data: { type: 'object', description: 'Record fields.' },
      },
      required: ['table', 'id', 'data'],
    },
  },
  {
    name: 'db_get',
    description: 'Fetch a single record by id, or all records in a table.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        id: { type: 'string', description: 'If omitted, returns all rows.' },
      },
      required: ['table'],
    },
  },
  {
    name: 'db_query',
    description: 'Filter records: where = {field: value} or {field: {op: "contains", value: "..."}}.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        where: { type: 'object', description: 'Filter conditions.' },
        limit: { type: 'integer', description: 'Default 100.' },
      },
      required: ['table'],
    },
  },
  {
    name: 'db_delete',
    description: 'Delete record by id, or all matching where clause.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        id: { type: 'string' },
        where: { type: 'object' },
      },
      required: ['table'],
    },
  },
];

// Tools that should require approval in 'destructive' mode.
export const DESTRUCTIVE_TOOLS = new Set(['close_tab', 'execute_js', 'download_file', 'save_text']);
const RISKY_WORDS = /\b(delete|remove|destroy|drop|wipe|cancel\s*subscription|buy|purchase|pay|checkout|order|submit|sign\s*out|log\s*out|publish|post|tweet|send|transfer|withdraw)\b/i;

// =====================================================================
// Helpers
// =====================================================================

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) {
    const [t2] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!t2) throw new Error('No active tab');
    return t2;
  }
  return tab;
}

async function resolveTab(tabId) {
  if (Number.isFinite(tabId)) return await chrome.tabs.get(tabId);
  return await getActiveTab();
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return /^(chrome|edge|brave|about|chrome-extension|moz-extension|view-source|file):/i.test(url);
}

async function execIsolated(tabId, func, args, frameId) {
  const target = { tabId };
  if (Number.isFinite(frameId)) target.frameIds = [frameId];
  const [{ result }] = await chrome.scripting.executeScript({
    target,
    func,
    args: args || [],
  });
  return result;
}

function waitForTabComplete(tabId, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(t);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    const t = setTimeout(finish, timeoutMs);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') finish();
    }).catch(() => finish());
  });
}

async function indicator(tabId, msg) {
  try { await chrome.tabs.sendMessage(tabId, msg); } catch {}
}

async function highlightAndPoint(tabId, selector, label) {
  try {
    const r = await chrome.tabs.sendMessage(tabId, { type: 'CC_HIGHLIGHT', selector });
    if (r?.center) {
      await indicator(tabId, { type: 'CC_CURSOR', x: r.center.x, y: r.center.y });
      if (label) await indicator(tabId, { type: 'CC_TOAST', text: label });
      await new Promise((res) => setTimeout(res, 250));
      return r.center;
    }
  } catch {}
  if (label) await indicator(tabId, { type: 'CC_TOAST', text: label });
  return null;
}

// =====================================================================
// Dispatcher
// =====================================================================

// Mutation tools blocked when set_readonly is enabled
const _MUTATING_TOOLS = new Set([
  'click', 'hover', 'type', 'key_press', 'select_option', 'fill_form',
  'scroll', 'navigate', 'back', 'forward', 'reload', 'execute_js',
  'new_tab', 'close_tab', 'switch_tab', 'duplicate_tab',
  'click_and_read', 'navigate_and_read', 'drag_drop', 'mouse_drag',
  'double_click', 'triple_click', 'set_zoom', 'resize_window',
  'upload_image', 'set_cookie', 'delete_cookie', 'clear_cookies',
  'download_file', 'save_text', 'mock_api_start',
  'cdp_key', 'group_tabs',
]);

// Standardized error codes — addresses AI feedback "Error messages generic"
const ERR_CODES = {
  TIMEOUT: 'ERR_TIMEOUT',
  RESTRICTED: 'ERR_RESTRICTED',
  NOT_FOUND: 'ERR_NOT_FOUND',
  AUTH_REQUIRED: 'ERR_AUTH_REQUIRED',
  RATE_LIMITED: 'ERR_RATE_LIMITED',
  READONLY: 'ERR_READONLY',
  PERMISSION: 'ERR_PERMISSION',
  WHITELIST: 'ERR_WHITELIST',
  USER_DENIED: 'ERR_USER_DENIED',
  INVALID_INPUT: 'ERR_INVALID_INPUT',
  UNKNOWN_TOOL: 'ERR_UNKNOWN_TOOL',
  EXEC_FAILED: 'ERR_EXEC_FAILED',
};

function _inferErrorCode(content) {
  const c = String(content || '').toLowerCase();
  if (c.includes('restricted') || c.includes('chrome://') || c.includes('blocked by browser')) return ERR_CODES.RESTRICTED;
  if (c.includes('timed out') || c.includes('timeout')) return ERR_CODES.TIMEOUT;
  if (c.includes('not found') || c.includes('no element') || c.includes('no matching')) return ERR_CODES.NOT_FOUND;
  if (c.includes('auth') || c.includes('login') || c.includes('not signed')) return ERR_CODES.AUTH_REQUIRED;
  if (c.includes('rate limit') || c.includes('too many')) return ERR_CODES.RATE_LIMITED;
  if (c.includes('read-only') || c.includes('readonly')) return ERR_CODES.READONLY;
  if (c.includes('permission')) return ERR_CODES.PERMISSION;
  if (c.includes('disabled for this') || c.includes('whitelist')) return ERR_CODES.WHITELIST;
  if (c.includes('denied permission')) return ERR_CODES.USER_DENIED;
  if (c.includes('required') || c.includes('invalid')) return ERR_CODES.INVALID_INPUT;
  if (c.startsWith('unknown tool:')) return ERR_CODES.UNKNOWN_TOOL;
  return ERR_CODES.EXEC_FAILED;
}

export async function executeTool(name, input, ctx = {}) {
  // Universal timer + error envelope wrapper
  const start = performance.now();

  const wrap = (result) => {
    const ms = Math.round(performance.now() - start);
    if (!result || typeof result !== 'object') return result;
    // Inject execution_time_ms into all responses
    result.execution_time_ms = ms;
    if (result.is_error) {
      result.error_code = result.error_code || _inferErrorCode(result.content);
      // Prefix content with code so model can parse easily
      if (typeof result.content === 'string' && !result.content.startsWith('[')) {
        result.content = `[${result.error_code}] ${result.content} (took ${ms}ms)`;
      }
    }
    return result;
  };

  if (ctx.whitelist && !ctx.whitelist.has(name)) {
    return wrap({ is_error: true, error_code: ERR_CODES.WHITELIST,
                  content: `Tool "${name}" is disabled for this conversation.` });
  }
  if (_MUTATING_TOOLS.has(name) && await _isReadonly()) {
    return wrap({ is_error: true, error_code: ERR_CODES.READONLY,
                  content: `🔒 Read-only mode is active. "${name}" is blocked. Call set_readonly with enabled=false to unlock.` });
  }
  const needs = await needsApproval(name, input, ctx);
  if (needs.required && ctx.askApproval) {
    const ok = await ctx.askApproval({ name, input, reason: needs.reason });
    if (!ok) return wrap({ is_error: true, error_code: ERR_CODES.USER_DENIED,
                            content: `User denied permission to call ${name}.` });
  }
  try {
    switch (name) {
      case 'health_check':       return wrap(await tool_healthCheck(input || {}));
      case 'conditional_action': return wrap(await tool_conditionalAction(input || {}, ctx));
      case 'get_element_info': return wrap(await tool_getElementInfo(input || {}));
      case 'smart_click':      return wrap(await tool_smartClick(input || {}, ctx));
      case 'smart_type':       return wrap(await tool_smartType(input || {}, ctx));
      case 'wait_for_navigation': return wrap(await tool_waitForNavigation(input || {}));
      case 'wait_for_element_state': return wrap(await tool_waitForElementState(input || {}));
      case 'extract_table':    return wrap(await tool_extractTable(input || {}));
      case 'extract_form_data':return wrap(await tool_extractFormData(input || {}));
      case 'extract_list':     return wrap(await tool_extractList(input || {}));
      case 'extract_metadata': return wrap(await tool_extractMetadata(input || {}));
      case 'extract_contacts': return wrap(await tool_extractContacts(input || {}));
      case 'extract_images':   return wrap(await tool_extractImages(input || {}));
      case 'wait_for_request': return wrap(await tool_waitForRequest(input || {}));
      case 'block_resources':  return wrap(await tool_blockResources(input || {}));
      case 'get_visible_text': return wrap(await tool_getVisibleText(input || {}));
      case 'find_clickable':   return wrap(await tool_findClickable(input || {}));
      case 'pdf_export':       return wrap(await tool_pdfExport(input || {}));
      case 'element_exists':   return wrap(await tool_elementExists(input || {}));
      case 'count_elements':   return wrap(await tool_countElements(input || {}));
      case 'scroll_to_element':return wrap(await tool_scrollToElement(input || {}));
      case 'highlight_element':return wrap(await tool_highlightElement(input || {}));
      case 'scroll_through_page': return wrap(await tool_scrollThroughPage(input || {}));
      case 'retry_with_backoff':return wrap(await tool_retryWithBackoff(input || {}, ctx));
      case 'auth_save':        return wrap(await tool_authSave(input || {}));
      case 'auth_restore':     return wrap(await tool_authRestore(input || {}));
      case 'auth_list':        return wrap(await tool_authList());
      case 'export_data':      return wrap(await tool_exportData(input || {}));
      case 'ai_summarize':     return wrap(await tool_aiSummarize(input || {}));
      case 'ai_describe_page': return wrap(await tool_aiDescribePage(input || {}));
      case 'ai_find_element':  return wrap(await tool_aiFindElement(input || {}));
      case 'ai_extract_data':  return wrap(await tool_aiExtractData(input || {}));
      case 'get_accessibility_tree': return wrap(await tool_getA11yTree(input || {}));
      case 'get_page_structure': return wrap(await tool_getPageStructure(input || {}));
      case 'monitor_url':      return wrap(await tool_monitorUrl(input || {}));
      case 'monitor_console':  return wrap(await tool_monitorConsole(input || {}));
      case 'monitor_network':  return wrap(await tool_monitorNetwork(input || {}));
      case 'conditional_step': return wrap(await tool_conditionalStep(input || {}, ctx));
      case 'loop_until':       return wrap(await tool_loopUntil(input || {}, ctx));
      case 'download_all_images': return wrap(await tool_downloadAllImages(input || {}));
      case 'db_set':           return wrap(await tool_dbSet(input || {}));
      case 'db_get':           return wrap(await tool_dbGet(input || {}));
      case 'db_query':         return wrap(await tool_dbQuery(input || {}));
      case 'db_delete':        return wrap(await tool_dbDelete(input || {}));
      case 'get_page':       return wrap(await tool_getPage(input || {}));
      case 'read_tab':       return wrap(await tool_getPage({ ...input, tab_id: input?.tab_id }));
      case 'find_element':   return wrap(await tool_findElement(input || {}));
      case 'extract_links':  return wrap(await tool_extractLinks(input || {}));
      case 'get_console':    return wrap(await tool_getConsole(input || {}));
      case 'click':          return wrap(await tool_click(input || {}));
      case 'hover':          return wrap(await tool_hover(input || {}));
      case 'type':           return wrap(await tool_type(input || {}));
      case 'key_press':      return wrap(await tool_keyPress(input || {}));
      case 'select_option':  return wrap(await tool_selectOption(input || {}));
      case 'fill_form':      return wrap(await tool_fillForm(input || {}));
      case 'scroll':         return wrap(await tool_scroll(input || {}));
      case 'wait_for':       return wrap(await tool_waitFor(input || {}));
      case 'wait':           return wrap(await tool_wait(input || {}));
      case 'navigate':       return wrap(await tool_navigate(input || {}));
      case 'back':           return wrap(await tool_back(input || {}));
      case 'forward':        return wrap(await tool_forward(input || {}));
      case 'reload':         return wrap(await tool_reload(input || {}));
      case 'screenshot':     return wrap(await tool_screenshot(input || {}));
      case 'execute_js':     return wrap(await tool_executeJs(input || {}));
      case 'list_tabs':      return wrap(await tool_listTabs(input || {}));
      case 'switch_tab':     return wrap(await tool_switchTab(input || {}));
      case 'new_tab':        return wrap(await tool_newTab(input || {}));
      case 'close_tab':      return wrap(await tool_closeTab(input || {}));
      case 'duplicate_tab':  return wrap(await tool_duplicateTab(input || {}));
      case 'click_and_read':  return wrap(await tool_clickAndRead(input || {}));
      case 'navigate_and_read': return wrap(await tool_navigateAndRead(input || {}));
      case 'network_log':    return wrap(await tool_networkLog(input || {}));
      case 'network_response': return wrap(await tool_networkResponse(input || {}));
      case 'screenshot_snapshot': return wrap(await tool_screenshotSnapshot(input || {}));
      case 'screenshot_compare': return wrap(await tool_screenshotCompare(input || {}));
      case 'list_windows':   return wrap(await tool_listWindows());
      case 'new_window':     return wrap(await tool_newWindow(input || {}));
      case 'focus_window':   return wrap(await tool_focusWindow(input || {}));
      case 'close_window':   return wrap(await tool_closeWindow(input || {}));
      case 'move_tab':       return wrap(await tool_moveTab(input || {}));
      case 'batch':          return wrap(await tool_batch(input || {}, ctx));
      case 'page_summary':   return wrap(await tool_pageSummary(input || {}));
      case 'scroll_until':   return wrap(await tool_scrollUntil(input || {}));
      case 'dom_snapshot':   return wrap(await tool_domSnapshot(input || {}));
      case 'get_value':      return wrap(await tool_getValue(input || {}));
      case 'get_attribute':  return wrap(await tool_getAttribute(input || {}));
      case 'get_text':       return wrap(await tool_getText(input || {}));
      case 'read_storage':   return wrap(await tool_readStorage(input || {}));
      case 'write_storage':  return wrap(await tool_writeStorage(input || {}));
      case 'read_cookies':   return wrap(await tool_readCookies(input || {}));
      case 'clipboard_read': return wrap(await tool_clipboardRead());
      case 'clipboard_write': return wrap(await tool_clipboardWrite(input || {}));
      case 'element_screenshot': return wrap(await tool_elementScreenshot(input || {}));
      case 'scratchpad_set': return wrap(await tool_scratchpadSet(input || {}));
      case 'scratchpad_get': return wrap(await tool_scratchpadGet(input || {}));
      case 'scratchpad_list': return wrap(await tool_scratchpadList());
      case 'note_save':      return wrap(await tool_noteSave(input || {}));
      case 'note_get':       return wrap(await tool_noteGet(input || {}));
      case 'note_list':      return wrap(await tool_noteList());
      case 'note_delete':    return wrap(await tool_noteDelete(input || {}));
      case 'get_page_diff':  return wrap(await tool_getPageDiff(input || {}));
      case 'list_frames':    return wrap(await tool_listFrames(input || {}));
      case 'find_by_text':   return wrap(await tool_findByText(input || {}));
      case 'drag_drop':      return wrap(await tool_dragDrop(input || {}));
      case 'mouse_drag':     return wrap(await tool_mouseDrag(input || {}));
      case 'double_click':   return wrap(await tool_doubleClick(input || {}));
      case 'triple_click':   return wrap(await tool_tripleClick(input || {}));
      case 'get_page_text':  return wrap(await tool_getPageText(input || {}));
      case 'scroll_to':      return wrap(await tool_scrollTo(input || {}));
      case 'set_zoom':       return wrap(await tool_setZoom(input || {}));
      case 'get_zoom':       return wrap(await tool_getZoom(input || {}));
      case 'resize_window':  return wrap(await tool_resizeWindow(input || {}));
      case 'upload_image':   return wrap(await tool_uploadImage(input || {}, ctx));
      case 'list_chat_attachments': return wrap(await tool_listChatAttachments({}, ctx));
      case 'get_chat_attachment':   return wrap(await tool_getChatAttachment(input || {}, ctx));
      case 'update_plan':    return wrap(await tool_updatePlan(input || {}, ctx));
      case 'gif_capture':    return wrap(await tool_gifCapture(input || {}));
      case 'ocr_image':      return wrap(await tool_ocrImage(input || {}, ctx));
      case 'set_cookie':     return wrap(await tool_setCookie(input || {}));
      case 'delete_cookie':  return wrap(await tool_deleteCookie(input || {}));
      case 'clear_cookies':  return wrap(await tool_clearCookies(input || {}));
      case 'export_cookies': return wrap(await tool_exportCookies(input || {}));
      case 'perf_profile':   return wrap(await tool_perfProfile(input || {}));
      case 'a11y_audit':     return wrap(await tool_a11yAudit(input || {}));
      case 'mock_api_start': return wrap(await tool_mockApiStart(input || {}));
      case 'mock_api_stop':  return wrap(await tool_mockApiStop(input || {}));
      case 'attach_file':    return wrap(await tool_attachFile(input || {}));
      case 'watch_element':  return wrap(await tool_watchElement(input || {}));
      case 'cdp_key':        return wrap(await tool_cdpKey(input || {}));
      case 'set_readonly':   return wrap(await tool_setReadonly(input || {}));
      case 'stable_ref':     return wrap(await tool_stableRef(input || {}));
      case 'group_tabs':     return wrap(await tool_groupTabs(input || {}));
      case 'workspace_write':return wrap(await tool_workspaceWrite(input || {}));
      case 'workspace_read': return wrap(await tool_workspaceRead(input || {}));
      case 'workspace_list': return wrap(await tool_workspaceList(input || {}));
      case 'workspace_delete': return wrap(await tool_workspaceDelete(input || {}));
      case 'diff_tabs':      return wrap(await tool_diffTabs(input || {}));
      case 'check_auth':     return wrap(await tool_checkAuth(input || {}));
      case 'worker_console': return wrap(await tool_workerConsole(input || {}));
      case 'web_search':     return wrap(await tool_webSearch(input || {}));
      case 'youtube_transcript': return wrap(await tool_youtubeTranscript(input || {}));
      case 'read_pdf':       return wrap(await tool_readPdf(input || {}));
      case 'fetch_url':      return wrap(await tool_fetchUrl(input || {}));
      case 'download_file':  return wrap(await tool_downloadFile(input || {}));
      case 'download_status': return wrap(await tool_downloadStatus(input || {}));
      case 'save_text':      return wrap(await tool_saveText(input || {}));
      case 'wait_for_idle':  return wrap(await tool_waitForIdle(input || {}));
      case 'remember':       return wrap(await tool_remember(input || {}, ctx));
      case 'forget':         return wrap(await tool_forget(input || {}, ctx));
      case 'recall_memories': return wrap(await tool_recallMemories(ctx));
      case 'search_kb':      return wrap(await tool_searchKb(input || {}, ctx));
      case 'list_kb':        return wrap(await tool_listKb(ctx));
      default: return wrap({ is_error: true, error_code: ERR_CODES.UNKNOWN_TOOL, content: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return wrap({ is_error: true, error_code: ERR_CODES.EXEC_FAILED, content: `Tool ${name} failed: ${e.message || String(e)}` });
  }
}

async function needsApproval(name, input, ctx) {
  const mode = ctx?.approvalMode || 'destructive';
  if (mode === 'never') return { required: false };
  if (mode === 'always') return { required: true, reason: 'Approval mode: always' };
  if (DESTRUCTIVE_TOOLS.has(name)) return { required: true, reason: `${name} is potentially destructive.` };
  if (name === 'navigate' && /^javascript:/i.test(input?.url || '')) return { required: true, reason: 'javascript: URL navigation' };
  if (name === 'fill_form' && input?.submit) return { required: true, reason: 'Form submission' };
  if (name === 'type' && input?.press_enter) {
    const blob = `${input.selector || ''} ${input.text || ''}`;
    if (RISKY_WORDS.test(blob)) return { required: true, reason: 'Possible form submission.' };
  }
  if (name === 'click') {
    if (RISKY_WORDS.test(input?.selector || '')) return { required: true, reason: 'Selector contains risky keyword.' };
  }
  return { required: false };
}

// =====================================================================
// READING TOOLS
// =====================================================================

async function tool_getPage({ max_chars = 2500, tab_id, full = false, include_shadow = true, focus = 'auto' }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) {
    return { is_error: true, error_code: ERR_CODES.RESTRICTED,
             content: `Cannot inspect restricted page: ${tab.url}. ` +
                      `chrome://, edge://, file://, and similar internal pages are blocked by browser policy. ` +
                      `Try a normal http(s) page instead.` };
  }
  await indicator(tab.id, { type: 'CC_TOAST', text: `Reading ${tab_id ? 'tab ' + tab_id : 'page'}…` });
  const snap = await execIsolated(tab.id, pageSnapshotInPage, [max_chars, full, include_shadow, focus]);
  if (!snap) return { content: 'No snapshot returned.' };
  const lines = [];
  lines.push(`URL: ${snap.url}`);
  lines.push(`TITLE: ${snap.title}`);
  lines.push(`TAB: id=${tab.id}${tab.active ? ' (active)' : ''}`);
  lines.push(`SCROLL: y=${snap.scrollY}/${snap.scrollHeight} (viewport=${snap.viewportH})`);
  if (snap.focus_used) lines.push(`FOCUS: ${snap.focus_used}${snap.focus_selector ? ' (' + snap.focus_selector + ')' : ''}`);

  // Explicit truncation flag — addresses AI feedback "agent kadang tidak sadar isinya terpotong"
  if (snap.text_truncated) {
    lines.push(`⚠ TRUNCATED: showing ${snap.text_chars} of ${snap.total_chars} chars (${Math.round(snap.text_chars / snap.total_chars * 100)}%). ` +
               `Re-call with max_chars=${Math.min(snap.total_chars, 20000)} to see more.`);
  }
  if (snap.elements_truncated) {
    lines.push(`⚠ ELEMENTS TRUNCATED: showing ${snap.elements?.length || 0} of ${snap.total_elements}. Use find_element to search the rest.`);
  }
  if (snap.elements_deduped) {
    lines.push(`ℹ DEDUPED: removed ${snap.elements_deduped} duplicate / repeated sibling element(s).`);
  }
  if (snap.shadow_roots_found) {
    lines.push(`📦 Shadow DOM: traversed ${snap.shadow_roots_found} shadow root(s).`);
  }

  if (snap.text) {
    lines.push('---PAGE TEXT---');
    lines.push(snap.text);
  }
  if (snap.elements?.length) {
    lines.push(`---INTERACTIVE ELEMENTS (${snap.elements.length}${snap.elements_truncated ? '/' + snap.total_elements : ''})---`);
    lines.push('(use #ref-N as selector for click/type)');
    for (const el of snap.elements) {
      const shadowMark = el.in_shadow ? ' 🟣' : '';
      const groupMark = el.group_count > 1 ? `  ×${el.group_count}` : '';
      lines.push(`#ref-${el.ref}  [${el.tag}${el.type ? '/' + el.type : ''}]${shadowMark}  ${el.label}${groupMark}`);
    }
  }
  return { content: lines.join('\n') };
}

function pageSnapshotInPage(maxChars, full, includeShadow, focus) {
  const url = location.href, title = document.title;
  const scrollY = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight;
  const viewportH = window.innerHeight;

  let shadowRootsFound = 0;

  // ---------- Focus detection ----------
  // Some sites (YouTube, Twitter, GitHub) have huge sidebars/recommendation
  // rails that drown out the main content the user actually navigated to.
  // Pick a focused root that emphasizes primary content over chrome.
  let focusRoot = document.body;
  let focusUsed = 'full-page';
  let focusSelector = '';
  function pickFocus(mode) {
    if (mode === 'full-page') return { root: document.body, label: 'full-page', selector: '' };
    const SITE_PRIMARY = {
      'youtube.com': ['ytd-watch-flexy #primary', '#primary.ytd-watch-flexy', 'ytd-watch-flexy', 'ytd-browse', '#contents'],
      'twitter.com': ['main [data-testid="primaryColumn"]', 'main'],
      'x.com': ['main [data-testid="primaryColumn"]', 'main'],
      'github.com': ['main', '#repo-content-pjax-container', '.repository-content'],
      'reddit.com': ['main', 'shreddit-app main'],
      'linkedin.com': ['main'],
    };
    const host = location.hostname.replace(/^www\./, '');
    for (const [pattern, sels] of Object.entries(SITE_PRIMARY)) {
      if (host.endsWith(pattern)) {
        for (const s of sels) {
          try {
            const el = document.querySelector(s);
            if (el && el.offsetHeight > 100) return { root: el, label: 'site-main', selector: s };
          } catch {}
        }
      }
    }
    // Generic: <main> if substantial, otherwise [role=main], article, #main, #content
    const generic = ['main', '[role="main"]', 'article', '#main', '#content', '.main-content', '#primary'];
    for (const s of generic) {
      try {
        const el = document.querySelector(s);
        if (el && el.offsetHeight > 100) return { root: el, label: 'main', selector: s };
      } catch {}
    }
    return { root: document.body, label: 'full-page', selector: '' };
  }
  if (focus === 'main' || focus === 'main-content' || focus === 'focused') {
    const f = pickFocus('main');
    focusRoot = f.root; focusUsed = f.label; focusSelector = f.selector;
  } else if (focus === 'auto') {
    // Auto: prefer main-content for known SPA sites, otherwise full-page
    const SPA_HOSTS = /(youtube|twitter|x|reddit|github|linkedin|instagram|tiktok)\.com$/;
    if (SPA_HOSTS.test(location.hostname.replace(/^www\./, ''))) {
      const f = pickFocus('main');
      if (f.label !== 'full-page') {
        focusRoot = f.root; focusUsed = f.label + ' (auto)'; focusSelector = f.selector;
      }
    }
  }

  // Recursively walk the DOM, descending into open shadow roots.
  // Closed shadow roots are inaccessible by spec — nothing we can do there.
  function* walkAll(root) {
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      yield node;
      if (node.shadowRoot && includeShadow) {
        shadowRootsFound++;
        for (const c of node.shadowRoot.children) stack.push(c);
      }
      if (node.children) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }
  }

  function getVisibleText() {
    const body = focusRoot;
    if (!body) return { text: '', total: 0, truncated: false };
    // First, count total available text (without truncation) by walking all nodes
    let totalChars = 0;
    let collectedChars = 0;
    const out = [];

    const visitTextIn = (root) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
          const cs = getComputedStyle(p);
          if (cs.display === 'none' || cs.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let n;
      while ((n = w.nextNode())) {
        const t = n.nodeValue.replace(/\s+/g, ' ').trim();
        if (!t) continue;
        totalChars += t.length + 1;
        if (collectedChars < maxChars) {
          out.push(t);
          collectedChars += t.length + 1;
        }
      }
    };

    visitTextIn(body);

    // Also walk into shadow roots if enabled
    if (includeShadow) {
      for (const node of walkAll(body)) {
        if (node.shadowRoot) {
          visitTextIn(node.shadowRoot);
        }
      }
    }

    const finalText = out.join('\n').slice(0, maxChars);
    return { text: finalText, total: totalChars, truncated: totalChars > maxChars };
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return true;
  }
  function labelFor(el) {
    const aria = el.getAttribute('aria-label'); if (aria) return aria.slice(0, 80);
    const ph = el.getAttribute('placeholder'); if (ph) return `[ph] ${ph}`.slice(0, 80);
    if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) return el.value?.slice(0, 80) || '';
    if (el.tagName === 'IMG') return el.alt?.slice(0, 80) || '';
    let t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t && el.title) t = el.title;
    return t.slice(0, 80);
  }
  const isInteractive = (el) => {
    if (!el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (['a', 'button', 'textarea', 'select'].includes(tag)) return el.tagName !== 'A' || el.hasAttribute('href');
    if (tag === 'input' && el.getAttribute('type') !== 'hidden') return true;
    const role = el.getAttribute('role');
    if (role && ['button','link','textbox','combobox','tab','menuitem','checkbox','radio'].includes(role)) return true;
    const ce = el.getAttribute('contenteditable');
    if (ce === '' || ce === 'true') return true;
    if (el.hasAttribute('onclick')) return true;
    return false;
  };

  const allCandidates = [];
  // Walk light DOM (within focus root) + (optionally) shadow DOM
  for (const node of walkAll(focusRoot)) {
    if (isInteractive(node)) {
      allCandidates.push({ el: node, in_shadow: !!node.getRootNode().host });
    }
  }

  // ---------- Dedup + group ----------
  // Remove icon-only / aria-only noise and collapse repeated siblings.
  // Two elements are "duplicates" if they share (label, tag, type) AND are
  // in the same parent (or grandparent at most) — that's how YouTube cards
  // produce 5–10x repeats per row.
  const groupMap = new Map();   // key → first index
  const filtered = [];
  let dropped = 0;
  for (const c of allCandidates) {
    const el = c.el;
    if (!full && !isVisible(el)) { dropped++; continue; }
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute('type') || el.getAttribute('role') || '';
    const lbl = labelFor(el);
    // Drop empty/icon-only buttons that have no aria-label / text → useless to model
    if (!lbl) { dropped++; continue; }
    // Group key: (label, tag, type, parent.tagName) — siblings of same kind dedupe
    const parent = el.parentElement;
    const key = `${tag}|${type}|${lbl}|${parent?.tagName || ''}`;
    if (groupMap.has(key)) {
      const idx = groupMap.get(key);
      filtered[idx]._group_count++;
      // Keep ref of FIRST occurrence — drop later duplicates entirely
      dropped++;
      continue;
    }
    groupMap.set(key, filtered.length);
    filtered.push({ ...c, _tag: tag, _type: type, _label: lbl, _group_count: 1 });
  }

  const elements = [];
  let ref = 0;
  window.__claudeRefs__ = window.__claudeRefs__ || {};
  for (const c of filtered) {
    ref++;
    window.__claudeRefs__[ref] = c.el;
    elements.push({
      ref,
      tag: c._tag,
      type: c._type,
      label: c._label,
      in_shadow: c.in_shadow,
      group_count: c._group_count,
    });
    if (elements.length >= 50) break;
  }

  const t = getVisibleText();
  return {
    url, title, scrollY, scrollHeight, viewportH,
    text: t.text,
    text_chars: t.text.length,
    total_chars: t.total,
    text_truncated: t.truncated,
    elements,
    total_elements: allCandidates.length,
    elements_truncated: filtered.length > 50,
    elements_deduped: dropped,
    shadow_roots_found: shadowRootsFound,
    focus_used: focusUsed,
    focus_selector: focusSelector,
  };
}

async function tool_findElement({ query, tab_id, limit = 20 }) {
  if (!query) return { is_error: true, content: 'query is required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const result = await execIsolated(tab.id, findElementInPage, [query, limit]);
  if (!result?.elements?.length) return { content: `No elements matched "${query}".` };
  const lines = [`Found ${result.elements.length} match(es) for "${query}":`];
  for (const el of result.elements) {
    lines.push(`#ref-${el.ref}  [${el.tag}]  ${el.label}`);
  }
  return { content: lines.join('\n') };
}

function findElementInPage(query, limit) {
  const q = (query || '').toLowerCase();
  if (!q) return { elements: [] };
  function isVisible(el) {
    if (!el?.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function labelFor(el) {
    const aria = el.getAttribute('aria-label'); if (aria) return aria.slice(0, 100);
    const ph = el.getAttribute('placeholder'); if (ph) return `[ph] ${ph}`.slice(0, 100);
    let t = (el.innerText || el.textContent || el.value || '').replace(/\s+/g, ' ').trim();
    if (!t && el.title) t = el.title;
    return t.slice(0, 100);
  }
  const all = document.querySelectorAll('a, button, input, textarea, select, [role=button], [role=link], [role=textbox], [role=tab], [role=menuitem], [onclick]');
  window.__claudeRefs__ = window.__claudeRefs__ || {};
  let ref = Object.keys(window.__claudeRefs__).length;
  const matches = [];
  for (const el of all) {
    if (!isVisible(el)) continue;
    const label = labelFor(el);
    const txt = `${label} ${el.getAttribute('name') || ''} ${el.getAttribute('href') || ''}`.toLowerCase();
    if (!txt.includes(q)) continue;
    ref++;
    window.__claudeRefs__[ref] = el;
    matches.push({ ref, tag: el.tagName.toLowerCase(), label });
    if (matches.length >= limit) break;
  }
  return { elements: matches };
}

async function tool_extractLinks({ tab_id, contains, limit = 50 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const links = await execIsolated(tab.id, extractLinksInPage, [contains || null, limit]);
  if (!links?.length) return { content: 'No links found.' };
  const lines = [`${links.length} links:`];
  for (const l of links) lines.push(`- ${l.text} → ${l.href}`);
  return { content: lines.join('\n') };
}

function extractLinksInPage(contains, limit) {
  const out = [];
  const q = contains ? contains.toLowerCase() : null;
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.href;
    if (!href || href.startsWith('javascript:')) continue;
    const text = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (q && !(href.toLowerCase().includes(q) || text.toLowerCase().includes(q))) continue;
    out.push({ text, href });
    if (out.length >= limit) break;
  }
  return out;
}

async function tool_getConsole({ tab_id, limit = 30 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  // Inject console interceptor (idempotent) and read buffer
  const result = await execIsolated(tab.id, getConsoleInPage, [limit]);
  if (!result?.entries?.length) return { content: '(console buffer empty — interceptor now installed; try again after some output)' };
  const lines = [`Last ${result.entries.length} console entries:`];
  for (const e of result.entries) lines.push(`[${e.level}] ${e.text}`);
  return { content: lines.join('\n') };
}

function getConsoleInPage(limit) {
  if (!window.__claudeConsoleBuf__) {
    window.__claudeConsoleBuf__ = [];
    const orig = {};
    for (const lvl of ['log', 'info', 'warn', 'error', 'debug']) {
      orig[lvl] = console[lvl].bind(console);
      console[lvl] = (...args) => {
        try {
          const text = args.map((a) => {
            try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
          }).join(' ');
          window.__claudeConsoleBuf__.push({ level: lvl, text: text.slice(0, 500), ts: Date.now() });
          if (window.__claudeConsoleBuf__.length > 200) window.__claudeConsoleBuf__.shift();
        } catch {}
        orig[lvl](...args);
      };
    }
    window.addEventListener('error', (e) => {
      window.__claudeConsoleBuf__.push({ level: 'error', text: `${e.message} @ ${e.filename}:${e.lineno}`, ts: Date.now() });
    });
  }
  return { entries: window.__claudeConsoleBuf__.slice(-limit) };
}

// =====================================================================
// INTERACTION TOOLS
// =====================================================================

async function tool_click({ selector, tab_id, button = 'left', timeout_ms = 600, wait_navigation = false }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  // Capture URL before click so we can detect SPA route change after
  const beforeUrl = tab.url;
  // Auto-retry: try selector now, then poll up to timeout_ms if not found yet
  let center = await chrome.tabs.sendMessage(tab.id, { type: 'CC_HIGHLIGHT', selector }).catch(() => null);
  let result = null;
  const start = Date.now();
  while (true) {
    if (center?.center) {
      await indicator(tab.id, { type: 'CC_CURSOR', x: center.center.x, y: center.center.y });
      await new Promise((r) => setTimeout(r, 220));
      await indicator(tab.id, { type: 'CC_PULSE', x: center.center.x, y: center.center.y });
    }
    await indicator(tab.id, { type: 'CC_TOAST', text: `Click ${selector}` });
    result = await execIsolated(tab.id, clickInPage, [selector, button]);
    if (result?.ok) break;
    if (Date.now() - start > timeout_ms) break;
    await new Promise((r) => setTimeout(r, 200));
    center = await chrome.tabs.sendMessage(tab.id, { type: 'CC_HIGHLIGHT', selector }).catch(() => null);
  }
  await indicator(tab.id, { type: 'CC_UNHIGHLIGHT' });
  if (!result?.ok) {
    return { is_error: true, error_code: ERR_CODES.NOT_FOUND,
             content: result?.error || `Click failed: selector "${selector}" not found within ${timeout_ms}ms` };
  }
  await new Promise((r) => setTimeout(r, 350));
  await waitForTabComplete(tab.id, 5000);
  // SPA / full-nav settle if requested. Detect URL change → run spaSettle.
  let settledNote = '';
  if (wait_navigation) {
    try {
      const after = await chrome.tabs.get(tab.id);
      if (after.url && after.url !== beforeUrl) {
        await spaSettle(tab.id, after.url).catch(() => {});
        settledNote = ' (settled)';
      } else {
        // No URL change but caller asked to wait — give the SPA a beat anyway
        await new Promise((r) => setTimeout(r, 400));
        settledNote = ' (no nav)';
      }
    } catch {}
  }
  const newTab = await chrome.tabs.get(tab.id);
  return { content: `Clicked ${result.label || selector}. URL: ${newTab.url}${settledNote}` };
}

function clickInPage(selector, button) {
  function resolve(sel) {
    const m = sel.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) {
      const el = window.__claudeRefs__[parseInt(m[1], 10)];
      if (el && el.isConnected) return el;
    }
    try { return document.querySelector(sel); } catch { return null; }
  }
  const el = resolve(selector);
  if (!el) return { ok: false, error: `Element not found: ${selector}` };
  const label = (el.innerText || el.value || el.getAttribute('aria-label') || '').slice(0, 60);
  el.scrollIntoView({ block: 'center', inline: 'center' });
  el.focus?.();
  if (button === 'right') {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, button: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  } else if (button === 'middle') {
    el.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
  } else {
    el.click();
  }
  return { ok: true, label };
}

async function tool_hover({ selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  await highlightAndPoint(tab.id, selector, `Hover ${selector}`);
  const result = await execIsolated(tab.id, hoverInPage, [selector]);
  if (!result?.ok) return { is_error: true, content: result?.error || 'Hover failed' };
  return { content: `Hovered ${selector}.` };
}

function hoverInPage(selector) {
  function resolve(sel) {
    const m = sel.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1], 10)]; if (el?.isConnected) return el; }
    try { return document.querySelector(sel); } catch { return null; }
  }
  const el = resolve(selector);
  if (!el) return { ok: false, error: `Element not found: ${selector}` };
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  const opts = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  el.dispatchEvent(new MouseEvent('mouseover', opts));
  el.dispatchEvent(new MouseEvent('mouseenter', opts));
  el.dispatchEvent(new MouseEvent('mousemove', opts));
  return { ok: true };
}

async function tool_type({ selector, text, press_enter = false, clear = true, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  await highlightAndPoint(tab.id, selector, `Type "${(text || '').slice(0, 30)}"`);
  const result = await execIsolated(tab.id, typeInPage, [selector, text, press_enter, clear]);
  await indicator(tab.id, { type: 'CC_UNHIGHLIGHT' });
  if (!result?.ok) return { is_error: true, content: result?.error || 'Type failed' };
  if (press_enter) {
    await new Promise((r) => setTimeout(r, 300));
    await waitForTabComplete(tab.id, 5000);
  }
  return { content: `Typed ${text.length} chars into ${selector}${press_enter ? ' + Enter' : ''}.` };
}

function typeInPage(selector, text, pressEnter, clear) {
  function resolve(sel) {
    const m = sel.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1], 10)]; if (el?.isConnected) return el; }
    try { return document.querySelector(sel); } catch { return null; }
  }
  const el = resolve(selector);
  if (!el) return { ok: false, error: `Element not found: ${selector}` };
  el.scrollIntoView({ block: 'center' });
  el.focus();
  const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  if (isInput) {
    const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    if (clear) setter.call(el, '');
    setter.call(el, (clear ? '' : el.value) + text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (el.isContentEditable) {
    if (clear) el.textContent = '';
    el.textContent += text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  } else {
    return { ok: false, error: 'Element is not editable' };
  }
  if (pressEnter) {
    const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keypress', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
    const form = el.closest && el.closest('form');
    if (form && el.tagName === 'INPUT') {
      try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch {}
    }
  }
  return { ok: true };
}

async function tool_keyPress({ keys, selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  await indicator(tab.id, { type: 'CC_TOAST', text: `Key: ${keys}` });
  const result = await execIsolated(tab.id, keyPressInPage, [keys, selector || null]);
  if (!result?.ok) return { is_error: true, content: result?.error || 'Key press failed' };
  return { content: `Sent keys: ${keys}` };
}

function keyPressInPage(keys, selector) {
  let target = document.activeElement || document.body;
  if (selector) {
    const m = selector.match(/^#ref-(\d+)$/);
    let el = null;
    if (m && window.__claudeRefs__) el = window.__claudeRefs__[parseInt(m[1], 10)];
    if (!el) try { el = document.querySelector(selector); } catch {}
    if (!el) return { ok: false, error: 'Selector not found' };
    el.focus();
    target = el;
  }
  const parts = keys.split('+').map((s) => s.trim());
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1).map((s) => s.toLowerCase()));
  const opts = {
    bubbles: true, cancelable: true,
    key, code: keyToCode(key),
    ctrlKey: mods.has('ctrl') || mods.has('control'),
    metaKey: mods.has('meta') || mods.has('cmd') || mods.has('command'),
    altKey: mods.has('alt') || mods.has('option'),
    shiftKey: mods.has('shift'),
    keyCode: keyToCode(key, true),
    which: keyToCode(key, true),
  };
  target.dispatchEvent(new KeyboardEvent('keydown', opts));
  target.dispatchEvent(new KeyboardEvent('keypress', opts));
  target.dispatchEvent(new KeyboardEvent('keyup', opts));
  return { ok: true };

  function keyToCode(k, asNumber) {
    const map = { Enter: 'Enter', Escape: 'Escape', Tab: 'Tab', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Backspace: 'Backspace', Delete: 'Delete', Space: 'Space' };
    const numMap = { Enter: 13, Escape: 27, Tab: 9, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, Delete: 46, Space: 32 };
    if (asNumber) return numMap[k] || (k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0);
    return map[k] || (k.length === 1 ? `Key${k.toUpperCase()}` : k);
  }
}

async function tool_selectOption({ selector, value, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  await highlightAndPoint(tab.id, selector, `Select "${value}"`);
  const result = await execIsolated(tab.id, selectOptionInPage, [selector, value]);
  await indicator(tab.id, { type: 'CC_UNHIGHLIGHT' });
  if (!result?.ok) return { is_error: true, content: result?.error || 'Select failed' };
  return { content: `Selected "${result.chosen}".` };
}

function selectOptionInPage(selector, value) {
  function resolve(sel) {
    const m = sel.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1], 10)]; if (el?.isConnected) return el; }
    try { return document.querySelector(sel); } catch { return null; }
  }
  const el = resolve(selector);
  if (!el) return { ok: false, error: 'Not found' };
  if (el.tagName !== 'SELECT') return { ok: false, error: 'Not a <select>' };
  let chosen = null;
  for (const opt of el.options) {
    if (opt.value === value || opt.textContent.trim() === value) { chosen = opt; break; }
  }
  if (!chosen) return { ok: false, error: `Option "${value}" not found` };
  el.value = chosen.value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, chosen: chosen.textContent.trim() };
}

async function tool_fillForm({ fields, tab_id, submit = false }) {
  if (!Array.isArray(fields) || !fields.length) return { is_error: true, content: 'fields[] required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  await indicator(tab.id, { type: 'CC_TOAST', text: `Fill ${fields.length} field(s)` });
  const result = await execIsolated(tab.id, fillFormInPage, [fields, submit]);
  if (!result?.ok) return { is_error: true, content: result?.error || 'Fill failed' };
  return { content: `Filled ${result.filled}/${fields.length} fields${submit ? ', submitted' : ''}. ${result.errors?.length ? 'Errors: ' + result.errors.join('; ') : ''}` };
}

function fillFormInPage(fields, submit) {
  function resolve(sel) {
    const m = sel.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1], 10)]; if (el?.isConnected) return el; }
    try { return document.querySelector(sel); } catch { return null; }
  }
  // Find the actual clickable surface for a hidden checkbox/radio.
  // Custom UI (Tailwind, Radix, MUI, shadcn, demoqa, etc) hides the real
  // <input> with display:none/opacity:0 and binds events to a <label> or
  // sibling <span>/<div> wrapper. Plain `input.checked = true` updates DOM
  // state but never fires the framework listeners on the visible surface.
  function findClickableSurface(input) {
    if (!input) return null;
    // 1) Explicit <label for="id">
    if (input.id) {
      try {
        const lab = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (lab) return lab;
      } catch {}
    }
    // 2) Wrapping label
    const wrappingLabel = input.closest('label');
    if (wrappingLabel) return wrappingLabel;
    // 3) ARIA / role wrapper (Radix, custom switches)
    let p = input.parentElement;
    for (let depth = 0; p && depth < 4; depth++, p = p.parentElement) {
      const role = p.getAttribute('role');
      if (role === 'checkbox' || role === 'radio' || role === 'switch') return p;
      if (p.hasAttribute('data-state') || p.hasAttribute('aria-checked')) return p;
    }
    // 4) Visible sibling/wrapper
    p = input.parentElement;
    if (p && getComputedStyle(input).display === 'none') {
      // Pick first visible child of the parent that's not the input itself.
      for (const child of p.children) {
        if (child === input) continue;
        const cs = getComputedStyle(child);
        if (cs.display !== 'none' && cs.visibility !== 'hidden') return child;
      }
      return p;
    }
    return input;
  }

  // Dispatch the full pointer/click sequence so all framework listeners fire.
  function fireClickSequence(target) {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const x = r.left + Math.max(2, r.width / 2);
    const y = r.top + Math.max(2, r.height / 2);
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
    try { target.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse', isPrimary: true })); } catch {}
    try { target.dispatchEvent(new MouseEvent('mousedown', opts)); } catch {}
    try { target.dispatchEvent(new PointerEvent('pointerup',   { ...opts, pointerType: 'mouse', isPrimary: true })); } catch {}
    try { target.dispatchEvent(new MouseEvent('mouseup',   opts)); } catch {}
    try { target.click(); } catch {
      try { target.dispatchEvent(new MouseEvent('click', opts)); } catch {}
    }
  }

  function setRadioOrCheck(input, kind, desiredChecked) {
    const surface = findClickableSurface(input);
    const beforeChecked = !!input.checked;
    // Direct toggling only works for native checkboxes — for hidden inputs
    // it bypasses framework state. Always prefer click on the surface.
    if (surface !== input || (input.tagName !== 'INPUT')) {
      if (kind === 'radio' || (kind === 'check' && desiredChecked !== beforeChecked)) {
        fireClickSequence(surface);
      } else {
        // Already in desired state — no-op
      }
    } else {
      // Native input visible — flip + fire events
      if (kind === 'radio') {
        input.checked = true;
      } else {
        input.checked = desiredChecked;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Verify after a microtask gap (frameworks often re-render synchronously
    // off the click event)
    const final = !!input.checked
      || input.getAttribute('aria-checked') === 'true'
      || (input.parentElement && input.parentElement.getAttribute('data-state') === 'checked');
    return { ok: kind === 'radio' ? final : final === !!desiredChecked, before: beforeChecked, after: final };
  }

  let filled = 0;
  const errors = [];
  let lastEl = null;
  for (const f of fields) {
    const el = resolve(f.selector);
    if (!el) { errors.push(`${f.selector}: not found`); continue; }
    lastEl = el;
    el.scrollIntoView({ block: 'center' });
    const t = (f.type || '').toLowerCase();
    try {
      if (t === 'check' || t === 'checkbox') {
        const desired = !!f.value && f.value !== 'false' && f.value !== 'no' && f.value !== '0';
        const r = setRadioOrCheck(el, 'check', desired);
        if (!r.ok) {
          errors.push(`${f.selector}: checkbox not toggled (before=${r.before}, after=${r.after})`);
          continue;
        }
      } else if (t === 'radio') {
        const r = setRadioOrCheck(el, 'radio', true);
        if (!r.ok) {
          errors.push(`${f.selector}: radio not selected (after=${r.after})`);
          continue;
        }
      } else if (t === 'select' || el.tagName === 'SELECT') {
        let chosen = null;
        for (const opt of el.options) if (opt.value === f.value || opt.textContent.trim() === f.value) { chosen = opt; break; }
        if (!chosen) { errors.push(`${f.selector}: option "${f.value}" not found`); continue; }
        el.value = chosen.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.focus();
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
          setter.call(el, f.value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.isContentEditable) {
          el.textContent = f.value;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, data: f.value }));
        } else {
          errors.push(`${f.selector}: not editable`);
          continue;
        }
      }
      filled++;
    } catch (e) {
      errors.push(`${f.selector}: ${e.message}`);
    }
  }
  if (submit && lastEl) {
    const form = lastEl.closest('form');
    if (form) try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch {}
  }
  return { ok: true, filled, errors };
}

async function tool_scroll({ direction, amount = 600, selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  await indicator(tab.id, { type: 'CC_TOAST', text: `Scroll ${direction}` });
  const result = await execIsolated(tab.id, scrollInPage, [direction, amount, selector || null]);
  if (!result?.ok) return { is_error: true, content: result?.error || 'Scroll failed' };
  return { content: `Scrolled ${direction}. y=${result.y}/${result.max}.` };
}

function scrollInPage(direction, amount, selector) {
  if (direction === 'into_view') {
    if (!selector) return { ok: false, error: 'into_view requires selector' };
    let el = null;
    const m = selector.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) el = window.__claudeRefs__[parseInt(m[1], 10)];
    if (!el) try { el = document.querySelector(selector); } catch {}
    if (!el) return { ok: false, error: 'not found' };
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return { ok: true, y: window.scrollY, max: document.documentElement.scrollHeight };
  }
  let target = window;
  let getY = () => window.scrollY;
  let max = () => document.documentElement.scrollHeight;
  if (selector) {
    let el = null;
    const m = selector.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) el = window.__claudeRefs__[parseInt(m[1], 10)];
    if (!el) try { el = document.querySelector(selector); } catch {}
    if (el) { target = el; getY = () => el.scrollTop; max = () => el.scrollHeight; }
  }
  if (direction === 'top') target.scrollTo ? target.scrollTo(0, 0) : (target.scrollTop = 0);
  else if (direction === 'bottom') { const m = max(); target.scrollTo ? target.scrollTo(0, m) : (target.scrollTop = m); }
  else if (direction === 'down') target.scrollBy ? target.scrollBy(0, amount) : (target.scrollTop += amount);
  else if (direction === 'up') target.scrollBy ? target.scrollBy(0, -amount) : (target.scrollTop -= amount);
  return { ok: true, y: getY(), max: max() };
}

// =====================================================================
// PAGE-LEVEL TOOLS
// =====================================================================

async function tool_waitFor({ selector, text_contains, timeout_ms = 5000, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const cap = Math.min(10000, Math.max(100, timeout_ms || 5000));
  await indicator(tab.id, { type: 'CC_TOAST', text: `Wait for ${selector}` });
  const result = await execIsolated(tab.id, waitForInPage, [selector, text_contains || null, cap]);
  if (!result?.ok) return { is_error: true, content: result?.error || `Timed out after ${cap}ms.` };
  return { content: `Found ${selector}${result.text ? ` ("${result.text.slice(0, 60)}")` : ''} after ${result.elapsed}ms.` };
}

function waitForInPage(selector, textContains, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      let el = null;
      try { el = document.querySelector(selector); } catch {}
      if (el) {
        if (!textContains) return resolve({ ok: true, elapsed: Date.now() - start });
        const t = (el.innerText || el.textContent || '').toLowerCase();
        if (t.includes(textContains.toLowerCase())) return resolve({ ok: true, elapsed: Date.now() - start, text: el.innerText?.slice(0, 100) });
      }
      if (Date.now() - start > timeoutMs) return resolve({ ok: false, error: 'timeout' });
      setTimeout(check, 200);
    }
    check();
  });
}

async function tool_wait({ ms = 1000 }) {
  const cap = Math.max(0, Math.min(5000, ms));
  await new Promise((r) => setTimeout(r, cap));
  return { content: `Waited ${cap}ms.` };
}

// Track recent navigations per tab to detect runaway loops
const _NAV_HISTORY = new Map(); // tabId -> [{url, ts}]
const _NAV_LIMIT = 8;       // max nav within window
const _NAV_WINDOW_MS = 30000; // 30 seconds

async function tool_navigate({ url, tab_id }) {
  if (!/^https?:\/\//i.test(url)) {
    if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) url = 'https://' + url;
    else return { is_error: true, content: 'URL must be http(s).' };
  }
  const tab = await resolveTab(tab_id);

  // Rate-limit: prevent runaway navigation loops
  const now = Date.now();
  const history = (_NAV_HISTORY.get(tab.id) || []).filter(h => now - h.ts < _NAV_WINDOW_MS);
  if (history.length >= _NAV_LIMIT) {
    return {
      is_error: true,
      content: `🛑 Navigation rate limit: ${_NAV_LIMIT} navigations in ${_NAV_WINDOW_MS / 1000}s on tab ${tab.id}. ` +
               `This usually means the agent is stuck in a redirect/reload loop. ` +
               `Recent: ${history.slice(-3).map(h => h.url).join(' → ')}\n` +
               `Wait ${Math.ceil((_NAV_WINDOW_MS - (now - history[0].ts)) / 1000)}s before navigating again.`,
    };
  }
  history.push({ url, ts: now });
  _NAV_HISTORY.set(tab.id, history);

  await indicator(tab.id, { type: 'CC_TOAST', text: `→ ${url}` });
  await chrome.tabs.update(tab.id, { url });
  await waitForTabComplete(tab.id, 20000);
  await new Promise((r) => setTimeout(r, 400));
  // SPA settle — for known SPAs the URL changes well before main content mounts
  await spaSettle(tab.id, url).catch(() => {});
  const updated = await chrome.tabs.get(tab.id);
  return { content: `Navigated to ${updated.url}. Title: ${updated.title || '(loading)'}` };
}

// SPA-aware settle: wait for main content to mount + DOM to stabilize.
// Most SPAs (YouTube, Twitter, Reddit, etc) route synchronously but render
// asynchronously, so a plain "tab complete" event fires before the page
// the user actually sees. We poll for a specific primary-content selector
// per host, then verify two consecutive DOM-size samples match.
async function spaSettle(tabId, url) {
  const SETTLE_RULES = [
    { test: /youtube\.com\/watch/, selectors: ['ytd-watch-flexy:not([hidden]) #title', '#movie_player video', 'h1.ytd-watch-metadata'], timeout: 4500 },
    { test: /youtube\.com\/(results|@|c\/|channel\/)/, selectors: ['ytd-search', 'ytd-section-list-renderer', '#contents ytd-video-renderer, #contents ytd-channel-renderer'], timeout: 3500 },
    { test: /(twitter|x)\.com/, selectors: ['main [data-testid="primaryColumn"] article', 'main [role="region"]'], timeout: 3500 },
    { test: /reddit\.com/, selectors: ['shreddit-app main', '[slot="post-container"]', 'main'], timeout: 3500 },
    { test: /github\.com/, selectors: ['main', '#repo-content-pjax-container'], timeout: 2500 },
    { test: /linkedin\.com/, selectors: ['main'], timeout: 2500 },
  ];
  let rule = null;
  for (const r of SETTLE_RULES) if (r.test.test(url)) { rule = r; break; }
  if (!rule) return;
  // Poll for one of the selectors to appear
  const deadline = Date.now() + rule.timeout;
  while (Date.now() < deadline) {
    const r = await execIsolated(tabId, (sels) => {
      for (const s of sels) {
        try {
          const el = document.querySelector(s);
          if (el && el.getBoundingClientRect().height > 30) return { found: true, html_size: document.documentElement.outerHTML.length };
        } catch {}
      }
      return { found: false };
    }, [rule.selectors]).catch(() => null);
    if (r?.found) {
      // Verify DOM stability — two consecutive identical sizes
      const size1 = r.html_size;
      await new Promise((res) => setTimeout(res, 250));
      const r2 = await execIsolated(tabId, () => document.documentElement.outerHTML.length).catch(() => null);
      if (r2 && Math.abs(r2 - size1) < size1 * 0.05) return; // <5% delta = stable
    }
    await new Promise((res) => setTimeout(res, 200));
  }
}

async function tool_back({ tab_id }) {
  const tab = await resolveTab(tab_id);
  await chrome.tabs.goBack(tab.id).catch(() => {});
  await waitForTabComplete(tab.id, 5000);
  const updated = await chrome.tabs.get(tab.id);
  return { content: `Back. URL: ${updated.url}` };
}

async function tool_forward({ tab_id }) {
  const tab = await resolveTab(tab_id);
  await chrome.tabs.goForward(tab.id).catch(() => {});
  await waitForTabComplete(tab.id, 5000);
  const updated = await chrome.tabs.get(tab.id);
  return { content: `Forward. URL: ${updated.url}` };
}

async function tool_reload({ tab_id, bypass_cache = false }) {
  const tab = await resolveTab(tab_id);
  await chrome.tabs.reload(tab.id, { bypassCache: !!bypass_cache });
  await waitForTabComplete(tab.id, 15000);
  return { content: `Reloaded${bypass_cache ? ' (hard)' : ''}.` };
}

async function tool_screenshot({ tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  await indicator(tab.id, { type: 'CC_TOAST', text: 'Capturing screenshot…' });
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) return { is_error: true, content: 'Capture failed.' };
  return {
    content: [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      { type: 'text', text: `Screenshot of ${tab.url}.` },
    ],
    _dataUrl: dataUrl,
  };
}

async function tool_executeJs({ code, tab_id }) {
  if (!code) return { is_error: true, content: 'code is required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  // First try isolated world (own JS sandbox, immune to page CSP for `new Function`)
  let result;
  try {
    result = await execIsolated(tab.id, executeJsInPage, [code]);
  } catch (e) {
    result = { error: e.message };
  }
  // If isolated world failed, try MAIN world via scripting.executeScript.
  // MAIN world IS subject to page Trusted Types policy though, so this can
  // fail on YouTube/Google with "require-trusted-types-for 'script'".
  // The MAIN-world helper now installs a TT policy first to handle that.
  if (result?.error) {
    try {
      const [{ result: r2 }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: executeJsInMainWorld,
        args: [code],
      });
      result = r2;
    } catch (e) {
      result = { error: 'isolated+main both failed: ' + e.message };
    }
  }
  // Final fallback: chrome.debugger / CDP (bypasses CSP + Trusted Types)
  // Triggered by any of: CSP, unsafe-eval, sandbox, "Trusted Type" assignment errors.
  if (result?.error && /csp|content security policy|unsafe-eval|sandbox|trusted type|trustedtypes/i.test(result.error)) {
    try {
      result = await executeJsViaCdp(tab.id, code);
    } catch (e) {
      result = { error: result.error + ' | CDP fallback: ' + e.message };
    }
  }
  if (result?.error) return { is_error: true, content: `JS error: ${result.error}` };
  let out = '';
  try { out = typeof result.value === 'string' ? result.value : JSON.stringify(result.value, null, 2); }
  catch { out = String(result.value); }
  return { content: out.slice(0, 4000) || '(returned undefined)' };
}

async function executeJsViaCdp(tabId, code) {
  // Attach debugger; auto-detach on completion.
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    const wrapped = `(async () => { ${code} })()`;
    const res = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: wrapped,
      awaitPromise: true,
      returnByValue: true,
      allowUnsafeEvalBlockedByCSP: true,
      userGesture: true,
    });
    if (res?.exceptionDetails) {
      return { error: res.exceptionDetails.text + (res.exceptionDetails.exception?.description ? ': ' + res.exceptionDetails.exception.description : '') };
    }
    return { value: res?.result?.value };
  } finally {
    try { await chrome.debugger.detach({ tabId }); } catch {}
  }
}

// Isolated-world variant — runs in extension's own JS world, bypasses page CSP/TT.
function executeJsInPage(code) {
  try {
    const fn = new Function(`return (async () => { ${code} })();`);
    return fn().then((v) => ({ value: v })).catch((e) => ({ error: e.message }));
  } catch (e) {
    return { error: e.message };
  }
}

// MAIN-world variant — runs in the page's JS world, IS subject to page CSP /
// Trusted Types. We register a permissive TT policy first so `new Function`
// is allowed. If TT is enforced and policy can't be created, the error message
// will mention "Trusted Type" which triggers the CDP fallback upstream.
function executeJsInMainWorld(code) {
  try {
    // Some pages enforce trustedTypes.createPolicy("policyName") restrictions
    // via require-trusted-types-for + trusted-types <names> CSP. If our
    // policy name isn't in the allow-list, createPolicy throws — we catch
    // and let the error propagate so CDP fallback handles it.
    if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
      // Use a stable name so we don't leak duplicate policies on repeated runs.
      const POLICY_NAME = 'mb-eval';
      try {
        // If already registered (re-run), getPolicy isn't standard but
        // createPolicy throws for duplicates → we just ignore.
        if (!window.__mbTTPolicy__) {
          window.__mbTTPolicy__ = trustedTypes.createPolicy(POLICY_NAME, {
            createScript: (s) => s,
            createScriptURL: (s) => s,
            createHTML: (s) => s,
          });
        }
      } catch (e) {
        // Duplicate policy or CSP doesn't allow this name — proceed anyway,
        // some pages still let `new Function` through if no enforcement.
      }
    }
    const fn = new Function(`return (async () => { ${code} })();`);
    return fn().then((v) => ({ value: v })).catch((e) => ({ error: e.message }));
  } catch (e) {
    return { error: e.message };
  }
}

// =====================================================================
// TAB MANAGEMENT
// =====================================================================

async function tool_listTabs({ all_windows = false }) {
  const opts = all_windows ? {} : { currentWindow: true };
  const tabs = await chrome.tabs.query(opts);
  const sig = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  // Structured + human-readable output. JSON block prevents the model from
  // hallucinating "clean — nothing to commit" or other invented strings.
  const tabData = tabs.map((t) => ({
    id: t.id,
    url: t.url || '(blank)',
    title: t.title || '',
    active: !!t.active,
    audible: !!t.audible,
    pinned: !!t.pinned,
    window_id: t.windowId,
  }));
  const lines = [
    `MOONBRIDGE_LIST_TABS [sig=${sig}] count=${tabs.length}`,
    '```json',
    JSON.stringify(tabData, null, 2),
    '```',
  ];
  for (const t of tabs) {
    const flags = [];
    if (t.active) flags.push('active');
    if (t.audible) flags.push('audible');
    if (t.pinned) flags.push('pinned');
    const flagStr = flags.length ? ` [${flags.join(',')}]` : '';
    lines.push(`id=${t.id}${flagStr}\n   ${t.url || '(blank)'}\n   ${t.title || ''}`);
  }
  return { content: lines.join('\n') };
}

async function tool_switchTab({ tab_id }) {
  if (!Number.isFinite(tab_id)) return { is_error: true, content: 'tab_id required.' };
  const tab = await chrome.tabs.get(tab_id);
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
  return { content: `Switched to tab ${tab.id}: ${tab.url}` };
}

async function tool_newTab({ url, background = false }) {
  const opts = { active: !background };
  if (url) opts.url = /^https?:\/\//i.test(url) ? url : (/^[\w.-]+\.[a-z]{2,}/i.test(url) ? 'https://' + url : url);
  const tab = await chrome.tabs.create(opts);
  if (opts.url) await waitForTabComplete(tab.id, 20000);
  const updated = await chrome.tabs.get(tab.id);
  return { content: `Opened tab id=${updated.id} url=${updated.url || '(blank)'}` };
}

async function tool_closeTab({ tab_id }) {
  let id = tab_id;
  if (!Number.isFinite(id)) { const t = await getActiveTab(); id = t.id; }
  await chrome.tabs.remove(id);
  return { content: `Closed tab ${id}.` };
}

async function tool_duplicateTab({ tab_id }) {
  let id = tab_id;
  if (!Number.isFinite(id)) { const t = await getActiveTab(); id = t.id; }
  const tab = await chrome.tabs.duplicate(id);
  return { content: `Duplicated tab ${id} → new tab id=${tab.id}` };
}

// ===== Combo tools =====

async function tool_clickAndRead({ selector, wait_ms = 800, max_chars = 2500, tab_id, focus = 'auto' }) {
  const r1 = await tool_click({ selector, tab_id });
  if (r1.is_error) return r1;
  // SPA click might trigger client-side route change without a full nav.
  // Wait the requested ms, then settle if URL changed (typical YouTube card click).
  const tab = await resolveTab(tab_id);
  const before = tab.url;
  await new Promise((res) => setTimeout(res, Math.min(3000, Math.max(0, wait_ms))));
  try {
    const after = await chrome.tabs.get(tab.id);
    if (after.url && after.url !== before) {
      await spaSettle(tab.id, after.url).catch(() => {});
    }
  } catch {}
  const r2 = await tool_getPage({ max_chars, tab_id, focus });
  return { content: `${r1.content}\n\n${r2.content}` };
}

async function tool_navigateAndRead({ url, max_chars = 2500, tab_id, focus = 'auto' }) {
  const r1 = await tool_navigate({ url, tab_id });
  if (r1.is_error) return r1;
  const r2 = await tool_getPage({ max_chars, tab_id, focus });
  return { content: `${r1.content}\n\n${r2.content}` };
}

// =====================================================================
// WEB SEARCH (DuckDuckGo HTML scrape — no API key)
// =====================================================================

async function tool_webSearch({ query, limit = 8 }) {
  if (!query) return { is_error: true, content: 'query is required.' };
  const max = Math.min(15, Math.max(1, limit || 8));
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  let html;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
    });
    if (!res.ok) return { is_error: true, content: `Search failed: HTTP ${res.status}` };
    html = await res.text();
  } catch (e) {
    return { is_error: true, content: `Search network error: ${e.message}` };
  }
  // Parse with DOMParser (allowed in extension context)
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const results = [];
  for (const r of doc.querySelectorAll('.result')) {
    const a = r.querySelector('.result__a');
    const snip = r.querySelector('.result__snippet');
    if (!a) continue;
    let href = a.getAttribute('href') || '';
    // DDG wraps in /l/?uddg=
    const m = href.match(/uddg=([^&]+)/);
    if (m) try { href = decodeURIComponent(m[1]); } catch {}
    results.push({
      title: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      url: href,
      snippet: (snip?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 280),
    });
    if (results.length >= max) break;
  }
  if (!results.length) return { content: `No results for "${query}".` };
  const lines = [`Top ${results.length} results for "${query}":`];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`\n${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`);
  }
  return { content: lines.join('\n') };
}

// =====================================================================
// YOUTUBE TRANSCRIPT
// =====================================================================

function extractYoutubeId(input) {
  if (!input) return null;
  if (/^[\w-]{11}$/.test(input)) return input;
  const u = input.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/);
  return u ? u[1] : null;
}

async function tool_youtubeTranscript({ url, lang = 'en' }) {
  const vid = extractYoutubeId(url);
  if (!vid) return { is_error: true, content: 'Could not extract YouTube video id.' };
  // Strategy: fetch watch page, parse captionTracks JSON, fetch first matching lang
  let html;
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${vid}`);
    html = await res.text();
  } catch (e) {
    return { is_error: true, content: `YouTube fetch failed: ${e.message}` };
  }
  // Find ytInitialPlayerResponse → captionTracks
  const m = html.match(/"captionTracks":(\[.*?\])/);
  if (!m) return { is_error: true, content: 'No captions found for this video.' };
  let tracks = [];
  try { tracks = JSON.parse(m[1].replace(/\\u0026/g, '&').replace(/\\"/g, '"')); }
  catch {
    try { tracks = JSON.parse(m[1]); } catch {}
  }
  if (!tracks.length) return { is_error: true, content: 'Caption tracks unparseable.' };
  let pick = tracks.find((t) => t.languageCode === lang);
  if (!pick) pick = tracks.find((t) => (t.languageCode || '').startsWith(lang));
  if (!pick) pick = tracks[0];
  let trackUrl = pick.baseUrl;
  if (!trackUrl) return { is_error: true, content: 'Caption URL missing.' };
  trackUrl = trackUrl.replace(/\\u0026/g, '&');
  let xml;
  try {
    const res = await fetch(trackUrl);
    xml = await res.text();
  } catch (e) {
    return { is_error: true, content: `Caption fetch failed: ${e.message}` };
  }
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const segs = doc.querySelectorAll('text');
  const lines = [];
  for (const s of segs) {
    const t = (s.textContent || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
    if (t) lines.push(t);
  }
  if (!lines.length) return { content: 'Empty transcript.' };
  const text = lines.join(' ');
  const limit = 18000;
  return {
    content: `Transcript of ${vid} (${pick.languageCode}, ${lines.length} segments, ${text.length} chars):\n\n${text.slice(0, limit)}${text.length > limit ? '\n\n[truncated]' : ''}`,
  };
}

// =====================================================================
// READ PDF (uses chrome offscreen + pdf.js if available, fallback: simple text scan)
// =====================================================================

async function tool_readPdf({ url, max_chars = 20000 }) {
  if (!url) return { is_error: true, content: 'url is required.' };
  let buf;
  try {
    const res = await fetch(url);
    if (!res.ok) return { is_error: true, content: `Fetch failed: HTTP ${res.status}` };
    buf = await res.arrayBuffer();
  } catch (e) {
    return { is_error: true, content: `Fetch error: ${e.message}` };
  }
  // Best-effort raw text extraction (works for many PDFs without pdf.js)
  const bytes = new Uint8Array(buf);
  // Decode as latin1 to preserve binary
  let raw = '';
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
  // Extract text between "BT ... ET" blocks
  const pieces = [];
  const btRe = /BT\s+([\s\S]*?)\s+ET/g;
  let m;
  while ((m = btRe.exec(raw)) !== null) {
    const block = m[1];
    // Tj operators with parenthesized strings
    const tjRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*(?:T[Jj])/g;
    let t;
    while ((t = tjRe.exec(block)) !== null) {
      let s = t[1];
      // Decode common escapes
      s = s.replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\t/g, '\t');
      if (s.trim()) pieces.push(s);
    }
  }
  const text = pieces.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return { content: '(PDF contained no extractable text — may be scanned/image-only)' };
  return { content: `PDF text (${pieces.length} fragments, ${text.length} chars):\n\n${text.slice(0, max_chars)}${text.length > max_chars ? '\n\n[truncated]' : ''}` };
}

// =====================================================================
// FETCH URL — generic readable text
// =====================================================================

async function tool_fetchUrl({ url, max_chars = 12000, use_cookies = false, tab_id, method = 'GET', headers = {}, body = null }) {
  if (!url) return { is_error: true, content: 'url is required.' };

  const fetchOpts = {
    method,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoonBridge/1.0)', ...headers },
  };
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOpts.body = body;
  }

  // Honor cookies from a tab — addresses AI feedback "scraping behind-login jadi jauh lebih mudah"
  if (use_cookies) {
    try {
      let targetUrl = url;
      let targetCookies;
      if (tab_id) {
        const tab = await chrome.tabs.get(tab_id);
        targetCookies = await chrome.cookies.getAll({ url: targetUrl });
      } else {
        targetCookies = await chrome.cookies.getAll({ url });
      }
      if (targetCookies.length) {
        const cookieStr = targetCookies.map(c => `${c.name}=${c.value}`).join('; ');
        fetchOpts.headers['Cookie'] = cookieStr;
        fetchOpts.credentials = 'include';
      }
    } catch (e) {
      // Cookie attach failed — continue without (fetch_url shouldn't hard-fail just because cookies)
    }
  }

  let res;
  try { res = await fetch(url, fetchOpts); }
  catch (e) { return { is_error: true, content: `Fetch error: ${e.message}` }; }
  if (!res.ok) return { is_error: true, content: `HTTP ${res.status}: ${res.statusText}` };

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const cookieNote = use_cookies && fetchOpts.headers['Cookie'] ? `\n[cookies: ${fetchOpts.headers['Cookie'].split(';').length} sent]` : '';

  if (ct.includes('application/json')) {
    let j;
    try { j = await res.json(); } catch { j = await res.text(); }
    const out = typeof j === 'string' ? j : JSON.stringify(j, null, 2);
    return { content: out.slice(0, max_chars) + (out.length > max_chars ? '\n[truncated]' : '') + cookieNote };
  }
  if (ct.startsWith('text/') || ct.includes('xml') || ct.includes('html')) {
    let html = await res.text();
    if (ct.includes('html')) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, noscript, iframe').forEach((n) => n.remove());
      const txt = (doc.body?.innerText || doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
      return { content: txt.slice(0, max_chars) + (txt.length > max_chars ? '\n[truncated]' : '') + cookieNote };
    }
    return { content: html.slice(0, max_chars) + (html.length > max_chars ? '\n[truncated]' : '') + cookieNote };
  }
  return { is_error: true, content: `Unsupported content-type: ${ct}` };
}

// =====================================================================
// DOWNLOAD / SAVE
// =====================================================================

async function tool_downloadFile({ url, filename, wait = true, timeout_ms = 8000 }) {
  if (!url) return { is_error: true, content: 'url is required.' };
  let id;
  try {
    const opts = { url };
    if (filename) opts.filename = filename;
    id = await chrome.downloads.download(opts);
  } catch (e) {
    return { is_error: true, content: `Download failed: ${e.message}` };
  }
  if (!wait) {
    return { content: `Started download (id=${id}).${filename ? ' Filename: ' + filename : ''} Use download_status(${id}) to check.` };
  }
  // Auto-poll until terminal state or timeout
  const result = await waitForDownload(id, timeout_ms);
  if (result.error) return { is_error: true, error_code: ERR_CODES.EXEC_FAILED,
                              content: `Download id=${id} failed: ${result.error}` };
  if (result.state === 'complete') {
    return { content: `Downloaded id=${id}: ${result.filename} (${result.bytes} bytes).` };
  }
  return { content: `Started download (id=${id}, state=${result.state}). Still in progress after ${timeout_ms}ms — call download_status(${id}) later.` };
}

async function tool_downloadStatus({ id }) {
  if (id == null) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'id is required.' };
  try {
    const items = await chrome.downloads.search({ id });
    if (!items?.length) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: `No download with id=${id}.` };
    const d = items[0];
    const out = {
      id: d.id,
      state: d.state, // 'in_progress' | 'complete' | 'interrupted'
      filename: d.filename,
      url: d.finalUrl || d.url,
      mime: d.mime,
      total_bytes: d.totalBytes,
      bytes_received: d.bytesReceived,
      paused: !!d.paused,
      error: d.error || null,        // e.g. "NETWORK_FAILED", "FILE_NO_SPACE"
      start_time: d.startTime,
      end_time: d.endTime || null,
    };
    return { content: JSON.stringify(out, null, 2) };
  } catch (e) {
    return { is_error: true, content: `download_status failed: ${e.message}` };
  }
}

// Wait for a download to reach terminal state (complete | interrupted) or timeout.
function waitForDownload(id, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => { if (done) return; done = true; chrome.downloads.onChanged.removeListener(listener); resolve(val); };
    const listener = (delta) => {
      if (delta.id !== id) return;
      if (delta.state?.current === 'complete') {
        chrome.downloads.search({ id }).then((items) => {
          const d = items?.[0] || {};
          finish({ state: 'complete', filename: d.filename, bytes: d.bytesReceived });
        });
      } else if (delta.state?.current === 'interrupted') {
        chrome.downloads.search({ id }).then((items) => {
          const d = items?.[0] || {};
          finish({ state: 'interrupted', error: d.error || 'interrupted' });
        });
      }
    };
    chrome.downloads.onChanged.addListener(listener);
    // In case the download already completed before listener attached:
    chrome.downloads.search({ id }).then((items) => {
      const d = items?.[0];
      if (d?.state === 'complete') finish({ state: 'complete', filename: d.filename, bytes: d.bytesReceived });
      else if (d?.state === 'interrupted') finish({ state: 'interrupted', error: d.error || 'interrupted' });
    });
    setTimeout(() => finish({ state: 'in_progress' }), timeoutMs);
  });
}

async function tool_saveText({ filename, content }) {
  if (!filename) return { is_error: true, content: 'filename is required.' };
  try {
    const blob = new Blob([content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const id = await chrome.downloads.download({ url, filename });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { content: `Saved ${filename} (${(content || '').length} chars, id=${id}).` };
  } catch (e) {
    return { is_error: true, content: `Save failed: ${e.message}` };
  }
}

// =====================================================================
// WAIT FOR NETWORK IDLE
// =====================================================================

async function tool_waitForIdle({ tab_id, timeout_ms = 8000 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const cap = Math.min(20000, Math.max(500, timeout_ms || 8000));
  const result = await execIsolated(tab.id, waitForNetworkIdleInPage, [cap, 500]);
  if (!result?.ok) return { is_error: true, content: result?.error || 'Timeout' };
  return { content: `Network idle after ${result.elapsed}ms.` };
}

function waitForNetworkIdleInPage(timeoutMs, idleMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    let lastActivity = Date.now();
    let pending = 0;
    let observer = null;
    const origFetch = window.fetch;
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    function bump() { lastActivity = Date.now(); }
    try {
      window.fetch = function (...args) {
        pending++; bump();
        return origFetch.apply(this, args).finally(() => { pending--; bump(); });
      };
      XMLHttpRequest.prototype.send = function (...args) {
        pending++; bump();
        this.addEventListener('loadend', () => { pending--; bump(); });
        return origSend.apply(this, args);
      };
    } catch {}
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => bump());
      try { observer.observe(document.body, { childList: true, subtree: true, attributes: false }); } catch {}
    }
    function check() {
      const now = Date.now();
      if (now - start > timeoutMs) {
        cleanup();
        return resolve({ ok: false, error: 'timeout', elapsed: now - start });
      }
      if (pending === 0 && now - lastActivity > idleMs) {
        cleanup();
        return resolve({ ok: true, elapsed: now - start });
      }
      setTimeout(check, 200);
    }
    function cleanup() {
      try { window.fetch = origFetch; XMLHttpRequest.prototype.send = origSend; } catch {}
      try { observer?.disconnect(); } catch {}
    }
    setTimeout(check, 200);
  });
}

// =====================================================================
// MEMORY (uses ctx.memory adapter passed by agent.js)
// =====================================================================

async function tool_remember({ fact, category }, ctx) {
  if (!ctx?.memory) return { is_error: true, content: 'Memory not available.' };
  if (!fact || !fact.trim()) return { is_error: true, content: 'fact is required.' };
  const id = await ctx.memory.add(fact.trim(), category || 'general');
  return { content: `Remembered (id=${id}): ${fact.trim()}` };
}

async function tool_forget({ id }, ctx) {
  if (!ctx?.memory) return { is_error: true, content: 'Memory not available.' };
  const ok = await ctx.memory.remove(id);
  return { content: ok ? `Forgot ${id}.` : `No memory with id=${id}.` };
}

async function tool_recallMemories(ctx) {
  if (!ctx?.memory) return { is_error: true, content: 'Memory not available.' };
  const items = await ctx.memory.list();
  if (!items.length) return { content: '(No stored memories yet.)' };
  const lines = ['Stored memories:'];
  for (const m of items) lines.push(`- [${m.id}] (${m.category}) ${m.fact}`);
  return { content: lines.join('\n') };
}

// =====================================================================
// KNOWLEDGE BASE (uses ctx.kb adapter)
// =====================================================================

async function tool_searchKb({ query, limit = 5 }, ctx) {
  if (!ctx?.kb) return { is_error: true, content: 'Knowledge base not available.' };
  if (!query) return { is_error: true, content: 'query is required.' };
  const matches = await ctx.kb.search(query, Math.min(10, limit));
  if (!matches.length) return { content: `No KB matches for "${query}".` };
  const lines = [`KB results for "${query}":`];
  for (const m of matches) {
    lines.push(`\n--- ${m.name} ---`);
    lines.push(m.excerpt);
  }
  return { content: lines.join('\n') };
}

async function tool_listKb(ctx) {
  if (!ctx?.kb) return { is_error: true, content: 'Knowledge base not available.' };
  const files = await ctx.kb.list();
  if (!files.length) return { content: '(KB is empty.)' };
  const lines = ['Knowledge base files:'];
  for (const f of files) lines.push(`- ${f.name} (${f.kind}, ${f.size} bytes)`);
  return { content: lines.join('\n') };
}

// =====================================================================
// NETWORK LOG (fetch + XHR interceptor)
// =====================================================================

async function tool_networkLog({ tab_id, limit = 30, filter = null, clear = false }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const cap = Math.min(100, Math.max(1, limit || 30));
  const entries = await execIsolated(tab.id, networkLogInPage, [cap, filter, !!clear]);
  if (!entries?.length) return { content: '(network buffer empty — interceptor now installed; perform actions then call again)' };
  const lines = [`---NETWORK LOG (${entries.length})---`];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const dur = e.duration != null ? `${e.duration}ms` : '?';
    const sz = e.size != null ? `${e.size}b` : '?';
    lines.push(`[${i}] ${e.method} ${e.status || '...'} ${dur} ${sz}\n     ${e.url}`);
  }
  return { content: lines.join('\n') };
}

function networkLogInPage(limit, filter, doClear) {
  if (!window.__ccNetBuf__) {
    window.__ccNetBuf__ = [];
    const origFetch = window.fetch;
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input?.url;
      const method = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
      const start = performance.now();
      const entry = { method, url, status: null, size: null, duration: null, type: 'fetch', body: null, ts: Date.now() };
      window.__ccNetBuf__.push(entry);
      if (window.__ccNetBuf__.length > 200) window.__ccNetBuf__.shift();
      try {
        const res = await origFetch.apply(this, arguments);
        entry.status = res.status;
        entry.duration = Math.round(performance.now() - start);
        // Clone to read body without consuming
        try {
          const clone = res.clone();
          clone.text().then((t) => { entry.body = (t || '').slice(0, 200_000); entry.size = (t || '').length; }).catch(() => {});
        } catch {}
        return res;
      } catch (e) {
        entry.status = 0;
        entry.duration = Math.round(performance.now() - start);
        entry.error = e.message;
        throw e;
      }
    };
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__cc = { method: (method || 'GET').toUpperCase(), url, ts: Date.now(), start: 0 };
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      const e = this.__cc;
      if (e) {
        e.start = performance.now();
        const entry = { method: e.method, url: e.url, status: null, size: null, duration: null, type: 'xhr', body: null, ts: e.ts };
        window.__ccNetBuf__.push(entry);
        if (window.__ccNetBuf__.length > 200) window.__ccNetBuf__.shift();
        this.addEventListener('loadend', () => {
          entry.status = this.status;
          entry.duration = Math.round(performance.now() - e.start);
          try { entry.body = (this.responseText || '').slice(0, 200_000); entry.size = (this.responseText || '').length; } catch {}
        });
      }
      return origSend.apply(this, arguments);
    };
  }
  let entries = window.__ccNetBuf__.slice(-limit);
  if (filter) {
    const f = filter.toLowerCase();
    entries = entries.filter((e) => (e.url || '').toLowerCase().includes(f));
  }
  if (doClear) window.__ccNetBuf__ = [];
  // Return a copy WITHOUT body to keep tool result small
  return entries.map((e) => ({ method: e.method, url: e.url, status: e.status, size: e.size, duration: e.duration, type: e.type }));
}

async function tool_networkResponse({ tab_id, index, max_chars = 8000 }) {
  if (!Number.isFinite(index)) return { is_error: true, content: 'index is required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const result = await execIsolated(tab.id, networkResponseInPage, [index]);
  if (!result?.ok) return { is_error: true, content: result?.error || 'Not found' };
  const body = result.body || '';
  return { content: `[${result.method} ${result.status} ${result.url}]\n\n${body.slice(0, max_chars)}${body.length > max_chars ? '\n[truncated]' : ''}` };
}

function networkResponseInPage(index) {
  const buf = window.__ccNetBuf__ || [];
  const sliced = buf.slice(-100);
  const e = sliced[index];
  if (!e) return { ok: false, error: `index ${index} out of range (have ${sliced.length})` };
  return { ok: true, method: e.method, url: e.url, status: e.status, body: e.body || '' };
}

// =====================================================================
// SCREENSHOT DIFF (in-memory snapshots)
// =====================================================================

const _ccSnapshots = new Map(); // id -> { dataUrl, width, height, label, ts }

async function tool_screenshotSnapshot({ tab_id, label }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const id = 'snap_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  _ccSnapshots.set(id, { dataUrl, label: label || '', ts: Date.now(), tabId: tab.id });
  // Cap memory
  if (_ccSnapshots.size > 20) {
    const oldest = [..._ccSnapshots.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    _ccSnapshots.delete(oldest[0]);
  }
  return { content: `Snapshot saved (id=${id})${label ? ' "' + label + '"' : ''}.` };
}

async function tool_screenshotCompare({ snapshot_id, tab_id, threshold = 0.05 }) {
  const snap = _ccSnapshots.get(snapshot_id);
  if (!snap) return { is_error: true, content: `No snapshot with id=${snapshot_id}.` };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const dataUrl2 = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

  // Decode both with OffscreenCanvas in the sidepanel context
  const result = await diffImages(snap.dataUrl, dataUrl2, threshold);
  const lines = [
    `Compared snapshot ${snapshot_id}${snap.label ? ' "' + snap.label + '"' : ''} (taken ${formatAgo(snap.ts)} ago)`,
    `vs current tab.`,
    `Pixel difference: ${(result.diffRatio * 100).toFixed(2)}% (${result.diffPixels} / ${result.totalPixels} pixels)`,
    `Threshold: ${(threshold * 100).toFixed(1)}%`,
    `Verdict: ${result.diffRatio > threshold ? '⚠ DIFFERENT' : '✓ SAME'}`,
    result.bounds ? `Changed region: x=${result.bounds.x} y=${result.bounds.y} ${result.bounds.w}×${result.bounds.h}` : '',
  ].filter(Boolean);
  return {
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: result.diffPng } },
      { type: 'text', text: lines.join('\n') },
    ],
    _dataUrl: 'data:image/png;base64,' + result.diffPng,
  };
}

function formatAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  return Math.floor(s / 3600) + 'h';
}

async function diffImages(aUrl, bUrl, threshold) {
  const [a, b] = await Promise.all([loadImageBitmap(aUrl), loadImageBitmap(bUrl)]);
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(a, 0, 0, w, h);
  const dataA = ctx.getImageData(0, 0, w, h);
  ctx.drawImage(b, 0, 0, w, h);
  const dataB = ctx.getImageData(0, 0, w, h);

  const diffData = ctx.createImageData(w, h);
  let diffPixels = 0;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  const pxThr = 30; // allow small color diff per channel
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dr = Math.abs(dataA.data[i] - dataB.data[i]);
      const dg = Math.abs(dataA.data[i + 1] - dataB.data[i + 1]);
      const db = Math.abs(dataA.data[i + 2] - dataB.data[i + 2]);
      const isDiff = dr > pxThr || dg > pxThr || db > pxThr;
      if (isDiff) {
        diffPixels++;
        diffData.data[i] = 255;     // red
        diffData.data[i + 1] = 0;
        diffData.data[i + 2] = 0;
        diffData.data[i + 3] = 200;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      } else {
        // dim the original
        diffData.data[i] = Math.floor(dataB.data[i] * 0.4);
        diffData.data[i + 1] = Math.floor(dataB.data[i + 1] * 0.4);
        diffData.data[i + 2] = Math.floor(dataB.data[i + 2] * 0.4);
        diffData.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(diffData, 0, 0);
  // Draw bounding box if any
  let bounds = null;
  if (diffPixels > 0) {
    bounds = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;
    ctx.strokeRect(bounds.x + 1, bounds.y + 1, bounds.w - 2, bounds.h - 2);
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buf = await blob.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(bin);
  return {
    diffPixels,
    totalPixels: w * h,
    diffRatio: diffPixels / (w * h),
    bounds,
    diffPng: base64,
  };
}

async function loadImageBitmap(dataUrl) {
  return await createImageBitmap(dataUrlToBlob(dataUrl));
}

// Decode a data:image/...;base64,XXX URL straight to Blob without fetch().
// fetch(data:) is blocked by extension CSP connect-src in some Chrome builds.
function dataUrlToBlob(dataUrl) {
  const m = dataUrl.match(/^data:([^;,]+)(?:;([^,]+))?,(.*)$/);
  if (!m) throw new Error('not a data URL');
  const mime = m[1] || 'application/octet-stream';
  const isBase64 = (m[2] || '').includes('base64');
  const data = m[3] || '';
  if (isBase64) {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(data)], { type: mime });
}

// =====================================================================
// MULTI-WINDOW
// =====================================================================

async function tool_listWindows() {
  const wins = await chrome.windows.getAll({ populate: true });
  const lines = [`---WINDOWS (${wins.length})---`];
  for (const w of wins) {
    const flag = w.focused ? '* ' : '  ';
    lines.push(`${flag}id=${w.id}  type=${w.type}  state=${w.state}  tabs=${(w.tabs || []).length}`);
    for (const t of (w.tabs || []).slice(0, 5)) {
      lines.push(`     ${t.active ? '→' : ' '} tab ${t.id}: ${(t.title || '').slice(0, 60)}`);
    }
    if ((w.tabs || []).length > 5) lines.push(`     … +${w.tabs.length - 5} more`);
  }
  return { content: lines.join('\n') };
}

async function tool_newWindow({ url, type = 'normal', focused = true }) {
  const opts = { type, focused };
  if (url) opts.url = /^https?:\/\//i.test(url) ? url : (/^[\w.-]+\.[a-z]{2,}/i.test(url) ? 'https://' + url : url);
  const w = await chrome.windows.create(opts);
  return { content: `Opened window id=${w.id} type=${w.type}${url ? ' url=' + opts.url : ''}` };
}

async function tool_focusWindow({ window_id }) {
  if (!Number.isFinite(window_id)) return { is_error: true, content: 'window_id required.' };
  await chrome.windows.update(window_id, { focused: true });
  return { content: `Focused window ${window_id}.` };
}

async function tool_closeWindow({ window_id }) {
  if (!Number.isFinite(window_id)) return { is_error: true, content: 'window_id required.' };
  await chrome.windows.remove(window_id);
  return { content: `Closed window ${window_id}.` };
}

async function tool_moveTab({ tab_id, window_id, index = -1 }) {
  if (!Number.isFinite(tab_id)) return { is_error: true, content: 'tab_id required.' };
  const opts = { index };
  if (Number.isFinite(window_id)) opts.windowId = window_id;
  const tab = await chrome.tabs.move(tab_id, opts);
  return { content: `Moved tab ${tab.id} to window=${tab.windowId} index=${tab.index}.` };
}

// =====================================================================
// BATCH
// =====================================================================

async function tool_batch({ steps, continue_on_error = false }, ctx) {
  if (!Array.isArray(steps) || !steps.length) return { is_error: true, content: 'steps[] required.' };
  const lines = [`---BATCH (${steps.length} steps)---`];
  let okCount = 0, errCount = 0;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s?.tool) { lines.push(`[${i}] ✕ missing tool name`); errCount++; if (!continue_on_error) break; continue; }
    const t0 = Date.now();
    let r;
    try { r = await executeTool(s.tool, s.input || {}, ctx || {}); }
    catch (e) { r = { is_error: true, content: 'crash: ' + e.message }; }
    const dur = Date.now() - t0;
    if (r._dataUrl) delete r._dataUrl;
    const txt = typeof r.content === 'string' ? r.content : JSON.stringify(r.content);
    if (r.is_error) {
      errCount++;
      lines.push(`[${i}] ✕ ${s.tool} (${dur}ms): ${txt.slice(0, 120)}`);
      if (!continue_on_error) break;
    } else {
      okCount++;
      lines.push(`[${i}] ✓ ${s.tool} (${dur}ms): ${txt.slice(0, 120)}`);
    }
  }
  lines.push(`---DONE: ${okCount} ok, ${errCount} err---`);
  return { content: lines.join('\n') };
}

// =====================================================================
// PAGE SUMMARY (compact landmarks)
// =====================================================================

async function tool_pageSummary({ tab_id, max_chars = 1500 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const sum = await execIsolated(tab.id, pageSummaryInPage, [max_chars]);
  if (!sum) return { content: '(empty)' };
  const lines = [];
  lines.push(`URL: ${sum.url}`);
  lines.push(`TITLE: ${sum.title}`);
  if (sum.headings?.length) {
    lines.push('---HEADINGS---');
    for (const h of sum.headings) lines.push(`${h.level} ${h.text}`);
  }
  if (sum.inputs?.length) {
    lines.push('---PRIMARY INPUTS---');
    for (const i of sum.inputs) lines.push(`#ref-${i.ref} [${i.tag}] ${i.label}`);
  }
  if (sum.buttons?.length) {
    lines.push('---PRIMARY BUTTONS---');
    for (const b of sum.buttons) lines.push(`#ref-${b.ref} ${b.label}`);
  }
  if (sum.nav?.length) {
    lines.push('---NAV---');
    for (const n of sum.nav) lines.push(`#ref-${n.ref} ${n.label}`);
  }
  return { content: lines.join('\n').slice(0, max_chars) };
}

function pageSummaryInPage(maxChars) {
  function isVisible(el) {
    if (!el?.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function lab(el) {
    return (el.getAttribute('aria-label')
      || el.getAttribute('placeholder')
      || el.value
      || (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
      || el.title || ''
    ).slice(0, 80);
  }
  window.__claudeRefs__ = window.__claudeRefs__ || {};
  let ref = Object.keys(window.__claudeRefs__).length;
  const headings = [];
  for (const h of document.querySelectorAll('h1, h2, h3')) {
    if (!isVisible(h)) continue;
    const t = (h.innerText || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    headings.push({ level: '#'.repeat(parseInt(h.tagName[1])), text: t.slice(0, 80) });
    if (headings.length >= 15) break;
  }
  const inputs = [];
  for (const el of document.querySelectorAll('input:not([type=hidden]), textarea, select')) {
    if (!isVisible(el)) continue;
    ref++; window.__claudeRefs__[ref] = el;
    inputs.push({ ref, tag: el.tagName.toLowerCase(), label: lab(el) });
    if (inputs.length >= 12) break;
  }
  const buttons = [];
  for (const el of document.querySelectorAll('button, [role=button], input[type=submit]')) {
    if (!isVisible(el)) continue;
    ref++; window.__claudeRefs__[ref] = el;
    buttons.push({ ref, label: lab(el) });
    if (buttons.length >= 12) break;
  }
  const nav = [];
  for (const el of document.querySelectorAll('nav a, [role=navigation] a, header a')) {
    if (!isVisible(el)) continue;
    ref++; window.__claudeRefs__[ref] = el;
    nav.push({ ref, label: lab(el) });
    if (nav.length >= 10) break;
  }
  return { url: location.href, title: document.title, headings, inputs, buttons, nav };
}

// =====================================================================
// SCROLL UNTIL
// =====================================================================

async function tool_scrollUntil({ selector, text, max_scrolls = 20, tab_id }) {
  if (!selector && !text) return { is_error: true, content: 'selector or text required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const result = await execIsolated(tab.id, scrollUntilInPage, [selector || null, text || null, max_scrolls]);
  if (!result.found) return { content: `Scrolled ${result.scrolls} times — target not found.` };
  return { content: `Found after ${result.scrolls} scroll(s). y=${result.y}/${result.max}.` };
}

function scrollUntilInPage(selector, text, maxScrolls) {
  return new Promise((resolve) => {
    let scrolls = 0;
    function check() {
      if (selector) {
        let el = null;
        try { el = document.querySelector(selector); } catch {}
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return resolve({ found: true, scrolls, y: window.scrollY, max: document.documentElement.scrollHeight });
        }
      }
      if (text) {
        const t = text.toLowerCase();
        const body = (document.body?.innerText || '').toLowerCase();
        if (body.includes(t)) return resolve({ found: true, scrolls, y: window.scrollY, max: document.documentElement.scrollHeight });
      }
      if (scrolls >= maxScrolls) return resolve({ found: false, scrolls, y: window.scrollY, max: document.documentElement.scrollHeight });
      const before = window.scrollY;
      window.scrollBy(0, window.innerHeight * 0.85);
      scrolls++;
      setTimeout(() => {
        if (window.scrollY === before) return resolve({ found: false, scrolls, y: window.scrollY, max: document.documentElement.scrollHeight });
        check();
      }, 350);
    }
    check();
  });
}

// =====================================================================
// DOM SNAPSHOT
// =====================================================================

async function tool_domSnapshot({ tab_id, max_nodes = 200, root_selector }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const tree = await execIsolated(tab.id, domSnapshotInPage, [max_nodes, root_selector || null]);
  if (!tree) return { content: '(empty)' };
  return { content: JSON.stringify(tree, null, 2).slice(0, 8000) };
}

function domSnapshotInPage(maxNodes, rootSel) {
  let root = document.body;
  if (rootSel) {
    try { root = document.querySelector(rootSel) || document.body; } catch {}
  }
  let count = 0;
  function visit(el) {
    if (count >= maxNodes) return null;
    count++;
    const node = { tag: el.tagName.toLowerCase() };
    const id = el.id; if (id) node.id = id;
    const cls = el.className; if (typeof cls === 'string' && cls) node.class = cls.slice(0, 80);
    const role = el.getAttribute('role'); if (role) node.role = role;
    const aria = el.getAttribute('aria-label'); if (aria) node['aria-label'] = aria.slice(0, 60);
    const href = el.getAttribute('href'); if (href) node.href = href.slice(0, 100);
    if (el.tagName === 'INPUT') node.type = el.type;
    const children = [];
    for (const c of el.children) {
      if (count >= maxNodes) break;
      const v = visit(c);
      if (v) children.push(v);
    }
    if (children.length) node.children = children;
    return node;
  }
  return visit(root);
}

// =====================================================================
// DIRECT DOM PROPERTY ACCESS
// =====================================================================

async function tool_getValue({ selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, getValueInPage, [selector]);
  if (!r?.ok) return { is_error: true, content: r?.error || 'Not found' };
  return { content: r.value ?? '' };
}
function getValueInPage(sel) {
  function resolve(s) {
    const m = s.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1])]; if (el?.isConnected) return el; }
    try { return document.querySelector(s); } catch { return null; }
  }
  const el = resolve(sel);
  if (!el) return { ok: false, error: 'not found' };
  if ('value' in el) return { ok: true, value: String(el.value) };
  if (el.isContentEditable) return { ok: true, value: el.textContent || '' };
  return { ok: true, value: el.innerText || el.textContent || '' };
}

async function tool_getAttribute({ selector, attribute, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, getAttrInPage, [selector, attribute]);
  if (!r?.ok) return { is_error: true, content: r?.error || 'Not found' };
  return { content: r.value === null ? '(null)' : String(r.value) };
}
function getAttrInPage(sel, attr) {
  function resolve(s) {
    const m = s.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1])]; if (el?.isConnected) return el; }
    try { return document.querySelector(s); } catch { return null; }
  }
  const el = resolve(sel);
  if (!el) return { ok: false, error: 'not found' };
  return { ok: true, value: el.getAttribute(attr) };
}

async function tool_getText({ selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, getTextInPage, [selector]);
  if (!r?.ok) return { is_error: true, content: r?.error || 'Not found' };
  return { content: r.text };
}
function getTextInPage(sel) {
  function resolve(s) {
    const m = s.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1])]; if (el?.isConnected) return el; }
    try { return document.querySelector(s); } catch { return null; }
  }
  const el = resolve(sel);
  if (!el) return { ok: false, error: 'not found' };
  return { ok: true, text: (el.innerText || el.textContent || '').slice(0, 4000) };
}

// =====================================================================
// STORAGE & COOKIES
// =====================================================================

async function tool_readStorage({ tab_id, kind = 'both' }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, readStorageInPage, [kind]);
  const lines = [];
  if (r.local) {
    lines.push('---localStorage---');
    for (const [k, v] of Object.entries(r.local)) lines.push(`${k} = ${String(v).slice(0, 200)}`);
  }
  if (r.session) {
    lines.push('---sessionStorage---');
    for (const [k, v] of Object.entries(r.session)) lines.push(`${k} = ${String(v).slice(0, 200)}`);
  }
  return { content: lines.join('\n') || '(empty)' };
}
function readStorageInPage(kind) {
  const out = {};
  if (kind === 'local' || kind === 'both') {
    out.local = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        out.local[k] = localStorage.getItem(k);
      }
    } catch {}
  }
  if (kind === 'session' || kind === 'both') {
    out.session = {};
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        out.session[k] = sessionStorage.getItem(k);
      }
    } catch {}
  }
  return out;
}

async function tool_writeStorage({ kind, key, value, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, writeStorageInPage, [kind, key, value]);
  if (!r?.ok) return { is_error: true, content: r?.error || 'failed' };
  return { content: `Wrote ${kind}.${key} = ${String(value).slice(0, 80)}` };
}
function writeStorageInPage(kind, key, value) {
  try {
    if (kind === 'local') localStorage.setItem(key, value);
    else if (kind === 'session') sessionStorage.setItem(key, value);
    else return { ok: false, error: 'kind must be local or session' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function tool_readCookies({ url, tab_id }) {
  const tab = await resolveTab(tab_id);
  const u = url || tab.url;
  if (!u) return { is_error: true, content: 'no URL.' };
  const cookies = await chrome.cookies.getAll({ url: u });
  if (!cookies.length) return { content: '(no cookies)' };
  const lines = [`---COOKIES for ${u} (${cookies.length})---`];
  for (const c of cookies) {
    const flags = [];
    if (c.secure) flags.push('secure');
    if (c.httpOnly) flags.push('httpOnly');
    if (c.sameSite) flags.push('SameSite=' + c.sameSite);
    lines.push(`${c.name} = ${c.value.slice(0, 80)}${c.value.length > 80 ? '…' : ''}`);
    lines.push(`   domain=${c.domain} path=${c.path} ${flags.join(' ')}`);
  }
  return { content: lines.join('\n') };
}

// =====================================================================
// CLIPBOARD
// =====================================================================

async function tool_clipboardRead() {
  // Try sidepanel first (with focus attempt)
  try {
    try { window.focus(); } catch {}
    const text = await navigator.clipboard.readText();
    return { content: text || '(empty clipboard)' };
  } catch (e) {
    // Fallback: read from active tab context (tab is usually focused)
    try {
      const tab = await getActiveTab();
      if (isRestrictedUrl(tab.url)) throw new Error('restricted page');
      const r = await execIsolated(tab.id, async () => {
        try {
          window.focus();
          return { ok: true, text: await navigator.clipboard.readText() };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }, []);
      if (r?.ok) return { content: r.text || '(empty clipboard)' };
      return { is_error: true, content: `Clipboard read failed: ${r?.error || 'unknown'}` };
    } catch (e2) {
      return { is_error: true, content: `Clipboard read failed: ${e.message} (fallback: ${e2.message})` };
    }
  }
}

async function tool_clipboardWrite({ text }) {
  if (text == null) return { is_error: true, content: 'text required.' };
  // Try 1: sidepanel direct (with focus + body click to satisfy "document is focused")
  try {
    try {
      window.focus();
      document.body?.click?.();
      document.body?.focus?.();
    } catch {}
    await navigator.clipboard.writeText(text);
    return { content: `Copied ${text.length} chars to clipboard.` };
  } catch (e1) {
    // Try 2: inject into active tab — pre-click body to give document focus
    try {
      const tab = await getActiveTab();
      if (isRestrictedUrl(tab.url)) throw new Error('restricted page');
      const r = await execIsolated(tab.id, async (t) => {
        // Force focus the page's body (cures "Document is not focused")
        try {
          document.body?.click?.();
          document.body?.focus?.();
          window.focus();
        } catch {}
        try {
          await navigator.clipboard.writeText(t);
          return { ok: true, via: 'clipboard-api' };
        } catch (err) {
          // Layer 3: legacy execCommand — works without focus check
          try {
            const ta = document.createElement('textarea');
            ta.value = t;
            ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            return { ok, via: 'execCommand', error: ok ? null : 'returned false' };
          } catch (err2) {
            return { ok: false, error: `clipboard: ${err.message} | execCommand: ${err2.message}` };
          }
        }
      }, [text]);
      if (r?.ok) return { content: `Copied ${text.length} chars to clipboard (via ${r.via}).` };
      return { is_error: true, content: `Clipboard write failed: ${r?.error || 'unknown'}` };
    } catch (e2) {
      return { is_error: true, content: `Clipboard write failed: ${e1.message} (tab fallback: ${e2.message}). Tip: click inside the page first to give it focus.` };
    }
  }
}

// =====================================================================
// ELEMENT SCREENSHOT
// =====================================================================

async function tool_elementScreenshot({ selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  // 1. Scroll into view first (inlined helper)
  const r1 = await execIsolated(tab.id, scrollAndProbeInPage, [selector]);
  if (!r1?.ok) return { is_error: true, content: r1?.error || 'Element not found' };
  // 2. Wait for any scroll animation / smooth transitions
  await new Promise((res) => setTimeout(res, 400));
  // 3. Get bounds + viewport size + DPR from THE TAB (not sidepanel)
  const info = await execIsolated(tab.id, getElementBoundsAndViewportInPage, [selector]);
  if (!info?.ok) return { is_error: true, content: info?.error || 'not found' };
  const { bounds, viewportW, viewportH, dpr } = info;
  if (bounds.w === 0 || bounds.h === 0) {
    return { is_error: true, content: `Element has zero visible size (rect: ${JSON.stringify(info.raw)}). Element may be display:none, off-screen after scroll, or wider/taller than viewport.` };
  }
  // 4. Capture the visible tab
  let dataUrl;
  try { dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }); }
  catch (e) { return { is_error: true, content: `captureVisibleTab failed: ${e.message}` }; }
  // 5. Crop using the TAB's viewport dimensions (not sidepanel's)
  const cropped = await cropImageWithViewport(dataUrl, bounds, viewportW, viewportH, dpr);
  if (!cropped.ok) return { is_error: true, content: cropped.error };
  return {
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: cropped.base64 } },
      { type: 'text', text: `Element screenshot: ${selector} (${bounds.w}×${bounds.h} @ ${dpr}x)` },
    ],
    _dataUrl: 'data:image/png;base64,' + cropped.base64,
  };
}

// Helper: scroll element into view AND verify it's findable. Runs in page context.
function scrollAndProbeInPage(sel) {
  function resolve(s) {
    const m = s.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1])]; if (el?.isConnected) return el; }
    try { return document.querySelector(s); } catch { return null; }
  }
  const el = resolve(sel);
  if (!el) return { ok: false, error: 'not found' };
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  return { ok: true };
}
function getElementBoundsAndViewportInPage(sel) {
  function resolve(s) {
    const m = s.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1])]; if (el?.isConnected) return el; }
    try { return document.querySelector(s); } catch { return null; }
  }
  const el = resolve(sel);
  if (!el) return { ok: false, error: 'not found' };
  const r = el.getBoundingClientRect();
  // Clamp to viewport — element might be partially off-screen
  const left = Math.max(0, Math.round(r.left));
  const top = Math.max(0, Math.round(r.top));
  const right = Math.min(window.innerWidth, Math.round(r.right));
  const bottom = Math.min(window.innerHeight, Math.round(r.bottom));
  const w = Math.max(0, right - left);
  const h = Math.max(0, bottom - top);
  return {
    ok: true,
    bounds: { x: left, y: top, w, h },
    raw: { left: r.left, top: r.top, width: r.width, height: r.height },
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };
}
async function cropImageWithViewport(dataUrl, bounds, viewportW, viewportH, dpr) {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const bmp = await createImageBitmap(blob);
    // captureVisibleTab returns image at native pixel resolution.
    // Scale factor = bitmap_width / tab_logical_viewport_width
    const scale = bmp.width / viewportW;
    const w = Math.max(1, Math.round(bounds.w * scale));
    const h = Math.max(1, Math.round(bounds.h * scale));
    const x = Math.max(0, Math.round(bounds.x * scale));
    const y = Math.max(0, Math.round(bounds.y * scale));
    // Clamp to bitmap edges to avoid drawImage errors
    const sw = Math.min(w, bmp.width - x);
    const sh = Math.min(h, bmp.height - y);
    if (sw <= 0 || sh <= 0) {
      return { ok: false, error: `bounds out of bitmap (bmp ${bmp.width}×${bmp.height}, viewport ${viewportW}×${viewportH}, requested ${x},${y} ${w}×${h})` };
    }
    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, x, y, sw, sh, 0, 0, sw, sh);
    const outBlob = await canvas.convertToBlob({ type: 'image/png' });
    const buf = await outBlob.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return { ok: true, base64: btoa(bin) };
  } catch (e) {
    return { ok: false, error: `crop failed: ${e.message}` };
  }
}

// =====================================================================
// SCRATCHPAD (in-memory, lifetime = sidepanel session)
// =====================================================================

const _ccScratch = new Map();

async function tool_scratchpadSet({ key, value }) {
  if (!key) return { is_error: true, content: 'key required.' };
  _ccScratch.set(key, String(value ?? ''));
  return { content: `Saved scratchpad[${key}] = ${String(value).slice(0, 80)}` };
}
async function tool_scratchpadGet({ key }) {
  if (!_ccScratch.has(key)) return { is_error: true, content: `no key '${key}'` };
  return { content: _ccScratch.get(key) };
}
async function tool_scratchpadList() {
  if (!_ccScratch.size) return { content: '(scratchpad empty)' };
  const lines = [`---SCRATCHPAD (${_ccScratch.size})---`];
  for (const [k, v] of _ccScratch) lines.push(`${k} = ${v.slice(0, 80)}${v.length > 80 ? '…' : ''}`);
  return { content: lines.join('\n') };
}

// =====================================================================
// PERSISTENT NOTES (chrome.storage)
// =====================================================================

const NOTES_KEY = 'ccNotes';

async function _readNotes() {
  const { [NOTES_KEY]: m } = await chrome.storage.local.get([NOTES_KEY]);
  return (m && typeof m === 'object') ? m : {};
}
async function _writeNotes(m) { await chrome.storage.local.set({ [NOTES_KEY]: m }); }

async function tool_noteSave({ key, value }) {
  if (!key) return { is_error: true, content: 'key required.' };
  const notes = await _readNotes();
  notes[key] = { value: String(value ?? ''), updatedAt: Date.now() };
  await _writeNotes(notes);
  return { content: `Saved note[${key}] (${String(value).length} chars).` };
}

async function tool_noteGet({ key }) {
  const notes = await _readNotes();
  if (!notes[key]) return { is_error: true, content: `no note '${key}'` };
  return { content: notes[key].value };
}

async function tool_noteList() {
  const notes = await _readNotes();
  const keys = Object.keys(notes);
  if (!keys.length) return { content: '(no persistent notes)' };
  const lines = [`---NOTES (${keys.length})---`];
  for (const k of keys) {
    const n = notes[k];
    const ago = Math.floor((Date.now() - n.updatedAt) / 60000);
    lines.push(`${k} (${n.value.length} chars, ${ago}m ago)`);
  }
  return { content: lines.join('\n') };
}

async function tool_noteDelete({ key }) {
  const notes = await _readNotes();
  if (!notes[key]) return { is_error: true, content: `no note '${key}'` };
  delete notes[key];
  await _writeNotes(notes);
  return { content: `Deleted note[${key}].` };
}

// =====================================================================
// PAGE DIFF
// =====================================================================

const _ccPageHistory = new Map(); // tabId -> { text, elements, ts }

async function tool_getPageDiff({ tab_id, max_chars = 4000 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const snap = await execIsolated(tab.id, pageSnapshotInPage, [max_chars, false]);
  const prev = _ccPageHistory.get(tab.id);
  _ccPageHistory.set(tab.id, { text: snap.text, elements: snap.elements, url: snap.url, ts: Date.now() });
  if (!prev) {
    return { content: `(first snapshot stored for tab ${tab.id} — call again later to see diff)\n\nURL: ${snap.url}\nTITLE: ${snap.title}\n${snap.text.slice(0, 1000)}` };
  }
  // Text diff (line-based, simple LCS-free approach)
  const oldLines = (prev.text || '').split('\n');
  const newLines = (snap.text || '').split('\n');
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const added = newLines.filter((l) => l && !oldSet.has(l));
  const removed = oldLines.filter((l) => l && !newSet.has(l));
  // Element diff by label
  const oldEls = new Map((prev.elements || []).map((e) => [e.label, e]));
  const newEls = new Map((snap.elements || []).map((e) => [e.label, e]));
  const elAdded = [...newEls.keys()].filter((k) => !oldEls.has(k));
  const elRemoved = [...oldEls.keys()].filter((k) => !newEls.has(k));
  const elapsed = Math.floor((Date.now() - prev.ts) / 1000);

  const lines = [`---PAGE DIFF (${elapsed}s elapsed)---`];
  if (prev.url !== snap.url) lines.push(`URL changed: ${prev.url} → ${snap.url}`);
  if (added.length) {
    lines.push(`+ ${added.length} text line(s):`);
    for (const a of added.slice(0, 20)) lines.push(`  + ${a.slice(0, 120)}`);
  }
  if (removed.length) {
    lines.push(`- ${removed.length} text line(s):`);
    for (const r of removed.slice(0, 20)) lines.push(`  - ${r.slice(0, 120)}`);
  }
  if (elAdded.length) {
    lines.push(`+ ${elAdded.length} new interactive element(s):`);
    for (const a of elAdded.slice(0, 10)) lines.push(`  + ${a.slice(0, 80)}`);
  }
  if (elRemoved.length) {
    lines.push(`- ${elRemoved.length} removed interactive element(s):`);
    for (const r of elRemoved.slice(0, 10)) lines.push(`  - ${r.slice(0, 80)}`);
  }
  if (!added.length && !removed.length && !elAdded.length && !elRemoved.length && prev.url === snap.url) {
    lines.push('(no changes detected)');
  }
  return { content: lines.join('\n').slice(0, max_chars) };
}

// =====================================================================
// LIST FRAMES (iframes)
// =====================================================================

async function tool_listFrames({ tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
  if (!frames || !frames.length) return { content: '(no frames)' };
  const lines = [`---FRAMES (${frames.length})---`];
  for (const f of frames) {
    const root = f.parentFrameId === -1 ? '★ root' : `frame ${f.frameId}`;
    lines.push(`${root}\n   url: ${f.url}\n   parent: ${f.parentFrameId}`);
  }
  return { content: lines.join('\n') };
}

// =====================================================================
// FIND BY TEXT
// =====================================================================

async function tool_findByText({ text, tag, tab_id }) {
  if (!text) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'text required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) {
    return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: `Restricted page: ${tab.url}` };
  }
  const r = await execIsolated(tab.id, findByTextInPage, [text, tag || null]);
  if (!r?.length) {
    return { is_error: true, error_code: ERR_CODES.NOT_FOUND,
             content: `No element matched "${text}"${tag ? ` in <${tag}>` : ''}.` };
  }
  const lines = [`Found ${r.length} match(es) for "${text}":`];
  for (const m of r.slice(0, 20)) {
    lines.push(`#ref-${m.ref}  [${m.tag}]  ${m.label}`);
    lines.push(`  css:   ${m.css}`);
    lines.push(`  xpath: ${m.xpath}`);
  }
  return { content: lines.join('\n') };
}

function findByTextInPage(text, tagFilter) {
  const q = text.toLowerCase();
  function isVisible(el) {
    if (!el?.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function getCSS(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const path = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && path.length < 6) {
      let part = cur.tagName.toLowerCase();
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.split(/\s+/).filter(Boolean).slice(0, 2).map((c) => '.' + CSS.escape(c)).join('');
        part += cls;
      }
      const sibs = cur.parentElement ? [...cur.parentElement.children].filter((s) => s.tagName === cur.tagName) : [];
      if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      path.unshift(part);
      cur = cur.parentElement;
    }
    return path.join(' > ');
  }
  function getXPath(el) {
    if (el.id) return `//*[@id="${el.id}"]`;
    const segs = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body) {
      const sibs = cur.parentElement ? [...cur.parentElement.children].filter((s) => s.tagName === cur.tagName) : [];
      const idx = sibs.length > 1 ? `[${sibs.indexOf(cur) + 1}]` : '';
      segs.unshift(cur.tagName.toLowerCase() + idx);
      cur = cur.parentElement;
    }
    return '/html/body/' + segs.join('/');
  }
  function lab(el) {
    return (el.getAttribute('aria-label')
      || el.getAttribute('placeholder')
      || el.value
      || (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
      || el.title || ''
    ).slice(0, 100);
  }
  const sel = tagFilter || 'a, button, input, textarea, select, [role=button], [role=link], [role=tab], [role=menuitem], h1, h2, h3, h4, label, span, div';
  const matches = [];
  window.__claudeRefs__ = window.__claudeRefs__ || {};
  let ref = Object.keys(window.__claudeRefs__).length;
  for (const el of document.querySelectorAll(sel)) {
    if (!isVisible(el)) continue;
    const label = lab(el);
    if (!label.toLowerCase().includes(q)) continue;
    // Skip elements that are huge containers
    if ((el.children?.length || 0) > 8) continue;
    ref++;
    window.__claudeRefs__[ref] = el;
    matches.push({ ref, tag: el.tagName.toLowerCase(), label, css: getCSS(el), xpath: getXPath(el) });
    if (matches.length >= 25) break;
  }
  return matches;
}

// =====================================================================
// DRAG AND DROP (HTML5)
// =====================================================================

async function tool_dragDrop({ from_selector, to_selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, dragDropInPage, [from_selector, to_selector]);
  if (!r?.ok) return { is_error: true, content: r?.error || 'failed' };
  return { content: `Dragged ${from_selector} → ${to_selector}.` };
}

function dragDropInPage(fromSel, toSel) {
  function resolve(s) {
    const m = s.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1])]; if (el?.isConnected) return el; }
    try { return document.querySelector(s); } catch { return null; }
  }
  const from = resolve(fromSel);
  const to = resolve(toSel);
  if (!from) return { ok: false, error: 'from not found' };
  if (!to) return { ok: false, error: 'to not found' };

  from.scrollIntoView({ block: 'center' });
  const fr = from.getBoundingClientRect();
  const tr = to.getBoundingClientRect();
  const fx = fr.left + fr.width / 2, fy = fr.top + fr.height / 2;
  const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;

  const dt = new DataTransfer();
  function fire(target, type, x, y) {
    const ev = new DragEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, dataTransfer: dt,
      button: 0,
    });
    target.dispatchEvent(ev);
  }

  fire(from, 'mousedown', fx, fy);
  fire(from, 'dragstart', fx, fy);
  fire(from, 'drag', fx, fy);
  fire(to, 'dragenter', tx, ty);
  fire(to, 'dragover', tx, ty);
  fire(to, 'drop', tx, ty);
  fire(from, 'dragend', tx, ty);
  fire(to, 'mouseup', tx, ty);
  return { ok: true };
}

// =====================================================================
// MOUSE DRAG (coordinate-based)
// =====================================================================

async function tool_mouseDrag({ from_x, from_y, to_x, to_y, steps = 10, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  await execIsolated(tab.id, mouseDragInPage, [from_x, from_y, to_x, to_y, steps]);
  return { content: `Mouse-dragged ${from_x},${from_y} → ${to_x},${to_y} (${steps} steps).` };
}
function mouseDragInPage(fx, fy, tx, ty, steps) {
  function fire(type, x, y) {
    const target = document.elementFromPoint(x, y) || document.body;
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, button: 0, buttons: 1,
    }));
  }
  fire('mousedown', fx, fy);
  for (let i = 1; i <= steps; i++) {
    const x = fx + ((tx - fx) * i) / steps;
    const y = fy + ((ty - fy) * i) / steps;
    fire('mousemove', x, y);
  }
  fire('mouseup', tx, ty);
  return true;
}

// =====================================================================
// DOUBLE / TRIPLE CLICK
// =====================================================================

async function tool_doubleClick({ selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, multiClickInPage, [selector, 2]);
  if (!r?.ok) return { is_error: true, content: r?.error || 'failed' };
  return { content: `Double-clicked ${selector}.` };
}
async function tool_tripleClick({ selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, multiClickInPage, [selector, 3]);
  if (!r?.ok) return { is_error: true, content: r?.error || 'failed' };
  return { content: `Triple-clicked ${selector}.` };
}
function multiClickInPage(sel, count) {
  function resolve(s) {
    const m = s.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1])]; if (el?.isConnected) return el; }
    try { return document.querySelector(s); } catch { return null; }
  }
  const el = resolve(sel);
  if (!el) return { ok: false, error: 'not found' };
  el.scrollIntoView({ block: 'center' });
  el.focus?.();
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < count; i++) el.click();
  if (count === 2) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, detail: 2 }));
  if (count === 3) {
    // Triple-click selects line. Simulate selection.
    try {
      const range = document.createRange();
      if (el.firstChild) range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}
  }
  return { ok: true };
}

// =====================================================================
// GET PAGE TEXT (article mode)
// =====================================================================

async function tool_getPageText({ tab_id, max_chars = 8000 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, getPageTextInPage, [max_chars]);
  return { content: `URL: ${r.url}\nTITLE: ${r.title}\n\n${r.text}` };
}
function getPageTextInPage(maxChars) {
  // Prefer <main>, <article>, then body
  const root = document.querySelector('main, article') || document.body;
  function walk(el) {
    let out = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        const t = node.nodeValue;
        if (t && t.trim()) out += t.replace(/\s+/g, ' ');
      } else if (node.nodeType === 1) {
        const cs = getComputedStyle(node);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|NAV|FOOTER|ASIDE)$/.test(node.tagName)) continue;
        out += walk(node);
        if (/^(P|DIV|SECTION|ARTICLE|H[1-6]|LI|BR|TR)$/.test(node.tagName)) out += '\n';
      }
      if (out.length > maxChars) break;
    }
    return out;
  }
  let text = walk(root).replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n[truncated]';
  return { url: location.href, title: document.title, text };
}

// =====================================================================
// SCROLL TO COORDINATES
// =====================================================================

async function tool_scrollTo({ x, y, position, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, scrollToInPage, [x ?? null, y ?? null, position || null]);
  return { content: `Scrolled to y=${r.y}/${r.max}.` };
}
function scrollToInPage(x, y, pos) {
  if (pos === 'top') window.scrollTo(0, 0);
  else if (pos === 'bottom') window.scrollTo(0, document.documentElement.scrollHeight);
  else if (Number.isFinite(x) || Number.isFinite(y)) {
    window.scrollTo(x ?? window.scrollX, y ?? window.scrollY);
  }
  return { y: window.scrollY, max: document.documentElement.scrollHeight };
}

// =====================================================================
// ZOOM
// =====================================================================

async function tool_setZoom({ zoom, tab_id }) {
  const tab = await resolveTab(tab_id);
  const z = Math.max(0.25, Math.min(5, Number(zoom) || 1));
  await chrome.tabs.setZoom(tab.id, z);
  // Verify by reading back — chrome.tabs.setZoom can race; poll briefly until consistent
  let actual = z;
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 60));
    actual = await chrome.tabs.getZoom(tab.id);
    if (Math.abs(actual - z) < 0.01) break;
  }
  return { content: `Zoom set to ${z}x on tab ${tab.id} (verified at ${actual}x).` };
}
async function tool_getZoom({ tab_id }) {
  const tab = await resolveTab(tab_id);
  // Force refresh — re-fetch the tab object first to clear any stale cache
  const fresh = await chrome.tabs.get(tab.id);
  const z = await chrome.tabs.getZoom(fresh.id);
  return { content: `Current zoom: ${z}x (tab ${fresh.id})` };
}

// =====================================================================
// RESIZE WINDOW
// =====================================================================

async function tool_resizeWindow({ window_id, width, height, state }) {
  let id = window_id;
  if (!Number.isFinite(id)) {
    const w = await chrome.windows.getCurrent();
    id = w.id;
  }
  const opts = {};
  if (Number.isFinite(width)) opts.width = width;
  if (Number.isFinite(height)) opts.height = height;
  if (state) opts.state = state;
  if (!Object.keys(opts).length) return { is_error: true, content: 'provide width+height OR state.' };
  const w = await chrome.windows.update(id, opts);
  return { content: `Window ${id}: ${w.width}×${w.height} state=${w.state}` };
}

// =====================================================================
// UPLOAD IMAGE
// =====================================================================

async function tool_uploadImage({ selector, url, base64, attachment_index, filename, mime, tab_id }, ctx = {}) {
  // Resolve source priority: attachment_index > base64 > url
  let b64 = null;
  let resolvedFilename = filename;
  let resolvedMime = mime;
  if (attachment_index != null) {
    const att = _getChatAttachment(ctx, attachment_index);
    if (!att) {
      return { is_error: true, error_code: ERR_CODES.NOT_FOUND,
               content: `No chat attachment at index ${attachment_index}. Call list_chat_attachments first.` };
    }
    if (!att.base64) {
      return { is_error: true, error_code: ERR_CODES.INVALID_INPUT,
               content: `Attachment ${attachment_index} (${att.name}) has no binary data — text files are inlined into the message instead.` };
    }
    b64 = att.base64;
    resolvedFilename = resolvedFilename || att.name || 'file';
    resolvedMime = resolvedMime || att.mime || 'application/octet-stream';
  } else if (base64) {
    b64 = base64;
  }
  resolvedFilename = resolvedFilename || 'image.png';
  resolvedMime = resolvedMime || 'image/png';

  if (!b64 && !url) {
    return { is_error: true, error_code: ERR_CODES.INVALID_INPUT,
             content: 'attachment_index, base64, or url required.' };
  }

  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  // Resolve image bytes in extension context (CORS-safe via fetch)
  if (!b64 && url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return { is_error: true, content: `Fetch image failed: HTTP ${res.status}` };
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      b64 = btoa(bin);
    } catch (e) { return { is_error: true, content: `Fetch image error: ${e.message}` }; }
  }
  const r = await execIsolated(tab.id, uploadImageInPage, [selector, b64, resolvedFilename, resolvedMime]);
  if (!r?.ok) return { is_error: true, content: r?.error || 'failed' };
  return { content: `Uploaded ${resolvedFilename} (${r.bytes} bytes, ${resolvedMime}) to ${selector}.` };
}
function uploadImageInPage(sel, b64, filename, mime) {
  function resolve(s) {
    const m = s.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) { const el = window.__claudeRefs__[parseInt(m[1])]; if (el?.isConnected) return el; }
    try { return document.querySelector(s); } catch { return null; }
  }
  const el = resolve(sel);
  if (!el) return { ok: false, error: 'not found' };
  // Decode base64 → Uint8Array → File
  let bytes;
  try {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (e) {
    return { ok: false, error: 'base64 decode failed: ' + e.message };
  }
  const file = new File([bytes], filename, { type: mime });
  const dt = new DataTransfer();
  dt.items.add(file);
  if (el.tagName === 'INPUT' && el.type === 'file') {
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, bytes: bytes.length };
  }
  // Drop target
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  function fire(type) {
    el.dispatchEvent(new DragEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, dataTransfer: dt,
    }));
  }
  fire('dragenter'); fire('dragover'); fire('drop');
  return { ok: true, bytes: bytes.length };
}

// =====================================================================
// CHAT ATTACHMENT ACCESS
// Lets the agent read files the user attached in the current/last message,
// then chain into upload_image(attachment_index=N) for any website upload.
// Source of truth: ctx.attachments (passed by sidepanel via runAgent).
// Falls back to the most recent user message in conversation.
// =====================================================================

function _resolveAttachmentList(ctx) {
  // 1) explicit ctx.attachments (best: still has base64 even after message clears)
  if (Array.isArray(ctx?.attachments) && ctx.attachments.length) return ctx.attachments;
  // 2) walk conversation backwards for last user message with image/document blocks
  const conv = ctx?.conversation;
  if (Array.isArray(conv)) {
    for (let i = conv.length - 1; i >= 0; i--) {
      const m = conv[i];
      if (m?.role !== 'user') continue;
      if (Array.isArray(m.content)) {
        const blocks = m.content.filter((b) => b?.type === 'image' || b?.type === 'document');
        if (blocks.length) {
          return blocks.map((b, idx) => ({
            name: b.source?.filename || (b.type === 'image' ? `image_${idx}.png` : `document_${idx}.pdf`),
            mime: b.source?.media_type || (b.type === 'image' ? 'image/png' : 'application/pdf'),
            base64: b.source?.data || '',
            kind: b.type === 'image' ? 'image' : 'pdf',
            size: b.source?.data ? Math.floor(b.source.data.length * 0.75) : 0,
          }));
        }
      }
      break; // only inspect the last user message
    }
  }
  return [];
}

function _getChatAttachment(ctx, index = 0) {
  const list = _resolveAttachmentList(ctx);
  return list[index] || null;
}

async function tool_listChatAttachments(_input, ctx = {}) {
  const list = _resolveAttachmentList(ctx);
  if (!list.length) {
    return { content: 'No attachments in current message. Ask the user to attach a file (paperclip icon) or paste/drag one in.' };
  }
  const out = list.map((a, i) => ({
    index: i,
    filename: a.name || a.filename || `attachment_${i}`,
    mime: a.mime || 'application/octet-stream',
    size: a.size || (a.base64 ? Math.floor(a.base64.length * 0.75) : 0),
    kind: a.kind || (String(a.mime || '').startsWith('image/') ? 'image'
                  : a.mime === 'application/pdf' ? 'pdf'
                  : a.text ? 'text' : 'binary'),
    has_binary: !!a.base64,
  }));
  return { content: JSON.stringify(out, null, 2) };
}

async function tool_getChatAttachment({ index = 0 }, ctx = {}) {
  const att = _getChatAttachment(ctx, index);
  if (!att) {
    return { is_error: true, error_code: ERR_CODES.NOT_FOUND,
             content: `No chat attachment at index ${index}. Call list_chat_attachments first.` };
  }
  // Text files: inline as text
  if (att.kind === 'text' && att.text != null) {
    return {
      content: JSON.stringify({
        filename: att.name, mime: att.mime || 'text/plain',
        size: att.size || (att.text || '').length,
        text: att.text, base64: '',
      }),
    };
  }
  if (!att.base64) {
    return { is_error: true, error_code: ERR_CODES.INVALID_INPUT,
             content: `Attachment ${index} (${att.name}) has no binary data available.` };
  }
  // Hard cap to avoid frying the context window — surface size + offer chunk hint.
  const MAX_INLINE = 15 * 1024 * 1024 * 4 / 3 | 0; // ~15MB raw
  if (att.base64.length > MAX_INLINE) {
    return { is_error: true, error_code: ERR_CODES.INVALID_INPUT,
             content: `Attachment ${index} (${att.name}) is ${(att.base64.length * 0.75 / 1024 / 1024).toFixed(1)}MB — too large to return inline. Use upload_image with attachment_index=${index} to push it directly.` };
  }
  return {
    content: JSON.stringify({
      filename: att.name,
      mime: att.mime || 'application/octet-stream',
      size: att.size || Math.floor(att.base64.length * 0.75),
      base64: att.base64,
    }),
  };
}

// =====================================================================
// UPDATE PLAN (interactive approval)
// =====================================================================

async function tool_updatePlan({ title, steps }, ctx) {
  if (!Array.isArray(steps) || !steps.length) return { is_error: true, content: 'steps required.' };
  if (!ctx?.askApproval) {
    // No UI: just return rendered plan
    const lines = [`📋 ${title || 'Plan'}`];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const icon = ({ pending: '⬜', in_progress: '🔵', done: '✅', skipped: '⏭' })[s.status] || '⬜';
      lines.push(`${i + 1}. ${icon} ${s.title}${s.note ? ' — ' + s.note : ''}`);
    }
    return { content: lines.join('\n') + '\n\n(no UI for approval; proceeding)' };
  }
  // Format plan as approval modal
  const planText = steps.map((s, i) => {
    const icon = ({ pending: '⬜', in_progress: '🔵', done: '✅', skipped: '⏭' })[s.status] || '⬜';
    return `${i + 1}. ${icon} ${s.title}${s.note ? '\n     ' + s.note : ''}`;
  }).join('\n');
  const ok = await ctx.askApproval({
    name: 'update_plan',
    input: { steps },
    reason: title ? `Plan: ${title}` : 'Approve this plan?',
  });
  if (!ok) return { is_error: true, content: 'Plan rejected by user.' };
  return { content: `Plan approved.\n\n${planText}` };
}

// =====================================================================
// GIF CAPTURE (multi-frame screenshot)
// =====================================================================

async function tool_gifCapture({ frames = 10, interval_ms = 500, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const cap = Math.min(30, Math.max(1, frames));
  const dl = Math.max(100, interval_ms);
  const captured = [];
  for (let i = 0; i < cap; i++) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      captured.push(dataUrl);
    } catch (e) { return { is_error: true, content: `Frame ${i} failed: ${e.message}` }; }
    if (i < cap - 1) await new Promise((r) => setTimeout(r, dl));
  }
  // Save each frame as a download
  const ts = Date.now();
  const baseName = `moonbridge-capture-${ts}`;
  let saved = 0;
  for (let i = 0; i < captured.length; i++) {
    try {
      await chrome.downloads.download({
        url: captured[i],
        filename: `${baseName}/frame-${String(i).padStart(3, '0')}.png`,
      });
      saved++;
    } catch {}
  }
  return { content: `Captured ${cap} frames @ ${dl}ms interval. Saved ${saved} PNG(s) to Downloads/${baseName}/. Use ffmpeg or online tool to combine into GIF.` };
}

// =====================================================================
// OCR (Claude vision)
// =====================================================================

async function tool_ocrImage({ tab_id, selector, data_url, prompt }, ctx) {
  // Get image data
  let imageDataUrl = data_url;

  if (!imageDataUrl) {
    if (selector) {
      const r = await tool_elementScreenshot({ selector, tab_id });
      if (r.is_error) return r;
      imageDataUrl = r.data_url;
    } else {
      const tab = await resolveTab(tab_id);
      if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
      try {
        imageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      } catch (e) {
        return { is_error: true, content: `Screenshot failed: ${e.message}` };
      }
    }
  }

  if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
    return { is_error: true, content: 'No valid image data.' };
  }

  // Parse data URL
  const m = imageDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return { is_error: true, content: 'Could not parse data URL.' };
  const mediaType = m[1];
  const b64 = m[2];

  // Read settings (from chrome.storage, since tools.js doesn't import sidepanel state)
  const { settings } = await chrome.storage.local.get(['settings']);
  if (!settings?.apiToken) {
    return { is_error: true, content: 'No API key configured. Open MoonBridge settings first.' };
  }
  const baseUrl = (settings.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
  const model = settings.defaultModel || 'claude-sonnet-4-5';

  const userText = prompt || 'Extract ALL text from this image. Preserve line breaks. Output ONLY the text, no commentary.';

  try {
    const resp = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiToken,
        'Authorization': `Bearer ${settings.apiToken}`,
        'anthropic-version': '2023-06-01',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        stream: false,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: userText },
          ],
        }],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { is_error: true, content: `OCR HTTP ${resp.status}: ${txt.slice(0, 300)}` };
    }
    const text = await _parseClaudeResponse(resp);
    return { content: text || '(no text recognized)' };
  } catch (e) {
    return { is_error: true, content: `OCR error: ${e.message}` };
  }
}

// =====================================================================
// ADVANCED COOKIE MANAGEMENT
// =====================================================================

async function tool_setCookie({ url, name, value, domain, path = '/', secure, http_only, same_site, expires_in }) {
  if (!url || !name) return { is_error: true, content: 'url and name are required.' };
  const opts = { url, name, value: value || '', path };
  if (domain) opts.domain = domain;
  if (typeof secure === 'boolean') opts.secure = secure;
  if (typeof http_only === 'boolean') opts.httpOnly = http_only;
  if (same_site) opts.sameSite = same_site;
  if (expires_in) opts.expirationDate = (Date.now() / 1000) + expires_in;

  try {
    const c = await chrome.cookies.set(opts);
    if (!c) return { is_error: true, content: 'chrome.cookies.set returned null (likely blocked by browser policy or invalid params).' };
    return { content: `Set cookie ${c.name} for ${c.domain}${c.path}` };
  } catch (e) {
    return { is_error: true, content: `set_cookie error: ${e.message}` };
  }
}

async function tool_deleteCookie({ url, name }) {
  if (!url || !name) return { is_error: true, content: 'url and name are required.' };
  try {
    const r = await chrome.cookies.remove({ url, name });
    if (!r) return { content: `Cookie ${name} not found at ${url}.` };
    return { content: `Deleted cookie ${name} from ${url}.` };
  } catch (e) {
    return { is_error: true, content: e.message };
  }
}

async function tool_clearCookies({ domain, url }) {
  let targetDomain = domain;
  if (!targetDomain && url) {
    try { targetDomain = new URL(url).hostname; } catch {}
  }
  if (!targetDomain) return { is_error: true, content: 'Provide domain or url.' };

  // Strip leading dot, normalize
  const dom = targetDomain.replace(/^\./, '');

  // chrome.cookies.getAll matches by domain (covers subdomains via leading dot)
  const cookies = await chrome.cookies.getAll({ domain: dom });
  let removed = 0;
  for (const c of cookies) {
    const cookieUrl = (c.secure ? 'https://' : 'http://') + c.domain.replace(/^\./, '') + c.path;
    try {
      const r = await chrome.cookies.remove({ url: cookieUrl, name: c.name, storeId: c.storeId });
      if (r) removed++;
    } catch {}
  }
  return { content: `Cleared ${removed}/${cookies.length} cookies for domain ${dom}.` };
}

async function tool_exportCookies({ url, tab_id }) {
  let target = url;
  if (!target) {
    const tab = await resolveTab(tab_id);
    target = tab.url;
  }
  if (!target) return { is_error: true, content: 'no URL.' };

  const cookies = await chrome.cookies.getAll({ url: target });
  if (!cookies.length) return { content: '(no cookies)' };

  // Netscape format: domain  flag  path  secure  expiration  name  value
  const lines = ['# Netscape HTTP Cookie File', '# Generated by MoonBridge'];
  for (const c of cookies) {
    const dom = c.domain.startsWith('.') ? c.domain : '.' + c.domain;
    const flag = c.hostOnly ? 'FALSE' : 'TRUE';
    const secure = c.secure ? 'TRUE' : 'FALSE';
    const exp = c.expirationDate ? Math.floor(c.expirationDate) : 0;
    lines.push([dom, flag, c.path, secure, exp, c.name, c.value].join('\t'));
  }
  return { content: '```\n' + lines.join('\n') + '\n```\n\nUse with curl: `curl --cookie cookies.txt URL`' };
}

// =====================================================================
// PERFORMANCE PROFILE
// =====================================================================

async function tool_perfProfile({ tab_id, include_resources = false }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };

  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (includeResources) => {
      const out = { url: location.href, navigation: {}, paint: {}, memory: {}, resources: null, summary: {} };

      // Navigation timing
      const navEntry = performance.getEntriesByType('navigation')[0];
      if (navEntry) {
        out.navigation = {
          dns_ms: Math.round(navEntry.domainLookupEnd - navEntry.domainLookupStart),
          tcp_ms: Math.round(navEntry.connectEnd - navEntry.connectStart),
          ttfb_ms: Math.round(navEntry.responseStart - navEntry.requestStart),
          response_ms: Math.round(navEntry.responseEnd - navEntry.responseStart),
          dom_ms: Math.round(navEntry.domContentLoadedEventEnd - navEntry.responseEnd),
          load_total_ms: Math.round(navEntry.loadEventEnd - navEntry.startTime),
          transfer_size: navEntry.transferSize,
          encoded_body_size: navEntry.encodedBodySize,
          decoded_body_size: navEntry.decodedBodySize,
        };
      }

      // Paint
      const paints = performance.getEntriesByType('paint');
      for (const p of paints) {
        out.paint[p.name.replace(/-/g, '_')] = Math.round(p.startTime);
      }

      // LCP via PerformanceObserver buffered
      const lcpEntries = performance.getEntriesByType ? performance.getEntriesByType('largest-contentful-paint') : [];
      if (lcpEntries.length) {
        const lcp = lcpEntries[lcpEntries.length - 1];
        out.paint.largest_contentful_paint = Math.round(lcp.startTime);
      }

      // Memory (non-standard)
      if (performance.memory) {
        out.memory = {
          used_mb: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
          total_mb: (performance.memory.totalJSHeapSize / 1048576).toFixed(2),
          limit_mb: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2),
        };
      }

      // Resource summary
      const resources = performance.getEntriesByType('resource');
      const byType = {};
      let totalBytes = 0;
      let totalDuration = 0;
      for (const r of resources) {
        const type = r.initiatorType || 'other';
        byType[type] = byType[type] || { count: 0, bytes: 0, ms: 0 };
        byType[type].count++;
        byType[type].bytes += (r.transferSize || 0);
        byType[type].ms += r.duration;
        totalBytes += (r.transferSize || 0);
        totalDuration += r.duration;
      }
      out.summary = {
        total_resources: resources.length,
        total_transfer_kb: (totalBytes / 1024).toFixed(1),
        total_duration_ms: Math.round(totalDuration),
        by_type: byType,
      };

      if (includeResources) {
        out.resources = resources
          .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
          .slice(0, 30)
          .map(r => ({
            name: r.name.length > 100 ? r.name.slice(0, 97) + '…' : r.name,
            type: r.initiatorType,
            kb: ((r.transferSize || 0) / 1024).toFixed(1),
            ms: Math.round(r.duration),
          }));
      }

      return out;
    },
    args: [include_resources],
  });

  const data = result[0]?.result;
  if (!data) return { is_error: true, content: 'Could not collect performance data.' };

  // Format for the agent
  const lines = [`Performance for ${data.url}`, ''];
  if (data.navigation.load_total_ms) {
    lines.push('Navigation:');
    lines.push(`  DNS lookup:     ${data.navigation.dns_ms} ms`);
    lines.push(`  TCP connect:    ${data.navigation.tcp_ms} ms`);
    lines.push(`  TTFB:           ${data.navigation.ttfb_ms} ms`);
    lines.push(`  Response:       ${data.navigation.response_ms} ms`);
    lines.push(`  DOM ready:      ${data.navigation.dom_ms} ms`);
    lines.push(`  TOTAL load:     ${data.navigation.load_total_ms} ms`);
    lines.push(`  Transfer size:  ${(data.navigation.transfer_size / 1024).toFixed(1)} KB`);
    lines.push('');
  }
  if (Object.keys(data.paint).length) {
    lines.push('Paint metrics:');
    for (const [k, v] of Object.entries(data.paint)) {
      lines.push(`  ${k}: ${v} ms`);
    }
    lines.push('');
  }
  if (data.memory.used_mb) {
    lines.push(`JS Heap: ${data.memory.used_mb} MB used / ${data.memory.total_mb} MB total / ${data.memory.limit_mb} MB limit`);
    lines.push('');
  }
  lines.push(`Resources: ${data.summary.total_resources} requests, ${data.summary.total_transfer_kb} KB total, ${data.summary.total_duration_ms} ms cumulative`);
  for (const [type, s] of Object.entries(data.summary.by_type)) {
    lines.push(`  ${type}: ${s.count} reqs, ${(s.bytes / 1024).toFixed(1)} KB, ${Math.round(s.ms)} ms`);
  }

  if (include_resources && data.resources) {
    lines.push('', 'Top 30 resources by size:');
    for (const r of data.resources) {
      lines.push(`  ${r.kb} KB  ${r.ms} ms  [${r.type}]  ${r.name}`);
    }
  }

  return { content: lines.join('\n') };
}

// =====================================================================
// ACCESSIBILITY AUDIT
// =====================================================================

async function tool_a11yAudit({ tab_id, severity = 'all' }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };

  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const issues = [];
      const sel = (e) => {
        if (e.id) return `#${e.id}`;
        const cls = e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        return e.tagName.toLowerCase() + cls;
      };

      // 1. Images without alt
      for (const img of document.querySelectorAll('img')) {
        if (!img.hasAttribute('alt')) {
          issues.push({ severity: 'error', rule: 'img-alt', element: sel(img), msg: 'Image missing alt attribute' });
        }
      }
      // 2. Inputs without labels
      for (const inp of document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select')) {
        const hasLabel = inp.labels?.length || inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby') || inp.getAttribute('placeholder');
        if (!hasLabel) {
          issues.push({ severity: 'error', rule: 'input-label', element: sel(inp), msg: 'Form input has no accessible label' });
        }
      }
      // 3. Buttons without text
      for (const b of document.querySelectorAll('button, [role=button]')) {
        const text = (b.innerText || b.textContent || '').trim();
        const aria = b.getAttribute('aria-label') || b.getAttribute('aria-labelledby') || b.getAttribute('title');
        if (!text && !aria) {
          issues.push({ severity: 'error', rule: 'button-name', element: sel(b), msg: 'Button has no discernible text' });
        }
      }
      // 4. Links without text
      for (const a of document.querySelectorAll('a[href]')) {
        const text = (a.innerText || a.textContent || '').trim();
        const aria = a.getAttribute('aria-label') || a.querySelector('img')?.getAttribute('alt');
        if (!text && !aria) {
          issues.push({ severity: 'error', rule: 'link-name', element: sel(a), msg: 'Link has no discernible text' });
        }
      }
      // 5. Heading hierarchy
      const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')];
      let prevLevel = 0;
      let h1Count = 0;
      for (const h of headings) {
        const lvl = parseInt(h.tagName[1]);
        if (lvl === 1) h1Count++;
        if (prevLevel && lvl > prevLevel + 1) {
          issues.push({ severity: 'warning', rule: 'heading-order', element: sel(h),
            msg: `Heading skips levels (h${prevLevel} → h${lvl})` });
        }
        prevLevel = lvl;
      }
      if (h1Count === 0 && headings.length) {
        issues.push({ severity: 'warning', rule: 'h1-missing', element: 'document', msg: 'Page has no <h1> heading' });
      }
      if (h1Count > 1) {
        issues.push({ severity: 'warning', rule: 'h1-multiple', element: 'document', msg: `Page has ${h1Count} <h1> headings (should be 1)` });
      }
      // 6. ARIA misuse — invalid role
      const validRoles = new Set([
        'alert','alertdialog','application','article','banner','button','cell','checkbox','columnheader',
        'combobox','complementary','contentinfo','definition','dialog','directory','document','feed',
        'figure','form','grid','gridcell','group','heading','img','link','list','listbox','listitem',
        'log','main','marquee','math','menu','menubar','menuitem','menuitemcheckbox','menuitemradio',
        'navigation','none','note','option','presentation','progressbar','radio','radiogroup','region',
        'row','rowgroup','rowheader','scrollbar','search','searchbox','separator','slider','spinbutton',
        'status','switch','tab','table','tablist','tabpanel','term','textbox','timer','toolbar','tooltip',
        'tree','treegrid','treeitem','rowheader','article','section'
      ]);
      for (const e of document.querySelectorAll('[role]')) {
        const r = e.getAttribute('role');
        if (r && !validRoles.has(r.split(' ')[0])) {
          issues.push({ severity: 'warning', rule: 'aria-role-invalid', element: sel(e), msg: `Invalid ARIA role: "${r}"` });
        }
      }
      // 7. Focusable hidden elements
      for (const e of document.querySelectorAll('[tabindex]:not([tabindex="-1"])')) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') {
          issues.push({ severity: 'warning', rule: 'focusable-hidden', element: sel(e),
            msg: 'Element is focusable but visually hidden' });
        }
      }
      // 8. <html> lang
      if (!document.documentElement.getAttribute('lang')) {
        issues.push({ severity: 'error', rule: 'html-lang', element: 'html', msg: 'Document missing lang attribute' });
      }
      // 9. Page title
      if (!document.title || !document.title.trim()) {
        issues.push({ severity: 'error', rule: 'document-title', element: 'head', msg: 'Document missing title' });
      }
      // 10. Sample contrast (5 elements)
      const sampleElements = [...document.querySelectorAll('p, span, a, button, h1, h2, h3, label')]
        .filter(e => e.innerText && e.innerText.trim().length > 0)
        .slice(0, 30);
      const parseColor = (str) => {
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        return [+m[1], +m[2], +m[3]];
      };
      const luminance = ([r, g, b]) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const contrast = (a, b) => {
        const la = luminance(a), lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
      };
      // Walk up to find effective bg
      const effectiveBg = (el) => {
        let cur = el;
        while (cur && cur !== document.body) {
          const cs = getComputedStyle(cur);
          const c = parseColor(cs.backgroundColor);
          if (c && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') return c;
          cur = cur.parentElement;
        }
        return [255, 255, 255]; // fallback white
      };
      for (const el of sampleElements) {
        const cs = getComputedStyle(el);
        const fg = parseColor(cs.color);
        if (!fg) continue;
        const bg = effectiveBg(el);
        const ratio = contrast(fg, bg);
        const fontSize = parseFloat(cs.fontSize);
        const fontWeight = parseInt(cs.fontWeight) || 400;
        const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const required = isLargeText ? 3 : 4.5;
        if (ratio < required) {
          issues.push({
            severity: ratio < 3 ? 'error' : 'warning',
            rule: 'contrast',
            element: sel(el),
            msg: `Contrast ${ratio.toFixed(2)}:1 (need ${required}:1) — text "${el.innerText.slice(0, 40)}…"`,
          });
        }
      }

      return {
        url: location.href,
        title: document.title,
        issues_total: issues.length,
        issues,
      };
    },
  });

  const data = result[0]?.result;
  if (!data) return { is_error: true, content: 'Could not run audit.' };

  const filtered = severity === 'all' ? data.issues : data.issues.filter(i => i.severity === severity);
  if (!filtered.length) {
    return { content: `✓ No ${severity === 'all' ? '' : severity + ' '}issues found on ${data.title || data.url}` };
  }

  const errs = filtered.filter(i => i.severity === 'error').length;
  const warns = filtered.filter(i => i.severity === 'warning').length;
  const lines = [
    `A11y audit: ${data.title || data.url}`,
    `${errs} error(s), ${warns} warning(s)`,
    '',
  ];
  // Group by rule
  const byRule = {};
  for (const i of filtered) {
    (byRule[i.rule] = byRule[i.rule] || []).push(i);
  }
  for (const [rule, list] of Object.entries(byRule)) {
    lines.push(`[${list[0].severity.toUpperCase()}] ${rule} (${list.length}):`);
    for (const i of list.slice(0, 5)) {
      lines.push(`  ${i.element} — ${i.msg}`);
    }
    if (list.length > 5) lines.push(`  … and ${list.length - 5} more`);
  }
  lines.push('', 'Note: Full WCAG validation requires manual testing with assistive technologies.');
  return { content: lines.join('\n') };
}

// =====================================================================
// API MOCKING (CDP Fetch interception)
// =====================================================================

const _MOCK_RULES = new Map(); // tabId -> [{pattern, status, body, contentType, delayMs}]

async function _ensureCdpAttached(tabId) {
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
  } catch (e) {
    if (!e.message.includes('already attached')) throw e;
  }
}

async function tool_mockApiStart({ tab_id, url_pattern, status = 200, body = '', content_type = 'application/json', delay_ms = 0 }) {
  if (!url_pattern) return { is_error: true, content: 'url_pattern is required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };

  await _ensureCdpAttached(tab.id);

  // Add rule
  const rules = _MOCK_RULES.get(tab.id) || [];
  rules.push({ pattern: url_pattern, status, body, contentType: content_type, delayMs: delay_ms });
  _MOCK_RULES.set(tab.id, rules);

  // Set up listener if first rule for this tab
  if (rules.length === 1) {
    const onEvent = async (source, method, params) => {
      if (source.tabId !== tab.id) return;
      if (method !== 'Fetch.requestPaused') return;
      const tabRules = _MOCK_RULES.get(tab.id) || [];
      const reqUrl = params.request.url;
      const matched = tabRules.find(r => _wildcardMatch(r.pattern, reqUrl));
      if (matched) {
        if (matched.delayMs) await new Promise(r => setTimeout(r, matched.delayMs));
        const bodyB64 = btoa(unescape(encodeURIComponent(matched.body)));
        try {
          await chrome.debugger.sendCommand({ tabId: tab.id }, 'Fetch.fulfillRequest', {
            requestId: params.requestId,
            responseCode: matched.status,
            responseHeaders: [
              { name: 'Content-Type', value: matched.contentType },
              { name: 'X-Mocked-By', value: 'MoonBridge' },
            ],
            body: bodyB64,
          });
        } catch {}
      } else {
        try {
          await chrome.debugger.sendCommand({ tabId: tab.id }, 'Fetch.continueRequest', {
            requestId: params.requestId,
          });
        } catch {}
      }
    };
    chrome.debugger.onEvent.addListener(onEvent);
    // Store listener for removal
    const tabState = _MOCK_RULES.get(tab.id);
    tabState._listener = onEvent;

    await chrome.debugger.sendCommand({ tabId: tab.id }, 'Fetch.enable', {
      patterns: [{ urlPattern: '*', requestStage: 'Request' }],
    });
  }

  return { content: `Mock active for tab ${tab.id}: ${url_pattern} → HTTP ${status} (${body.length} bytes). ${rules.length} rule(s) total.` };
}

function _wildcardMatch(pattern, url) {
  // Convert * to .* for regex
  const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return re.test(url);
}

async function tool_mockApiStop({ tab_id }) {
  const tab = await resolveTab(tab_id);
  const rules = _MOCK_RULES.get(tab.id);
  if (!rules || !rules.length) return { content: 'No mocks active for this tab.' };

  // Remove listener
  if (rules._listener) {
    try { chrome.debugger.onEvent.removeListener(rules._listener); } catch {}
  }

  try {
    await chrome.debugger.sendCommand({ tabId: tab.id }, 'Fetch.disable');
  } catch {}
  try {
    await chrome.debugger.detach({ tabId: tab.id });
  } catch {}

  const count = rules.length;
  _MOCK_RULES.delete(tab.id);
  return { content: `Stopped ${count} mock rule(s) on tab ${tab.id}.` };
}

// =====================================================================
// ATTACH FILE — send file inline to user's chat (no Downloads folder)
// =====================================================================

async function tool_attachFile({ filename, content, mime_type = 'text/plain', encoding = 'utf8', caption }) {
  if (!filename) return { is_error: true, content: 'filename is required.' };
  if (content == null) return { is_error: true, content: 'content is required.' };

  // Build a data URL for the file
  let dataUrl;
  let sizeBytes;
  try {
    if (encoding === 'base64') {
      // Validate it's actually base64
      const cleaned = String(content).replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
        return { is_error: true, content: 'encoding=base64 but content contains invalid chars.' };
      }
      dataUrl = `data:${mime_type};base64,${cleaned}`;
      // Calculate decoded size
      sizeBytes = Math.floor(cleaned.length * 3 / 4);
    } else {
      const text = String(content);
      // UTF-8 → base64
      const b64 = btoa(unescape(encodeURIComponent(text)));
      dataUrl = `data:${mime_type};base64,${b64}`;
      sizeBytes = new Blob([text]).size;
    }
  } catch (e) {
    return { is_error: true, content: `Encoding error: ${e.message}` };
  }

  // Broadcast to sidepanel — it will render an inline attachment card
  try {
    chrome.runtime.sendMessage({
      type: 'CC_ATTACH_FILE',
      filename,
      mime_type,
      data_url: dataUrl,
      size: sizeBytes,
      caption: caption || null,
    }).catch(() => {});
  } catch {}

  return {
    content: `📎 Attached "${filename}" (${formatBytes(sizeBytes)}) to chat.${caption ? ' Caption: ' + caption : ''}`,
  };
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// =====================================================================
// WATCH ELEMENT — MutationObserver-based, more efficient than polling
// =====================================================================

async function tool_watchElement({ selector, change = 'appear', timeout_ms = 10000, tab_id }) {
  if (!selector) return { is_error: true, content: 'selector is required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };

  const result = await execIsolated(tab.id, async (sel, changeType, timeoutMs) => {
    const refMap = window.__claudeRefs__ || {};
    const refMatch = sel.match(/^#ref-(\d+)$/);
    const initial = refMatch ? refMap[refMatch[1]] : document.querySelector(sel);
    const querySel = () => refMatch ? refMap[refMatch[1]] : document.querySelector(sel);

    return new Promise((resolve) => {
      const start = Date.now();
      let timer;

      const finish = (status, detail) => {
        clearTimeout(timer);
        if (observer) observer.disconnect();
        const elapsed = Date.now() - start;
        resolve({ status, detail, elapsed_ms: elapsed });
      };

      // Quick check before observer
      const current = querySel();
      if (changeType === 'appear' && current) {
        return finish('matched', 'element already present');
      }
      if (changeType === 'disappear' && !current) {
        return finish('matched', 'element already absent');
      }

      const initialText = initial?.textContent || '';
      const initialAttrs = initial ? [...initial.attributes].map(a => `${a.name}=${a.value}`).join(';') : '';

      const observer = new MutationObserver(() => {
        const cur = querySel();
        if (changeType === 'appear' && cur) finish('matched', 'element appeared');
        else if (changeType === 'disappear' && !cur) finish('matched', 'element removed');
        else if (changeType === 'text_change' && cur && cur.textContent !== initialText) {
          finish('matched', `text changed: "${initialText.slice(0, 60)}" → "${(cur.textContent || '').slice(0, 60)}"`);
        }
        else if (changeType === 'attribute_change' && cur) {
          const newAttrs = [...cur.attributes].map(a => `${a.name}=${a.value}`).join(';');
          if (newAttrs !== initialAttrs) finish('matched', 'attributes changed');
        }
      });

      observer.observe(document.body, {
        childList: true, subtree: true, characterData: true, attributes: true,
      });

      timer = setTimeout(() => finish('timeout', `no ${changeType} within ${timeoutMs}ms`), timeoutMs);
    });
  }, [selector, change, timeout_ms]);

  if (!result) return { is_error: true, content: 'watch_element returned nothing.' };
  if (result.status === 'matched') {
    return { content: `✓ ${result.detail} (${result.elapsed_ms}ms)` };
  }
  return { content: `⏱ ${result.detail}` };
}

// =====================================================================
// CDP KEY — real isTrusted=true keyboard events
// =====================================================================

async function tool_cdpKey({ text, tab_id }) {
  if (!text) return { is_error: true, content: 'text is required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };

  // Determine: is this a key combo or plain text?
  const isComboLike = /^[A-Z][a-zA-Z]*$|[+\-]/.test(text) && text.length < 30 && !/\s/.test(text);

  try {
    await chrome.debugger.attach({ tabId: tab.id }, '1.3');
  } catch (e) {
    if (!e.message.includes('already attached')) {
      return { is_error: true, content: `CDP attach failed: ${e.message}` };
    }
  }

  try {
    if (isComboLike && (text.includes('+') || /^[A-Z]/.test(text))) {
      // Parse combo: "ctrl+shift+a" or "Enter"
      const parts = text.split('+').map(p => p.trim());
      const key = parts[parts.length - 1];
      const modifiers = parts.slice(0, -1).map(m => m.toLowerCase());
      let mod = 0;
      if (modifiers.includes('alt')) mod |= 1;
      if (modifiers.includes('ctrl') || modifiers.includes('control')) mod |= 2;
      if (modifiers.includes('meta') || modifiers.includes('cmd') || modifiers.includes('super')) mod |= 4;
      if (modifiers.includes('shift')) mod |= 8;

      const keyMap = {
        'Enter': { code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 },
        'Tab': { code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 },
        'Escape': { code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 },
        'Backspace': { code: 'Backspace', key: 'Backspace', windowsVirtualKeyCode: 8 },
        'Delete': { code: 'Delete', key: 'Delete', windowsVirtualKeyCode: 46 },
        'ArrowUp': { code: 'ArrowUp', key: 'ArrowUp', windowsVirtualKeyCode: 38 },
        'ArrowDown': { code: 'ArrowDown', key: 'ArrowDown', windowsVirtualKeyCode: 40 },
        'ArrowLeft': { code: 'ArrowLeft', key: 'ArrowLeft', windowsVirtualKeyCode: 37 },
        'ArrowRight': { code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39 },
        'Home': { code: 'Home', key: 'Home', windowsVirtualKeyCode: 36 },
        'End': { code: 'End', key: 'End', windowsVirtualKeyCode: 35 },
        'PageUp': { code: 'PageUp', key: 'PageUp', windowsVirtualKeyCode: 33 },
        'PageDown': { code: 'PageDown', key: 'PageDown', windowsVirtualKeyCode: 34 },
        'Space': { code: 'Space', key: ' ', windowsVirtualKeyCode: 32 },
      };

      let keyInfo;
      if (keyMap[key]) {
        keyInfo = keyMap[key];
      } else if (key.length === 1) {
        const upper = key.toUpperCase();
        keyInfo = {
          code: 'Key' + upper,
          key: key.toLowerCase(),
          windowsVirtualKeyCode: upper.charCodeAt(0),
        };
      } else {
        return { is_error: true, content: `Unknown key: ${key}` };
      }

      await chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchKeyEvent', {
        type: 'keyDown', modifiers: mod, ...keyInfo,
      });
      await chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchKeyEvent', {
        type: 'keyUp', modifiers: mod, ...keyInfo,
      });
      return { content: `✓ CDP key: ${text}` };
    }

    // Plain text — type each char with Input.insertText
    await chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.insertText', { text });
    return { content: `✓ CDP typed ${text.length} chars (isTrusted=true)` };
  } catch (e) {
    return { is_error: true, content: `CDP key error: ${e.message}` };
  }
}

// =====================================================================
// READ-ONLY MODE
// =====================================================================

const _READONLY_KEY = 'moonbridge_readonly';

async function tool_setReadonly({ enabled }) {
  if (typeof enabled !== 'boolean') return { is_error: true, content: 'enabled boolean required.' };
  await chrome.storage.local.set({ [_READONLY_KEY]: enabled });
  return { content: enabled
    ? '🔒 Read-only mode ENABLED. Click/type/navigate tools will be blocked.'
    : '🔓 Read-only mode disabled.' };
}

async function _isReadonly() {
  try {
    const { [_READONLY_KEY]: r } = await chrome.storage.local.get([_READONLY_KEY]);
    return !!r;
  } catch { return false; }
}

// =====================================================================
// STABLE REFS — survive across get_page calls
// =====================================================================

async function tool_stableRef({ selector, tab_id }) {
  if (!selector) return { is_error: true, content: 'selector required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };

  const result = await execIsolated(tab.id, (sel) => {
    const refMap = window.__claudeRefs__ || {};
    const refMatch = sel.match(/^#ref-(\d+)$/);
    const el = refMatch ? refMap[refMatch[1]] : document.querySelector(sel);
    if (!el) return { ok: false, error: 'element not found' };

    // Build a stable selector: tag + id + classes + nth-of-type + text
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${CSS.escape(el.id)}` : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('moonbridge-')).slice(0, 2).map(c => CSS.escape(c)).join('.')
      : '';
    let stableSel = tag + id + cls;

    // If not unique, add nth-of-type
    try {
      const matches = document.querySelectorAll(stableSel);
      if (matches.length > 1) {
        const parent = el.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter(c => c.tagName === el.tagName);
          const idx = siblings.indexOf(el) + 1;
          stableSel = `${stableSel}:nth-of-type(${idx})`;
        }
      }
    } catch {}

    // Persist in stable map
    window.__claudeStableRefs__ = window.__claudeStableRefs__ || {};
    const id_n = Object.keys(window.__claudeStableRefs__).length + 1;
    const stableId = `$stable-${id_n}`;
    window.__claudeStableRefs__[stableId] = { selector: stableSel, captured_at: Date.now() };

    const text = (el.innerText || el.textContent || '').slice(0, 60).trim();
    return { ok: true, stableId, selector: stableSel, text };
  }, [selector]);

  if (!result?.ok) {
    return { is_error: true, content: result?.error || 'stable_ref failed.' };
  }
  return {
    content: `✓ Stable selector for "${result.text}":\n   ${result.selector}\n\n` +
             `Use this CSS selector instead of #ref-N — it survives across get_page calls and DOM updates (as long as the element's tag/id/class don't change).`
  };
}

// =====================================================================
// TAB GROUP
// =====================================================================

async function tool_groupTabs({ tab_ids, title, color = 'orange' }) {
  if (!Array.isArray(tab_ids) || !tab_ids.length) {
    return { is_error: true, content: 'tab_ids array required.' };
  }
  try {
    const groupId = await chrome.tabs.group({ tabIds: tab_ids });
    await chrome.tabGroups.update(groupId, { title: title || 'MoonBridge', color });
    return { content: `✓ Grouped ${tab_ids.length} tabs as "${title || 'MoonBridge'}" (${color}).` };
  } catch (e) {
    return { is_error: true, content: `group_tabs error: ${e.message}` };
  }
}

// =====================================================================
// VIRTUAL WORKSPACE — sandboxed storage separate from user's Downloads
// =====================================================================

const _WS_KEY = 'moonbridge_workspace';

async function _wsRead() {
  const { [_WS_KEY]: ws } = await chrome.storage.local.get([_WS_KEY]);
  return ws && typeof ws === 'object' ? ws : {};
}
async function _wsWrite(ws) { await chrome.storage.local.set({ [_WS_KEY]: ws }); }

async function tool_workspaceWrite({ path, content, encoding = 'utf8' }) {
  if (!path || content == null) return { is_error: true, content: 'path and content required.' };
  const ws = await _wsRead();
  ws[path] = {
    content: String(content),
    encoding,
    updated_at: Date.now(),
    size: encoding === 'base64' ? Math.floor(content.length * 3 / 4) : new Blob([content]).size,
  };
  await _wsWrite(ws);
  return { content: `✓ Wrote ${path} (${formatBytes(ws[path].size)}). Total files in workspace: ${Object.keys(ws).length}.` };
}

async function tool_workspaceRead({ path }) {
  if (!path) return { is_error: true, content: 'path required.' };
  const ws = await _wsRead();
  if (!ws[path]) return { is_error: true, content: `File not found: ${path}. Use workspace_list to see available files.` };
  const f = ws[path];
  return {
    content: `--- ${path} (${formatBytes(f.size)}, ${f.encoding}) ---\n${f.content}`
  };
}

async function tool_workspaceList({ prefix = '' }) {
  const ws = await _wsRead();
  const entries = Object.entries(ws).filter(([p]) => !prefix || p.startsWith(prefix));
  if (!entries.length) return { content: prefix ? `(no files matching "${prefix}")` : '(workspace empty)' };
  entries.sort((a, b) => b[1].updated_at - a[1].updated_at);
  const lines = [`Virtual workspace${prefix ? ' (filter: ' + prefix + ')' : ''} — ${entries.length} file(s):`];
  for (const [p, f] of entries) {
    const ago = Math.round((Date.now() - f.updated_at) / 60000);
    lines.push(`  ${p}  (${formatBytes(f.size)}, ${ago}m ago)`);
  }
  return { content: lines.join('\n') };
}

async function tool_workspaceDelete({ path, prefix }) {
  const ws = await _wsRead();
  let removed = 0;
  if (path && ws[path]) { delete ws[path]; removed = 1; }
  else if (prefix) {
    for (const k of Object.keys(ws)) {
      if (k.startsWith(prefix)) { delete ws[k]; removed++; }
    }
  }
  if (!removed) return { content: 'No matching files.' };
  await _wsWrite(ws);
  return { content: `✓ Deleted ${removed} file(s).` };
}

// =====================================================================
// CROSS-TAB DIFF
// =====================================================================

async function tool_diffTabs({ tab_a, tab_b, mode = 'text', max_chars = 8000 }) {
  if (!tab_a || !tab_b) return { is_error: true, content: 'tab_a and tab_b required.' };
  let ta, tb;
  try {
    ta = await chrome.tabs.get(tab_a);
    tb = await chrome.tabs.get(tab_b);
  } catch (e) { return { is_error: true, content: `Tab not found: ${e.message}` }; }
  if (isRestrictedUrl(ta.url) || isRestrictedUrl(tb.url)) {
    return { is_error: true, content: 'One or both tabs are restricted pages.' };
  }

  const grab = async (tabId) => {
    return await execIsolated(tabId, (m) => {
      if (m === 'meta') {
        return {
          url: location.href,
          title: document.title,
          headings: [...document.querySelectorAll('h1, h2, h3')].slice(0, 30).map(h => h.tagName + ':' + (h.innerText || '').trim().slice(0, 80)),
          forms: document.querySelectorAll('form').length,
          links: document.querySelectorAll('a[href]').length,
          images: document.querySelectorAll('img').length,
        };
      }
      if (m === 'structure') {
        const walk = (el, depth = 0) => {
          if (depth > 6) return '';
          let s = '  '.repeat(depth) + el.tagName.toLowerCase();
          if (el.id) s += '#' + el.id;
          if (el.children.length) s += ` (${el.children.length})`;
          s += '\n';
          for (const c of el.children) s += walk(c, depth + 1);
          return s;
        };
        return walk(document.body || document.documentElement);
      }
      // text
      return (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
    }, [mode]);
  };

  const a = await grab(tab_a);
  const b = await grab(tab_b);

  if (mode === 'meta') {
    const lines = ['META DIFF:', `Tab ${tab_a}: ${ta.title}`, `  URL: ${ta.url}`, `  Forms: ${a.forms}, Links: ${a.links}, Images: ${a.images}`];
    lines.push(`Tab ${tab_b}: ${tb.title}`, `  URL: ${tb.url}`, `  Forms: ${b.forms}, Links: ${b.links}, Images: ${b.images}`);
    const onlyA = a.headings.filter(h => !b.headings.includes(h));
    const onlyB = b.headings.filter(h => !a.headings.includes(h));
    if (onlyA.length) { lines.push('', 'HEADINGS only in A:'); for (const h of onlyA.slice(0, 20)) lines.push('  + ' + h); }
    if (onlyB.length) { lines.push('', 'HEADINGS only in B:'); for (const h of onlyB.slice(0, 20)) lines.push('  + ' + h); }
    return { content: lines.join('\n') };
  }

  // text or structure: line-by-line diff (cheap LCS-free version)
  const aLines = (typeof a === 'string' ? a : '').split('\n');
  const bLines = (typeof b === 'string' ? b : '').split('\n');
  const aSet = new Set(aLines);
  const bSet = new Set(bLines);
  const onlyInA = aLines.filter(l => l.trim() && !bSet.has(l));
  const onlyInB = bLines.filter(l => l.trim() && !aSet.has(l));

  const lines = [`${mode.toUpperCase()} DIFF (tab ${tab_a} vs ${tab_b}):`, `A only: ${onlyInA.length} lines`, `B only: ${onlyInB.length} lines`, ''];
  if (onlyInA.length) {
    lines.push('--- only in A ---');
    for (const l of onlyInA.slice(0, 40)) lines.push('- ' + l.slice(0, 200));
    if (onlyInA.length > 40) lines.push(`  … ${onlyInA.length - 40} more`);
  }
  if (onlyInB.length) {
    lines.push('--- only in B ---');
    for (const l of onlyInB.slice(0, 40)) lines.push('+ ' + l.slice(0, 200));
    if (onlyInB.length > 40) lines.push(`  … ${onlyInB.length - 40} more`);
  }
  const out = lines.join('\n');
  return { content: out.length > max_chars ? out.slice(0, max_chars) + '\n[truncated]' : out };
}

// =====================================================================
// CHECK AUTH — heuristic login detection
// =====================================================================

async function tool_checkAuth({ tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };

  const result = await execIsolated(tab.id, () => {
    const signals = { logged_in: 0, logged_out: 0, indicators: [] };

    // Logged-out signals
    const loginForms = [...document.querySelectorAll('form')].filter(f => {
      const html = f.innerHTML.toLowerCase();
      return /password|sign\s*in|log\s*in/i.test(html);
    });
    if (loginForms.length) {
      signals.logged_out += 3;
      signals.indicators.push(`login form found (${loginForms.length})`);
    }

    const signinLinks = [...document.querySelectorAll('a, button')].filter(el => {
      const t = (el.innerText || el.textContent || '').toLowerCase().trim();
      return /^(sign\s*in|log\s*in|login|register|sign\s*up)$/.test(t);
    });
    if (signinLinks.length) {
      signals.logged_out += 2;
      signals.indicators.push(`"sign in/up" link visible`);
    }

    // Logged-in signals
    const signoutLinks = [...document.querySelectorAll('a, button')].filter(el => {
      const t = (el.innerText || el.textContent || '').toLowerCase().trim();
      return /^(sign\s*out|log\s*out|logout)$/.test(t);
    });
    if (signoutLinks.length) {
      signals.logged_in += 4;
      signals.indicators.push(`"sign out" link visible`);
    }

    // Avatar / profile indicators
    const avatars = document.querySelectorAll('[class*="avatar"], [class*="profile"], [aria-label*="account" i], [aria-label*="profile" i]');
    if (avatars.length) {
      signals.logged_in += 2;
      signals.indicators.push(`avatar/profile element (${avatars.length})`);
    }

    // Cookies named like session
    const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0].toLowerCase());
    const sessionCookies = cookies.filter(c => /session|auth|token|jwt|sid$/.test(c));
    if (sessionCookies.length) {
      signals.logged_in += 1;
      signals.indicators.push(`session cookies: ${sessionCookies.slice(0, 3).join(', ')}`);
    }

    const verdict = signals.logged_in > signals.logged_out ? 'logged_in'
                  : signals.logged_out > signals.logged_in ? 'logged_out'
                  : 'unknown';

    return { verdict, score_in: signals.logged_in, score_out: signals.logged_out, indicators: signals.indicators };
  });

  if (!result) return { is_error: true, content: 'check_auth failed.' };

  const emoji = result.verdict === 'logged_in' ? '✅' : result.verdict === 'logged_out' ? '❌' : '❓';
  const lines = [`${emoji} Auth status for ${tab.url}: ${result.verdict.toUpperCase()}`];
  lines.push(`  Score: logged_in=${result.score_in}, logged_out=${result.score_out}`);
  if (result.indicators.length) {
    lines.push('  Indicators:');
    for (const i of result.indicators) lines.push('    - ' + i);
  }
  if (result.verdict !== 'logged_in') {
    lines.push('', '⚠ Action that requires auth may fail. Ask user to sign in first.');
  }
  return { content: lines.join('\n') };
}

// =====================================================================
// WORKER / SERVICE WORKER CONSOLE
// =====================================================================
//
// Chrome extensions can't directly attach console to web workers from
// content scripts, but CDP (debugger) can subscribe to ALL execution
// contexts including workers. This tool attaches debugger and reads.

const _WORKER_LOG_KEY = 'mb_worker_logs';

async function tool_workerConsole({ tab_id, limit = 50 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };

  // Try to inject a logger into the page that subscribes to worker creation
  // and proxies their console.log via postMessage. We accumulate in storage.

  // Simpler approach: use CDP Runtime.consoleAPICalled with includeAllExecutionContexts
  let attached = false;
  try {
    await chrome.debugger.attach({ tabId: tab.id }, '1.3');
    attached = true;
  } catch (e) {
    if (!e.message.includes('already attached')) {
      return { is_error: true, content: `CDP attach failed: ${e.message}` };
    }
  }

  const logs = [];
  const onEvent = (source, method, params) => {
    if (source.tabId !== tab.id) return;
    if (method === 'Runtime.consoleAPICalled') {
      const ctx = params.executionContextId;
      const args = (params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      logs.push({ type: params.type, args, context: ctx, ts: Date.now() });
    }
  };

  chrome.debugger.onEvent.addListener(onEvent);
  try {
    await chrome.debugger.sendCommand({ tabId: tab.id }, 'Runtime.enable', {});
    // Wait briefly to capture some logs
    await new Promise(r => setTimeout(r, 1500));
  } finally {
    chrome.debugger.onEvent.removeListener(onEvent);
    if (attached) {
      try { await chrome.debugger.detach({ tabId: tab.id }); } catch {}
    }
  }

  if (!logs.length) return { content: '(no worker/SW console logs captured in 1.5s window)' };
  const lines = [`Captured ${logs.length} log entries (across all execution contexts):`];
  for (const l of logs.slice(-limit)) {
    lines.push(`  [${l.type}] ctx=${l.context}: ${l.args.slice(0, 200)}`);
  }
  return { content: lines.join('\n') };
}

// =====================================================================
// HEALTH CHECK — runtime state snapshot
// =====================================================================

async function tool_healthCheck() {
  const out = { ok: true, timestamp: Date.now() };

  // Tab counts
  try {
    const allTabs = await chrome.tabs.query({});
    const activeTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    out.tabs = {
      total: allTabs.length,
      active_id: activeTab?.id,
      active_url: activeTab?.url,
      restricted: allTabs.filter(t => isRestrictedUrl(t.url)).length,
    };
  } catch (e) { out.tabs = { error: e.message }; }

  // Workspace
  try {
    const ws = await _wsRead();
    const totalBytes = Object.values(ws).reduce((s, f) => s + (f.size || 0), 0);
    out.workspace = { files: Object.keys(ws).length, bytes: totalBytes };
  } catch (e) { out.workspace = { error: e.message }; }

  // Readonly state
  out.readonly = await _isReadonly();

  // Mock rules
  out.mocks = {
    tabs_with_mocks: _MOCK_RULES.size,
    total_rules: [..._MOCK_RULES.values()].reduce((s, r) => s + r.length, 0),
  };

  // Nav history (rate limiting)
  const now = Date.now();
  let navInWindow = 0;
  for (const hist of _NAV_HISTORY.values()) {
    navInWindow += hist.filter(h => now - h.ts < _NAV_WINDOW_MS).length;
  }
  out.navigation = {
    recent_count: navInWindow,
    limit: _NAV_LIMIT,
    window_ms: _NAV_WINDOW_MS,
    tabs_tracked: _NAV_HISTORY.size,
  };

  // Debugger attached?
  try {
    const targets = await chrome.debugger.getTargets();
    out.debugger = { attached: targets.filter(t => t.attached).length };
  } catch (e) { out.debugger = { error: e.message }; }

  // Stable refs / claudeRefs (per active tab)
  if (out.tabs?.active_id) {
    try {
      const r = await execIsolated(out.tabs.active_id, () => ({
        refs: Object.keys(window.__claudeRefs__ || {}).length,
        stable: Object.keys(window.__claudeStableRefs__ || {}).length,
      }));
      out.refs = r;
    } catch {}
  }

  // Memory + KB counts (read from chrome.storage)
  try {
    const data = await chrome.storage.local.get(['memories', 'kb', 'scheduled']);
    out.persistence = {
      memories: (data.memories || []).length,
      kb_files: (data.kb || []).length,
      scheduled: (data.scheduled || []).length,
    };
  } catch {}

  const lines = [
    '🟢 MoonBridge HEALTH CHECK',
    `  Tabs: ${out.tabs?.total} total (${out.tabs?.restricted} restricted)`,
    `  Active tab: ${out.tabs?.active_id} → ${(out.tabs?.active_url || '').slice(0, 60)}`,
    `  Workspace: ${out.workspace?.files} files, ${formatBytes(out.workspace?.bytes || 0)}`,
    `  Readonly: ${out.readonly ? '🔒 LOCKED' : 'unlocked'}`,
    `  Active mocks: ${out.mocks?.total_rules} rules across ${out.mocks?.tabs_with_mocks} tab(s)`,
    `  Nav budget: ${out.navigation?.recent_count}/${out.navigation?.limit} in last ${out.navigation?.window_ms / 1000}s`,
    `  Debugger: ${out.debugger?.attached || 0} target(s) attached`,
    out.refs ? `  Refs in active tab: ${out.refs.refs} ref-N, ${out.refs.stable} stable` : null,
    `  Memory: ${out.persistence?.memories} entries, KB: ${out.persistence?.kb_files} files, Scheduled: ${out.persistence?.scheduled} tasks`,
  ].filter(Boolean);
  return { content: lines.join('\n') };
}

// =====================================================================
// CONDITIONAL ACTION — try chain until one succeeds
// =====================================================================

async function tool_conditionalAction({ actions }, ctx) {
  if (!Array.isArray(actions) || !actions.length) {
    return { is_error: true, error_code: ERR_CODES.INVALID_INPUT,
             content: 'actions array required.' };
  }
  const tried = [];
  for (const [i, a] of actions.entries()) {
    if (!a.tool || !a.input) {
      tried.push({ idx: i, tool: a.tool, error: 'missing tool/input' });
      continue;
    }
    // Recursive call to executeTool — picks up wrapping, readonly, etc.
    const result = await executeTool(a.tool, a.input, ctx);
    tried.push({
      idx: i,
      tool: a.tool,
      input_summary: JSON.stringify(a.input).slice(0, 80),
      ok: !result.is_error,
      content: (result.content || '').slice(0, 100),
    });
    if (!result.is_error) {
      const lines = [`✓ Conditional matched at action #${i + 1}: ${a.tool}`];
      lines.push(`  Result: ${(result.content || '').slice(0, 200)}`);
      if (i > 0) {
        lines.push('', `  Skipped:`);
        for (const t of tried.slice(0, i)) {
          lines.push(`    #${t.idx + 1} ${t.tool} → ${t.content}`);
        }
      }
      return { content: lines.join('\n') };
    }
  }
  const lines = ['✗ All actions failed:'];
  for (const t of tried) {
    lines.push(`  #${t.idx + 1} ${t.tool}(${t.input_summary}) → ${t.content || t.error}`);
  }
  return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: lines.join('\n') };
}

// =====================================================================
// ROUND 4 — AI WISHLIST IMPLEMENTATIONS
// =====================================================================

// Helper: resolve selector → element in page (handles #ref-N)
const _resolveSelector = (sel) => {
  const m = sel.match(/^#ref-(\d+)$/);
  if (m && window.__claudeRefs__) {
    const el = window.__claudeRefs__[parseInt(m[1], 10)];
    if (el?.isConnected) return el;
  }
  try { return document.querySelector(sel); } catch { return null; }
};

// ---- get_element_info -----------------------------------------------
async function tool_getElementInfo({ selector, tab_id }) {
  if (!selector) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'selector required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, (sel) => {
    const m = sel.match(/^#ref-(\d+)$/);
    let el = m && window.__claudeRefs__ ? window.__claudeRefs__[parseInt(m[1], 10)] : null;
    if (!el?.isConnected) { try { el = document.querySelector(sel); } catch {} }
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value;
    let path = []; let cur = el;
    while (cur && cur !== document.body && path.length < 6) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) p += '#' + cur.id;
      else if (cur.className && typeof cur.className === 'string') {
        const c = cur.className.split(/\s+/).filter(Boolean)[0];
        if (c) p += '.' + c;
      }
      path.unshift(p); cur = cur.parentElement;
    }
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').slice(0, 500).trim(),
      value: el.value !== undefined ? el.value : null,
      attributes: attrs,
      position: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      visible: rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0',
      computed: {
        display: cs.display, color: cs.color, background: cs.backgroundColor,
        font_size: cs.fontSize, cursor: cs.cursor, z_index: cs.zIndex,
      },
      parent_path: path.join(' > '),
    };
  }, [selector]);
  if (!r) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: `No element matched: ${selector}` };
  return { content: JSON.stringify(r, null, 2) };
}

// ---- smart_click ----------------------------------------------------
async function tool_smartClick({ description, tab_id }, ctx) {
  if (!description) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'description required.' };
  const find = await tool_findByText({ text: description, tab_id });
  if (!find.is_error) {
    const m = (find.content || '').match(/#ref-(\d+)/);
    if (m) return await tool_click({ selector: '#ref-' + m[1], tab_id });
  }
  // Fallback: aria-label / role-based
  const tab = await resolveTab(tab_id);
  const fallback = await execIsolated(tab.id, (desc) => {
    const lower = desc.toLowerCase();
    const els = [...document.querySelectorAll('button, a, [role=button], input[type=submit], input[type=button], [role=link]')];
    const match = els.find(e => {
      const text = ((e.innerText || e.textContent || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('placeholder') || '') + ' ' + (e.getAttribute('title') || '') + ' ' + (e.value || '')).toLowerCase();
      return text.includes(lower);
    });
    if (!match) return null;
    window.__claudeRefs__ = window.__claudeRefs__ || {};
    const id = Object.keys(window.__claudeRefs__).length + 1;
    window.__claudeRefs__[id] = match;
    return { ref: id, label: (match.innerText || match.value || '').slice(0, 60) };
  }, [description]);
  if (!fallback) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: `Couldn't find element matching "${description}".` };
  return await tool_click({ selector: '#ref-' + fallback.ref, tab_id });
}

// ---- smart_type -----------------------------------------------------
async function tool_smartType({ field, text, tab_id, press_enter }, ctx) {
  if (!field) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'field required.' };
  const tab = await resolveTab(tab_id);
  const found = await execIsolated(tab.id, (f) => {
    const lower = f.toLowerCase();
    const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, [contenteditable=""], [contenteditable=true]')];
    const match = inputs.find(e => {
      const tokens = [
        e.getAttribute('aria-label'),
        e.getAttribute('placeholder'),
        e.getAttribute('name'),
        e.getAttribute('id'),
        e.getAttribute('type'),
        e.labels && e.labels[0] ? e.labels[0].innerText : '',
      ].filter(Boolean).join(' ').toLowerCase();
      return tokens.includes(lower);
    });
    if (!match) return null;
    window.__claudeRefs__ = window.__claudeRefs__ || {};
    const id = Object.keys(window.__claudeRefs__).length + 1;
    window.__claudeRefs__[id] = match;
    return { ref: id };
  }, [field]);
  if (!found) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: `No field matching "${field}".` };
  return await tool_type({ selector: '#ref-' + found.ref, text, press_enter, tab_id });
}

// ---- wait_for_navigation --------------------------------------------
async function tool_waitForNavigation({ tab_id, url_contains, timeout_ms = 10000 }) {
  const tab = await resolveTab(tab_id);
  const startUrl = tab.url;
  const deadline = Date.now() + timeout_ms;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
    const cur = await chrome.tabs.get(tab.id);
    const navigated = cur.url !== startUrl && cur.status === 'complete';
    const matchUrl = !url_contains || cur.url.includes(url_contains);
    if (navigated && matchUrl) return { content: `✓ Navigated: ${startUrl} → ${cur.url}` };
  }
  return { is_error: true, error_code: ERR_CODES.TIMEOUT, content: `Navigation didn't complete${url_contains ? ' to ' + url_contains : ''} within ${timeout_ms}ms.` };
}

// ---- wait_for_element_state -----------------------------------------
async function tool_waitForElementState({ selector, state, timeout_ms = 5000, tab_id }) {
  if (!selector || !state) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'selector and state required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, async (sel, st, to) => {
    const start = Date.now();
    let lastSnapshot = '';
    while (Date.now() - start < to) {
      const el = (sel.match(/^#ref-(\d+)$/) && window.__claudeRefs__) ? window.__claudeRefs__[parseInt(sel.match(/^#ref-(\d+)$/)[1])] : document.querySelector(sel);
      if (st === 'hidden' && !el) return { ok: true };
      if (el) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const visible = r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
        if (st === 'visible' && visible) return { ok: true };
        if (st === 'hidden' && !visible) return { ok: true };
        if (st === 'enabled' && !el.disabled) return { ok: true };
        if (st === 'disabled' && el.disabled) return { ok: true };
        if (st === 'stable') {
          const snap = el.outerHTML.slice(0, 500);
          if (snap === lastSnapshot) return { ok: true };
          lastSnapshot = snap;
        }
      }
      await new Promise(r => setTimeout(r, 150));
    }
    return { ok: false };
  }, [selector, state, timeout_ms]);
  if (r?.ok) return { content: `✓ ${selector} reached state: ${state}` };
  return { is_error: true, error_code: ERR_CODES.TIMEOUT, content: `${selector} did not reach state "${state}" within ${timeout_ms}ms.` };
}

// ---- extract_table --------------------------------------------------
async function tool_extractTable({ selector, tab_id, max_rows = 100 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, (sel, max) => {
    const table = sel ? document.querySelector(sel) : document.querySelector('table');
    if (!table) return null;
    const rows = [...table.querySelectorAll('tr')];
    if (!rows.length) return [];
    const headers = [...rows[0].querySelectorAll('th, td')].map(c => (c.innerText || '').trim() || `col${0}`);
    const out = [];
    for (let i = 1; i < rows.length && out.length < max; i++) {
      const cells = [...rows[i].querySelectorAll('td, th')];
      const row = {};
      cells.forEach((c, j) => row[headers[j] || `col${j}`] = (c.innerText || '').trim());
      out.push(row);
    }
    return out;
  }, [selector || '', max_rows]);
  if (!r) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: 'No table found.' };
  return { content: `Extracted ${r.length} row(s):\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`` };
}

// ---- extract_form_data ----------------------------------------------
async function tool_extractFormData({ form_selector, tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, (sel) => {
    const forms = sel ? document.querySelectorAll(sel) : document.querySelectorAll('form');
    return [...forms].map((f, fi) => ({
      form_index: fi,
      action: f.action || null,
      method: f.method || 'get',
      fields: [...f.querySelectorAll('input, textarea, select')].map(i => ({
        name: i.name || null,
        type: i.type || i.tagName.toLowerCase(),
        value: i.type === 'password' ? '***' : (i.value || ''),
        label: i.labels?.[0]?.innerText?.trim() || i.getAttribute('aria-label') || i.getAttribute('placeholder') || null,
        required: i.required || false,
        readonly: i.readOnly || false,
      })),
    }));
  }, [form_selector || '']);
  if (!r?.length) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: 'No forms found.' };
  return { content: `Found ${r.length} form(s):\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`` };
}

// ---- extract_list ---------------------------------------------------
async function tool_extractList({ container, item, fields, tab_id, max_items = 50 }) {
  if (!item) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'item selector required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, (cont, it, flds, max) => {
    const root = cont ? document.querySelector(cont) : document;
    if (!root) return null;
    const items = [...root.querySelectorAll(it)].slice(0, max);
    return items.map(el => {
      if (!flds || !Object.keys(flds).length) return { text: (el.innerText || '').slice(0, 200).trim() };
      const obj = {};
      for (const [k, sel] of Object.entries(flds)) {
        const child = el.querySelector(sel);
        obj[k] = child ? (child.innerText || child.getAttribute('href') || child.getAttribute('src') || '').trim() : null;
      }
      return obj;
    });
  }, [container || '', item, fields || {}, max_items]);
  if (!r) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: 'Container not found.' };
  return { content: `Extracted ${r.length} item(s):\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`` };
}

// ---- extract_metadata -----------------------------------------------
async function tool_extractMetadata({ tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, () => {
    const m = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr);
    const og = {}, tw = {};
    for (const e of document.querySelectorAll('meta[property^="og:"]')) og[e.getAttribute('property').slice(3)] = e.getAttribute('content');
    for (const e of document.querySelectorAll('meta[name^="twitter:"]')) tw[e.getAttribute('name').slice(8)] = e.getAttribute('content');
    const json_ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent); } catch { return null; } }).filter(Boolean);
    return {
      title: document.title,
      description: m('meta[name=description]'),
      canonical: m('link[rel=canonical]', 'href'),
      lang: document.documentElement.lang || null,
      favicon: m('link[rel~=icon]', 'href'),
      og, twitter: tw, json_ld,
    };
  });
  return { content: '```json\n' + JSON.stringify(r, null, 2) + '\n```' };
}

// ---- extract_contacts -----------------------------------------------
async function tool_extractContacts({ tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, () => {
    const text = document.body?.innerText || '';
    const emails = [...new Set(text.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])];
    const phones = [...new Set(text.match(/\+?[\d\s().-]{8,20}\d/g) || [])].filter(p => p.replace(/\D/g, '').length >= 8);
    return { emails, phones };
  });
  return { content: `Emails: ${r.emails.length}, Phones: ${r.phones.length}\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`` };
}

// ---- extract_images -------------------------------------------------
async function tool_extractImages({ tab_id, min_size = 50 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, (min) => {
    return [...document.querySelectorAll('img')]
      .filter(i => i.naturalWidth >= min || i.naturalHeight >= min || i.width >= min || i.height >= min)
      .slice(0, 100)
      .map(i => ({
        src: i.src, alt: i.alt || '',
        width: i.naturalWidth || i.width, height: i.naturalHeight || i.height,
      }));
  }, [min_size]);
  return { content: `Found ${r.length} image(s) ≥ ${min_size}px:\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`` };
}

// ---- wait_for_request -----------------------------------------------
async function tool_waitForRequest({ url_contains, method, timeout_ms = 10000, tab_id }) {
  if (!url_contains) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'url_contains required.' };
  const tab = await resolveTab(tab_id);
  let attached = false;
  try { await chrome.debugger.attach({ tabId: tab.id }, '1.3'); attached = true; }
  catch (e) { if (!e.message.includes('already attached')) return { is_error: true, content: `CDP attach failed: ${e.message}` }; }

  return await new Promise((resolve) => {
    let done = false;
    const requests = new Map();
    const handler = (src, m, p) => {
      if (src.tabId !== tab.id || done) return;
      if (m === 'Network.requestWillBeSent' && p.request.url.includes(url_contains)) {
        if (method && p.request.method !== method) return;
        requests.set(p.requestId, p.request);
      }
      if (m === 'Network.responseReceived' && requests.has(p.requestId)) {
        done = true;
        chrome.debugger.onEvent.removeListener(handler);
        if (attached) { try { chrome.debugger.detach({ tabId: tab.id }); } catch {} }
        resolve({ content: `✓ Caught ${p.response.url} → HTTP ${p.response.status}\n\`\`\`json\n${JSON.stringify({ request: requests.get(p.requestId), response: { status: p.response.status, mimeType: p.response.mimeType } }, null, 2)}\n\`\`\`` });
      }
    };
    chrome.debugger.onEvent.addListener(handler);
    chrome.debugger.sendCommand({ tabId: tab.id }, 'Network.enable').catch(() => {});
    setTimeout(() => {
      if (done) return;
      done = true;
      chrome.debugger.onEvent.removeListener(handler);
      if (attached) { try { chrome.debugger.detach({ tabId: tab.id }); } catch {} }
      resolve({ is_error: true, error_code: ERR_CODES.TIMEOUT, content: `No request matching "${url_contains}" within ${timeout_ms}ms.` });
    }, timeout_ms);
  });
}

// ---- block_resources ------------------------------------------------
async function tool_blockResources({ tab_id, types = [], url_patterns = [] }) {
  const tab = await resolveTab(tab_id);
  if (!types.length && !url_patterns.length) {
    try { await chrome.debugger.sendCommand({ tabId: tab.id }, 'Network.setBlockedURLs', { urls: [] }); } catch {}
    try { await chrome.debugger.detach({ tabId: tab.id }); } catch {}
    return { content: '✓ Resource blocking cleared.' };
  }
  try { await chrome.debugger.attach({ tabId: tab.id }, '1.3'); } catch (e) { if (!e.message.includes('already attached')) return { is_error: true, content: e.message }; }
  await chrome.debugger.sendCommand({ tabId: tab.id }, 'Network.enable').catch(() => {});
  const typeUrls = { image: '*.png|*.jpg|*.jpeg|*.gif|*.webp', font: '*.woff|*.woff2|*.ttf', media: '*.mp4|*.webm|*.mp3', stylesheet: '*.css', script: '*.js' };
  const urls = [];
  for (const t of types) if (typeUrls[t]) urls.push(...typeUrls[t].split('|'));
  urls.push(...url_patterns);
  await chrome.debugger.sendCommand({ tabId: tab.id }, 'Network.setBlockedURLs', { urls });
  return { content: `✓ Blocking ${urls.length} pattern(s) on tab ${tab.id}: ${urls.slice(0, 5).join(', ')}${urls.length > 5 ? '…' : ''}` };
}

// ---- get_visible_text -----------------------------------------------
async function tool_getVisibleText({ tab_id, max_chars = 10000 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, (max) => {
    const text = document.body?.innerText || '';
    return { text: text.slice(0, max), total: text.length };
  }, [max_chars]);
  const trunc = r.total > max_chars ? `\n\n[⚠ TRUNCATED: ${r.total} of ${max_chars} chars shown]` : '';
  return { content: r.text + trunc };
}

// ---- find_clickable -------------------------------------------------
async function tool_findClickable({ tab_id, limit = 80 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, (lim) => {
    window.__claudeRefs__ = window.__claudeRefs__ || {};
    let id = Object.keys(window.__claudeRefs__).length;
    const sel = 'a[href], button, input:not([type=hidden]), [role=button], [role=link], [onclick]';
    const items = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      id++;
      window.__claudeRefs__[id] = el;
      items.push({
        ref: id, tag: el.tagName.toLowerCase(),
        type: el.type || el.getAttribute('role') || 'click',
        label: ((el.innerText || el.value || el.getAttribute('aria-label') || '').slice(0, 80) || '(unnamed)').replace(/\s+/g, ' ').trim(),
        position: { x: Math.round(r.x), y: Math.round(r.y) },
      });
      if (items.length >= lim) break;
    }
    return items;
  }, [limit]);
  const lines = [`${r.length} clickable element(s):`];
  for (const i of r) lines.push(`  #ref-${i.ref}  [${i.tag}/${i.type}]  ${i.label}  @(${i.position.x},${i.position.y})`);
  return { content: lines.join('\n') };
}

// ---- pdf_export -----------------------------------------------------
async function tool_pdfExport({ tab_id, filename = 'page.pdf', landscape = false }) {
  const tab = await resolveTab(tab_id);
  let attached = false;
  try { await chrome.debugger.attach({ tabId: tab.id }, '1.3'); attached = true; }
  catch (e) { if (!e.message.includes('already attached')) return { is_error: true, content: e.message }; }
  try {
    const r = await chrome.debugger.sendCommand({ tabId: tab.id }, 'Page.printToPDF', { landscape, printBackground: true });
    const dataUrl = `data:application/pdf;base64,${r.data}`;
    const id = await chrome.downloads.download({ url: dataUrl, filename });
    return { content: `✓ Saved as PDF: ${filename} (download id=${id}, ${formatBytes(Math.floor(r.data.length * 3 / 4))})` };
  } catch (e) {
    return { is_error: true, content: `pdf_export failed: ${e.message}` };
  } finally {
    if (attached) { try { await chrome.debugger.detach({ tabId: tab.id }); } catch {} }
  }
}

// ---- element_exists / count_elements --------------------------------
async function tool_elementExists({ selector, tab_id }) {
  if (!selector) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'selector required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const exists = await execIsolated(tab.id, (s) => {
    const m = s.match(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) return !!window.__claudeRefs__[parseInt(m[1])]?.isConnected;
    try { return !!document.querySelector(s); } catch { return false; }
  }, [selector]);
  return { content: `${selector}: ${exists ? 'exists' : 'NOT FOUND'}` };
}

async function tool_countElements({ selector, tab_id }) {
  if (!selector) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'selector required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const n = await execIsolated(tab.id, (s) => { try { return document.querySelectorAll(s).length; } catch { return -1; } }, [selector]);
  if (n < 0) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: `Invalid selector: ${selector}` };
  return { content: `${selector}: ${n} element(s)` };
}

// ---- scroll_to_element / highlight_element / scroll_through_page ----
async function tool_scrollToElement({ selector, block = 'center', tab_id }) {
  if (!selector) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'selector required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const ok = await execIsolated(tab.id, (s, b) => {
    const m = s.match(/^#ref-(\d+)$/);
    const el = m && window.__claudeRefs__ ? window.__claudeRefs__[parseInt(m[1])] : document.querySelector(s);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: b });
    return true;
  }, [selector, block]);
  if (!ok) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: `Element not found: ${selector}` };
  await new Promise(r => setTimeout(r, 400));
  return { content: `✓ Scrolled to ${selector} (block=${block})` };
}

async function tool_highlightElement({ selector, color = 'red', duration_ms = 2000, tab_id }) {
  if (!selector) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'selector required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const ok = await execIsolated(tab.id, (s, c, d) => {
    const m = s.match(/^#ref-(\d+)$/);
    const el = m && window.__claudeRefs__ ? window.__claudeRefs__[parseInt(m[1])] : document.querySelector(s);
    if (!el) return false;
    const orig = el.style.outline;
    el.style.outline = `3px solid ${c}`;
    el.style.outlineOffset = '2px';
    setTimeout(() => { el.style.outline = orig; el.style.outlineOffset = ''; }, d);
    return true;
  }, [selector, color, duration_ms]);
  if (!ok) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: 'Element not found.' };
  return { content: `✓ Highlighted ${selector} (${color}, ${duration_ms}ms)` };
}

async function tool_scrollThroughPage({ tab_id, step_px = 500, delay_ms = 300, max_scrolls = 30 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, async (step, delay, max) => {
    let lastH = 0; let scrolls = 0;
    for (let i = 0; i < max; i++) {
      window.scrollBy(0, step);
      await new Promise(r => setTimeout(r, delay));
      scrolls++;
      const h = document.documentElement.scrollHeight;
      if (h === lastH && window.scrollY + window.innerHeight >= h - 5) break;
      lastH = h;
    }
    return { scrolls, final_height: lastH, position: window.scrollY };
  }, [step_px, delay_ms, max_scrolls]);
  return { content: `✓ Scrolled ${r.scrolls} time(s). Page height: ${r.final_height}px, position: ${r.position}px` };
}

// ---- retry_with_backoff ---------------------------------------------
async function tool_retryWithBackoff({ tool, input, max_attempts = 3, backoff_ms = 500 }, ctx) {
  if (!tool) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'tool required.' };
  let last;
  for (let i = 0; i < max_attempts; i++) {
    last = await executeTool(tool, input || {}, ctx);
    if (!last.is_error) return { content: `✓ Succeeded on attempt ${i + 1}/${max_attempts}\n${last.content}` };
    if (i < max_attempts - 1) await new Promise(r => setTimeout(r, backoff_ms * Math.pow(2, i)));
  }
  return { is_error: true, error_code: last?.error_code || ERR_CODES.EXEC_FAILED,
           content: `All ${max_attempts} attempts failed. Last error: ${last?.content}` };
}

// ---- auth save/restore/list -----------------------------------------
const _AUTH_KEY = 'mb_auth_states';

async function tool_authSave({ name, tab_id }) {
  if (!name) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'name required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const url = new URL(tab.url);
  const cookies = await chrome.cookies.getAll({ url: tab.url });
  const storage = await execIsolated(tab.id, () => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
  }));
  const { [_AUTH_KEY]: existing = {} } = await chrome.storage.local.get([_AUTH_KEY]);
  existing[name] = { domain: url.hostname, url: tab.url, cookies, storage, saved_at: Date.now() };
  await chrome.storage.local.set({ [_AUTH_KEY]: existing });
  return { content: `✓ Saved auth "${name}": ${cookies.length} cookies, ${Object.keys(storage.local).length} localStorage entries.` };
}

async function tool_authRestore({ name, tab_id }) {
  if (!name) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'name required.' };
  const tab = await resolveTab(tab_id);
  const { [_AUTH_KEY]: existing = {} } = await chrome.storage.local.get([_AUTH_KEY]);
  const snap = existing[name];
  if (!snap) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: `No auth slot named "${name}".` };
  let restored = 0;
  for (const c of snap.cookies) {
    try {
      await chrome.cookies.set({
        url: tab.url, name: c.name, value: c.value, domain: c.domain, path: c.path,
        secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
        expirationDate: c.expirationDate,
      });
      restored++;
    } catch {}
  }
  await execIsolated(tab.id, (s) => {
    for (const [k, v] of Object.entries(s.local)) localStorage.setItem(k, v);
    for (const [k, v] of Object.entries(s.session)) sessionStorage.setItem(k, v);
  }, [snap.storage]);
  return { content: `✓ Restored "${name}": ${restored}/${snap.cookies.length} cookies, storage applied. Reload page to apply.` };
}

async function tool_authList() {
  const { [_AUTH_KEY]: existing = {} } = await chrome.storage.local.get([_AUTH_KEY]);
  const items = Object.entries(existing);
  if (!items.length) return { content: '(no saved auth states)' };
  const lines = [`${items.length} saved auth state(s):`];
  for (const [name, s] of items) {
    const ago = Math.round((Date.now() - s.saved_at) / 60000);
    lines.push(`  • ${name}  domain=${s.domain}  cookies=${s.cookies.length}  ${ago}m ago`);
  }
  return { content: lines.join('\n') };
}

// ---- export_data ----------------------------------------------------
async function tool_exportData({ data, format = 'csv', filename }) {
  if (!Array.isArray(data) || !data.length) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'data must be non-empty array.' };
  const fname = filename || (format === 'json' ? 'export.json' : 'export.csv');
  let content;
  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
  } else {
    const cols = [...new Set(data.flatMap(r => Object.keys(r)))];
    const esc = (v) => { const s = String(v ?? ''); return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    content = cols.join(',') + '\n' + data.map(r => cols.map(c => esc(r[c])).join(',')).join('\n');
  }
  return await tool_attachFile({ filename: fname, content, mime_type: format === 'json' ? 'application/json' : 'text/csv', caption: `${data.length} rows exported as ${format.toUpperCase()}` });
}

// ---- ai_summarize ---------------------------------------------------
async function tool_aiSummarize({ tab_id, length = 'medium' }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const text = await execIsolated(tab.id, () => (document.body?.innerText || '').slice(0, 30000));
  if (!text) return { is_error: true, content: 'No text to summarize.' };
  const lengthInstr = { short: 'in 1 paragraph', medium: 'in 3-4 paragraphs', long: 'with full breakdown including all main sections' }[length] || 'in 3-4 paragraphs';
  try {
    const out = await _callClaude(
      [{ role: 'user', content: `Summarize this page ${lengthInstr}. Match the language of the source text.\n\n---\n${text}` }],
      2000
    );
    return { content: out || '(empty)' };
  } catch (e) {
    return { is_error: true, content: `Summarize error: ${e.message}` };
  }
}

// =====================================================================
// ROUND 5 — FINAL WISHLIST IMPLEMENTATIONS
// =====================================================================

async function _callClaude(messages, maxTokens = 2000) {
  const { settings } = await chrome.storage.local.get(['settings']);
  if (!settings?.apiToken) throw new Error('No API key set.');
  const baseUrl = (settings.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
  const resp = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiToken,
      'Authorization': `Bearer ${settings.apiToken}`,
      'anthropic-version': '2023-06-01',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      model: settings.defaultModel || 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages,
      stream: false,
    }),
  });
  if (!resp.ok) throw new Error(`Claude HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return await _parseClaudeResponse(resp);
}

// Some proxies (and Anthropic itself when stream=true is forced) return SSE
// even on non-streaming requests. This parser handles both: real JSON, OR
// "event:/data:" SSE chunks that we accumulate into a final message.
async function _parseClaudeResponse(resp) {
  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  const text = await resp.text();
  // Try JSON first
  if (ct.includes('json') || text.trim().startsWith('{')) {
    try {
      const j = JSON.parse(text);
      return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    } catch {
      // fall through to SSE parser
    }
  }
  // SSE format: event: foo\ndata: {...}\n\n
  // Re-assemble text deltas from content_block_delta events
  let buf = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') continue;
    let ev;
    try { ev = JSON.parse(payload); } catch { continue; }
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
      buf += ev.delta.text || '';
    } else if (ev.type === 'message' && Array.isArray(ev.content)) {
      // Some servers send the entire message as a single SSE event
      buf += ev.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    } else if (ev.content && Array.isArray(ev.content)) {
      buf += ev.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    }
  }
  if (buf.trim()) return buf.trim();
  // Last resort: dump the raw response so error message is informative
  throw new Error(`Could not parse Claude response. First 200 chars: ${text.slice(0, 200)}`);
}

// ---- ai_describe_page -----------------------------------------------
async function tool_aiDescribePage({ tab_id, focus }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch (e) { return { is_error: true, content: `Screenshot failed: ${e.message}` }; }
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return { is_error: true, content: 'Bad screenshot data URL.' };
  const prompt = focus
    ? `Describe what is on this page, focusing on: ${focus}. Be concise but precise.`
    : `Describe what is on this page including non-text content (charts, images, canvas drawings, video frames). Be concise but precise.`;
  try {
    const text = await _callClaude([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
        { type: 'text', text: prompt },
      ],
    }], 2500);
    return { content: text || '(empty)' };
  } catch (e) { return { is_error: true, content: e.message }; }
}

// ---- ai_find_element ------------------------------------------------
async function tool_aiFindElement({ intent, tab_id }) {
  if (!intent) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'intent required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const candidates = await execIsolated(tab.id, () => {
    window.__claudeRefs__ = window.__claudeRefs__ || {};
    let id = Object.keys(window.__claudeRefs__).length;
    const items = [];
    for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), [role=button], [role=link], [data-testid], [aria-label]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      id++;
      window.__claudeRefs__[id] = el;
      items.push({
        ref: id,
        tag: el.tagName.toLowerCase(),
        label: ((el.innerText || el.value || el.getAttribute('aria-label') || '').slice(0, 80) || '').replace(/\s+/g, ' ').trim(),
        attrs: { id: el.id, name: el.name, type: el.type, role: el.getAttribute('role'), 'aria-label': el.getAttribute('aria-label'), 'data-testid': el.getAttribute('data-testid') },
      });
      if (items.length >= 80) break;
    }
    return items;
  });
  try {
    const text = await _callClaude([{
      role: 'user',
      content: `User wants to find: "${intent}"\n\nCandidates on page (with #ref-N selectors):\n${JSON.stringify(candidates, null, 2)}\n\nReturn ONLY the JSON: {"best_match": "#ref-N", "confidence": 0-100, "reasoning": "..."}. If no good match, set best_match to null.`,
    }]);
    const j = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return { content: `Best: ${j.best_match || 'none'} (confidence: ${j.confidence || 0}%)\nReason: ${j.reasoning || ''}` };
  } catch (e) { return { is_error: true, content: e.message }; }
}

// ---- ai_extract_data ------------------------------------------------
async function tool_aiExtractData({ description, schema, tab_id, max_chars = 20000 }) {
  if (!description) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'description required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const text = await execIsolated(tab.id, (max) => (document.body?.innerText || '').slice(0, max), [max_chars]);
  if (!text) return { is_error: true, content: 'No text on page.' };
  try {
    const prompt = `Extract: ${description}\n${schema ? 'Target schema: ' + JSON.stringify(schema) + '\n' : ''}From this page text:\n---\n${text}\n---\n\nReturn ONLY valid JSON matching the schema. No markdown fences, no explanation.`;
    const out = await _callClaude([{ role: 'user', content: prompt }], 3000);
    const json = out.match(/[\[\{][\s\S]*[\]\}]/)?.[0] || out;
    JSON.parse(json); // validate
    return { content: '```json\n' + json + '\n```' };
  } catch (e) { return { is_error: true, content: `Extract failed: ${e.message}` }; }
}

// ---- get_accessibility_tree -----------------------------------------
async function tool_getA11yTree({ tab_id, max_nodes = 200 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  let attached = false;
  try { await chrome.debugger.attach({ tabId: tab.id }, '1.3'); attached = true; }
  catch (e) { if (!e.message.includes('already attached')) return { is_error: true, content: e.message }; }
  try {
    await chrome.debugger.sendCommand({ tabId: tab.id }, 'Accessibility.enable');
    const r = await chrome.debugger.sendCommand({ tabId: tab.id }, 'Accessibility.getFullAXTree');
    const nodes = (r.nodes || []).slice(0, max_nodes).map(n => ({
      role: n.role?.value, name: n.name?.value,
      value: n.value?.value, description: n.description?.value,
      ignored: n.ignored,
    })).filter(n => n.role || n.name);
    return { content: `${nodes.length} a11y nodes:\n\`\`\`json\n${JSON.stringify(nodes, null, 2)}\n\`\`\`` };
  } catch (e) { return { is_error: true, content: e.message }; }
  finally { if (attached) { try { await chrome.debugger.detach({ tabId: tab.id }); } catch {} } }
}

// ---- get_page_structure ---------------------------------------------
async function tool_getPageStructure({ tab_id }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, () => {
    const summarize = (el) => el ? ((el.innerText || '').slice(0, 100).replace(/\s+/g, ' ').trim()) : null;
    const findLandmark = (selectors) => { for (const s of selectors) { const el = document.querySelector(s); if (el) return el; } return null; };
    const header = findLandmark(['header', '[role=banner]', '.header', '#header']);
    const nav = findLandmark(['nav', '[role=navigation]', '.nav', '#nav']);
    const main = findLandmark(['main', '[role=main]', '.main', '#main', 'article']);
    const footer = findLandmark(['footer', '[role=contentinfo]', '.footer', '#footer']);
    const sections = main ? [...main.querySelectorAll('section, article, h1, h2')].slice(0, 20).map(s => ({
      tag: s.tagName.toLowerCase(),
      heading: (s.querySelector('h1,h2,h3')?.innerText || s.innerText || '').slice(0, 80).trim(),
    })) : [];
    return {
      title: document.title,
      url: location.href,
      header: summarize(header),
      nav: summarize(nav),
      main_sections: sections,
      footer: summarize(footer),
      headings: [...document.querySelectorAll('h1, h2, h3')].slice(0, 30).map(h => ({ level: h.tagName, text: (h.innerText || '').slice(0, 100).trim() })),
    };
  });
  return { content: '```json\n' + JSON.stringify(r, null, 2) + '\n```' };
}

// ---- monitor_url ----------------------------------------------------
async function tool_monitorUrl({ tab_id, pattern, timeout_ms = 30000 }) {
  if (!pattern) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'pattern required.' };
  const tab = await resolveTab(tab_id);
  const start = Date.now();
  while (Date.now() - start < timeout_ms) {
    await new Promise(r => setTimeout(r, 250));
    const cur = await chrome.tabs.get(tab.id);
    if (cur.url && cur.url.includes(pattern)) return { content: `✓ URL matched after ${Date.now() - start}ms: ${cur.url}` };
  }
  return { is_error: true, error_code: ERR_CODES.TIMEOUT, content: `URL did not match "${pattern}" within ${timeout_ms}ms.` };
}

// ---- monitor_console ------------------------------------------------
async function tool_monitorConsole({ tab_id, level = 'error', duration_ms = 5000 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  let attached = false;
  try { await chrome.debugger.attach({ tabId: tab.id }, '1.3'); attached = true; }
  catch (e) { if (!e.message.includes('already attached')) return { is_error: true, content: e.message }; }
  const logs = [];
  const handler = (src, m, p) => {
    if (src.tabId !== tab.id) return;
    if (m === 'Runtime.consoleAPICalled') {
      if (level === 'all' || p.type === level) {
        logs.push({ type: p.type, args: (p.args || []).map(a => a.value ?? a.description ?? '').join(' '), ts: p.timestamp });
      }
    }
  };
  chrome.debugger.onEvent.addListener(handler);
  try { await chrome.debugger.sendCommand({ tabId: tab.id }, 'Runtime.enable'); } catch {}
  await new Promise(r => setTimeout(r, duration_ms));
  chrome.debugger.onEvent.removeListener(handler);
  if (attached) { try { await chrome.debugger.detach({ tabId: tab.id }); } catch {} }
  if (!logs.length) return { content: `No ${level} entries in ${duration_ms}ms.` };
  const lines = [`Captured ${logs.length} ${level} entries:`];
  for (const l of logs.slice(0, 50)) lines.push(`  [${l.type}] ${l.args.slice(0, 200)}`);
  return { content: lines.join('\n') };
}

// ---- monitor_network ------------------------------------------------
async function tool_monitorNetwork({ tab_id, url_contains, method, duration_ms = 5000 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  let attached = false;
  try { await chrome.debugger.attach({ tabId: tab.id }, '1.3'); attached = true; }
  catch (e) { if (!e.message.includes('already attached')) return { is_error: true, content: e.message }; }
  const requests = new Map();
  const handler = (src, m, p) => {
    if (src.tabId !== tab.id) return;
    if (m === 'Network.requestWillBeSent') {
      if (url_contains && !p.request.url.includes(url_contains)) return;
      if (method && p.request.method !== method) return;
      requests.set(p.requestId, { url: p.request.url, method: p.request.method, ts: p.timestamp, status: 'pending' });
    }
    if (m === 'Network.responseReceived' && requests.has(p.requestId)) {
      const r = requests.get(p.requestId);
      r.status = p.response.status; r.mime = p.response.mimeType;
    }
  };
  chrome.debugger.onEvent.addListener(handler);
  try { await chrome.debugger.sendCommand({ tabId: tab.id }, 'Network.enable'); } catch {}
  await new Promise(r => setTimeout(r, duration_ms));
  chrome.debugger.onEvent.removeListener(handler);
  if (attached) { try { await chrome.debugger.detach({ tabId: tab.id }); } catch {} }
  const arr = [...requests.values()];
  if (!arr.length) return { content: `No matching requests in ${duration_ms}ms.` };
  const lines = [`Captured ${arr.length} request(s):`];
  for (const r of arr.slice(0, 40)) lines.push(`  [${r.status}] ${r.method} ${r.url.slice(0, 120)}`);
  return { content: lines.join('\n') };
}

// ---- conditional_step / loop_until ----------------------------------
async function _checkCondition(cond, tabId) {
  if (!cond) return false;
  if (cond.url_contains) {
    const tab = await chrome.tabs.get(tabId);
    return (tab.url || '').includes(cond.url_contains);
  }
  if (cond.text_contains) {
    return await execIsolated(tabId, (t) => (document.body?.innerText || '').toLowerCase().includes(t.toLowerCase()), [cond.text_contains]);
  }
  if (cond.selector) {
    const exists = await execIsolated(tabId, (s) => {
      try { return !!document.querySelector(s); } catch { return false; }
    }, [cond.selector]);
    return cond.exists === false ? !exists : !!exists;
  }
  return false;
}

async function tool_conditionalStep({ if: condition, then: thenSteps, else: elseSteps, tab_id }, ctx) {
  const tab = await resolveTab(tab_id);
  const matched = await _checkCondition(condition, tab.id);
  const branch = matched ? (thenSteps || []) : (elseSteps || []);
  const tag = matched ? 'THEN' : 'ELSE';
  if (!branch.length) return { content: `Condition: ${tag} (no steps to run).` };
  const results = [];
  for (const [i, step] of branch.entries()) {
    const r = await executeTool(step.tool, step.input || {}, ctx);
    results.push(`#${i + 1} ${step.tool}: ${r.is_error ? '✗ ' + (r.content || '').slice(0, 80) : '✓ ' + (r.content || '').slice(0, 80)}`);
    if (r.is_error) break;
  }
  return { content: `Branch: ${tag}\n${results.join('\n')}` };
}

async function tool_loopUntil({ steps, until, max_iterations = 10, delay_ms = 500, tab_id }, ctx) {
  if (!Array.isArray(steps) || !steps.length) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'steps required.' };
  if (!until) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'until condition required.' };
  const tab = await resolveTab(tab_id);
  for (let i = 0; i < max_iterations; i++) {
    if (await _checkCondition(until, tab.id)) {
      return { content: `✓ Stopped after ${i} iteration(s) — condition met.` };
    }
    for (const step of steps) {
      await executeTool(step.tool, step.input || { tab_id: tab.id }, ctx);
    }
    await new Promise(r => setTimeout(r, delay_ms));
  }
  if (await _checkCondition(until, tab.id)) {
    return { content: `✓ Condition met after ${max_iterations} iterations.` };
  }
  return { is_error: true, error_code: ERR_CODES.TIMEOUT, content: `Condition not met after ${max_iterations} iterations.` };
}

// ---- download_all_images --------------------------------------------
async function tool_downloadAllImages({ tab_id, selector = 'img', folder, min_size = 100 }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, error_code: ERR_CODES.RESTRICTED, content: 'Restricted page.' };
  const urls = await execIsolated(tab.id, (sel, ms) => {
    return [...document.querySelectorAll(sel)]
      .filter(i => i.tagName === 'IMG')
      .filter(i => (i.naturalWidth || i.width) >= ms || (i.naturalHeight || i.height) >= ms)
      .map(i => i.src).filter(s => s && !s.startsWith('data:'));
  }, [selector, min_size]);
  if (!urls.length) return { content: 'No images matched.' };
  const baseFolder = folder || `moonbridge-images-${Date.now().toString(36)}`;
  let saved = 0;
  for (const [i, url] of urls.entries()) {
    try {
      const ext = (url.match(/\.(png|jpg|jpeg|gif|webp|svg)/i) || [])[1] || 'png';
      await chrome.downloads.download({ url, filename: `${baseFolder}/img-${String(i).padStart(3, '0')}.${ext}` });
      saved++;
    } catch {}
  }
  return { content: `✓ Downloaded ${saved}/${urls.length} images to Downloads/${baseFolder}/` };
}

// ---- DB (key-value table on top of workspace) -----------------------
const _DB_KEY = 'mb_db';

async function _dbRead() { const { [_DB_KEY]: db } = await chrome.storage.local.get([_DB_KEY]); return db && typeof db === 'object' ? db : {}; }
async function _dbWrite(db) { await chrome.storage.local.set({ [_DB_KEY]: db }); }

async function tool_dbSet({ table, id, data }) {
  if (!table || !id) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'table, id required.' };
  const db = await _dbRead();
  db[table] = db[table] || {};
  db[table][id] = { ...data, _id: id, _updated_at: Date.now() };
  await _dbWrite(db);
  return { content: `✓ db.${table}[${id}] = ${JSON.stringify(data).slice(0, 100)}. Total in table: ${Object.keys(db[table]).length}.` };
}

async function tool_dbGet({ table, id }) {
  if (!table) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'table required.' };
  const db = await _dbRead();
  if (!db[table]) return { content: `(table "${table}" empty)` };
  if (id) {
    const r = db[table][id];
    if (!r) return { is_error: true, error_code: ERR_CODES.NOT_FOUND, content: `Not found: db.${table}[${id}]` };
    return { content: '```json\n' + JSON.stringify(r, null, 2) + '\n```' };
  }
  const all = Object.values(db[table]);
  return { content: `${all.length} rows in ${table}:\n\`\`\`json\n${JSON.stringify(all, null, 2)}\n\`\`\`` };
}

async function tool_dbQuery({ table, where = {}, limit = 100 }) {
  if (!table) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'table required.' };
  const db = await _dbRead();
  if (!db[table]) return { content: `(table empty)` };
  const matches = (row, conditions) => {
    for (const [k, v] of Object.entries(conditions || {})) {
      if (typeof v === 'object' && v?.op) {
        if (v.op === 'contains' && !String(row[k] ?? '').includes(v.value)) return false;
        if (v.op === 'gt' && !(row[k] > v.value)) return false;
        if (v.op === 'lt' && !(row[k] < v.value)) return false;
      } else {
        if (row[k] !== v) return false;
      }
    }
    return true;
  };
  const rows = Object.values(db[table]).filter(r => matches(r, where)).slice(0, limit);
  return { content: `${rows.length} match(es):\n\`\`\`json\n${JSON.stringify(rows, null, 2)}\n\`\`\`` };
}

async function tool_dbDelete({ table, id, where }) {
  if (!table) return { is_error: true, error_code: ERR_CODES.INVALID_INPUT, content: 'table required.' };
  const db = await _dbRead();
  if (!db[table]) return { content: '(table empty)' };
  let removed = 0;
  if (id) { if (db[table][id]) { delete db[table][id]; removed = 1; } }
  else if (where) {
    const matches = (row) => Object.entries(where).every(([k, v]) => row[k] === v);
    for (const k of Object.keys(db[table])) {
      if (matches(db[table][k])) { delete db[table][k]; removed++; }
    }
  }
  await _dbWrite(db);
  return { content: `✓ Deleted ${removed} record(s) from ${table}.` };
}
