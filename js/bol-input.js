/**
 * bhatkhande.io — Bol Input System
 * Smart autocomplete for Tabla bols with Devanagari ↔ Roman support
 */

class BolInput {
  constructor() {
    this.currentCell = null;
    this.currentScript = 'roman';
    this.onBolChanged = null;      // callback(sectionIdx, avartanIdx, matraIdx, bols)
    this.onNavigate = null;        // callback(direction) — 'left', 'right', 'up', 'down'
    this.isActive = false;
    this.highlightedIdx = -1;      // currently highlighted dropdown index
    this._createOverlay();
  }

  /**
   * Create the floating input overlay with autocomplete dropdown
   */
  _createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'bol-input-overlay';
    this.overlay.innerHTML = `
      <input type="text" class="bol-input-field" placeholder="Type bol or roman=देवनागरी"
             spellcheck="false" autocomplete="off" autocapitalize="off">
      <div class="bol-autocomplete-dropdown"></div>
    `;
    document.body.appendChild(this.overlay);

    this.inputField = this.overlay.querySelector('.bol-input-field');
    this.dropdown = this.overlay.querySelector('.bol-autocomplete-dropdown');

    // Event listeners
    this.inputField.addEventListener('input', () => this._onInput());
    this.inputField.addEventListener('keydown', (e) => this._onKeyDown(e));
    this.inputField.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.overlay.contains(document.activeElement)) {
          this._confirmAndClose();
        }
      }, 200);
    });

    // Prevent overlay click from triggering outside-click-close
    this.overlay.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Show the input overlay on a specific cell
   */
  show(cellEl, sectionIdx, avartanIdx, matraIdx, currentBols) {
    this.currentCell = { el: cellEl, sectionIdx, avartanIdx, matraIdx };

    const rect = cellEl.getBoundingClientRect();
    this.overlay.style.left = `${rect.left + window.scrollX}px`;
    this.overlay.style.top = `${rect.top + window.scrollY}px`;
    this.overlay.style.width = `${Math.max(rect.width, 120)}px`;
    this.overlay.classList.add('active');

    const bolText = (currentBols || []).join(' ');
    this.inputField.value = bolText;
    this.inputField.focus();
    this.inputField.select();

    this.isActive = true;
    this.highlightedIdx = -1;
    this._hideDropdown();
  }

  /**
   * Hide the input overlay
   */
  hide() {
    this.overlay.classList.remove('active');
    this.inputField.value = '';
    this._hideDropdown();
    this.currentCell = null;
    this.isActive = false;
    this.highlightedIdx = -1;
  }

  /**
   * Set the current script (for autocomplete display)
   */
  setScript(script) {
    this.currentScript = script;
  }

  /**
   * Handle text input — trigger autocomplete
   */
  _onInput() {
    const value = this.inputField.value.trim();
    if (!value) {
      this._hideDropdown();
      return;
    }

    const words = value.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.length > 0) {
      const suggestions = this._search(lastWord);
      this._showDropdown(suggestions, lastWord);
    } else {
      this._hideDropdown();
    }
  }

  /**
   * Handle keyboard navigation
   */
  _onKeyDown(e) {
    const dropdownVisible = this.dropdown.classList.contains('visible');
    const items = this.dropdown.querySelectorAll('.autocomplete-item');

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (dropdownVisible && this.highlightedIdx >= 0 && this.highlightedIdx < items.length) {
          // Accept highlighted suggestion
          this._selectSuggestion(items[this.highlightedIdx].dataset.roman);
        } else {
          // Confirm and move right
          this._confirmAndClose();
          if (this.onNavigate) this.onNavigate('right');
        }
        break;

      case 'Tab':
        e.preventDefault();
        if (dropdownVisible && this.highlightedIdx >= 0 && this.highlightedIdx < items.length) {
          this._selectSuggestion(items[this.highlightedIdx].dataset.roman);
        } else {
          this._confirmAndClose();
          if (this.onNavigate) {
            this.onNavigate(e.shiftKey ? 'left' : 'right');
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.hide();
        break;

      case 'ArrowDown':
        if (dropdownVisible) {
          e.preventDefault();
          this._navigateDropdown('down', items);
        }
        break;

      case 'ArrowUp':
        if (dropdownVisible) {
          e.preventDefault();
          this._navigateDropdown('up', items);
        } else {
          e.preventDefault();
          this._confirmAndClose();
          if (this.onNavigate) this.onNavigate('up');
        }
        break;

      case 'ArrowRight':
        if (this.inputField.selectionStart === this.inputField.value.length) {
          if (!dropdownVisible) {
            e.preventDefault();
            this._confirmAndClose();
            if (this.onNavigate) this.onNavigate('right');
          }
        }
        break;

      case 'ArrowLeft':
        if (this.inputField.selectionStart === 0) {
          if (!dropdownVisible) {
            e.preventDefault();
            this._confirmAndClose();
            if (this.onNavigate) this.onNavigate('left');
          }
        }
        break;

      // Number keys 1-8 select numbered suggestions
      case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8':
        if (dropdownVisible) {
          const idx = parseInt(e.key) - 1;
          if (idx < items.length) {
            e.preventDefault();
            this._selectSuggestion(items[idx].dataset.roman);
          }
        }
        break;
    }
  }

  /**
   * Search bols matching a query
   */
  _search(query) {
    const q = query.toLowerCase();
    const results = [];

    // Search Roman keys
    for (const key of BOL_KEYS_SORTED) {
      if (key.toLowerCase().startsWith(q)) {
        results.push({ roman: key, devanagari: BOL_MAP[key] });
      }
    }

    // Also search Devanagari
    for (const [dev, roman] of Object.entries(BOL_MAP_REVERSE)) {
      if (dev.startsWith(query) && !results.find(r => r.roman === roman)) {
        results.push({ roman, devanagari: dev });
      }
    }

    return results.slice(0, 8);
  }

  /**
   * Show autocomplete dropdown
   */
  _showDropdown(suggestions, query) {
    if (suggestions.length === 0) {
      this._hideDropdown();
      return;
    }

    this.highlightedIdx = -1;

    this.dropdown.innerHTML = suggestions.map((s, i) => `
      <div class="autocomplete-item"
           data-roman="${s.roman}"
           data-devanagari="${s.devanagari}"
           data-index="${i}">
        <span class="ac-number">${i + 1}</span>
        <span class="ac-roman">${this._highlight(s.roman, query)}</span>
        <span class="ac-devanagari">${s.devanagari}</span>
      </div>
    `).join('');

    this.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._selectSuggestion(item.dataset.roman);
      });
      item.addEventListener('mouseenter', () => {
        this._clearDropdownHighlight();
        item.classList.add('active');
        this.highlightedIdx = parseInt(item.dataset.index);
      });
    });

    this.dropdown.classList.add('visible');
  }

  /**
   * Hide autocomplete dropdown
   */
  _hideDropdown() {
    this.dropdown.classList.remove('visible');
    this.dropdown.innerHTML = '';
    this.highlightedIdx = -1;
  }

  /**
   * Highlight matching portion of text
   */
  _highlight(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.substring(0, idx) +
           `<strong>${text.substring(idx, idx + query.length)}</strong>` +
           text.substring(idx + query.length);
  }

  /**
   * Clear all dropdown highlights
   */
  _clearDropdownHighlight() {
    this.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.classList.remove('active');
    });
  }

  /**
   * Navigate dropdown with arrow keys
   */
  _navigateDropdown(direction, items) {
    if (items.length === 0) return;

    this._clearDropdownHighlight();

    if (direction === 'down') {
      this.highlightedIdx = this.highlightedIdx < items.length - 1 ? this.highlightedIdx + 1 : 0;
    } else {
      this.highlightedIdx = this.highlightedIdx > 0 ? this.highlightedIdx - 1 : items.length - 1;
    }

    items[this.highlightedIdx].classList.add('active');
    items[this.highlightedIdx].scrollIntoView({ block: 'nearest' });
  }

  /**
   * Select a suggestion from the dropdown
   */
  _selectSuggestion(romanBol) {
    const value = this.inputField.value;
    const words = value.split(/\s+/);
    words[words.length - 1] = romanBol;
    this.inputField.value = words.join(' ') + ' ';
    this._hideDropdown();
    this.inputField.focus();
  }

  /**
   * Confirm the current input and notify listeners
   */
  _confirmAndClose() {
    if (!this.currentCell) return;

    const value = this.inputField.value.trim();
    const bols = value ? value.split(/\s+/).filter(b => b.length > 0) : [];

    const normalizedBols = bols.map(bol =>
      typeof normalizeBolToken === 'function' ? normalizeBolToken(bol) : bol
    );

    if (this.onBolChanged) {
      this.onBolChanged(
        this.currentCell.sectionIdx,
        this.currentCell.avartanIdx,
        this.currentCell.matraIdx,
        normalizedBols
      );
    }

    this.hide();
  }
}


