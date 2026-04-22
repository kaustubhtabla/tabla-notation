/**
 * bhatkhande.io — Main Application Controller
 * Wires together all components: composition model, notation grid, bol input, and UI.
 */

const bhatkhande = {
  ioApp: class {
  constructor() {
    this.composition = null;
    this.notationGrid = null;
    this.bolInput = null;
    this.currentScript = 'roman';
    this.autoSaveTimer = null;
    this.isOnline = false;
    this.showOptionalDetails = false;
  }

  async init() {
    try {
      this._migrateLegacyData();
      this.showOptionalDetails = this._loadOptionalDetailsPreference();
      await syncBolDictionaryWithServer();
      this.bolInput = new BolInput();

      const lastActiveId = localStorage.getItem('bhatkhande_io_last_active_id');
      
      // Initial connectivity check
      await this.checkConnectivity();
      
      if (lastActiveId) {
        this.composition = await Composition.load(lastActiveId);
        if (!this.composition) {
          localStorage.removeItem('bhatkhande_io_last_active_id');
        }
      }
      if (!this.composition) {
        document.getElementById('dashboard-hub')?.classList.add('active');
        this.composition = new Composition('teentaal', 'theka');
        await this.composition.save();
      }

      const gridContainer = document.getElementById('notation-grid-container');
      if (!gridContainer) return;

      this.notationGrid = new NotationGrid(gridContainer, this.composition, this.bolInput);
      this.notationGrid.onCompositionChanged = () => this._onCompositionChanged();
      this.notationGrid.onAddSection = () => this.addSection();

      this._initTheme();
      this._initDashboard();
      this._initLibrary();
      this._populateDropdowns();
      this._setupLayakariGenerator();

      this.notationGrid.render();
      this._updateMetadataPanel();
      this._updateSavedList();
      this._bindUIEvents();
      this._applyOptionalDetailsVisibility();

      this._startAutoSave();
    } catch (err) {
      console.error('bhatkhande.io initialization failed:', err);
    }
  }

  _migrateLegacyData() {
    const legacyPrefix = 'taallipi_';
    const newPrefix = 'bhatkhande_io_';
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(legacyPrefix)) {
        const newKey = key.replace(legacyPrefix, newPrefix);
        const value = localStorage.getItem(key);
        if (value !== null) {
          localStorage.setItem(newKey, value);
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(k => localStorage.removeItem(k));
  }

  _loadOptionalDetailsPreference() {
    try {
      const stored = localStorage.getItem('bhatkhande_io_show_optional_details');
      const legacyStored = localStorage.getItem('bhatkhande_io_show_composition_details');
      const resolved = stored === null ? legacyStored : stored;
      if (resolved === null) return false;
      return resolved === 'true';
    } catch (err) {
      console.warn('Could not read optional details preference:', err);
      return false;
    }
  }

  _applyOptionalDetailsVisibility() {
    const section = document.getElementById('optional-details-section');
    const body = document.getElementById('optional-details-body');
    const toggle = document.getElementById('toggle-optional-details');
    const label = document.getElementById('optional-details-toggle-label');

    if (section) {
      section.classList.toggle('is-collapsed', !this.showOptionalDetails);
    }
    if (body) {
      body.hidden = !this.showOptionalDetails;
    }
    if (toggle) {
      toggle.checked = this.showOptionalDetails;
    }
    if (label) {
      label.textContent = this.showOptionalDetails ? 'On' : 'Off';
    }
  }

  _setOptionalDetailsVisibility(isVisible) {
    this.showOptionalDetails = !!isVisible;
    this._applyOptionalDetailsVisibility();
    try {
      localStorage.setItem('bhatkhande_io_show_optional_details', this.showOptionalDetails ? 'true' : 'false');
    } catch (err) {
      console.warn('Could not save optional details preference:', err);
    }
  }

  _bindOptionalMetadataInputs() {
    const layaSelect = document.getElementById('comp-laya');
    if (layaSelect) {
      layaSelect.addEventListener('change', (e) => {
        this.composition.updateMetadata({ laya: e.target.value });
      });
    }

    const gharanaInput = document.getElementById('comp-gharana');
    if (gharanaInput) {
      gharanaInput.addEventListener('input', (e) => {
        this.composition.updateMetadata({ gharana: e.target.value });
      });
    }

    const guruInput = document.getElementById('comp-guru');
    if (guruInput) {
      guruInput.addEventListener('input', (e) => {
        this.composition.updateMetadata({ guru: e.target.value });
      });
    }

    const notesInput = document.getElementById('comp-notes');
    if (notesInput) {
      notesInput.addEventListener('input', (e) => {
        this.composition.updateMetadata({ notes: e.target.value });
      });
    }
  }

  _populateDropdowns() {
    const taalSelect = document.getElementById('comp-taal');
    if (taalSelect) {
      taalSelect.innerHTML = Object.values(TAAL_DATABASE).map(t =>
        `<option value="${t.id}" ${t.id === this.composition.taalId ? 'selected' : ''}>
          ${t.name} (${t.nameDevanagari}) — ${t.matras} matras
        </option>`
      ).join('');
    }

    const typeSelect = document.getElementById('comp-type');
    if (typeSelect) {
      typeSelect.innerHTML = this._buildCompositionTypeOptions(this.composition.compositionType);
    }

    const layaSelect = document.getElementById('comp-laya');
    if (layaSelect) {
      layaSelect.innerHTML = LAYA_TYPES.map(l =>
        `<option value="${l.id}" ${l.id === this.composition.laya ? 'selected' : ''}>
          ${l.name} (${l.nameDevanagari})
        </option>`
      ).join('');
    }
  }

  _initDashboard() {
    const dashTaal = document.getElementById('dash-new-taal');
    if (dashTaal) {
      dashTaal.innerHTML = Object.values(TAAL_DATABASE).map(t =>
        `<option value="${t.id}" ${t.id === 'teentaal' ? 'selected' : ''}>${t.name} (${t.matras} matras)</option>`
      ).join('');
    }

    const dashType = document.getElementById('dash-new-type');
    if (dashType) {
      dashType.innerHTML = this._buildCompositionTypeOptions('theka');
    }

    document.getElementById('btn-dash-create')?.addEventListener('click', () => {
      const taal = dashTaal?.value || 'teentaal';
      const type = dashType?.value || 'theka';
      this.newCompositionFromDash(taal, type);
    });

    document.getElementById('btn-dash-close')?.addEventListener('click', () => {
      document.getElementById('dashboard-hub')?.classList.remove('active');
    });
  }

  _openDashboard() {
    document.getElementById('dashboard-hub')?.classList.add('active');
    this._populateDashboardRecent();
    this._populateLibraryPanel();
  }

  _buildCompositionTypeOptions(selectedType) {
    const normalizedSelection = typeof normalizeCompositionTypeId === 'function'
      ? normalizeCompositionTypeId(selectedType)
      : selectedType;
    const utilityOptions = COMPOSITION_TYPES
      .filter(type => type.category === 'utility')
      .map(type =>
        `<option value="${type.id}" ${type.id === normalizedSelection ? 'selected' : ''}>${type.name} (${type.nameDevanagari})</option>`
      )
      .join('');

    const categorizedGroups = COMPOSITION_CATEGORIES
      .filter(category => category.id !== 'utility')
      .map(category => {
        const categoryTypes = COMPOSITION_TYPES.filter(type => type.category === category.id);
        if (categoryTypes.length === 0) return '';

        const options = categoryTypes.map(type =>
          `<option value="${type.id}" ${type.id === normalizedSelection ? 'selected' : ''}>${type.name} (${type.nameDevanagari})</option>`
        ).join('');

        return `<optgroup label="${category.name} (${category.nameDevanagari})">${options}</optgroup>`;
      })
      .join('');

    return utilityOptions + categorizedGroups;
  }

  async _populateDashboardRecent() {
    const listEl = document.getElementById('dash-recent-list');
    if (!listEl) return;
    
    const saved = this._sortSavedByRecent(await Composition.listSaved());
    
    let html = '';
    
    if (!this.isOnline) {
      html += `
        <div class="dash-offline-notice">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          Running in Local Workspace mode. Start the sync server to enable cloud backup.
        </div>
      `;
    }

    if (saved.length === 0) {
      html += `<div class="dash-empty">${this.isOnline ? 'No saved compositions in the cloud... Start typing!' : 'No local compositions found yet. Create one below!'}</div>`;
      listEl.innerHTML = html;
      return;
    }

    html += saved.map(c => {
      const taal = TAAL_DATABASE[c.taalId];
      const date = new Date(c.updatedAt).toLocaleDateString();
      return `
        <div class="dash-recent-card" data-id="${c.id}">
          <div class="dash-card-title">${this._escapeHtml(c.title || 'Untitled Workspace')}</div>
          <div class="dash-card-taal">${taal ? taal.name : c.taalId}</div>
          <div class="dash-card-date">${date}</div>
        </div>
      `;
    }).join('');
    
    listEl.innerHTML = html;

    listEl.querySelectorAll('.dash-recent-card').forEach(item => {
      item.addEventListener('click', () => {
        this.loadComposition(item.getAttribute('data-id'));
      });
    });
  }

  async checkConnectivity() {
    this._updateSyncStatus('syncing');
    try {
      const response = await fetch('/api/compositions', { signal: AbortSignal.timeout(1500) });
      this.isOnline = response.ok;
      this._updateSyncStatus(this.isOnline ? 'connected' : 'disconnected');
    } catch {
      this.isOnline = false;
      this._updateSyncStatus('disconnected');
    }
  }

  _updateSyncStatus(status) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    
    el.classList.remove('syncing', 'connected', 'disconnected');
    el.classList.add(status);
    
    const label = el.querySelector('.sync-label');
    if (label) {
      if (status === 'syncing') {
        label.textContent = 'Syncing...';
        el.title = 'Checking connection to sync server...';
      } else if (status === 'connected') {
        label.textContent = 'Cloud Sync';
        el.title = 'Connected to sync server. Compositions are synced to the cloud.';
      } else {
        label.textContent = 'Local Only';
        el.title = 'Sync server unavailable. Compositions are saved to your browser only.';
      }
    }
  }

  _setupLayakariGenerator() {
    const typeSelect = document.getElementById('comp-type');
    if (!typeSelect) return;

    const container = typeSelect.parentElement;

    const btn = document.createElement('button');
    btn.id = 'btn-generate-layakaris';
    btn.className = 'btn btn-primary';
    btn.style.width = '100%';
    btn.style.marginTop = '10px';
    btn.style.padding = '8px 12px';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="margin-right: 6px;">
        <path d="M8 1L1 7l3 2-2 6 9-8H8l3-6z" fill="currentColor"/>
      </svg>
      Generate All Layakaris
    `;

    btn.addEventListener('click', () => this.generateAllLayakaris());
    container.appendChild(btn);

    this._toggleLayakariButton();
  }

  _toggleLayakariButton() {
    const btn = document.getElementById('btn-generate-layakaris');
    if (btn) {
      btn.style.display = this.composition.compositionType === 'theka' ? 'flex' : 'none';
      btn.style.justifyContent = 'center';
    }
  }

  generateAllLayakaris() {
    if (this.composition.compositionType !== 'theka') return;
    if (!confirm('This will replace all current sections with a complete set of Layakaris. Do you want to continue?')) return;

    this.composition._saveUndoState();
    this.composition.sections = [];

    const speeds = [
      { val: '2', name: 'Dugun (2x)', type: 'palta' },
      { val: '3', name: 'Tigun (3x)', type: 'palta' },
      { val: '4', name: 'Chaugun (4x)', type: 'palta' },
      { val: '3/2', name: 'Aad (3/2)', type: 'palta' },
      { val: '5/4', name: 'Kuad (5/4)', type: 'palta' },
      { val: '7/4', name: 'Biyad (7/4)', type: 'palta' }
    ];

    const thekaSection = typeof getDefaultSectionBlueprintForCompositionType === 'function'
      ? getDefaultSectionBlueprintForCompositionType('theka')
      : { type: 'custom', label: 'Theka' };
    this.composition.addSection(thekaSection.type, 'Theka (Thah)');
    
    // Explicitly seed the Thah section with the Theka bols
    const taal = this.composition.getTaal();
    const thahMatras = taal.theka.map(b => ({ bols: [b] }));
    while (thahMatras.length < taal.matras) thahMatras.push({ bols: [] });
    this.composition.sections[0].avartans[0].matras = thahMatras;
    
    // Reverse the array so that calling multiple times on index 0 appends them in correct visual order
    speeds.slice().reverse().forEach(speed => {
      this.composition.generateLayakariSection(0, speed.val, speed.name);
    });

    this.notationGrid.render();
    this._updateMetadataPanel();
    this._onCompositionChanged();
    this._showToast('Complete Layakari set generated successfully!', 'success');
  }

  _initTheme() {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (!toggleBtn) return;

    const sunIcon = document.getElementById('icon-sun');
    const moonIcon = document.getElementById('icon-moon');
    const autoIcon = document.getElementById('icon-auto');

    const toggleTheme = (themeStr) => {
      let actualTheme = themeStr;
      
      if (themeStr === 'auto') {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        localStorage.removeItem('bhatkhande_io_theme');
      } else {
        localStorage.setItem('bhatkhande_io_theme', themeStr);
      }
      
      document.documentElement.setAttribute('data-theme', actualTheme);
      document.documentElement.setAttribute('data-theme-setting', themeStr);
      
      if (sunIcon) sunIcon.style.display = themeStr === 'dark' ? 'block' : 'none';
      if (moonIcon) moonIcon.style.display = themeStr === 'light' ? 'block' : 'none';
      if (autoIcon) autoIcon.style.display = themeStr === 'auto' ? 'block' : 'none';
      toggleBtn.title = `Theme: ${themeStr.charAt(0).toUpperCase() + themeStr.slice(1)} (Click to toggle)`;
    };

    const savedTheme = localStorage.getItem('bhatkhande_io_theme') || 'auto';
    toggleTheme(savedTheme);

    toggleBtn.addEventListener('click', () => {
      const currentSetting = document.documentElement.getAttribute('data-theme-setting') || 'auto';
      let nextSetting = 'auto';
      if (currentSetting === 'auto') nextSetting = 'dark';
      else if (currentSetting === 'dark') nextSetting = 'light';
      else if (currentSetting === 'light') nextSetting = 'auto';
      toggleTheme(nextSetting);
      this._showToast(`Theme changed to ${nextSetting.charAt(0).toUpperCase() + nextSetting.slice(1)}`);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('bhatkhande_io_theme')) {
         toggleTheme('auto');
      }
    });
  }

  _bindUIEvents() {
    const titleInput = document.getElementById('comp-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        this.composition.updateMetadata({ title: e.target.value });
        const headerTitle = document.getElementById('header-title-display');
        if (headerTitle) headerTitle.textContent = e.target.value || 'Untitled';
      });
    }

    const taalSelect = document.getElementById('comp-taal');
    if (taalSelect) {
      taalSelect.addEventListener('change', (e) => {
        const nextTaalId = e.target.value;
        const currentTaalId = this.composition.taalId;
        if (nextTaalId === currentTaalId) return;

        const confirmed = confirm("Changing the Taal will replace the current bols with the selected Taal's theka.\n\nDo you want to continue?");
        if (!confirmed) {
          e.target.value = currentTaalId;
          return;
        }

        this.composition.changeTaal(nextTaalId);
        this.composition.fillAllAvartansWithTheka();
        this.notationGrid.render();
        this._updateTaalInfo();
        this._updateSavedList();
        this._onCompositionChanged();
        this._showToast('Taal updated and cells filled with the selected theka!', 'success');
      });
    }

    const typeSelect = document.getElementById('comp-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.composition.updateMetadata({ compositionType: e.target.value });
        this.notationGrid.render();
        this._updateMetadataPanel();
        this._onCompositionChanged();
        this._toggleLayakariButton();
      });
    }

    this._bindOptionalMetadataInputs();

    const detailsToggle = document.getElementById('toggle-optional-details');
    if (detailsToggle) {
      detailsToggle.addEventListener('change', (e) => {
        this._setOptionalDetailsVisibility(e.target.checked);
      });
    }

    const scriptToggle = document.getElementById('script-toggle');
    if (scriptToggle) {
      scriptToggle.addEventListener('change', (e) => {
	        this.currentScript = e.target.checked ? 'devanagari' : 'roman';
	        this.notationGrid.setScript(this.currentScript);
	        const label = document.getElementById('script-label');
	        if (label) label.textContent = this.currentScript === 'devanagari' ? 'Hindi' : 'English';
	      });
	    }

    document.getElementById('btn-home')?.addEventListener('click', () => {
      this._openDashboard();
    });
    document.getElementById('btn-new')?.addEventListener('click', () => {
       document.getElementById('dashboard-hub')?.classList.add('active');
       this._populateDashboardRecent();
    });
    document.getElementById('btn-save')?.addEventListener('click', () => this.saveComposition());
    document.getElementById('btn-export-pdf')?.addEventListener('click', () => this.exportPDF());
    document.getElementById('btn-export-json')?.addEventListener('click', () => this.exportJSON());
    document.getElementById('btn-import-json')?.addEventListener('click', () => this.importJSON());
    document.getElementById('btn-undo')?.addEventListener('click', () => this.undo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.redo());

    const quickEntryBtn = document.getElementById('btn-quick-entry-apply');
    if (quickEntryBtn) {
      quickEntryBtn.addEventListener('click', () => this.applyQuickEntry());
    }
    const quickEntryInput = document.getElementById('quick-entry-input');
    if (quickEntryInput) {
      quickEntryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.applyQuickEntry();
        }
      });
    }

    const quickSectionSelect = document.getElementById('quick-entry-section');
    if (quickSectionSelect) {
      quickSectionSelect.addEventListener('change', () => this._refreshAvartanDropdown());
    }

    const fileInput = document.getElementById('file-import-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this._handleFileImport(file);
          fileInput.value = '';
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      const isInInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.saveComposition(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isInInput) { e.preventDefault(); this.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey && !isInInput) { e.preventDefault(); this.redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); this.exportPDF(); }
    });

    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('sidebar-open');
    });
  }

  async newCompositionFromDash(taalId, typeId) {
    this.composition = new Composition(taalId, typeId);
    await this.composition.save();
    this.notationGrid.composition = this.composition;
    this.notationGrid.render();
    this._updateMetadataPanel();
    this._updateSavedList();
    document.getElementById('dashboard-hub')?.classList.remove('active');
    this._showToast('Workspace initialized', 'success');
  }

  async saveComposition() {
    await this.composition.save(true);
    await this._updateSavedList();
    this._showToast('Composition saved!', 'success');
  }

  async loadComposition(id) {
    try {
      const comp = await Composition.load(id);
      if (comp) {
        this.composition = comp;
        this.notationGrid.composition = this.composition;
        this.notationGrid.setScript(this.currentScript);
        this._updateMetadataPanel();
        this._showToast('Composition loaded');
        document.getElementById('dashboard-hub')?.classList.remove('active');
      } else {
        this._showToast('Could not load composition. File missing.', 'error');
      }
    } catch (e) {
      console.error(e);
      this._showToast('Failed to load composition format.', 'error');
    }
  }

  async deleteComposition(id) {
    if (confirm('Delete this saved composition?')) {
      await Composition.deleteSaved(id);
      await this._updateSavedList();
      this._showToast('Composition deleted');
    }
  }

  exportPDF() {
    PdfExport.exportAsPDF(this.composition, this.currentScript, {
      includeOptionalDetails: this.showOptionalDetails
    });
    this._showToast('PDF preview opened', 'success');
  }

  exportJSON() {
    this.composition.exportToFile();
    this._showToast('Backup saved as JSON');
  }

  importJSON() {
    document.getElementById('file-import-input')?.click();
  }

  async _handleFileImport(file) {
    try {
      const comp = await Composition.importFromFile(file);
      this.composition = comp;
      this.notationGrid.composition = this.composition;
      this.notationGrid.setScript(this.currentScript);
      this._updateMetadataPanel();
      this._showToast('Composition imported!', 'success');
    } catch (err) {
      this._showToast('Import failed: ' + err.message, 'error');
    }
  }

  addSection() {
    const sections = this.composition.sections;
    const expandable = typeof isExpandableCompositionType === 'function' &&
      isExpandableCompositionType(this.composition.compositionType);
    let newType = expandable ? 'palta' : 'custom';

    if (!expandable && sections.length > 0) {
      const lastSection = sections[sections.length - 1];
      if (lastSection.type !== 'mukh') newType = lastSection.type;
    }

    const typeInfo = SECTION_TYPES.find(t => t.id === newType);
    const typeName = typeInfo ? typeInfo.name.split(' ')[0] : 'Section';
    const existingCount = sections.filter(s => s.type === newType).length;

    const newSectionIdx = this.composition.addSection(newType, `${typeName} ${existingCount + 1}`);
    this.notationGrid.render();
    this._onCompositionChanged();
    this._selectQuickEntryTarget(newSectionIdx, 0);
  }

  applyQuickEntry() {
    const input = document.getElementById('quick-entry-input');
    const sectionSelect = document.getElementById('quick-entry-section');
    const avartanSelect = document.getElementById('quick-entry-avartan');

    if (!input || !input.value.trim()) return;

    const sIdx = sectionSelect ? parseInt(sectionSelect.value) : 0;
    const aIdx = avartanSelect ? parseInt(avartanSelect.value) : 0;
    const bolEntries = typeof parseQuickEntry === 'function' ? parseQuickEntry(input.value) : input.value.split(' ').map(b => [b]);

    const result = this.composition.applyQuickEntry(sIdx, aIdx, 0, bolEntries);
    this.notationGrid.render();
    this._onCompositionChanged();

    input.value = '';
    this._showToast('Bols applied successfully', 'success');
  }

  undo() {
    if (this.composition.undo()) {
      this.notationGrid.render();
      this._showToast('Undo');
      this._updateUndoRedoButtons();
    }
  }

  redo() {
    if (this.composition.redo()) {
      this.notationGrid.render();
      this._showToast('Redo');
      this._updateUndoRedoButtons();
    }
  }

  _onCompositionChanged() {
    this._updateUndoRedoButtons();
    this._updateQuickEntrySelectors();
  }

  _updateMetadataPanel() {
    const c = this.composition;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

    setVal('comp-title', c.title);
    setVal('comp-taal', c.taalId);
    setVal('comp-type', c.compositionType);
    setVal('comp-laya', c.laya);
    setVal('comp-gharana', c.gharana);
    setVal('comp-guru', c.guru);
    setVal('comp-notes', c.notes);

    const headerTitle = document.getElementById('header-title-display');
    if (headerTitle) headerTitle.textContent = c.title;

    this._updateTaalInfo();
    this._updateQuickEntrySelectors();
    this._updateUndoRedoButtons();
    this._toggleLayakariButton();
  }

  _updateTaalInfo() {
    const taal = this.composition.getTaal();
    const infoEl = document.getElementById('taal-info-display');
    if (taal && infoEl) {
      const markerStr = taal.markers.map(m => m.label).join(' · ');
      infoEl.innerHTML = `
        <span class="taal-info-item">${taal.matras} Matras</span>
        <span class="taal-info-sep">|</span>
        <span class="taal-info-item">${taal.vibhaagStructure.join('-')}</span>
        <span class="taal-info-sep">|</span>
        <span class="taal-info-item">${markerStr}</span>
      `;
    }
  }

  _updateQuickEntrySelectors() {
    const sectionSelect = document.getElementById('quick-entry-section');
    if (sectionSelect) {
      const currentVal = sectionSelect.value;
      sectionSelect.innerHTML = this.composition.sections.map((s, i) => `<option value="${i}">${s.label}</option>`).join('');
      if (currentVal && parseInt(currentVal) < this.composition.sections.length) sectionSelect.value = currentVal;
    }
    this._refreshAvartanDropdown();
  }

  _selectQuickEntryTarget(sectionIdx, avartanIdx = 0) {
    const sectionSelect = document.getElementById('quick-entry-section');
    const avartanSelect = document.getElementById('quick-entry-avartan');
    const quickEntryInput = document.getElementById('quick-entry-input');

    if (sectionSelect && Number.isInteger(sectionIdx) && sectionIdx >= 0 && sectionIdx < this.composition.sections.length) {
      sectionSelect.value = String(sectionIdx);
    }

    this._refreshAvartanDropdown();

    const section = this.composition.sections[sectionIdx];
    if (avartanSelect && section && Array.isArray(section.avartans)) {
      const safeAvartanIdx = Math.max(0, Math.min(avartanIdx, section.avartans.length - 1));
      avartanSelect.value = String(safeAvartanIdx);
    }

    if (quickEntryInput) {
      quickEntryInput.focus();
    }
  }

  _refreshAvartanDropdown() {
    const sectionSelect = document.getElementById('quick-entry-section');
    const avartanSelect = document.getElementById('quick-entry-avartan');
    if (!avartanSelect) return;

    const sIdx = sectionSelect ? parseInt(sectionSelect.value) || 0 : 0;
    const section = this.composition.sections[sIdx];
    if (section) {
      avartanSelect.innerHTML = section.avartans.map((_, i) => `<option value="${i}">Avartan ${i + 1}</option>`).join('');
    }
  }

  _updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !this.composition.canUndo();
    if (redoBtn) redoBtn.disabled = !this.composition.canRedo();
  }

  async _updateSavedList() {
    const listEl = document.getElementById('saved-compositions-list');
    if (!listEl) return;

    const saved = this._sortSavedByRecent(await Composition.listSaved());
    if (saved.length === 0) {
      listEl.innerHTML = '<div class="saved-empty">No saved compositions</div>';
      return;
    }

    listEl.innerHTML = saved.map(c => {
      const taal = TAAL_DATABASE[c.taalId];
      const taalName = taal ? taal.name : c.taalId;
      const date = new Date(c.updatedAt).toLocaleDateString();
      return `
        <div class="saved-item" data-id="${c.id}">
          <div class="saved-item-info">
            <div class="saved-item-title">${this._escapeHtml(c.title)}</div>
            <div class="saved-item-meta">${taalName} · ${date}</div>
          </div>
          <button class="btn-icon saved-item-delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.saved-item').forEach(item => {
      const id = item.getAttribute('data-id');
      item.addEventListener('click', () => {
        this.loadComposition(id);
      });
      item.querySelector('.saved-item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteComposition(id);
      });
    });
  }

  _startAutoSave() {
    this.autoSaveTimer = setInterval(() => { this.composition.save(); }, 30000);
  }

  _showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => { toast.classList.remove('toast-visible'); setTimeout(() => toast.remove(), 300); }, 2500);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  _sortSavedByRecent(saved) {
    return [...(saved || [])].sort((a, b) => {
      const aTime = Date.parse(a?.updatedAt || '') || 0;
      const bTime = Date.parse(b?.updatedAt || '') || 0;
      return bTime - aTime;
    });
  }

  // ── Composition Library ──────────────────────────────────────────────

  _initLibrary() {
    this._libraryCache = null;

    const filterSelect = document.getElementById('dash-library-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        this._renderLibraryCards(filterSelect.value);
      });
    }

    this._populateLibraryPanel();
  }

  async _fetchLibrary() {
    if (this._libraryCache) return this._libraryCache;

    // Try API endpoint first (local sync server)
    try {
      const response = await fetch('/api/library', { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            this._libraryCache = data;
            return this._libraryCache;
          }
        }
      }
    } catch (_) { /* fall through to static fallback */ }

    // Static JSON fallback (GitHub Pages, file://, or server unavailable)
    try {
      const response = await fetch('data/library.json', { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          this._libraryCache = data;
          return this._libraryCache;
        }
      }
    } catch (_) { /* fall through */ }

    return [];
  }

  async _populateLibraryPanel() {
    const library = await this._fetchLibrary();
    if (!Array.isArray(library) || library.length === 0) {
      const gridEl = document.getElementById('dash-library-grid');
      if (gridEl) gridEl.innerHTML = '<div class="dash-empty">No library compositions available.</div>';
      return;
    }

    // Populate the taal filter dropdown
    const filterSelect = document.getElementById('dash-library-filter');
    if (filterSelect) {
      const taalIds = [...new Set(library.map(c => c.taalId))];
      const currentVal = filterSelect.value;
      filterSelect.innerHTML = '<option value="all">All Taals</option>' +
        taalIds.map(id => {
          const taal = TAAL_DATABASE[id];
          const name = taal ? `${taal.name} (${taal.matras} matras)` : id;
          return `<option value="${id}">${name}</option>`;
        }).join('');
      if (currentVal && [...filterSelect.options].some(o => o.value === currentVal)) {
        filterSelect.value = currentVal;
      }
    }

    this._renderLibraryCards(filterSelect?.value || 'all');
  }

  _renderLibraryCards(filterTaalId = 'all') {
    const gridEl = document.getElementById('dash-library-grid');
    if (!gridEl || !this._libraryCache) return;

    const library = filterTaalId === 'all'
      ? this._libraryCache
      : this._libraryCache.filter(c => c.taalId === filterTaalId);

    if (library.length === 0) {
      gridEl.innerHTML = '<div class="dash-empty">No compositions match this filter.</div>';
      return;
    }

    gridEl.innerHTML = library.map(c => {
      const taal = TAAL_DATABASE[c.taalId];
      const taalName = taal ? taal.name : c.taalId;
      const typeInfo = typeof getCompositionTypeInfo === 'function' ? getCompositionTypeInfo(c.compositionType) : null;
      const typeName = typeInfo ? typeInfo.name : c.compositionType;
      const sectionCount = Array.isArray(c.sections) ? c.sections.length : 0;
      return `
        <div class="dash-library-card" data-lib-id="${this._escapeHtml(c.id)}">
          <span class="dash-library-badge">Library</span>
          <div class="dash-card-title">${this._escapeHtml(c.title || 'Untitled')}</div>
          <div class="dash-card-taal">${this._escapeHtml(taalName)}</div>
          <div class="dash-card-meta">
            <span class="dash-card-type">${this._escapeHtml(typeName)}</span>
            <span class="dash-card-meta-dot"></span>
            <span class="dash-card-sections">${sectionCount} section${sectionCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    gridEl.querySelectorAll('.dash-library-card').forEach(card => {
      card.addEventListener('click', () => {
        this.cloneFromLibrary(card.getAttribute('data-lib-id'));
      });
    });
  }

  async cloneFromLibrary(libraryId) {
    const library = await this._fetchLibrary();
    const entry = library.find(c => c.id === libraryId);
    if (!entry) {
      this._showToast('Library composition not found.', 'error');
      return;
    }

    // Deep clone and assign fresh identity
    const cloneData = JSON.parse(JSON.stringify(entry));
    cloneData.id = 'comp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    cloneData.createdAt = new Date().toISOString();
    cloneData.updatedAt = new Date().toISOString();

    const comp = Composition.fromJSON(cloneData);
    this.composition = comp;
    await this.composition.save(true);
    this.notationGrid.composition = this.composition;
    this.notationGrid.setScript(this.currentScript);
    this._updateMetadataPanel();
    this._updateSavedList();
    document.getElementById('dashboard-hub')?.classList.remove('active');
    this._showToast(`"${entry.title}" loaded from library`, 'success');
  }
  }
};

// Global App Initialization
window.app = null;
document.addEventListener('DOMContentLoaded', () => {
  window.app = new bhatkhande.ioApp();
  window.app.init();
});
