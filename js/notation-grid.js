/**
 * bhatkhande.io — Notation Grid Renderer
 * Implements the Avartan Block system for multi-line wrapping
 * Auto-renames sections based on selected Layakari
 */

class NotationGrid {
  constructor(containerEl, composition, bolInput) {
    this.container = containerEl;
    this.composition = composition;
    this.bolInput = bolInput;
    this.currentScript = 'roman';
    this.activeCell = null;
    this.onCompositionChanged = null;
    this.onAddSection = null;
    this.onCellClicked = null; // callback(sIdx, aIdx, mIdx) for Quick Entry targeting

    this.bolInput.onBolChanged = (sIdx, aIdx, mIdx, bols) => {
      this.composition.setBol(sIdx, aIdx, mIdx, bols);
      this.render();
      if (this.onCompositionChanged) this.onCompositionChanged();
    };

    this.bolInput.onNavigate = (direction) => {
      this._navigateFromActive(direction);
    };

    // Global click listener to close popups and unactivate cells
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.matra-cell') && !e.target.closest('.bol-input-overlay')) {
        this.bolInput.hide();
        this.activeCell = null;
        if (this.container) {
          this.container.querySelectorAll('.cell-active').forEach(c => c.classList.remove('cell-active'));
        }
      }
      if (!e.target.closest('#add-section-split-container') && this.container) {
        this.container.querySelector('#add-section-menu')?.classList.remove('active');
      }
    });
  }

  setScript(script) {
    this.currentScript = script;
    this.bolInput.setScript(script);
    this.render();
  }

  render() {
    const taal = this.composition.getTaal();
    if (!taal) {
      this.container.innerHTML = '<div class="grid-error">Unknown Taal selected.</div>';
      return;
    }

    let html = '';
    this.composition.sections.forEach((section, sIdx) => {
      html += this._renderSection(section, sIdx, taal);
    });

    const compType = this.composition.compositionType || 'custom';
    let primaryAddLabel = 'Add Section';
    let primaryAddType = 'custom';
    let optionsHtml = '';

    if (compType === 'kayda' || compType === 'peshkar') {
      primaryAddLabel = 'Add Palta';
      primaryAddType = 'palta';
      optionsHtml = `
        <button class="add-section-option" data-type="palta">Add Palta</button>
        <button class="add-section-option" data-type="tihai">Add Tihai</button>
        <button class="add-section-option" data-type="custom">Add Custom Section</button>
      `;
    } else if (compType === 'theka') {
      primaryAddLabel = 'Add Layakari (Dugun)';
      primaryAddType = 'dugun';
      optionsHtml = `
        <button class="add-section-option" data-type="dugun">Add Dugun Section</button>
        <button class="add-section-option" data-type="custom">Add Custom Section</button>
      `;
    } else {
      primaryAddLabel = 'Add Section';
      primaryAddType = 'custom';
      optionsHtml = `
        <button class="add-section-option" data-type="custom">Add Section</button>
        <button class="add-section-option" data-type="tihai">Add Tihai</button>
      `;
    }

    html += `
      <div class="add-section-bar">
        <div class="add-section-split-btn" id="add-section-split-container">
          <button class="btn-add-section-primary" id="btn-add-section-primary" data-type="${primaryAddType}">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            ${primaryAddLabel}
          </button>
          <button class="btn-add-section-dropdown" id="btn-add-section-dropdown" title="More options">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <div class="add-section-menu" id="add-section-menu">
            ${optionsHtml}
          </div>
        </div>
      </div>`;

    this.container.innerHTML = html;
    this._attachEventListeners();
  }

  _renderSection(section, sIdx, taal) {
    const sectionTypeInfo = SECTION_TYPES.find(t => t.id === section.type) || SECTION_TYPES.find(t => t.id === 'custom') || SECTION_TYPES[0];
    const showTypeBadge = section.type !== 'custom';

    let html = `
      <div class="notation-section" data-section="${sIdx}">
        <div class="section-header">
          <div class="section-header-left">
            ${showTypeBadge ? `<span class="section-type-badge ${section.type}">${sectionTypeInfo.nameDevanagari}</span>` : ''}
            <input type="text" class="section-label-input" value="${this._escapeHtml(section.label)}" data-section="${sIdx}">
          </div>
          <div class="section-header-right">
            <div class="layakari-generator-group">
              <select class="form-select fill-theka-speed" data-section="${sIdx}" title="Select Layakari speed">
                  <option value="" disabled selected>Layakari</option>
                  <option value="1">Thah (1x)</option>
                  <option value="2">Dugun (2x)</option>
                  <option value="3">Tigun (3x)</option>
                  <option value="4">Chaugun (4x)</option>
                  <option value="3/2">Aad (3/2)</option>
                  <option value="5/4">Kuad (5/4)</option>
                  <option value="7/4">Biyad (7/4)</option>
              </select>
              <button class="btn-generate-layakari btn-fill-theka" data-section="${sIdx}" title="Generate Section">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 1L2.5 9h4.5v6l7-8h-5V1z"/></svg> Generate
              </button>
            </div>
            <button class="btn-icon btn-action btn-copy-section" data-section="${sIdx}" title="Copy Section Text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            </button>
            <button class="btn-icon btn-action-danger btn-remove-section" data-section="${sIdx}" ${this.composition.sections.length <= 1 ? 'disabled' : ''} title="Remove Section">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        ${this._renderNotationTable(section, sIdx, taal)}
        <button class="btn-add-avartan" data-section="${sIdx}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Add Avartan
        </button>
      </div>`;

    return html;
  }

  _renderNotationTable(section, sIdx, taal) {
    let html = `<div class="notation-table-wrapper">`;
    const baseWrapLimit = taal.wrapAfter || taal.matras;

    // Detect the maximum bol density across all matras in this section
    let maxBolsPerMatra = 1;
    section.avartans.forEach(avartan => {
      avartan.matras.forEach(matra => {
        if (matra && matra.bols) {
          const bolCount = matra.bols.length;
          // Also check for compound bols (single bol that represents multiple)
          if (bolCount === 1 && typeof isCompoundBol !== 'undefined' && isCompoundBol(matra.bols[0])) {
            maxBolsPerMatra = Math.max(maxBolsPerMatra, 2);
          } else {
            maxBolsPerMatra = Math.max(maxBolsPerMatra, bolCount);
          }
        }
      });
    });

    // We use the base wrap limit (usually 8 for Teentaal) to keep the avartan in 2 lines as requested.
    let wrapLimit = baseWrapLimit;

    const allChunks = [];
    for (let i = 0; i < taal.matras; i += wrapLimit) {
      allChunks.push({
        start: i,
        end: Math.min(i + wrapLimit, taal.matras),
        fullSize: Math.min(i + wrapLimit, taal.matras) - i
      });
    }

    section.avartans.forEach((avartan, aIdx) => {
      const renderedMatraCount = this.composition.getRenderedMatraCount(sIdx, aIdx, true) || taal.matras;
      const chunks = allChunks
        .map(chunk => ({
          start: chunk.start,
          end: Math.min(chunk.end, renderedMatraCount),
          fullSize: chunk.fullSize
        }))
        .filter(chunk => chunk.start < chunk.end);

      html += `<div class="avartan-block" data-section="${sIdx}" data-avartan="${aIdx}">`;
      html += `
        <div class="avartan-block-header">
          <span class="avartan-label">Avartan ${aIdx + 1}</span>
          <div class="avartan-actions">
            <button class="btn-avartan-action btn-duplicate-avartan" data-section="${sIdx}" data-avartan="${aIdx}" title="Duplicate this avartan">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.5"/></svg>
              <span>Duplicate</span>
            </button>
            <button class="btn-avartan-action btn-clear-avartan" data-section="${sIdx}" data-avartan="${aIdx}" title="Clear all bols">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5.5 4V2.5h5V4M6.5 7v4M9.5 7v4M3.5 4l.7 9.3a1.5 1.5 0 001.5 1.2h4.6a1.5 1.5 0 001.5-1.2l.7-9.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Clear</span>
            </button>
            <button class="btn-avartan-action btn-copy-avartan" data-section="${sIdx}" data-avartan="${aIdx}" title="Copy avartan text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              <span>Copy</span>
            </button>
            <button class="btn-avartan-action btn-avartan-action--danger btn-remove-avartan" data-section="${sIdx}" data-avartan="${aIdx}" ${this.composition.sections[sIdx].avartans.length <= 1 ? 'disabled' : ''} title="Remove this avartan">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              <span>Remove</span>
            </button>
          </div>
        </div>`;

      chunks.forEach((chunk, chunkIdx) => {
        const numCols = chunk.fullSize;
        const visibleCols = chunk.end - chunk.start;
        const widthPercent = 100; 
        const chunkStyle = `width:${widthPercent}%; max-width:100%;`;
        const tableStyle = `${chunkIdx > 0 ? 'border-top: 1px solid var(--grid-border);' : ''} width: 100%;`;

        const tableClass = `notation-table`;
        html += `<div class="chunk-container" style="${chunkStyle}">`;
        html += `<table class="${tableClass}" style="${tableStyle}">`;

        html += `<colgroup>`;
        for (let i = 0; i < numCols; i++) {
          html += `<col style="width: ${100 / numCols}%;">`;
        }
        html += `</colgroup>`;

        html += `<thead><tr class="markers-row">`;
        for (let i = 0; i < numCols; i++) {
          const matraNum = chunk.start + i;
          const isOffRange = matraNum >= chunk.end;
          const vibClass = isVibhaagStart(taal, matraNum) && i !== 0 ? ' vibhaag-start' : '';
          
          if (isOffRange) {
            html += `<th class="marker-cell${vibClass}"></th>`;
          } else {
            html += `<th class="marker-cell${vibClass}"><span class="matra-num">${matraNum + 1}</span></th>`;
          }
        }
        html += `</tr></thead><tbody>`;

        html += `<tr class="avartan-row" data-section="${sIdx}" data-avartan="${aIdx}">`;
        for (let i = 0; i < numCols; i++) {
          const matraNum = chunk.start + i;
          const isOffRange = matraNum >= chunk.end;
          const vibClass = isVibhaagStart(taal, matraNum) && i !== 0 ? ' vibhaag-start' : '';
          
          if (isOffRange) {
            html += `<td class="matra-cell empty${vibClass}" data-section="${sIdx}" data-avartan="${aIdx}" data-matra="${matraNum}" id="cell-${sIdx}-${aIdx}-${matraNum}"></td>`;
            continue;
          }

          const matra = avartan.matras[matraNum];
          const isActive = this.activeCell && this.activeCell.sectionIdx === sIdx && this.activeCell.avartanIdx === aIdx && this.activeCell.matraIdx === matraNum;
          let classes = 'matra-cell';
          if (isVibhaagStart(taal, matraNum) && i !== 0) classes += ' vibhaag-start';
          if (isActive) classes += ' cell-active';
          if (matraNum === 0) classes += ' sam-column';

          const bolHtml = this._renderBolContent(matra ? matra.bols : []);
          html += `<td class="${classes}" data-section="${sIdx}" data-avartan="${aIdx}" data-matra="${matraNum}" id="cell-${sIdx}-${aIdx}-${matraNum}">${bolHtml}</td>`;
        }
        html += `</tr>`;

        html += `<tr class="symbols-row" data-section="${sIdx}" data-avartan="${aIdx}">`;
        for (let i = 0; i < numCols; i++) {
          const matraNum = chunk.start + i;
          const isOffRange = matraNum >= chunk.end;
          const vibClass = isVibhaagStart(taal, matraNum) && i !== 0 ? ' vibhaag-start' : '';

          if (isOffRange) {
            html += `<td class="symbol-cell empty${vibClass}"></td>`;
            continue;
          }

          const marker = getMarkerForMatra(taal, matraNum);
          if (marker) {
            html += `<td class="symbol-cell${vibClass}"><span class="marker-badge ${marker.type}">${marker.label}</span></td>`;
          } else {
            html += `<td class="symbol-cell${vibClass}"></td>`;
          }
        }
        html += `</tr></tbody></table></div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
    return html;
  }

  _renderBolContent(bols) {
    if (!bols || bols.length === 0) return '<div class="bol-content empty">·</div>';

    // Check if it is a single compound bol
    let isCompound = false;
    if (bols.length === 1) {
      if (typeof isCompoundBol !== 'undefined' && isCompoundBol(bols[0])) {
        isCompound = true;
      }
    }

    if (bols.length === 1 && !isCompound) {
      return `<div class="bol-content thah">${this._escapeHtml(getBolDisplay(bols[0], this.currentScript))}</div>`;
    }

    if (bols.length === 1 && isCompound) {
      const bolText = this._escapeHtml(this._getGroupedBolText(bols));
      return `<div class="bol-content"><div class="bol-group multi-bol"><div class="bol-group-inner"><span class="grouped-bol">${bolText}</span></div><div class="bol-bracket"></div></div></div>`;
    }

    let layaClass = 'multi-bol';
    if (bols.length === 2) layaClass = 'dugun';
    else if (bols.length === 3) layaClass = 'tigun';
    else if (bols.length === 4) layaClass = 'chaugun';
    else if (bols.length === 5) layaClass = 'kuad';
    else if (bols.length >= 6) layaClass = 'biyad';

    const groupedText = this._escapeHtml(this._getGroupedBolText(bols));
    return `<div class="bol-content"><div class="bol-group ${layaClass}"><div class="bol-group-inner"><span class="grouped-bol">${groupedText}</span></div><div class="bol-bracket"></div></div></div>`;
  }

  _getGroupedBolText(bols) {
    return (bols || []).map(bol => getBolDisplay(bol, this.currentScript)).join('');
  }

  _attachEventListeners() {
    this.container.querySelectorAll('.matra-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        this._activateCell(parseInt(cell.dataset.section), parseInt(cell.dataset.avartan), parseInt(cell.dataset.matra), cell);
      });
    });

    this.container.querySelectorAll('.section-label-input').forEach(input => {
      input.addEventListener('change', () => {
        const sIdx = parseInt(input.dataset.section);
        this.composition.updateSectionLabel(sIdx, input.value);
        const detectedType = this._detectSectionType(input.value);
        if (detectedType) this.composition.updateSectionType(sIdx, detectedType);
        this.render();
        if (this.onCompositionChanged) this.onCompositionChanged();
      });
    });

    this.container.querySelectorAll('.btn-remove-section').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (confirm('Remove this section?')) {
          this.composition.removeSection(parseInt(btn.dataset.section));
          this.render();
          if (this.onCompositionChanged) this.onCompositionChanged();
        }
      });
    });

    this.container.querySelectorAll('.btn-fill-theka').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sIdx = parseInt(btn.dataset.section);
        const speedSelect = this.container.querySelector(`.fill-theka-speed[data-section="${sIdx}"]`);

        const speedValue = speedSelect ? speedSelect.value : '';
        if (!speedValue) {
          alert('Please select a Layakari speed to generate first.');
          return;
        }
        const speedName = speedSelect.options[speedSelect.selectedIndex].text.split(' ')[0];

        const result = this.composition.generateLayakariSection(sIdx, speedValue, speedName);
        if (result === -1) {
          alert('Fractional Layakaris are currently only supported for Theka base compositions.');
          return;
        }

        this.render();
        if (this.onCompositionChanged) this.onCompositionChanged();

        // Optional: Scroll to the newly created section
        setTimeout(() => {
          const newSectionEl = this.container.querySelector(`.notation-section[data-section="${result}"]`);
          if (newSectionEl) {
            newSectionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
      });
    });

    this.container.querySelectorAll('.btn-add-avartan').forEach(btn => {
      btn.addEventListener('click', () => {
        this.composition.addAvartan(parseInt(btn.dataset.section));
        this.render();
        if (this.onCompositionChanged) this.onCompositionChanged();
      });
    });

    this.container.querySelectorAll('.btn-duplicate-avartan').forEach(btn => {
      btn.addEventListener('click', () => {
        this.composition.duplicateAvartan(parseInt(btn.dataset.section), parseInt(btn.dataset.avartan));
        this.render();
        if (this.onCompositionChanged) this.onCompositionChanged();
      });
    });

    this.container.querySelectorAll('.btn-clear-avartan').forEach(btn => {
      btn.addEventListener('click', () => {
        this.composition.clearAvartan(parseInt(btn.dataset.section), parseInt(btn.dataset.avartan));
        this.render();
        if (this.onCompositionChanged) this.onCompositionChanged();
      });
    });

    this.container.querySelectorAll('.btn-remove-avartan').forEach(btn => {
      btn.addEventListener('click', () => {
        this.composition.removeAvartan(parseInt(btn.dataset.section), parseInt(btn.dataset.avartan));
        this.render();
        if (this.onCompositionChanged) this.onCompositionChanged();
      });
    });

    const addSectionContainer = this.container.querySelector('#add-section-split-container');
    if (addSectionContainer) {
      const primaryBtn = addSectionContainer.querySelector('#btn-add-section-primary');
      const dropdownBtn = addSectionContainer.querySelector('#btn-add-section-dropdown');
      const menu = addSectionContainer.querySelector('#add-section-menu');

      primaryBtn.addEventListener('click', () => {
        if (this.onAddSection) {
          this.onAddSection(primaryBtn.dataset.type);
        } else {
          this.composition.addSection(primaryBtn.dataset.type, `Section ${this.composition.sections.length + 1}`);
          this.render();
          if (this.onCompositionChanged) this.onCompositionChanged();
        }
      });

      dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('active');
      });

      addSectionContainer.querySelectorAll('.add-section-option').forEach(opt => {
        opt.addEventListener('click', () => {
          menu.classList.remove('active');
          if (this.onAddSection) {
            this.onAddSection(opt.dataset.type);
          } else {
            this.composition.addSection(opt.dataset.type, `Section ${this.composition.sections.length + 1}`);
            this.render();
            if (this.onCompositionChanged) this.onCompositionChanged();
          }
        });
      });
    }

    this.container.querySelectorAll('.btn-copy-section').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sIdx = parseInt(btn.dataset.section);
        const text = this._getSectionText(sIdx);
        this._copyToClipboard(text, btn);
      });
    });

    this.container.querySelectorAll('.btn-copy-avartan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sIdx = parseInt(btn.dataset.section);
        const aIdx = parseInt(btn.dataset.avartan);
        const text = this._getAvartanText(sIdx, aIdx);
        this._copyToClipboard(text, btn);
      });
    });
  }

  _getAvartanText(sIdx, aIdx) {
    const section = this.composition.sections[sIdx];
    if (!section) return '';
    const avartan = section.avartans[aIdx];
    if (!avartan) return '';
    const taal = this.composition.getTaal();
    
    let textChunks = [];
    for (let i = 0; i < taal.matras; i++) {
      const matra = avartan.matras[i];
      let bolText = '';
      if (matra && matra.bols && matra.bols.length > 0) {
         bolText = matra.bols.map(b => getBolDisplay(b, this.currentScript)).join(' ');
         if (matra.bols.length > 1) bolText = `[${bolText}]`;
      } else {
         bolText = '-';
      }
      
      textChunks.push(bolText);
      if (isVibhaagStart(taal, i + 1)) {
        textChunks.push('|');
      }
    }
    return textChunks.join(' ').replace(/ \|\s*$/, '');
  }

  _getSectionText(sIdx) {
    const section = this.composition.sections[sIdx];
    if (!section) return '';
    let texts = [];
    for (let aIdx = 0; aIdx < section.avartans.length; aIdx++) {
      texts.push(this._getAvartanText(sIdx, aIdx));
    }
    return texts.join('\n');
  }

  _copyToClipboard(text, btnEl) {
    navigator.clipboard.writeText(text).then(() => {
      const originalHtml = btnEl.innerHTML;
      btnEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => {
        btnEl.innerHTML = originalHtml;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  _activateCell(sIdx, aIdx, mIdx, cellEl) {
    this.container.querySelectorAll('.cell-active').forEach(c => c.classList.remove('cell-active'));
    cellEl.classList.add('cell-active');
    this.activeCell = { sectionIdx: sIdx, avartanIdx: aIdx, matraIdx: mIdx };
    this.bolInput.show(cellEl, sIdx, aIdx, mIdx, this.composition.getBol(sIdx, aIdx, mIdx));
    // Notify the app to auto-target Quick Entry to this cell's section/avartan
    if (this.onCellClicked) this.onCellClicked(sIdx, aIdx, mIdx);
  }

  _navigateFromActive(direction) {
    if (!this.activeCell) return;
    const { sectionIdx, avartanIdx, matraIdx } = this.activeCell;
    const taal = this.composition.getTaal();
    let newS = sectionIdx, newA = avartanIdx, newM = matraIdx;

    switch (direction) {
      case 'right':
        newM++;
        if (newM >= taal.matras) { newM = 0; newA++; if (newA >= this.composition.sections[newS].avartans.length) { newA = 0; newS++; if (newS >= this.composition.sections.length) { newS = sectionIdx; newA = avartanIdx; newM = matraIdx; } } }
        break;
      case 'left':
        newM--;
        if (newM < 0) { newM = taal.matras - 1; newA--; if (newA < 0) { newS--; if (newS < 0) { newS = sectionIdx; newA = avartanIdx; newM = matraIdx; } else newA = this.composition.sections[newS].avartans.length - 1; } }
        break;
      case 'down':
        newA++;
        if (newA >= this.composition.sections[newS].avartans.length) { newS++; if (newS < this.composition.sections.length) newA = 0; else { newS = sectionIdx; newA = avartanIdx; } }
        break;
      case 'up':
        newA--;
        if (newA < 0) { newS--; if (newS >= 0) newA = this.composition.sections[newS].avartans.length - 1; else { newS = sectionIdx; newA = avartanIdx; } }
        break;
    }
    const cellEl = this.container.querySelector(`#cell-${newS}-${newA}-${newM}`);
    if (cellEl) this._activateCell(newS, newA, newM, cellEl);
  }

  _detectSectionType(label) {
    const lower = label.toLowerCase().trim();
    const typeKeywords = [{ keywords: ['palta', 'palte', 'पलटा'], type: 'palta' }, { keywords: ['mukh', 'theme', 'मुख'], type: 'mukh' }, { keywords: ['dohra', 'दोहरा'], type: 'dohra' }];
    for (const entry of typeKeywords) for (const kw of entry.keywords) if (lower.includes(kw)) return entry.type;
    return null;
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}