// ─── Quick Entry Parser ──────────────────────────────────────────────

/**
 * Parse a string of bols into an array of matra entries.
 * Space-separated bols = one bol per matra (thah).
 * Bols in brackets [Dha Ti] = multiple bols in one matra (dugun/tigun/chaugun).
 *
 * Example: "Dha Dhin [Dhin Dha] Ta" →
 *   matra 0: ['Dha']
 *   matra 1: ['Dhin']
 *   matra 2: ['Dhin', 'Dha']
 *   matra 3: ['Ta']
 */
function parseQuickEntry(input) {
  const result = [];
  let i = 0;
  const str = input.trim();

  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && str[i] === ' ') i++;
    if (i >= str.length) break;

    if (str[i] === '[') {
      // Multi-bol matra
      i++; // skip [
      let content = '';
      while (i < str.length && str[i] !== ']') {
        content += str[i];
        i++;
      }
      if (i < str.length) i++; // skip ]
      const bols = content.trim().split(/\s+/).filter(b => b.length > 0);
      const normalizedBols = bols.map(bol =>
        typeof normalizeBolToken === 'function' ? normalizeBolToken(bol) : bol
      );
      result.push(normalizedBols);
    } else {
      // Single bol matra
      let word = '';
      while (i < str.length && str[i] !== ' ' && str[i] !== '[') {
        word += str[i];
        i++;
      }
      if (word.length > 0) {
        result.push([
          typeof normalizeBolToken === 'function' ? normalizeBolToken(word) : word
        ]);
      }
    }
  }

  return result;
}
