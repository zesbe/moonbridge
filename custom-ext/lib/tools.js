// Tool definitions + executors for the browser agent.
// Definitions follow Anthropic Messages API tool schema.
//
// Most tools accept an optional `tab_id` to operate on a specific tab without
// switching the active tab — useful for cross-tab workflows.

export const ALL_TOOLS = [
  // ===== Reading =====
  {
    name: 'get_page',
    description: 'Read a tab: URL, title, visible text, and clickable elements with #ref-N selectors. Use FIRST to understand a page. Set full=true to also include hidden/structural elements.',
    input_schema: {
      type: 'object',
      properties: {
        max_chars: { type: 'integer', description: 'Max chars of text (default 4000).' },
        tab_id: { type: 'integer', description: 'Optional tab id. Default = active tab.' },
        full: { type: 'boolean', description: 'Include all elements, not just visible (default false).' },
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
    description: 'Click an element. Provide CSS selector or #ref-N from get_page.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        tab_id: { type: 'integer' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Default left.' },
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
    description: 'COMBO: Click an element, wait for the page to settle, then read the new state. Faster than calling click + wait + get_page separately. Use this when you click something and need to see what changed.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        wait_ms: { type: 'integer', description: 'Settle time before reading (default 800).' },
        max_chars: { type: 'integer' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'navigate_and_read',
    description: 'COMBO: Navigate to a URL and immediately return its content. Faster than navigate + get_page.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        max_chars: { type: 'integer' },
        tab_id: { type: 'integer' },
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
    description: 'Upload an image to an input[type=file] or drop target. Fetches the image from a URL (or base64) and programmatically attaches it via DataTransfer.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for input[type=file] or drop target.' },
        url: { type: 'string', description: 'Image URL. Required if base64 not provided.' },
        base64: { type: 'string', description: 'Base64-encoded image (without data: prefix). Alternative to url.' },
        filename: { type: 'string', description: 'Default "image.png".' },
        mime: { type: 'string', description: 'Default "image/png".' },
        tab_id: { type: 'integer' },
      },
      required: ['selector'],
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
    description: 'Fetch any URL and return its text content (HTML stripped to readable text). Use for raw content access without opening a tab. JSON URLs are returned formatted.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        max_chars: { type: 'integer', description: 'Default 12000.' },
      },
      required: ['url'],
    },
  },

  // ===== File system actions =====
  {
    name: 'download_file',
    description: 'Download a file from a URL to the user\'s Downloads folder. Returns the saved filename.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        filename: { type: 'string', description: 'Optional filename suggestion.' },
      },
      required: ['url'],
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

export async function executeTool(name, input, ctx = {}) {
  if (ctx.whitelist && !ctx.whitelist.has(name)) {
    return { is_error: true, content: `Tool "${name}" is disabled for this conversation.` };
  }
  const needs = await needsApproval(name, input, ctx);
  if (needs.required && ctx.askApproval) {
    const ok = await ctx.askApproval({ name, input, reason: needs.reason });
    if (!ok) return { is_error: true, content: `User denied permission to call ${name}.` };
  }
  try {
    switch (name) {
      case 'get_page':       return await tool_getPage(input || {});
      case 'read_tab':       return await tool_getPage({ ...input, tab_id: input?.tab_id });
      case 'find_element':   return await tool_findElement(input || {});
      case 'extract_links':  return await tool_extractLinks(input || {});
      case 'get_console':    return await tool_getConsole(input || {});
      case 'click':          return await tool_click(input || {});
      case 'hover':          return await tool_hover(input || {});
      case 'type':           return await tool_type(input || {});
      case 'key_press':      return await tool_keyPress(input || {});
      case 'select_option':  return await tool_selectOption(input || {});
      case 'fill_form':      return await tool_fillForm(input || {});
      case 'scroll':         return await tool_scroll(input || {});
      case 'wait_for':       return await tool_waitFor(input || {});
      case 'wait':           return await tool_wait(input || {});
      case 'navigate':       return await tool_navigate(input || {});
      case 'back':           return await tool_back(input || {});
      case 'forward':        return await tool_forward(input || {});
      case 'reload':         return await tool_reload(input || {});
      case 'screenshot':     return await tool_screenshot(input || {});
      case 'execute_js':     return await tool_executeJs(input || {});
      case 'list_tabs':      return await tool_listTabs(input || {});
      case 'switch_tab':     return await tool_switchTab(input || {});
      case 'new_tab':        return await tool_newTab(input || {});
      case 'close_tab':      return await tool_closeTab(input || {});
      case 'duplicate_tab':  return await tool_duplicateTab(input || {});
      case 'click_and_read':  return await tool_clickAndRead(input || {});
      case 'navigate_and_read': return await tool_navigateAndRead(input || {});
      case 'network_log':    return await tool_networkLog(input || {});
      case 'network_response': return await tool_networkResponse(input || {});
      case 'screenshot_snapshot': return await tool_screenshotSnapshot(input || {});
      case 'screenshot_compare': return await tool_screenshotCompare(input || {});
      case 'list_windows':   return await tool_listWindows();
      case 'new_window':     return await tool_newWindow(input || {});
      case 'focus_window':   return await tool_focusWindow(input || {});
      case 'close_window':   return await tool_closeWindow(input || {});
      case 'move_tab':       return await tool_moveTab(input || {});
      case 'batch':          return await tool_batch(input || {}, ctx);
      case 'page_summary':   return await tool_pageSummary(input || {});
      case 'scroll_until':   return await tool_scrollUntil(input || {});
      case 'dom_snapshot':   return await tool_domSnapshot(input || {});
      case 'get_value':      return await tool_getValue(input || {});
      case 'get_attribute':  return await tool_getAttribute(input || {});
      case 'get_text':       return await tool_getText(input || {});
      case 'read_storage':   return await tool_readStorage(input || {});
      case 'write_storage':  return await tool_writeStorage(input || {});
      case 'read_cookies':   return await tool_readCookies(input || {});
      case 'clipboard_read': return await tool_clipboardRead();
      case 'clipboard_write': return await tool_clipboardWrite(input || {});
      case 'element_screenshot': return await tool_elementScreenshot(input || {});
      case 'scratchpad_set': return await tool_scratchpadSet(input || {});
      case 'scratchpad_get': return await tool_scratchpadGet(input || {});
      case 'scratchpad_list': return await tool_scratchpadList();
      case 'note_save':      return await tool_noteSave(input || {});
      case 'note_get':       return await tool_noteGet(input || {});
      case 'note_list':      return await tool_noteList();
      case 'note_delete':    return await tool_noteDelete(input || {});
      case 'get_page_diff':  return await tool_getPageDiff(input || {});
      case 'list_frames':    return await tool_listFrames(input || {});
      case 'find_by_text':   return await tool_findByText(input || {});
      case 'drag_drop':      return await tool_dragDrop(input || {});
      case 'mouse_drag':     return await tool_mouseDrag(input || {});
      case 'double_click':   return await tool_doubleClick(input || {});
      case 'triple_click':   return await tool_tripleClick(input || {});
      case 'get_page_text':  return await tool_getPageText(input || {});
      case 'scroll_to':      return await tool_scrollTo(input || {});
      case 'set_zoom':       return await tool_setZoom(input || {});
      case 'get_zoom':       return await tool_getZoom(input || {});
      case 'resize_window':  return await tool_resizeWindow(input || {});
      case 'upload_image':   return await tool_uploadImage(input || {});
      case 'update_plan':    return await tool_updatePlan(input || {}, ctx);
      case 'gif_capture':    return await tool_gifCapture(input || {});
      case 'web_search':     return await tool_webSearch(input || {});
      case 'youtube_transcript': return await tool_youtubeTranscript(input || {});
      case 'read_pdf':       return await tool_readPdf(input || {});
      case 'fetch_url':      return await tool_fetchUrl(input || {});
      case 'download_file':  return await tool_downloadFile(input || {});
      case 'save_text':      return await tool_saveText(input || {});
      case 'wait_for_idle':  return await tool_waitForIdle(input || {});
      case 'remember':       return await tool_remember(input || {}, ctx);
      case 'forget':         return await tool_forget(input || {}, ctx);
      case 'recall_memories': return await tool_recallMemories(ctx);
      case 'search_kb':      return await tool_searchKb(input || {}, ctx);
      case 'list_kb':        return await tool_listKb(ctx);
      default: return { is_error: true, content: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { is_error: true, content: `Tool ${name} failed: ${e.message || String(e)}` };
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

async function tool_getPage({ max_chars = 2500, tab_id, full = false }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) {
    return { content: `Cannot inspect restricted page: ${tab.url}.` };
  }
  await indicator(tab.id, { type: 'CC_TOAST', text: `Reading ${tab_id ? 'tab ' + tab_id : 'page'}…` });
  const snap = await execIsolated(tab.id, pageSnapshotInPage, [max_chars, full]);
  if (!snap) return { content: 'No snapshot returned.' };
  const lines = [];
  lines.push(`URL: ${snap.url}`);
  lines.push(`TITLE: ${snap.title}`);
  lines.push(`TAB: id=${tab.id}${tab.active ? ' (active)' : ''}`);
  lines.push(`SCROLL: y=${snap.scrollY}/${snap.scrollHeight} (viewport=${snap.viewportH})`);
  if (snap.text) {
    lines.push('---PAGE TEXT---');
    lines.push(snap.text);
  }
  if (snap.elements?.length) {
    lines.push(`---INTERACTIVE ELEMENTS (${snap.elements.length})---`);
    lines.push('(use #ref-N as selector for click/type)');
    for (const el of snap.elements) {
      lines.push(`#ref-${el.ref}  [${el.tag}${el.type ? '/' + el.type : ''}]  ${el.label}`);
    }
  }
  return { content: lines.join('\n') };
}

function pageSnapshotInPage(maxChars, full) {
  const url = location.href, title = document.title;
  const scrollY = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight;
  const viewportH = window.innerHeight;

  function getVisibleText() {
    const body = document.body;
    if (!body) return '';
    const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
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
    const out = []; let total = 0; let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      out.push(t);
      total += t.length + 1;
      if (total > maxChars) break;
    }
    return out.join('\n').slice(0, maxChars);
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
  const sel = 'a[href], button, input:not([type=hidden]), textarea, select, [role=button], [role=link], [role=textbox], [role=combobox], [role=tab], [role=menuitem], [contenteditable=""], [contenteditable=true], [onclick]';
  const elements = [];
  const all = document.querySelectorAll(sel);
  let ref = 0;
  window.__claudeRefs__ = window.__claudeRefs__ || {};
  for (const el of all) {
    if (!full && !isVisible(el)) continue;
    ref++;
    window.__claudeRefs__[ref] = el;
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute('type') || el.getAttribute('role') || '';
    elements.push({ ref, tag, type, label: labelFor(el) });
    if (elements.length >= 50) break;
  }
  return { url, title, scrollY, scrollHeight, viewportH, text: getVisibleText(), elements };
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

async function tool_click({ selector, tab_id, button = 'left' }) {
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  // Auto-retry: try selector now, then poll up to 1.5s if not found yet
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
    if (Date.now() - start > 1500) break;
    await new Promise((r) => setTimeout(r, 250));
    center = await chrome.tabs.sendMessage(tab.id, { type: 'CC_HIGHLIGHT', selector }).catch(() => null);
  }
  await indicator(tab.id, { type: 'CC_UNHIGHLIGHT' });
  if (!result?.ok) return { is_error: true, content: result?.error || 'Click failed (after auto-retry)' };
  await new Promise((r) => setTimeout(r, 350));
  await waitForTabComplete(tab.id, 5000);
  const newTab = await chrome.tabs.get(tab.id);
  return { content: `Clicked ${result.label || selector}. URL: ${newTab.url}` };
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
      if (t === 'check') {
        el.checked = !!f.value && f.value !== 'false';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (t === 'radio') {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
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

async function tool_navigate({ url, tab_id }) {
  if (!/^https?:\/\//i.test(url)) {
    if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) url = 'https://' + url;
    else return { is_error: true, content: 'URL must be http(s).' };
  }
  const tab = await resolveTab(tab_id);
  await indicator(tab.id, { type: 'CC_TOAST', text: `→ ${url}` });
  await chrome.tabs.update(tab.id, { url });
  await waitForTabComplete(tab.id, 20000);
  await new Promise((r) => setTimeout(r, 400));
  const updated = await chrome.tabs.get(tab.id);
  return { content: `Navigated to ${updated.url}. Title: ${updated.title || '(loading)'}` };
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
  // First try isolated world
  let result;
  try {
    result = await execIsolated(tab.id, executeJsInPage, [code]);
  } catch (e) {
    result = { error: e.message };
  }
  // If isolated world failed (often happens with `new Function` blocked by sandbox),
  // try MAIN world via scripting.executeScript.
  if (result?.error) {
    try {
      const [{ result: r2 }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: executeJsInPage,
        args: [code],
      });
      result = r2;
    } catch (e) {
      result = { error: 'isolated+main both failed: ' + e.message };
    }
  }
  // Final fallback: chrome.debugger / CDP (bypasses CSP) — opt-in due to debug bar
  if (result?.error && /csp|content security policy|unsafe-eval|sandbox/i.test(result.error)) {
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

function executeJsInPage(code) {
  try {
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
  // Unique signature so we can tell halusination apart from real output.
  const sig = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  console.log('[moonbridge:list_tabs] sig=' + sig + ' returned', tabs.length, 'tabs');
  const lines = [
    `---OPEN TABS (${tabs.length}) [sig=${sig}]---`,
  ];
  for (const t of tabs) {
    const flags = [];
    if (t.active) flags.push('active');
    if (t.audible) flags.push('audible');
    if (t.pinned) flags.push('pinned');
    const flagStr = flags.length ? ` [${flags.join(',')}]` : '';
    lines.push(`id=${t.id}${flagStr}\n   ${t.url || '(blank)'}\n   ${t.title || ''}`);
  }
  const out = lines.join('\n');
  console.log('[moonbridge:list_tabs] output bytes:', out.length, 'first 100:', out.slice(0, 100));
  return { content: out };
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

async function tool_clickAndRead({ selector, wait_ms = 800, max_chars = 2500, tab_id }) {
  const r1 = await tool_click({ selector, tab_id });
  if (r1.is_error) return r1;
  await new Promise((res) => setTimeout(res, Math.min(3000, Math.max(0, wait_ms))));
  const r2 = await tool_getPage({ max_chars, tab_id });
  return { content: `${r1.content}\n\n${r2.content}` };
}

async function tool_navigateAndRead({ url, max_chars = 2500, tab_id }) {
  const r1 = await tool_navigate({ url, tab_id });
  if (r1.is_error) return r1;
  const r2 = await tool_getPage({ max_chars, tab_id });
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

async function tool_fetchUrl({ url, max_chars = 12000 }) {
  if (!url) return { is_error: true, content: 'url is required.' };
  let res;
  try { res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoonBridge/1.0)' } }); }
  catch (e) { return { is_error: true, content: `Fetch error: ${e.message}` }; }
  if (!res.ok) return { is_error: true, content: `HTTP ${res.status}` };
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    let j;
    try { j = await res.json(); } catch { j = await res.text(); }
    const out = typeof j === 'string' ? j : JSON.stringify(j, null, 2);
    return { content: out.slice(0, max_chars) + (out.length > max_chars ? '\n[truncated]' : '') };
  }
  if (ct.startsWith('text/') || ct.includes('xml') || ct.includes('html')) {
    let html = await res.text();
    if (ct.includes('html')) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Strip scripts/styles
      doc.querySelectorAll('script, style, noscript, iframe').forEach((n) => n.remove());
      const txt = (doc.body?.innerText || doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
      return { content: txt.slice(0, max_chars) + (txt.length > max_chars ? '\n[truncated]' : '') };
    }
    return { content: html.slice(0, max_chars) + (html.length > max_chars ? '\n[truncated]' : '') };
  }
  return { is_error: true, content: `Unsupported content-type: ${ct}` };
}

// =====================================================================
// DOWNLOAD / SAVE
// =====================================================================

async function tool_downloadFile({ url, filename }) {
  if (!url) return { is_error: true, content: 'url is required.' };
  try {
    const opts = { url };
    if (filename) opts.filename = filename;
    const id = await chrome.downloads.download(opts);
    return { content: `Started download (id=${id}).${filename ? ' Filename: ' + filename : ''}` };
  } catch (e) {
    return { is_error: true, content: `Download failed: ${e.message}` };
  }
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
  if (!text) return { is_error: true, content: 'text required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  const r = await execIsolated(tab.id, findByTextInPage, [text, tag || null]);
  if (!r?.length) return { content: `No element matched "${text}".` };
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
  return { content: `Zoom set to ${z}x on tab ${tab.id}.` };
}
async function tool_getZoom({ tab_id }) {
  const tab = await resolveTab(tab_id);
  const z = await chrome.tabs.getZoom(tab.id);
  return { content: `Current zoom: ${z}x` };
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

async function tool_uploadImage({ selector, url, base64, filename = 'image.png', mime = 'image/png', tab_id }) {
  if (!url && !base64) return { is_error: true, content: 'url or base64 required.' };
  const tab = await resolveTab(tab_id);
  if (isRestrictedUrl(tab.url)) return { is_error: true, content: 'Restricted page.' };
  // Resolve image bytes in extension context (CORS-safe via fetch)
  let b64 = base64;
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
  const r = await execIsolated(tab.id, uploadImageInPage, [selector, b64, filename, mime]);
  if (!r?.ok) return { is_error: true, content: r?.error || 'failed' };
  return { content: `Uploaded ${filename} (${r.bytes} bytes) to ${selector}.` };
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
