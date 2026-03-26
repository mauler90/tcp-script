// ==UserScript==
// @name         S.R.C - Script Riutilizzo Container
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  S.R.C - Script Riutilizzo Container per C.r.t. | (c) 2026 Vittorio Zingoni - All rights reserved
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
'use strict';

// =============================================================================
//  S.R.C - Script Riutilizzo Container per C.r.t.
//  (c) 2026 Vittorio Zingoni - All rights reserved
//  Uso interno autorizzato. Vietata la riproduzione o distribuzione
//  senza esplicito consenso scritto dell'autore.
// =============================================================================


// ═══════════════════════════════════════════════════════════════════
//  BASE: Layout, filtri, export, contatore, autocompila
// ═══════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────
//  1. LAYOUT — CSS, pulizia, riordino colonne
// ─────────────────────────────────────────────────────────────────
function injectStyles() {
    if (document.getElementById('tcp-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'tcp-custom-styles';
    style.textContent = `
        .ui-datatable thead th { background-color:#bdf3fc !important; font-size:12px !important; }
        #searchForm\\:resultTable_TRANSPORT_ORDER_DM_data > tr:not(.ui-expanded-row-content) { color:#002856 !important; }
        tr.ui-expanded-row { background-color:#85c2ff !important; }
        tr.ui-datatable-even.ui-expanded-row, tr.ui-datatable-odd.ui-expanded-row { border-top:4px solid #344bf7 !important; border-bottom:4px solid #344bf7 !important; }
        tr.ui-expanded-row-content.ui-widget-content { border-top:4px solid #344bf7 !important; }
        tr.ui-expanded-row > td:nth-child(3) { font-weight:bold !important; font-size:14px !important; }
        tr.ui-expanded-row > td:nth-child(5) { font-weight:bold !important; font-size:14px !important; }
        tr.ui-expanded-row > td:nth-child(11) { font-weight:bold !important; font-size:14px !important; }
        [id*="transportEquipmentsTable_data"] > tr > td:nth-child(4) { font-weight:bold !important; font-size:14px !important; }
        [id*="transportEquipmentsTable_data"] > tr > td:nth-child(5) { font-weight:bold !important; font-size:14px !important; }
        [id*="transportEquipmentsTable_data"] > tr > td:nth-child(6) { font-weight:bold !important; font-size:14px !important; }
        [id*="j_idt1011"] > span { font-weight:bold !important; font-size:14px !important; }
    `;
    document.head.appendChild(style);
}

function cleanBrackets() {
    document.querySelectorAll('td, th').forEach(el => {
        el.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && /\[[^\]]+\]/.test(node.textContent))
                node.textContent = node.textContent.replace(/\[[^\]]+\]\s*/g, '').trim();
        });
    });
}

function applyConditionalStyles() {
    document.querySelectorAll('tr.ui-expanded-row > td:nth-child(7)').forEach(el => {
        if (el.innerText && el.innerText.trim() !== '') {
            el.style.setProperty('color', 'red', 'important');
            el.style.setProperty('font-weight', 'bold', 'important');
        } else {
            el.style.removeProperty('color');
            el.style.removeProperty('font-weight');
        }
    });
}

const ORDER_MAIN      = [1, 7, 2, 10, 3, 4, 5, 6, 8, 9, 11, 12];
const ORDER_CONTAINER = [1, 2, 7, 3, 12, 5, 6, 8, 9, 10, 11, 4, 13, 14];

function reorderRow(row, newOrder) {
    if (row.dataset.reordered) return;
    const cells = Array.from(row.children);
    if (cells.length < Math.max(...newOrder) + 1) return;
    cells.forEach((cell, i) => { if (!newOrder.includes(i)) cell.style.setProperty('display','none','important'); });
    newOrder.forEach(i => { if (cells[i]) row.appendChild(cells[i]); });
    row.dataset.reordered = 'true';
}

function reorderAllTables() {
    document.querySelectorAll('#searchForm\\:resultTable_TRANSPORT_ORDER_DM_head tr').forEach(r => reorderRow(r, ORDER_MAIN));
    document.querySelectorAll('#searchForm\\:resultTable_TRANSPORT_ORDER_DM_data > tr:not(.ui-expanded-row-content)').forEach(r => reorderRow(r, ORDER_MAIN));
    document.querySelectorAll('[id*="transportEquipmentsTable"] thead tr').forEach(r => reorderRow(r, ORDER_CONTAINER));
    document.querySelectorAll('[id*="transportEquipmentsTable_data"] > tr').forEach(r => reorderRow(r, ORDER_CONTAINER));
}

function initLayout() {
    injectStyles();
    reorderAllTables();
    cleanBrackets();
    applyConditionalStyles();
}

// ─────────────────────────────────────────────────────────────────
//  2. NORMALIZZAZIONE CARRIER / CONTAINER (condivisa)
// ─────────────────────────────────────────────────────────────────
const CARRIERS = {
    'MSC':      text => /MSC/i.test(text),
    'Hapag':    text => /hapag/i.test(text),
    'ONE':      text => /ONE|ocean network/i.test(text),
    'CMA':      text => /CMA/i.test(text),
    'Maersk':   text => /maersk/i.test(text),
    'OOCL':     text => /OOCL/i.test(text),
    'ZIM':      text => /\bZIM\b/i.test(text),
    'Yang Ming': text => /yang.?ming/i.test(text),
    'Evergreen': text => /evergreen/i.test(text),
};

function normalizeCarrier(text) {
    for (const [name, fn] of Object.entries(CARRIERS)) { if (fn(text)) return name; }
    return null;
}

function normalizeContainer(text) {
    if (/reef/i.test(text))      return "40'R";
    if (/open.?top/i.test(text)) return "40OT";
    if (/20/i.test(text))        return "20'";
    if (/40/i.test(text) && /high|hc/i.test(text)) return "40HC";
    if (/40/i.test(text))        return "40'";
    return null;
}

// ─────────────────────────────────────────────────────────────────
//  3. CONTATORE VIAGGI
// ─────────────────────────────────────────────────────────────────
function parseDate(str) {
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (!m) return null;
    const [, dd, mm, yy] = m;
    return new Date(`20${yy}-${mm}-${dd}`);
}

function getFilterRange() {
    const fromEl = document.querySelector('[id*="inputPickupDeliveryDateStart_input"]');
    const toEl   = document.querySelector('[id*="inputPickupDeliveryDateEnd_input"]');
    return { from: fromEl ? parseDate(fromEl.value) : null, to: toEl ? parseDate(toEl.value) : null };
}

function inRange(dateStr, from, to) {
    const d = parseDate(dateStr);
    if (!d) return false;
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
}

function collectCounterData() {
    const { from, to } = getFilterRange();
    const result = { total:0, import:0, export:0, carriers:{} };
    document.querySelectorAll('tr.ui-expanded-row').forEach(row => {
        const trafficType = row.querySelector('td:nth-child(3)')?.innerText.trim().toLowerCase();
        const isImport = trafficType === 'import';
        const isExport = trafficType === 'export';
        const contentRow = row.nextElementSibling;
        if (!contentRow || !contentRow.classList.contains('ui-expanded-row-content')) return;
        contentRow.querySelectorAll('[id*="transportEquipmentsTable_data"] > tr').forEach(cRow => {
            const dateEl  = cRow.querySelector('td:nth-child(6)');
            const dateStr = dateEl ? dateEl.innerText.trim() : '';
            if (!inRange(dateStr, from, to)) return;
            const carrier  = normalizeCarrier(cRow.querySelector('td:nth-child(4)')?.innerText.trim() || '');
            const contType = normalizeContainer(cRow.querySelector('td:nth-child(5)')?.innerText.trim() || '');
            result.total++;
            if (isImport) result.import++;
            if (isExport) result.export++;
            if (!carrier) return;
            if (!result.carriers[carrier]) result.carriers[carrier] = {
                import:{ total:0,"20'":0,"40'":0,"40HC":0 },
                export:{ total:0,"20'":0,"40'":0,"40HC":0 }
            };
            const dir = isImport ? 'import' : isExport ? 'export' : null;
            if (!dir) return;
            result.carriers[carrier][dir].total++;
            if (contType) result.carriers[carrier][dir][contType]++;
        });
    });
    return result;
}

// -- DRAG HELPER --
function tcpMakeDraggable(el, storageKey) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch(e) {}
    if (saved && saved.left !== undefined) {
        el.style.left = saved.left; el.style.top = saved.top;
        el.style.right = 'auto'; el.style.bottom = 'auto';
    }
    var isDragging = false, startX, startY, startLeft, startTop;
    el.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'LABEL') return;
        isDragging = true;
        var rect = el.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startLeft = rect.left; startTop = rect.top;
        el.style.left = startLeft + 'px'; el.style.top = startTop + 'px';
        el.style.right = 'auto'; el.style.bottom = 'auto';
        el.style.cursor = 'grabbing';
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        var nx = startLeft + (e.clientX - startX);
        var ny = startTop + (e.clientY - startY);
        nx = Math.max(0, Math.min(nx, window.innerWidth - el.offsetWidth));
        ny = Math.max(0, Math.min(ny, window.innerHeight - el.offsetHeight));
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
    });
    document.addEventListener('mouseup', function() {
        if (!isDragging) return;
        isDragging = false;
        el.style.cursor = 'move';
        localStorage.setItem(storageKey, JSON.stringify({left: el.style.left, top: el.style.top}));
    });
    el.style.cursor = 'move';
}

let _wTitle = null, _wSummary = null, _wDetail = null, _wBtn = null, _wEl = null;

function buildCounterWidget() {
    if (document.getElementById('tcp-counter-widget')) return;
    const box = document.createElement('div');
    box.id = 'tcp-counter-widget';
    box.style.cssText = 'position:fixed;top:50px;left:20px;background:white;border:2px solid #002856;border-radius:6px;padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;color:#002856;z-index:9999;min-width:200px;box-shadow:2px 2px 8px rgba(0,0,0,0.15);';
    _wTitle = document.createElement('div');
    _wTitle.style.cssText = 'font-weight:bold;font-size:13px;margin-bottom:6px;border-bottom:1px solid #002856;padding-bottom:4px;';
    box.appendChild(_wTitle);
    _wSummary = document.createElement('div');
    _wSummary.style.marginBottom = '6px';
    box.appendChild(_wSummary);
    _wBtn = document.createElement('button');
    _wBtn.textContent = 'Dettaglio ▼';
    _wBtn.style.cssText = 'background:#002856;color:white;border:none;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;width:100%;margin-top:2px;';
    _wDetail = document.createElement('div');
    _wDetail.style.cssText = 'display:none;margin-top:8px;border-top:1px solid #bdf3fc;padding-top:6px;';
    _wBtn.addEventListener('click', () => {
        const open = _wDetail.style.display !== 'none';
        _wDetail.style.display = open ? 'none' : 'block';
        _wBtn.textContent = open ? 'Dettaglio ▼' : 'Dettaglio ▲';
    });
    box.appendChild(_wBtn);
    box.appendChild(_wDetail);
    _wEl = box;
    document.body.appendChild(box);
    tcpMakeDraggable(box, 'tcp_widget_counter_pos');
}

function updateCounterWidget(data) {
    if (!_wTitle) return;
    _wTitle.textContent = 'Totale viaggi: ' + data.total;
    _wSummary.innerHTML = `Import: <b>${data.import}</b> &nbsp;|&nbsp; Export: <b>${data.export}</b>`;
    _wDetail.innerHTML = '';
    const names = Object.keys(data.carriers).sort();
    if (!names.length) { _wDetail.innerHTML = '<i>Nessuna compagnia mappata nel range.</i>'; return; }
    names.forEach(name => {
        const c = data.carriers[name];
        const block = document.createElement('div');
        block.style.marginBottom = '8px';
        block.innerHTML = `<b>${name}</b><br>
            &nbsp;Import: ${c.import.total}<span style="color:#555;margin-left:6px;">20': ${c.import["20'"]} &nbsp;40': ${c.import["40'"]} &nbsp;40HC: ${c.import["40HC"]}</span><br>
            &nbsp;Export: ${c.export.total}<span style="color:#555;margin-left:6px;">20': ${c.export["20'"]} &nbsp;40': ${c.export["40'"]} &nbsp;40HC: ${c.export["40HC"]}</span>`;
        _wDetail.appendChild(block);
    });
}

function initCounter() {
    buildCounterWidget();
    updateCounterWidget(collectCounterData());
}

// ─────────────────────────────────────────────────────────────────
//  4. AUTOCOMPILA DATA + CASELLE IMPORT
// ─────────────────────────────────────────────────────────────────
function getTomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}

function clickButtonByText(text) {
    for (const el of document.querySelectorAll('button, .ui-button, span, div')) {
        if (el.innerText && el.innerText.trim() === text) { el.click(); return true; }
    }
    return false;
}

function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles:true }));
}

function compilaData() {
    const d = document.querySelector('[id*="inputPickupDeliveryDateStart_input"]');
    if (!d) return;
    d.value = getTomorrow();
    d.dispatchEvent(new Event('input', { bubbles:true }));
    d.dispatchEvent(new Event('change', { bubbles:true }));
    d.dispatchEvent(new KeyboardEvent('keyup', { bubbles:true }));
}

function addPortForAutocompila(searchText, callback) {
    const portInput = document.querySelector('[id*="portsInput"][id*="ccInput_port_input"]');
    if (!portInput) return;
    portInput.focus();
    setInputValue(portInput, searchText);
    let attempts = 0;
    const interval = setInterval(function() {
        attempts++;
        const first = document.querySelector('[id*="portsInput"][id*="ccInput_port_item_0"]');
        if (first) { clearInterval(interval); first.click(); if (callback) setTimeout(callback, 800); }
        if (attempts > 20) clearInterval(interval);
    }, 150);
}

function autocompila() {
    const importBtn = document.querySelector('#searchForm\\:searchAccordionPanel\\:j_idt266\\:inputTrafficType > div:nth-child(2) > span:nth-child(2)');
    if (importBtn) importBtn.click();
    clickButtonByText('Other Branches');
    setTimeout(compilaData, 200);
    setTimeout(function() {
        addPortForAutocompila('la spezia', function() { addPortForAutocompila('livorno', null); });
    }, 1500);
}

function addAutocompilaButton() {
    const anchor = document.querySelector('#searchForm\\:j_idt222 > span:nth-child(2)');
    if (!anchor || document.getElementById('btn-autocompila')) return;
    const parentItem = anchor.closest('li, div.ui-menuitem, div');
    if (!parentItem) return;
    const btn = document.createElement(parentItem.tagName);
    btn.id = 'btn-autocompila';
    btn.style.cssText = parentItem.style.cssText + '; cursor:pointer;';
    btn.className = parentItem.className;
    btn.innerHTML = '<span style="color:#1a73e8;font-size:13px;font-weight:bold;display:flex;align-items:center;gap:6px;padding:4px 8px;">⚡ Autocompila import</span>';
    btn.addEventListener('click', autocompila);
    parentItem.parentNode.insertBefore(btn, parentItem.nextSibling);
}

// ─────────────────────────────────────────────────────────────────
//  5. FILTRI PORTO
// ─────────────────────────────────────────────────────────────────
function cercaPorto(searchText, callback) {
    var portInput = document.querySelector('[id*="portsInput"][id*="ccInput_port_input"]');
    if (!portInput) return;
    var $input = $(portInput);
    $input.val(searchText);
    $input.trigger('keydown'); $input.trigger('keypress'); $input.trigger('input'); $input.trigger('keyup');
    var attempts = 0;
    var interval = setInterval(function() {
        attempts++;
        var first = document.querySelector('[id*="portsInput"][id*="ccInput_port_item_0"]');
        if (first) { clearInterval(interval); $(first).trigger('click'); if (callback) setTimeout(callback, 1200); }
        if (attempts > 30) clearInterval(interval);
    }, 200);
}

function addPortoButtons() {
    var anchor = document.querySelector('#searchForm\\:j_idt222 > span:nth-child(2)');
    if (!anchor || document.getElementById('btn-spezia')) return;
    var parentItem = anchor.closest('li, div.ui-menuitem, div');
    if (!parentItem) return;
    var insertAfter = document.getElementById('btn-autocompila') || parentItem;

    function creaBtn(id, label, onClick) {
        var btn = document.createElement(insertAfter.tagName);
        btn.id = id;
        btn.style.cssText = insertAfter.style.cssText + '; cursor:pointer;';
        btn.className = insertAfter.className;
        btn.innerHTML = '<span style="color:#1a73e8;font-size:13px;font-weight:bold;display:flex;align-items:center;gap:6px;padding:4px 8px;">' + label + '</span>';
        btn.addEventListener('click', onClick);
        return btn;
    }

    var sep = document.createElement(insertAfter.tagName);
    sep.style.cssText = 'padding:2px 8px;'; sep.className = insertAfter.className;
    sep.innerHTML = '<span style="padding:4px 8px;font-size:11px;color:#888;display:block;text-align:center;">── Porto ──</span>';

    var btnSpezia  = creaBtn('btn-spezia',  'Spezia',  function() { cercaPorto('la spezia'); });
    var btnLivorno = creaBtn('btn-livorno', 'Livorno', function() { cercaPorto('livorno'); });
    var btnGenova  = creaBtn('btn-genova',  'Genova',  function() { cercaPorto('genova'); });

    [sep, btnSpezia, btnLivorno, btnGenova].reduce((ref, el) => {
        ref.parentNode.insertBefore(el, ref.nextSibling); return el;
    }, insertAfter);
}

// ─────────────────────────────────────────────────────────────────
//  6. FILTRI CONTAINER TYPE
// ─────────────────────────────────────────────────────────────────
function selezionaContainer(searchText) {
    var label = document.querySelector('[id*="inputTransportEquipmentContainerType_label"]');
    if (!label) return;
    label.click();
    var att = 0;
    var iv = setInterval(function() {
        att++;
        var filter = document.querySelector('[id*="inputTransportEquipmentContainerType_filter"]');
        if (filter && filter.offsetParent !== null) {
            clearInterval(iv);
            filter.value = searchText;
            filter.dispatchEvent(new Event('input', { bubbles:true }));
            filter.dispatchEvent(new KeyboardEvent('keyup', { bubbles:true }));
            var att2 = 0;
            var iv2 = setInterval(function() {
                att2++;
                var found = null;
                document.querySelectorAll('.ui-selectonemenu-list li, .ui-multiselect-item').forEach(function(li) {
                    if (!found && li.offsetParent !== null && li.textContent.toLowerCase().includes(searchText.toLowerCase())) found = li;
                });
                if (found) { clearInterval(iv2); found.click(); }
                if (att2 > 20) clearInterval(iv2);
            }, 150);
        }
        if (att > 20) clearInterval(iv);
    }, 150);
}

function pulisciContainer() {
    var e = document.querySelector('[id*="inputTransportEquipmentContainerType_0"]');
    if (e) e.click();
}

function addContainerButtons() {
    var anchor = document.getElementById('btn-genova') || document.getElementById('btn-spezia-livorno');
    if (!anchor || document.getElementById('btn-20box')) return;

    function creaBtn(id, label, onClick) {
        var btn = document.createElement(anchor.tagName);
        btn.id = id;
        btn.style.cssText = anchor.style.cssText + '; cursor:pointer;';
        btn.className = anchor.className;
        btn.innerHTML = '<span style="color:#1a73e8;font-size:13px;font-weight:bold;display:flex;align-items:center;gap:6px;padding:4px 8px;">' + label + '</span>';
        btn.addEventListener('click', onClick);
        return btn;
    }

    var sep = document.createElement(anchor.tagName);
    sep.style.cssText = 'padding:2px 8px;'; sep.className = anchor.className;
    sep.innerHTML = '<span style="padding:4px 8px;font-size:11px;color:#888;display:block;text-align:center;">── Container ──</span>';

    var btn20   = creaBtn('btn-20box', '📦 20 box', function() { selezionaContainer('22G0'); });
    var btn40   = creaBtn('btn-40box', '📦 40 box', function() { selezionaContainer('42G0'); });
    var btn40hc = creaBtn('btn-40hc',  '📦 40 HC',  function() { selezionaContainer('45G0'); });

    var btnClear = document.createElement(anchor.tagName);
    btnClear.id = 'btn-container-clear';
    btnClear.style.cssText = anchor.style.cssText + '; cursor:pointer;';
    btnClear.className = anchor.className;
    btnClear.innerHTML = '<span style="color:#c0392b;font-size:13px;font-weight:bold;display:block;text-align:center;padding:4px 8px;">✕ Pulisci</span>';
    btnClear.addEventListener('click', pulisciContainer);

    [sep, btn20, btn40, btn40hc, btnClear].reduce((ref, el) => {
        ref.parentNode.insertBefore(el, ref.nextSibling); return el;
    }, anchor);
}

// ─────────────────────────────────────────────────────────────────
//  7. FILTRI COMPAGNIE MARITTIME
// ─────────────────────────────────────────────────────────────────
function selezionaCarrier(searchText) {
    var clearBtn = document.querySelector('[id*="inputCarrier_clearButton"]');
    if (clearBtn) clearBtn.click();
    setTimeout(function() {
        var input = document.querySelector('[id*="inputCarrier_input"]');
        if (!input) return;
        var $input = $(input);
        $input.val(searchText);
        $input.trigger('keydown'); $input.trigger('keypress'); $input.trigger('input'); $input.trigger('keyup');
        var attempts = 0;
        var interval = setInterval(function() {
            attempts++;
            var first = document.querySelector('[id*="inputCarrier_item_0"]');
            if (first) { clearInterval(interval); $(first).trigger('click'); }
            if (attempts > 30) clearInterval(interval);
        }, 200);
    }, 400);
}

function pulisciCarrier() {
    var cb = document.querySelector('[id*="inputCarrier_clearButton"]');
    if (cb) cb.click();
}

function addCompagnieButtons() {
    var anchor = document.getElementById('btn-container-clear');
    if (!anchor || document.getElementById('btn-msc')) return;

    function creaBtn(id, label, onClick) {
        var btn = document.createElement(anchor.tagName);
        btn.id = id;
        btn.style.cssText = anchor.style.cssText + '; cursor:pointer;';
        btn.className = anchor.className;
        btn.innerHTML = '<span style="color:#1a73e8;font-size:13px;font-weight:bold;display:flex;align-items:center;gap:6px;padding:4px 8px;">' + label + '</span>';
        btn.addEventListener('click', onClick);
        return btn;
    }

    function creaRiga(b1, b2) {
        var riga = document.createElement(anchor.tagName);
        riga.style.cssText = 'display:flex;gap:2px;padding:1px 4px;';
        riga.className = anchor.className;
        b1.style.flex = '1'; if (b2) b2.style.flex = '1';
        riga.appendChild(b1); if (b2) riga.appendChild(b2);
        return riga;
    }

    var sep = document.createElement(anchor.tagName);
    sep.style.cssText = 'padding:2px 8px;'; sep.className = anchor.className;
    sep.innerHTML = '<span style="padding:4px 8px;font-size:11px;color:#888;display:block;text-align:center;">── Compagnie ──</span>';

    var btnMSC    = creaBtn('btn-msc',          '🚢 MSC',    function() { selezionaCarrier('MSC Med'); });
    var btnHapag  = creaBtn('btn-hapag',         '🚢 Hapag',  function() { selezionaCarrier('Hapag Lloyd'); });
    var btnONE    = creaBtn('btn-one',           '🚢 One',    function() { selezionaCarrier('Ocean Network'); });
    var btnCMA    = creaBtn('btn-cma',           '🚢 CMA',    function() { selezionaCarrier('CMA-CGM'); });
    var btnOOCL   = creaBtn('btn-oocl',          '🚢 OOCL',   function() { selezionaCarrier('OOCL LOGISTICS LINE LTD'); });
    var btnZIM    = creaBtn('btn-zim',           '🚢 Zim',    function() { selezionaCarrier('ZIM INTEGRATED SHIPPING SERVICE LTD'); });
    var btnYMing  = creaBtn('btn-yming',         '🚢 Y.Ming', function() { selezionaCarrier('Yang Ming Marine Transport Corporation'); });
    var btnMaersk = creaBtn('btn-maersk',        '🚢 Maersk', function() { selezionaCarrier('MAERSK A/S'); });
    var btnClr    = creaBtn('btn-carrier-clear', '✕ Pulisci', function() { pulisciCarrier(); });
    btnClr.querySelector('span').style.color = '#c0392b';

    [
        sep,
        creaRiga(btnMSC, btnHapag),
        creaRiga(btnONE, btnCMA),
        creaRiga(btnOOCL, btnZIM),
        creaRiga(btnYMing, btnMaersk),
        btnClr
    ].reduce((ref, el) => {
        anchor.parentNode.insertBefore(el, ref.nextSibling); return el;
    }, anchor);
}

// ─────────────────────────────────────────────────────────────────
//  8. EXPORT EXCEL
// ─────────────────────────────────────────────────────────────────
function tcpContainerLabel(raw) {
    // Normalizza anche i valori già processati da normalizeContainer
    var aliases = {
        "40'R": "40' Reefer", "40OT": "40' Open Top",
        "40HC": "40' HC",     "20'":  "20' Box",
        "40'":  "40' Box"
    };
    if (aliases[raw]) return aliases[raw];
    var t = (raw || '').toLowerCase();
    if (/reefer.*high|high.*reefer/i.test(raw))   return "40' Reefer HC";
    if (/high.{0,5}cube.{0,10}open|open.{0,10}high.{0,5}cube/i.test(raw)) return "40' Open Top HC";
    if (/20.*reefer|reefer.*20/i.test(raw))        return "20' Reefer";
    if (/40.*reefer|reefer.*40/i.test(raw))        return "40' Reefer";
    if (/20.*open|open.*20/i.test(raw))            return "20' Open Top";
    if (/40.*open|open.*40/i.test(raw))            return "40' Open Top";
    if (/high.{0,5}cube/i.test(raw))               return "40' HC";
    if (/20.*standard|20.*dry|standard.*20|dry.*20/i.test(raw)) return "20' Box";
    if (/40.*standard|40.*dry|standard.*40|dry.*40/i.test(raw)) return "40' Box";
    if (/\b20\b/.test(raw))                        return "20' Box";
    if (/\b40\b/.test(raw))                        return "40' Box";
    return raw;
}

function exportToExcel() {
    // Raccolta dati (invariata)
    document.querySelectorAll('tr.ui-expanded-row').forEach(row => {
        if (row.dataset.tcpTagged) return;
        const trafficType = row.querySelector('td:nth-child(3)')?.innerText.trim() || '';
        const address     = row.querySelector('td:nth-child(5)')?.innerText.trim() || '';
        const reqTrucking = row.querySelector('td:nth-child(7)')?.innerText.trim() || '';
        const branch      = row.querySelector('td:nth-child(8)')?.innerText.trim() || '';
        const reqBranch   = row.querySelector('td:nth-child(9)')?.innerText.trim() || '';
        const createdOn     = row.querySelector('td:nth-child(12)')?.innerText.trim() || '';
        const deliveryPlace = row.querySelector('td:nth-child(11)')?.innerText.trim() || '';
        const contentRow  = row.nextElementSibling;
        if (!contentRow || !contentRow.classList.contains('ui-expanded-row-content')) return;
        contentRow.querySelectorAll('[id*="transportEquipmentsTable_data"] > tr').forEach(cRow => {
            const carrierRaw   = cRow.querySelector('td:nth-child(4)')?.innerText.trim() || '';
            const containerRaw = cRow.querySelector('td:nth-child(5)')?.innerText.trim() || '';
            const delivery     = cRow.querySelector('td:nth-child(6)')?.innerText.trim() || '';
            const portLoad     = cRow.querySelector('td:nth-child(7)')?.innerText.replace(/\[[^\]]+\]\s*/g,'').trim() || '';
            const portDisch    = cRow.querySelector('td:nth-child(8)')?.innerText.replace(/\[[^\]]+\]\s*/g,'').trim() || '';
            const contNr       = cRow.querySelector('td:nth-child(3)')?.innerText.trim() || '';
            cRow.dataset.tcpTraffic   = trafficType;
            cRow.dataset.tcpCarrier   = normalizeCarrier(carrierRaw) || carrierRaw;
            cRow.dataset.tcpContainer    = normalizeContainer(containerRaw) || containerRaw;
            cRow.dataset.tcpContainerRaw = containerRaw;
            cRow.dataset.tcpDelivery  = delivery;
            cRow.dataset.tcpAddress   = address;
            cRow.dataset.tcpPort      = trafficType.toLowerCase()==='import' ? portDisch : portLoad;
            cRow.dataset.tcpContNr    = contNr;
            cRow.dataset.tcpBranch    = branch;
            cRow.dataset.tcpReqBranch = reqBranch;
            cRow.dataset.tcpReqTruck  = reqTrucking;
            cRow.dataset.tcpCreated      = createdOn;
            cRow.dataset.tcpDelivPlace  = deliveryPlace;
        });
        row.dataset.tcpTagged = 'true';
    });

    const headers = ['Traffic Type','Carrier','Container Type','Delivery Date','Delivery Time','Address','Delivery Place','Port','Container Nr','Req. Trucking','Branch','Req. Branch LEF','Created On'];
    const dataRows = [];
    document.querySelectorAll('[id*="transportEquipmentsTable_data"] > tr[data-tcp-traffic]').forEach(r => {
        var _dlv=(r.dataset.tcpDelivery||'').split(',');
        var _dlvDate=(_dlv[0]||'').trim();
        var _dlvTime=(_dlv[1]||'').trim();
        dataRows.push([r.dataset.tcpTraffic, r.dataset.tcpCarrier, tcpContainerLabel(r.dataset.tcpContainerRaw || r.dataset.tcpContainer),
            _dlvDate, _dlvTime, r.dataset.tcpAddress, r.dataset.tcpDelivPlace,
            r.dataset.tcpPort, r.dataset.tcpContNr, r.dataset.tcpReqTruck,
            r.dataset.tcpBranch, r.dataset.tcpReqBranch, r.dataset.tcpCreated]);
    });
    if (!dataRows.length) { alert('Nessun dato da esportare. Espandi almeno una riga.'); return; }

    // Carica SheetJS e genera xlsx
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = function() {
        var XLSX = window.XLSX;
        var wb = XLSX.utils.book_new();
        var wsData = [headers].concat(dataRows);
        var ws = XLSX.utils.aoa_to_sheet(wsData);

        // Larghezze colonne adattate al contenuto
        var colWidths = headers.map(function(h, ci) {
            var max = h.length;
            dataRows.forEach(function(row) {
                var v = (row[ci] || '').toString();
                if (v.length > max) max = v.length;
            });
            return { wch: Math.min(max + 2, 40) };
        });
        ws['!cols'] = colWidths;

        // Autofilter su tutta la tabella
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: {r:0, c:0}, e: {r:dataRows.length, c:headers.length-1} }) };

        // Stile header: sfondo blu, testo bianco, grassetto
        var headerStyle = {
            fill: { fgColor: { rgb: '002856' } },
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
            border: {
                bottom: { style: 'thin', color: { rgb: 'AACCEE' } },
                right:  { style: 'thin', color: { rgb: 'AACCEE' } }
            }
        };
        headers.forEach(function(_, ci) {
            var cellRef = XLSX.utils.encode_cell({ r: 0, c: ci });
            if (!ws[cellRef]) return;
            ws[cellRef].s = headerStyle;
        });

        // Righe alternate: bianco e azzurrino
        dataRows.forEach(function(row, ri) {
            var isEven = ri % 2 === 0;
            var bgColor = isEven ? 'EAF4FB' : 'FFFFFF';
            row.forEach(function(_, ci) {
                var cellRef = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
                if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
                ws[cellRef].s = {
                    fill: { fgColor: { rgb: bgColor } },
                    font: { sz: 10 },
                    alignment: { vertical: 'center' },
                    border: {
                        bottom: { style: 'thin', color: { rgb: 'D0DFF0' } },
                        right:  { style: 'thin', color: { rgb: 'D0DFF0' } }
                    }
                };
            });
        });

        XLSX.utils.book_append_sheet(wb, ws, 'Viaggi');
        XLSX.writeFile(wb, 'viaggi_' + new Date().toISOString().slice(0,10) + '.xlsx');
    };
    script.onerror = function() {
        alert('Impossibile caricare SheetJS. Controlla la connessione o le impostazioni del browser.');
    };
    document.head.appendChild(script);
}

// ─────────────────────────────────────────────────────────────────
//  IMPORT TARIFFARIO DA FILE (pannello laterale gestionale)
// ─────────────────────────────────────────────────────────────────
function tcpImportTariffario(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var text = e.target.result.replace(/^\uFEFF/, '').replace(/\uFEFF/g,'');
        var lines = text.split('\n').map(function(l){return l.replace(/\r$/,'');}).filter(function(l){return l.trim();});
        if (!lines.length) { alert('File vuoto.'); return; }
        var start = isNaN(parseInt(lines[0].split(';')[0])) ? 1 : 0;
        var tar = []; var errors = 0;
        for (var i = start; i < lines.length; i++) {
            var parts = lines[i].split(';');
            if (parts.length < 2) continue;
            var km = parseInt(parts[0]);
            var c20 = parseFloat((parts[1]||'').replace(',','.'));
            var c40 = parts[2] ? parseFloat(parts[2].replace(',','.')) : c20;
            if (!km || isNaN(km)) { errors++; continue; }
            var r = { km: km };
            if (!isNaN(c20) && c20 > 0) r.c20 = c20;
            if (!isNaN(c40) && c40 > 0) r.c40 = c40;
            tar.push(r);
        }
        input.value = '';
        if (!tar.length) { alert('Nessun dato valido trovato nel file.'); return; }
        localStorage.setItem('tcp_tariffario', JSON.stringify(tar));
        var msg = tar.length + ' righe importate' + (errors > 0 ? ', ' + errors + ' saltate' : '') + '.';
        alert(msg);
    };
    reader.readAsText(file, 'UTF-8');
}

// ─────────────────────────────────────────────────────────────────
//  ESPORTA TARIFFARIO (gestionale)
// ─────────────────────────────────────────────────────────────────
function tcpEsportaTariffarioGest() {
    var tar = []; try { tar = JSON.parse(localStorage.getItem('tcp_tariffario') || '[]'); } catch(e) {}
    if (!tar.length) { alert('Nessun tariffario da esportare.'); return; }
    var rows = ["km;Costo grezzo 20';Costo grezzo 40'/40HC"];
    tar.sort(function(a,b){return a.km-b.km;}).forEach(function(r){
        rows.push(r.km+';'+( r.c20||'')+';'+( r.c40||''));
    });
    var csv = '\uFEFF' + rows.join('\n');
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tariffario_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(a.href);
}

// ─────────────────────────────────────────────────────────────────
//  ESPORTA / IMPORTA-MERGE TRATTE (gestionale)
// ─────────────────────────────────────────────────────────────────
function tcpEsportaTrattteGest() {
    var tratte = []; try { tratte = JSON.parse(localStorage.getItem('tcp_tratte') || '[]'); } catch(e) {}
    if (!tratte.length) { alert('Nessuna tratta da esportare.'); return; }
    var rows = ["Porto Imp;Scarico;Carico;Porto Exp;Km"];
    tratte.forEach(function(t){
        rows.push([t.portoImp,t.scarico,t.carico,t.portoExp,t.km].join(';'));
    });
    var csv = '\uFEFF' + rows.join('\n');
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tratte_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(a.href);
}

function tcpMergeTratteGest(input) {
    var file = input.files && input.files[0]; input.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var text = e.target.result.replace(/^\uFEFF/,'').replace(/\r/g,'');
        var lines = text.split('\n').filter(function(l){return l.trim();});
        if (lines.length < 2) { alert('File vuoto o non valido.'); return; }
        var incoming = [];
        for (var i = 1; i < lines.length; i++) {
            var p = lines[i].split(';');
            if (p.length < 5) continue;
            var portoImp=p[0].trim(), scarico=p[1].trim(), carico=p[2].trim(), portoExp=p[3].trim(), km=parseInt(p[4])||0;
            if (!scarico || !carico || !km) continue;
            var id = [portoImp,scarico,carico,portoExp].join('||');
            incoming.push({id:id,portoImp:portoImp,scarico:scarico,carico:carico,portoExp:portoExp,km:km});
        }
        if (!incoming.length) { alert('Nessuna tratta valida nel file.'); return; }
        var existing = []; try { existing = JSON.parse(localStorage.getItem('tcp_tratte')||'[]'); } catch(e) {}
        var added = 0, conflicts = [];
        incoming.forEach(function(t) {
            var ex = existing.find(function(x){return x.id===t.id;});
            if (!ex) { existing.push(t); added++; }
            else if (ex.km !== t.km) { conflicts.push({ex:ex, inc:t}); }
        });
        if (conflicts.length) {
            var msg = added + ' tratte nuove aggiunte.\n\nConflitti (km diversi):\n';
            conflicts.forEach(function(cf) {
                var scelta = confirm(cf.ex.scarico+' ↕ '+cf.ex.carico+'\nMio: '+cf.ex.km+' km\nCollega: '+cf.inc.km+' km\n\nOK = tieni collega | Annulla = tieni il tuo');
                if (scelta) cf.ex.km = cf.inc.km;
            });
        }
        localStorage.setItem('tcp_tratte', JSON.stringify(existing));
        alert(added + ' tratte nuove aggiunte' + (conflicts.length ? ', ' + conflicts.length + ' conflitti risolti' : '') + '.');
    };
    reader.readAsText(file, 'UTF-8');
}

// ─────────────────────────────────────────────────────────────────
//  INIT PRINCIPALE
// ─────────────────────────────────────────────────────────────────
function waitForTable(callback) {
    const obs = new MutationObserver(() => {
        const head = document.querySelector('#searchForm\\:resultTable_TRANSPORT_ORDER_DM_head tr');
        if (head && head.children.length > 0) { obs.disconnect(); callback(); }
    });
    obs.observe(document.body, { childList:true, subtree:true });
}

waitForTable(initLayout);

// ── Funzioni chiamabili dalla finestra monitor ──
window.tcpGoToRow = function(orderId) {
    window.focus();
    document.querySelectorAll('tr.ui-expanded-row').forEach(function(row) {
        var sub = row.nextElementSibling;
        if (!sub || !sub.classList.contains('ui-expanded-row-content')) return;
        sub.querySelectorAll('[id*="transportEquipmentsTable_data"] > tr').forEach(function(cr) {
            var nr = cr.querySelector('td:nth-child(3)')?.innerText.trim() || '';
            if (nr && nr === orderId) {
                cr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                var n = 0;
                var iv = setInterval(function() {
                    cr.style.outline = (n % 2 === 0) ? '3px solid #e74c3c' : 'none';
                    if (++n > 17) { clearInterval(iv); cr.style.outline = ''; }
                }, 280);
            }
        });
    });
};

window.tcpSelectRow = function(orderId) {
    window.focus();
    document.querySelectorAll('tr.ui-expanded-row').forEach(function(row) {
        var sub = row.nextElementSibling;
        if (!sub || !sub.classList.contains('ui-expanded-row-content')) return;
        sub.querySelectorAll('[id*="transportEquipmentsTable_data"] > tr').forEach(function(cr) {
            var nr = cr.querySelector('td:nth-child(3)')?.innerText.trim() || '';
            if (nr && nr === orderId) {
                // Cerca la checkbox specifica di questa riga container (non quella di colonna)
                var chk = cr.querySelector('[id*="transportEquipmentsTable"][id*="_checkbox"] > span.ui-chkbox-icon');
                if (chk) { chk.click(); return; }
                // Fallback: input checkbox diretto nella riga
                var inp = cr.querySelector('td:nth-child(1) input[type="checkbox"]');
                if (inp) inp.click();
            }
        });
    });
};

let _debounceCounter = null;
const _counterObserver = new MutationObserver(mutations => {
    if (mutations.every(m => _wEl && _wEl.contains(m.target))) return;
    const head = document.querySelector('#searchForm\\:resultTable_TRANSPORT_ORDER_DM_head tr');
    if (head && head.children.length > 0) {
        clearTimeout(_debounceCounter);
        _debounceCounter = setTimeout(initCounter, 800);
    }
});
_counterObserver.observe(document.body, { childList:true, subtree:true });

console.log('✅ TCP Base v4.6 caricato (senza monitor)');

// ─────────────────────────────────────────────────────────────────
//  PANNELLO LATERALE COLLASSABILE
// ─────────────────────────────────────────────────────────────────
function buildSidePanel() {
    if (document.getElementById('tcp-side-panel')) return;

    // Contenitore principale
    var panel = document.createElement('div');
    panel.id = 'tcp-side-panel';
    panel.style.cssText = 'position:fixed;right:0;top:calc(50% - 74px);transform:translateY(-50%);z-index:9998;display:flex;flex-direction:row;align-items:stretch;font-family:Arial,sans-serif;';

    // Pannello contenuto (collassabile)
    var body = document.createElement('div');
    body.id = 'tcp-side-body';
    body.style.cssText = 'background:white;border:2px solid #002856;border-right:none;border-left:none;border-radius:0;padding:10px 8px;width:160px;box-shadow:none;overflow-y:auto;max-height:80vh;transition:width .2s,padding .2s,opacity .2s;overflow:hidden;';

    // Linguetta toggle — fratello flex del body, sempre visibile
    var tab = document.createElement('div');
    tab.id = 'tcp-side-tab';
    tab.title = 'Apri/Chiudi filtri';
    tab.style.cssText = 'background:#002856;color:white;border:2px solid #002856;border-right:none;border-radius:8px 0 0 8px;width:22px;min-width:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;text-orientation:mixed;user-select:none;font-size:11px;font-weight:bold;letter-spacing:1px;box-shadow:-3px 0 8px rgba(0,0,0,.2);flex-shrink:0;';
    tab.textContent = '▶ FILTRI';

    var open = false;
    // Stato iniziale: chiuso
    body.style.width = '0';
    body.style.padding = '0';
    body.style.opacity = '0';
    tab.textContent = '◀ FILTRI';
    function togglePanel() {
        open = !open;
        if (open) {
            body.style.width = '160px';
            body.style.padding = '10px 8px';
            body.style.opacity = '1';
            body.style.borderRight = '2px solid #002856';
            tab.textContent = '▶ FILTRI';
        } else {
            body.style.width = '0';
            body.style.padding = '0';
            body.style.opacity = '0';
            body.style.borderRight = 'none';
            tab.textContent = '◀ FILTRI';
        }
    }
    tab.addEventListener('click', togglePanel);

    // ── Sezione helper ──
    function sep(label) {
        var d = document.createElement('div');
        d.style.cssText = 'font-size:10px;font-weight:bold;color:#888;text-align:center;margin:8px 0 4px;border-top:1px solid #e0eaf8;padding-top:6px;letter-spacing:.5px;';
        d.textContent = label;
        return d;
    }
    function btn(label, color, onClick) {
        var b = document.createElement('button');
        b.style.cssText = 'width:100%;background:'+(color||'#002856')+';color:white;border:none;border-radius:4px;padding:5px 4px;margin-bottom:3px;cursor:pointer;font-size:11px;font-weight:bold;text-align:center;';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
    }
    function row2(b1, b2) {
        var r = document.createElement('div');
        r.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:0;';
        r.appendChild(b1); r.appendChild(b2);
        return r;
    }

    // ── Porto ──
    body.appendChild(sep('⚓ PORTO'));
    body.appendChild(btn('La Spezia', '#1a65b8', function(){ cercaPorto('la spezia'); }));
    body.appendChild(btn('Livorno',   '#1a65b8', function(){ cercaPorto('livorno'); }));
    body.appendChild(btn('Genova',    '#1a65b8', function(){ cercaPorto('genova'); }));

    // ── Container ──
    body.appendChild(sep('📦 CONTAINER'));
    body.appendChild(row2(
        btn("20'",  '#2471a3', function(){ selezionaContainer('22G0'); }),
        btn("40'",  '#2471a3', function(){ selezionaContainer('42G0'); })
    ));
    body.appendChild(btn("40 HC", '#2471a3', function(){ selezionaContainer('45G0'); }));
    body.appendChild(btn('✕ Pulisci', '#a93226', function(){ pulisciContainer(); }));

    // ── Compagnie ──
    body.appendChild(sep('🚢 COMPAGNIE'));
    body.appendChild(row2(
        btn('MSC',   '#1a65b8', function(){ selezionaCarrier('MSC Med'); }),
        btn('Hapag', '#1a65b8', function(){ selezionaCarrier('Hapag Lloyd'); })
    ));
    body.appendChild(row2(
        btn('ONE',   '#1a65b8', function(){ selezionaCarrier('Ocean Network'); }),
        btn('CMA',   '#1a65b8', function(){ selezionaCarrier('CMA-CGM'); })
    ));
    body.appendChild(row2(
        btn('OOCL',  '#1a65b8', function(){ selezionaCarrier('OOCL LOGISTICS LINE LTD'); }),
        btn('ZIM',   '#1a65b8', function(){ selezionaCarrier('ZIM INTEGRATED SHIPPING SERVICE LTD'); })
    ));
    body.appendChild(row2(
        btn('Y.Ming','#1a65b8', function(){ selezionaCarrier('Yang Ming Marine Transport Corporation'); }),
        btn('Maersk','#1a65b8', function(){ selezionaCarrier('MAERSK A/S'); })
    ));
    body.appendChild(btn('✕ Pulisci', '#a93226', function(){ pulisciCarrier(); }));

    // ── Export ──
    body.appendChild(sep('📊 GLF'));
    body.appendChild(btn('Excel', '#27ae60', function(){ exportToExcel(); }));
    // ── Tariffario ──
    body.appendChild(sep('📋 TARIFFARIO'));
    var tarInput = document.createElement('input');
    tarInput.type = 'file'; tarInput.accept = '.csv'; tarInput.style.display = 'none';
    tarInput.addEventListener('change', function(){ tcpImportTariffario(tarInput); });
    document.body.appendChild(tarInput);
    body.appendChild(row2(
        btn('📂 Importa', '#1a4a8a', function(){ tarInput.click(); }),
        btn('📥 Esporta', '#1a5c1a', function(){ tcpEsportaTariffarioGest(); })
    ));
    body.appendChild(sep('🗺️ TRATTE'));
    var tratteInput = document.createElement('input');
    tratteInput.type = 'file'; tratteInput.accept = '.csv'; tratteInput.style.display = 'none';
    tratteInput.addEventListener('change', function(){ tcpMergeTratteGest(tratteInput); });
    document.body.appendChild(tratteInput);
    body.appendChild(row2(
        btn('📂 Imp/Merge', '#1a4a8a', function(){ tratteInput.click(); }),
        btn('📥 Esporta', '#1a5c1a', function(){ tcpEsportaTrattteGest(); })
    ));

    panel.appendChild(tab);
    panel.appendChild(body);
    document.body.appendChild(panel);
}

waitForTable(function() { buildSidePanel(); });

// ─────────────────────────────────────────────────────────────────
//  DEBUG BUTTON 🐞
// ─────────────────────────────────────────────────────────────────
function buildDebugBtn() {
    if (document.getElementById('tcp-dbg-btn')) return;

    var btn = document.createElement('div');
    btn.id = 'tcp-dbg-btn';
    btn.title = 'TCP Debug';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:28px;height:28px;background:#002856;color:white;border-radius:50%;cursor:pointer;z-index:10000;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.3);opacity:0.7;';
    btn.textContent = '🐞';
    btn.onmouseenter = function() { btn.style.opacity = '1'; };
    btn.onmouseleave = function() { btn.style.opacity = '0.7'; };

    var panel = document.createElement('div');
    panel.id = 'tcp-dbg-panel';
    panel.style.cssText = 'position:fixed;bottom:56px;right:20px;width:480px;max-height:400px;background:white;border:2px solid #002856;border-radius:8px;z-index:10001;display:none;flex-direction:column;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:Arial,sans-serif;';

    var header = document.createElement('div');
    header.style.cssText = 'background:#002856;color:white;padding:7px 12px;font-weight:bold;font-size:12px;display:flex;align-items:center;justify-content:space-between;border-radius:6px 6px 0 0;';

    var title = document.createElement('span');
    title.textContent = '🐞 TCP Debug';

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:4px;';

    var diagBtn = document.createElement('button');
    diagBtn.textContent = '▶ Diagnosi';
    diagBtn.style.cssText = 'background:#e67e22;color:white;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:10px;';
    diagBtn.onclick = function() { window.tcpRunDiag && window.tcpRunDiag(); };

    var clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑 Svuota';
    clearBtn.style.cssText = 'background:#555;color:white;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:10px;';
    clearBtn.onclick = function() { var b=document.getElementById('tcp-dbg-body'); if(b) b.innerHTML=''; };

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:#c0392b;color:white;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:10px;';
    closeBtn.onclick = function() { panel.style.display = 'none'; };

    btns.appendChild(diagBtn);
    btns.appendChild(clearBtn);
    btns.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(btns);

    var logDiv = document.createElement('div');
    logDiv.id = 'tcp-dbg-body';
    logDiv.style.cssText = 'overflow-y:auto;max-height:340px;padding:8px 10px;';

    panel.appendChild(header);
    panel.appendChild(logDiv);

    btn.addEventListener('click', function() {
        var open = panel.style.display !== 'none';
        panel.style.display = open ? 'none' : 'flex';
        if (!open && window.tcpRunDiag) window.tcpRunDiag();
    });

    document.body.appendChild(btn);
    document.body.appendChild(panel);
}

function _dbgPush(type, msg) {
    var col = type==='error'?'#e74c3c':type==='ok'?'#27ae60':type==='warn'?'#e67e22':'#002856';
    var body = document.getElementById('tcp-dbg-body');
    if (!body) return;
    var d = document.createElement('div');
    d.style.cssText = 'padding:2px 0;border-bottom:1px solid #f0f4fa;font-size:10px;';
    d.innerHTML = '<span style="color:#888;">[' + new Date().toLocaleTimeString('it-IT') + ']</span> '
        + '<span style="color:' + col + ';font-weight:bold;">[' + type + ']</span> '
        + '<span>' + msg + '</span>';
    body.insertBefore(d, body.firstChild);
}

window.tcpRunDiag = function() {
    var body = document.getElementById('tcp-dbg-body');
    if (body) body.innerHTML = '';
    _dbgPush('info', 'Diagnosi avviata');

    // Controlla finestra monitor
    var mw = window.tcpMonitorWin;
    if (!mw) {
        _dbgPush('warn', 'monitorWin: non aperta');
    } else if (mw.closed) {
        _dbgPush('warn', 'monitorWin: CHIUSA');
    } else {
        _dbgPush('ok', 'monitorWin: aperta ✓');
        try {
            ['showTab','rPairs','rPlanner','handleCheck','doAbbina','updDim'].forEach(function(fn) {
                _dbgPush(typeof mw[fn]==='function'?'ok':'error',
                    fn + ': ' + (typeof mw[fn]==='function' ? 'OK ✓' : 'MANCANTE'));
            });
        } catch(e) { _dbgPush('error', 'Accesso finestra: ' + e.message); }
    }

    // Storage
    try {
        var orders = JSON.parse(localStorage.getItem('tcp_mon_orders') || '[]');
        var pairs  = JSON.parse(localStorage.getItem('tcp_mon_pairs') || '[]');
        _dbgPush('info', 'Storage: ' + orders.length + ' ordini, ' + pairs.length + ' coppie');
    } catch(e) { _dbgPush('error', 'Storage: ' + e.message); }

    // Widget presenti
    ['tcp-mon-widget', 'tcp-counter-widget'].forEach(function(id) {
        _dbgPush(document.getElementById(id) ? 'ok' : 'warn',
            id + ': ' + (document.getElementById(id) ? '✓' : 'MANCANTE'));
    });

    // Funzioni gestionale
    ['tcpGoToRow','tcpSelectRow'].forEach(function(fn) {
        _dbgPush(typeof window[fn]==='function'?'ok':'error',
            fn + ': ' + (typeof window[fn]==='function'?'OK ✓':'MANCANTE'));
    });

    // Righe visibili nel gestionale
    var righe = document.querySelectorAll('tr.ui-expanded-row').length;
    _dbgPush(righe>0?'ok':'warn', 'Righe espanse nel gestionale: ' + righe);

    // Storage size
    try {
        var bytes = JSON.stringify(localStorage).length;
        _dbgPush('info', 'localStorage usato: ~' + Math.round(bytes/1024) + ' KB');
    } catch(e) {}

    _dbgPush('info', 'Diagnosi completata');
};

// Aggiunge buildDebugBtn all'init
waitForTable(function() {
    buildDebugBtn();
});


// ═══════════════════════════════════════════════════════════════════
//  MONITOR NUOVI VIAGGI — widget + finestra separata a 3 tab
//  [Viaggi] [Riutilizzi] [Planner]
// ═══════════════════════════════════════════════════════════════════


// ── Chiavi storage ──
const SK  = 'tcp_mon_state';    // sessionStorage: stato running/settings
const OK  = 'tcp_mon_orders';   // localStorage: ordini raccolti
const PK  = 'tcp_mon_pairs';    // localStorage: coppie abbinate

// ── Palette colori per carrier ──
const PAL = {
    MSC:   ['#b3d4f5','#85b8ed','#5a9ce0','#3080d4','#1a65b8','#0d4a9a'],
    Hapag: ['#fdd5a0','#fbb970','#f89d40','#f58010','#d96500','#b84e00'],
    ONE:   ['#b3f5c8','#85ed9e','#5ae074','#30d44a','#1ab82e','#0a9a1e'],
    CMA:   ['#d5b3f5','#b885ed','#9a5ae0','#7c30d4','#601ab8','#46009a'],
};

// ────────────────────────────────────────────────
//  STORAGE
// ────────────────────────────────────────────────
const ss = {
    save:  s  => sessionStorage.setItem(SK, JSON.stringify(s)),
    load:  () => { try { return JSON.parse(sessionStorage.getItem(SK)); } catch { return null; } },
    clear: () => sessionStorage.removeItem(SK),
};
const ls = {
    orders: () => { try { return JSON.parse(localStorage.getItem(OK)) || []; } catch { return []; } },
    saveOrders: o => localStorage.setItem(OK, JSON.stringify(o)),
    pairs:  () => { try { return JSON.parse(localStorage.getItem(PK)) || []; } catch { return []; } },
    savePairs: p => localStorage.setItem(PK, JSON.stringify(p)),
};

// ────────────────────────────────────────────────
//  UTILITY
// ────────────────────────────────────────────────
function ncr(t) {
    if (/MSC/i.test(t)) return 'MSC';
    if (/hapag/i.test(t)) return 'Hapag';
    if (/ONE|ocean network/i.test(t)) return 'ONE';
    if (/CMA/i.test(t)) return 'CMA';
    if (/OOCL/i.test(t)) return 'OOCL';
    if (/\bZIM\b/i.test(t)) return 'ZIM';
    if (/yang.?ming/i.test(t)) return 'Yang Ming';
    if (/maersk/i.test(t)) return 'Maersk';
    if (/evergreen/i.test(t)) return 'Evergreen';
    return null;
}
function nct(t) {
    if (/reef/i.test(t))      return "40'R";
    if (/open.?top/i.test(t)) return "40OT";
    if (/20/i.test(t))        return "20'";
    if (/40/i.test(t) && /high|hc/i.test(t)) return '40HC';
    if (/40/i.test(t))        return "40'";
    return null;
}
function pdt(s) {
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{2}),?\s*(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(2000+parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]));
}
function pd(s) {
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (!m) return null;
    const d = new Date(2000+parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]));
    d.setHours(0,0,0,0); return d;
}

// ── Mappa branch → sigla cliente ──
function tcpBranchToClient(branch) {
    if (!branch) return '';
    var b = branch;
    if (/savino.*del.*bene|savino.*bene/i.test(b)) {
        if (/livorno|livorn/i.test(b))       return 'SDB LI';
        if (/firenze|florence/i.test(b))     return 'SDB FI';
        if (/genova|genoa/i.test(b))         return 'SDB GE';
        if (/milano.*dp|dp.*milano|divisione.*prog/i.test(b)) return 'SDB MI DP';
        if (/milano|milan/i.test(b))         return 'SDB MI';
        if (/roma|rome/i.test(b))            return 'SDB RM';
        if (/napoli|naples/i.test(b))        return 'SDB NA';
        if (/torino|turin/i.test(b))         return 'SDB TO';
        if (/bergamo/i.test(b))              return 'SDB BG';
        if (/catania/i.test(b))              return 'SDB CT';
        if (/fidenza/i.test(b))              return 'SDB PR';
        if (/montecosaro/i.test(b))          return 'SDB MC';
        if (/montemurlo/i.test(b))           return 'SDB PO';
        if (/montichiari/i.test(b))          return 'SDB BS';
        if (/san.*miniato/i.test(b))         return 'SDB SM';
        if (/udine/i.test(b))                return 'SDB UD';
        if (/verona/i.test(b))               return 'SDB VR';
        if (/vicenza/i.test(b))              return 'SDB VI';
        if (/campogalliano/i.test(b))        return 'SDB MO';
        if (/montebelluna/i.test(b))         return 'SDB TV';
        if (/pisa/i.test(b))                 return 'SDB PI';
        if (/stabio/i.test(b))               return 'SDB STABIO';
        if (/padova|padua/i.test(b))         return 'SDB PD';
        if (/venezia|venice/i.test(b))       return 'SDB VE';
        if (/bologna/i.test(b))              return 'SDB BO';
        return 'SDB';
    }
    if (/albatrans/i.test(b))               return 'ALBATRANS';
    if (/aprile/i.test(b))                  return 'APRILE';
    if (/arimar/i.test(b))                  return 'ARIMAR';
    if (/c\.d\.c|cdc/i.test(b))             return 'CDC';
    if (/danesi/i.test(b))                  return 'DANESI';
    if (/general.*noli|noli/i.test(b))      return 'GENERAL NOLI';
    if (/bortesi/i.test(b))                 return 'BORTESI';
    return branch;
}

// ── Estrai solo la città dall'indirizzo ──
function tcpCitta(address) {
    if (!address) return '';
    // Prende la prima parte prima di "+" (coppie di indirizzi)
    var part = address.split('+')[0].trim();
    // Rimuove CAP (5 cifre) e provincia "(XX)"
    part = part.replace(/\b\d{5}\b/g, '').replace(/\([A-Z]{2}\)/g, '').trim();
    // Prende solo le parole prima di eventuali virgole o trattini
    part = part.split(/[,\-]/)[0].trim();
    return part;
}

// ── Mappa carrier → nome Excel ──
function tcpCarrierExcel(carrier) {
    var map = {
        'MSC': 'MSC', 'Hapag': 'HAPAG', 'ONE': 'ONE', 'CMA': 'CMA',
        'OOCL': 'OOCL', 'ZIM': 'ZIM', 'Yang Ming': 'YANG MING', 'Maersk': 'MAERSK'
    };
    return map[carrier] || carrier;
}

// ── Mappa container → tipo Excel ──
function tcpContExcel(cont) {
    var map = {"20'": '20 BOX', "40'": '40 BOX', '40HC': '40 HC'};
    return map[cont] || cont;
}

function compat(ic, ec) {
    if (ic === "20'") return ec === "20'";
    if (ic === '40HC') return ec === "40'" || ec === '40HC';
    if (ic === "40'") return ec === "40'";
    return false;
}
function portA(p) {
    if (!p) return '';
    if (/spezia/i.test(p)) return 'SPZ';
    if (/livorno/i.test(p)) return 'LIV';
    if (/genova/i.test(p)) return 'GEN';
    return p.substring(0,3).toUpperCase();
}
function pairedIds() {
    const s = new Set();
    ls.pairs().forEach(p => { s.add(p.imp.id); s.add(p.exp.id); });
    return s;
}
function wkNum(d) {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay()||7));
    const ys = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
    return Math.ceil((((dt-ys)/86400000)+1)/7);
}
function monday(off) {
    const n = new Date(); n.setHours(0,0,0,0);
    const day = n.getDay()||7;
    const m = new Date(n); m.setDate(n.getDate()-day+1+off*7);
    return m;
}
function sameDay(a,b) { return a&&b && a.toDateString()===b.toDateString(); }

// ────────────────────────────────────────────────
//  RACCOLTA DATI DAL GESTIONALE
// ────────────────────────────────────────────────
function collect(intervalMin, carriers, containers) {
    const now = new Date();
    const cutoff = new Date(now - intervalMin * 60000);
    const existing = ls.orders();
    existing.forEach(o => { delete o.isModified; delete o.modifiedAt; });
    const knownIds = new Set(existing.map(o => o.id));
    const fresh = [];

    document.querySelectorAll('tr.ui-expanded-row').forEach(row => {
        const traffic  = row.querySelector('td:nth-child(3)')?.innerText.trim() || '';
        const addressRaw = row.querySelector('td:nth-child(5)')?.innerText.trim() || '';
        const addressParts = addressRaw.split(/(?<=\d{5})\s+(?=[A-Z])/);
        const address = (()=>{ if(addressParts.length<2)return addressRaw.trim(); const p0=addressParts[0].toUpperCase(),p1=addressParts[1].toUpperCase(); const isLivTrento=(p0.includes('LIVORNO')||p0.includes('(LI)'))&&(p1.includes('TRENTO')||p1.includes('(TN)')); return isLivTrento?[...addressParts].reverse().join(' + ').trim():addressParts.join(' + ').trim(); })();
        const addressAll = addressRaw;
        const reqTruck = row.querySelector('td:nth-child(7)')?.innerText.trim() || '';
        const branch   = row.querySelector('td:nth-child(8)')?.innerText.trim() || '';
        const reqBranch= row.querySelector('td:nth-child(9)')?.innerText.trim() || '';
        const place    = row.querySelector('td:nth-child(11)')?.innerText.trim() || '';
        const created  = row.querySelector('td:nth-child(12)')?.innerText.trim() || '';
        const createdDT = pdt(created);

        // Non si scarta più per data — tutti i visibili entrano in lista
        const sub = row.nextElementSibling;
        if (!sub || !sub.classList.contains('ui-expanded-row-content')) return;

        Array.from(sub.querySelectorAll('[id*="transportEquipmentsTable_data"] > tr')).forEach((cr, crIdx) => {
            const rawCarrier= cr.querySelector('td:nth-child(4)')?.innerText.trim() || '';
            const rawCont   = cr.querySelector('td:nth-child(5)')?.innerText.trim() || '';
            const carrier   = ncr(rawCarrier);
            const cont      = nct(rawCont);

            if (!carrier || !carriers.includes(carrier)) return;
            if (!cont || !containers.includes(cont)) return;

            const portLoadE = cr.querySelector('td:nth-child(7)')?.innerText.replace(/\[[^\]]+\]\s*/g,'').trim() || '';
            if (traffic.toLowerCase() === 'export' && /livorno/i.test(portLoadE) && addressParts.length === 1 && /livorno/i.test(addressAll) && (/savino.*livorno/i.test(addressAll) || /savino.*livorno/i.test(branch) || /savino.*livorno/i.test(place))) return;
            const contNr   = cr.querySelector('td:nth-child(3)')?.innerText.trim() || '';
            const id       = contNr || (traffic + created + rawCarrier);
            const _exO = existing.find(x => x.id === id);
            if (_exO) {
                const _dlvN     = cr.querySelector('td:nth-child(6)')?.innerText.trim() || '';
                const _plN      = cr.querySelector('td:nth-child(7)')?.innerText.replace(/\[[^\]]+\]\s*/g,'').trim() || '';
                const _pdN      = cr.querySelector('td:nth-child(8)')?.innerText.replace(/\[[^\]]+\]\s*/g,'').trim() || '';
                const _portN    = traffic.toLowerCase() === 'import' ? _pdN : _plN;
                const _ldvN     = cr.querySelector('td:nth-child(12)')?.innerText.trim() || '';
                const _carrierN = ncr(rawCarrier) || _exO.carrier;
                const _contN    = nct(rawCont) || _exO.cont;
                if (_exO.delivery !== _dlvN || _exO.port !== _portN || _exO.ldv !== _ldvN ||
                    _exO.address !== address || _exO.carrier !== _carrierN || _exO.cont !== _contN ||
                    _exO.branch !== branch) {
                    _exO.delivery   = _dlvN;
                    _exO.port       = _portN;
                    _exO.ldv        = _ldvN;
                    _exO.address    = address;
                    _exO.carrier    = _carrierN;
                    _exO.cont       = _contN;
                    _exO.branch     = branch;
                    _exO.isModified = true;
                    _exO.modifiedAt = now.toISOString();
                }
                return;
            }

            const delivery  = cr.querySelector('td:nth-child(6)')?.innerText.trim() || '';
            const portLoad  = cr.querySelector('td:nth-child(7)')?.innerText.replace(/\[[^\]]+\]\s*/g,'').trim() || '';
            const portDisch = cr.querySelector('td:nth-child(8)')?.innerText.replace(/\[[^\]]+\]\s*/g,'').trim() || '';
            const port      = traffic.toLowerCase() === 'import' ? portDisch : portLoad;
            const ldv       = cr.querySelector('td:nth-child(12)')?.innerText.trim() || '';
            const adrEl     = cr.querySelector('[id*="dangerousGoodsPanel"] > span');
            const adr       = adrEl ? 'ADR' : '';

            // isNew = dentro la finestra temporale (badge NEW nella tabella)
            const isNew = createdDT && createdDT >= cutoff;
            fresh.push({ id, created, traffic, carrier, cont, delivery, address, port, contNr, branch, reqBranch, reqTruck, ldv, adr, place, highlighted: false, addedAt: now.toISOString(), isNew: !!isNew });
        });
    });

    // ── Rileva container non più presenti nel gestionale ──
    const activeIds = new Set();
    document.querySelectorAll('tr.ui-expanded-row').forEach(row => {
        const sub = row.nextElementSibling;
        if (!sub || !sub.classList.contains('ui-expanded-row-content')) return;
        Array.from(sub.querySelectorAll('[id*="transportEquipmentsTable_data"] > tr')).forEach(cr => {
            const contNr = cr.querySelector('td:nth-child(3)')?.innerText.trim() || '';
            const rawCarrier = cr.querySelector('td:nth-child(4)')?.innerText.trim() || '';
            const created = row.querySelector('td:nth-child(12)')?.innerText.trim() || '';
            const traffic = row.querySelector('td:nth-child(3)')?.innerText.trim() || '';
            const id = contNr || (traffic + created + rawCarrier);
            if(id) activeIds.add(id);
        });
    });
    const now24 = Date.now();
    existing.forEach(o => {
        if(o.manual){
            // Viaggio manuale — non toccare mai missing
        } else if(activeIds.has(o.id)){
            // Tornato presente — ripristina
            if(o.missingFrom){ delete o.missingFrom; o.missing = false; }
        } else {
            // Non trovato nel gestionale
            if(!o.missingFrom) o.missingFrom = now24;
            o.missing = true;
        }
    });

    const merged = [...existing, ...fresh];
    merged.sort((a,b) => { const ta=a.manual?new Date(a.addedAt||0).getTime():(pdt(a.created)||0); const tb=b.manual?new Date(b.addedAt||0).getTime():(pdt(b.created)||0); return tb-ta; });
    ls.saveOrders(merged);

    // Riconosce ordini appena aggiunti che corrispondono a pairs importati da collega
    if (fresh.length > 0) {
        const pairs = ls.pairs();
        let pairsChanged = false;
        pairs.forEach(pair => {
            if (!pair.imported) return;
            fresh.forEach(o => {
                const matchImp = o.traffic.toLowerCase() === 'import' &&
                    ((pair.imp.contNr && o.contNr && o.contNr === pair.imp.contNr) ||
                     (o.carrier === pair.imp.carrier && o.address === pair.imp.address && o.delivery === pair.imp.delivery));
                const matchExp = o.traffic.toLowerCase() === 'export' &&
                    (o.carrier === pair.exp.carrier && o.address === pair.exp.address && o.delivery === pair.exp.delivery);
                if (matchImp && pair.imp.id !== o.id) { pair.imp = Object.assign({}, pair.imp, {id: o.id}); pairsChanged = true; }
                if (matchExp && pair.exp.id !== o.id) { pair.exp = Object.assign({}, pair.exp, {id: o.id}); pairsChanged = true; }
            });
        });
        if (pairsChanged) ls.savePairs(pairs);
    }

    // newIds = solo quelli dentro la finestra temporale
    const newIds = fresh.filter(o => o.isNew).map(o => o.id);
    const modIds = merged.filter(o => o.isModified).map(o => o.id);

    // Controllo alert coppie abbinate
    (function(){
        var alerts = {};
        try { alerts = JSON.parse(localStorage.getItem('tcp_pair_alerts') || '{}'); } catch(e) {}
        var pairs = ls.pairs();
        var fields = [
            {k:'delivery', label:'Delivery'},
            {k:'address',  label:'Indirizzo'},
            {k:'port',     label:'Porto'},
            {k:'carrier',  label:'Carrier'},
            {k:'cont',     label:'Container'}
        ];
        pairs.forEach(function(p, idx) {
            var key = String(idx);
            var changes = [];
            ['imp','exp'].forEach(function(side) {
                var ref = p[side];
                var live = merged.find(function(o){ return o.id === ref.id; });
                if (!live) return;
                fields.forEach(function(f) {
                    if (live[f.k] !== undefined && ref[f.k] !== undefined && live[f.k] !== ref[f.k]) {
                        changes.push(side.toUpperCase() + ' ' + f.label + ': ' + ref[f.k] + ' -> ' + live[f.k]);
                    }
                });
            });
            if (changes.length > 0) {
                var existing = alerts[key];
                var newTooltip = changes.join(' | ');
                if (existing && existing.dismissed && existing.dismissedTooltip === newTooltip) {
                } else if (!existing || existing.tooltip !== newTooltip) {
                    alerts[key] = { tooltip: newTooltip, at: now.toISOString(), dismissed: false };
                }
            } else {
                delete alerts[key];
            }
        });
        localStorage.setItem('tcp_pair_alerts', JSON.stringify(alerts));
    })();

    return { newCount: newIds.length, newIds, modIds };
}

// ────────────────────────────────────────────────
//  HTML FINESTRA MONITOR
// ────────────────────────────────────────────────
function buildTariffarioHtml() {
    var fuel = parseFloat(localStorage.getItem('tcp_fuel') || '0');
    var tar  = []; try { tar = JSON.parse(localStorage.getItem('tcp_tariffario') || '[]'); } catch(e) {}
    var kmList = [];
    for (var k = 100; k <= 1500; k++) kmList.push(k);

    var rows = kmList.map(function(km) {
        var r = tar.find(function(x) { return x.km === km; }) || {km:km, c20:0, c40:0, c40hc:0};
        var f20   = r.c20 ? Math.round(r.c20 * (1 + fuel/100)) : '';
        var f40   = r.c40 ? Math.round(r.c40 * (1 + fuel/100)) : '';
        return '<tr>'
            + '<td style="padding:3px 8px;font-weight:bold;color:#002856;white-space:nowrap;">' + km + ' km</td>'
            + '<td style="padding:3px 4px;"><input type="number" data-km="'+km+'" data-tipo="c20" value="'+(r.c20||'')+'" placeholder="—" style="width:55px;border:1px solid #ccc;border-radius:3px;padding:2px 4px;text-align:right;font-size:11px;" oninput="tcpTarUpdate(this)"></td>'
            + '<td id="tf-'+km+'-c20" style="padding:3px 6px;color:#1a5c1a;font-weight:bold;text-align:right;white-space:nowrap;">' + (f20 ? '€ '+f20 : '—') + '</td>'
            + '<td style="padding:3px 4px;"><input type="number" data-km="'+km+'" data-tipo="c40" value="'+(r.c40||'')+'" placeholder="—" style="width:55px;border:1px solid #ccc;border-radius:3px;padding:2px 4px;text-align:right;font-size:11px;" oninput="tcpTarUpdate(this)"></td>'
            + '<td id="tf-'+km+'-c40" style="padding:3px 6px;color:#1a5c1a;font-weight:bold;text-align:right;white-space:nowrap;">' + (f40 ? '€ '+f40 : '—') + '</td>'
            + '</tr>';
    }).join('');

    return '<table style="border-collapse:collapse;font-size:12px;">'
        + '<thead><tr style="background:#002856;color:white;">'
        + '<th style="padding:7px 10px;text-align:left;">Km</th>'
        + '<th style="padding:7px 10px;text-align:right;">Grezzo 20\'</th>'
        + '<th style="padding:7px 10px;text-align:right;">Finale 20\'</th>'
        + '<th style="padding:7px 10px;text-align:right;">Grezzo 40\'/40HC</th>'
        + '<th style="padding:7px 10px;text-align:right;">Finale 40\'/40HC</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function buildTratteHtml() {
    var tratte = []; try { tratte = JSON.parse(localStorage.getItem('tcp_tratte') || '[]'); } catch(e) {}
    if (!tratte.length) return '<p style="color:#aaa;text-align:center;padding:30px;font-size:13px;">Nessuna tratta salvata. Le tratte si creano automaticamente salvando i km su un riutilizzo.</p>';
    var rows = tratte.map(function(t, idx) {
        var bg = idx % 2 === 0 ? '#f8fbff' : 'white';
        var id = t.id.replace(/'/g, "\\'");
        var sc = t.scarico.replace(/"/g, '&#34;');
        var ca = t.carico.replace(/"/g, '&#34;');
        return '<table style="width:100%;border-collapse:collapse;background:'+bg+';border:1px solid #d0dff0;border-radius:4px;margin-bottom:4px;font-size:12px;"><tr>'
            + '<td style="padding:5px 10px;">'
            + '<span style="font-size:10px;color:#888;">' + t.portoImp + '</span> → '
            + '<button onclick="tcpSelAlias(this)" data-tipo="I" data-v="' + sc + '" style="background:#e8f0fa;color:#002856;border:1px solid #aac4e0;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:10px;font-weight:bold;">I</button>'
            + ' <b style="color:#002856;">' + t.scarico + '</b> ↕ '
            + '<b style="color:#1a5c1a;">' + t.carico + '</b> '
            + '<button onclick="tcpSelAlias(this)" data-tipo="E" data-v="' + ca + '" style="background:#e8f4ee;color:#1a5c1a;border:1px solid #a8d5b5;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:10px;font-weight:bold;">E</button>'
            + ' → <span style="font-size:10px;color:#888;">' + t.portoExp + '</span>'
            + ' <b style="color:#002856;">' + t.km + ' km</b>'
            + (t.tappa ? ' <span style="color:#1a7a1a;font-weight:bold;font-size:11px;">(ferma ' + t.tappa + ')</span>' : '')
            + '</td>'
            + '<td style="white-space:nowrap;padding:5px 8px;width:1px;">'
            + '<button onclick="tcpDeleteTratta(\'' + id + '\')" style="background:#a93226;color:white;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:10px;">✕</button>'
            + '</td></tr></table>';
    }).join('');
    return rows;
}

function buildReportHtml(pairs, orders) {
    var tratte=[]; try{tratte=JSON.parse(localStorage.getItem('tcp_tratte')||'[]');}catch(e){}
    var tar=[]; try{tar=JSON.parse(localStorage.getItem('tcp_tariffario')||'[]');}catch(e){}
    var tappe=[]; try{tappe=JSON.parse(localStorage.getItem('tcp_tappe_custom')||'[]');}catch(e){}
    var stats=null; try{stats=JSON.parse(localStorage.getItem('tcp_stats')||'null');}catch(e){}
    var today=new Date(); today.setHours(0,0,0,0);
    if(!stats&&pairs.length>0){stats={total:pairs.length,monthly:{},note:'init'};localStorage.setItem('tcp_stats',JSON.stringify(stats));}

    function card(title,html){
        return '<div style="background:white;border:1px solid #d0dff0;border-radius:6px;padding:12px 16px;margin-bottom:12px;">'
            +'<div style="font-weight:bold;font-size:12px;color:#002856;border-bottom:1px solid #e0eaf8;padding-bottom:6px;margin-bottom:10px;">'+title+'</div>'
            +html+'</div>';
    }
    function drow(label,val,color){
        return '<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid #f0f4fa;">'
            +'<span style="color:#555;">'+label+'</span>'
            +'<b style="color:'+(color||'#002856')+';">'+val+'</b></div>';
    }

    // 1. STORAGE — barra visiva
    var lsB=0; try{lsB=JSON.stringify(localStorage).length;}catch(e){}
    var lsKb=Math.round(lsB/1024); var lsMax=5120; var lsPct=Math.min(100,Math.round(lsKb/lsMax*100));
    var bCol=lsPct>80?'#a93226':lsPct>50?'#c47a00':'#1a7a1a';
    var impOrd=orders.filter(function(o){return(o.traffic||'').toLowerCase()==='import';}).length;
    var expOrd=orders.filter(function(o){return(o.traffic||'').toLowerCase()==='export';}).length;
    var manOrd=orders.filter(function(o){return o.manual;}).length;
    var misOrd=orders.filter(function(o){return o.missing;}).length;
    var pConKm=pairs.filter(function(p){return p.km>0;}).length;
    var pSenzaKm=pairs.length-pConKm;
    var pConTappa=pairs.filter(function(p){return p.tappa;}).length;
    var tarComp=tar.filter(function(r){return r.c20||r.c40;}).length;
    var sBar='<div style="margin-bottom:10px;">'
        +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">'
        +'<span style="color:#555;">localStorage usato</span>'
        +'<b style="color:'+bCol+';">'+lsKb+' KB / '+lsMax+' KB &nbsp;('+lsPct+'%)</b></div>'
        +'<div style="background:#e0eaf8;border-radius:4px;height:14px;overflow:hidden;">'
        +'<div style="background:'+bCol+';width:'+lsPct+'%;height:100%;border-radius:4px;"></div></div></div>';
    var s1=card('Storage',
        sBar
        +drow('Ordini in lista',orders.length)
        +drow('&nbsp;&nbsp;Import / Export',impOrd+' / '+expOrd)
        +drow('&nbsp;&nbsp;Manuali',manOrd,'#1a65b8')
        +drow('&nbsp;&nbsp;Missing',misOrd,misOrd>0?'#a93226':'#555')
        +drow('Coppie abbinate',pairs.length)
        +drow('&nbsp;&nbsp;Con km / Senza',pConKm+' / '+pSenzaKm,pSenzaKm>0?'#c47a00':'#555')
        +drow('&nbsp;&nbsp;Con tappa',pConTappa)
        +drow('Tratte salvate',tratte.length)
        +drow('Tariffario',tarComp+' / '+tar.length+' righe')
        +drow('Tappe custom',tappe.length)
    );

    // 2. A PROGRAMMA
    var CARS=['MSC','Hapag','ONE','CMA','OOCL','ZIM','Yang Ming','Maersk','Evergreen'];
    var COTS=["20'","40'","40HC"];
    var aprog=pairs.filter(function(p){
        var m2=p.exp.delivery.match(/(\d{2})\/(\d{2})\/(\d{2})/);
        if(!m2)return false;
        var de=new Date(2000+parseInt(m2[3]),parseInt(m2[2])-1,parseInt(m2[1]));
        de.setHours(0,0,0,0);
        return de>=today;
    });
    var grid={};
    CARS.forEach(function(car){grid[car]={};COTS.forEach(function(co){grid[car][co]=0;});grid[car].tot=0;});
    aprog.forEach(function(p){
        var car=p.imp.carrier; var co=p.imp.cont;
        if(grid[car]&&grid[car][co]!==undefined){grid[car][co]++;grid[car].tot++;}
    });
    var th='padding:5px 10px;text-align:center;font-size:11px;font-weight:bold;';
    var td='padding:4px 10px;text-align:center;font-size:12px;';
    var gH='<table style="border-collapse:collapse;margin-top:4px;">'
        +'<thead><tr style="background:#002856;color:white;">'
        +'<th style="'+th+'text-align:left;">Tipo</th>'
        +CARS.map(function(car){return '<th style="'+th+'">'+car+'</th>';}).join('')
        +'</tr></thead><tbody>'
        +COTS.map(function(co,ri){
            var bg=ri%2===0?'#f8fbff':'white';
            return '<tr style="background:'+bg+';">'
                +'<td style="'+td+'font-weight:bold;text-align:left;">'+co+'</td>'
                +CARS.map(function(car){
                    var v=grid[car][co]||0;
                    return '<td style="'+td+'color:'+(v>0?'#1a7a1a':'#bbb')+';">'+(v>0?'<b>'+v+'</b>':'-')+'</td>';
                }).join('')+'</tr>';
        }).join('')
        +'<tr style="background:#e8f0fa;border-top:2px solid #002856;">'
        +'<td style="'+td+'font-weight:bold;text-align:left;">Tot</td>'
        +CARS.map(function(car){var v=grid[car].tot||0;return '<td style="'+td+'font-weight:bold;">'+(v||'-')+'</td>';}).join('')
        +'</tr></tbody></table>';
    var s2=card('A Programma (da oggi) &nbsp;<span style="background:#27ae60;color:white;border-radius:4px;padding:1px 8px;font-size:11px;font-weight:normal;">'+aprog.length+'</span>',
        aprog.length===0?'<p style="color:#aaa;font-size:11px;padding:6px 0;">Nessuno.</p>':gH);

    // 3. CONTATORI
    var s3h;
    if(!stats){
        s3h='<p style="color:#aaa;font-size:11px;">Nessun dato ancora.</p>';
    } else {
        var mese=today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2);
        var mPrec=new Date(today); mPrec.setMonth(mPrec.getMonth()-1);
        var kPrec=mPrec.getFullYear()+'-'+('0'+(mPrec.getMonth()+1)).slice(-2);
        var mD=(stats.monthly&&stats.monthly[mese])||{total:0};
        var pD=(stats.monthly&&stats.monthly[kPrec])||{total:0};
        var gs={};
        CARS.forEach(function(car){gs[car]={};COTS.forEach(function(co){gs[car][co]=0;});gs[car].tot=0;});
        CARS.forEach(function(car){COTS.forEach(function(co){
            var k=car+'_'+co.replace("'","");
            gs[car][co]=mD[k]||0; gs[car].tot+=gs[car][co];
        });});
        var gMH='<table style="border-collapse:collapse;margin-top:4px;">'
            +'<thead><tr style="background:#002856;color:white;">'
            +'<th style="'+th+'text-align:left;">Tipo</th>'
            +CARS.map(function(car){return '<th style="'+th+'">'+car+'</th>';}).join('')
            +'</tr></thead><tbody>'
            +COTS.map(function(co,ri){
                var bg=ri%2===0?'#f8fbff':'white';
                return '<tr style="background:'+bg+';">'
                    +'<td style="'+td+'font-weight:bold;text-align:left;">'+co+'</td>'
                    +CARS.map(function(car){
                        var v=gs[car][co]||0;
                        return '<td style="'+td+'color:'+(v>0?'#1a7a1a':'#bbb')+';">'+(v>0?'<b>'+v+'</b>':'-')+'</td>';
                    }).join('')+'</tr>';
            }).join('')
            +'<tr style="background:#e8f0fa;border-top:2px solid #002856;">'
            +'<td style="'+td+'font-weight:bold;text-align:left;">Tot</td>'
            +CARS.map(function(car){var v=gs[car].tot||0;return '<td style="'+td+'font-weight:bold;">'+(v||'-')+'</td>';}).join('')
            +'</tr></tbody></table>';
        var nI=stats.note==='init'?'<div style="font-size:10px;color:#888;font-style:italic;margin-top:4px;">* Inizializzato da coppie esistenti, senza storico mensile.</div>':'';
        var anno=today.getFullYear().toString();
        var annoTot=0;
        if(stats.monthly){Object.keys(stats.monthly).forEach(function(k){if(k.substring(0,4)===anno)annoTot+=(stats.monthly[k].total||0);});}
        s3h=drow('Totale storico',(stats.total||0))
            +drow('Anno corrente ('+anno+')',annoTot,'#002856')
            +drow('Questo mese ('+mese+')',(mD.total||0),'#1a7a1a')
            +drow('Mese prec. ('+kPrec+')',(pD.total||0))
            +nI
            +'<div style="font-size:10px;color:#888;font-weight:bold;margin:8px 0 2px;">DETTAGLIO MESE CORRENTE</div>'
            +gMH;
    }
    var s3=card('Contatori Riutilizzi', s3h);

    // 4. INTEGRITA DATI
    var wH='';
    var pTS=pairs.filter(function(p){
        if(!p.tappa)return false;
        if(p.km>0)return false;
        // verifica se esiste tratta con tappa nell'archivio
        var tid=[p.imp.port,p.imp.address,p.tappa||'',p.exp.address,p.exp.port].join('||');
        var trattaTappa=tratte.find(function(t){return t.id===tid&&t.km>0;});
        return !trattaTappa;
    });
    var dI=pairs.filter(function(p){
        var m2=p.imp.delivery.match(/(\d{2})\/(\d{2})\/(\d{2})/);
        var m3=p.exp.delivery.match(/(\d{2})\/(\d{2})\/(\d{2})/);
        if(!m2||!m3)return false;
        var di=new Date(2000+parseInt(m2[3]),parseInt(m2[2])-1,parseInt(m2[1]));
        var de=new Date(2000+parseInt(m3[3]),parseInt(m3[2])-1,parseInt(m3[1]));
        return de<di;
    });
    if(pTS.length>0){
        wH+='<div style="color:#c47a00;font-size:11px;padding:3px 0;font-weight:bold;">Tappa senza km ('+pTS.length+'):</div>';
        pTS.forEach(function(p){wH+='<div style="color:#c47a00;font-size:10px;padding:2px 0 2px 10px;">&rsaquo; '+p.imp.address+' / '+p.tappa+' / '+p.exp.address+'</div>';});
    }
    if(dI.length>0){
        wH+='<div style="color:#a93226;font-size:11px;padding:3px 0;font-weight:bold;">Export prima di Import ('+dI.length+'):</div>';
        dI.forEach(function(p){wH+='<div style="color:#a93226;font-size:10px;padding:2px 0 2px 10px;">&rsaquo; IMP '+p.imp.delivery.substring(0,8)+' / EXP '+p.exp.delivery.substring(0,8)+' &mdash; '+p.imp.address+'</div>';});
    }
    if(misOrd>0){wH+='<div style="color:#888;font-size:11px;padding:3px 0;">'+misOrd+' ordine/i missing nel gestionale</div>';}
    if(pSenzaKm>0){wH+='<div style="color:#888;font-size:11px;padding:3px 0;">'+pSenzaKm+' coppia/e senza km</div>';}
    if(!wH){wH='<div style="color:#1a7a1a;font-size:11px;padding:3px 0;">Nessun problema rilevato</div>';}
    var s4=card('Integrita Dati', wH);

    return s1+s2+s3+s4;
}
function buildHTML(orders, settings, lastUpdate, newCount, newIds, modIds) {
    const pid  = pairedIds();
    const nset = new Set(newIds);
    const mset = new Set(modIds || []);
    const pairs = ls.pairs();
    const palJ = JSON.stringify(PAL);
    const okJ  = JSON.stringify(OK);
    const pkJ  = JSON.stringify(PK);
    const tarHtml = buildTariffarioHtml();
    const fuelVal = parseFloat(localStorage.getItem('tcp_fuel') || '0');
    const tratteHtml = buildTratteHtml();
    const reportHtml = buildReportHtml(pairs, ls.orders());
    const addiz = (function(){ try{ return JSON.parse(localStorage.getItem('tcp_addizionali')||'null'); }catch(e){} return null; })() || {stessoGiorno:{base:100,hc:30},giornoSucc:{base:100,sosta:30,hc:30},weekend:{base:50,hc:30},altri:{base:50,hc:30}};

    // ── Tab Viaggi: righe tabella ──
    const tableRows = orders.length === 0
        ? `<tr><td colspan="14" style="text-align:center;padding:30px;color:#aaa;font-size:13px;">Nessun viaggio registrato</td></tr>`
        : orders.map(o => {
            const sid  = o.id.replace(/[^a-z0-9]/gi,'_');
            const isPaired = pid.has(o.id);
            const isNew    = nset.has(o.id);
            const isMod    = !isNew && mset.has(o.id);
            let rowBg = '';
            if (o.missing) rowBg = 'background:#e0e0e0;opacity:0.55;';
            else if (isPaired) rowBg = 'background:#d4f5d4;';
            else if (isMod) rowBg = 'background:#fff8e1;';
            else if (o.highlighted) rowBg = 'background:#fff3cd;';
            const newBadge = isNew ? '<span style="background:#e74c3c;color:white;border-radius:3px;padding:1px 5px;font-size:9px;margin-left:4px;vertical-align:middle;">NEW</span>' : '';
            const modBadge = isMod ? '<span style="background:#f0a500;color:white;border-radius:3px;padding:1px 5px;font-size:9px;margin-left:4px;vertical-align:middle;">MOD</span>' : '';
            const missingBadge = o.missing ? ' <span style="background:#888;color:white;border-radius:3px;padding:1px 5px;font-size:8px;vertical-align:middle;white-space:nowrap;">non presente</span>' : '';
            const rtIcon   = o.reqTruck ? `<span style="color:#c0392b;font-weight:bold;font-size:13px;" title="${o.reqTruck}">✕</span>` : '';
            const hlBg     = o.highlighted ? '#f0a500' : '#002856';
            const pallino  = (o.reqTruck || o.ldv) ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#e74c3c;margin:0 4px;vertical-align:middle;" title="${o.reqTruck?'RT: '+o.reqTruck+' ':''}${o.ldv?'LDV emessa ':''}${o.adr?'ADR: '+o.adr:''}"></span>` : '';
            const ldvCell  = o.ldv ? '<span style="color:#c0392b;font-weight:bold;font-size:10px;">LDV Emessa</span>' : '';
            const adrIcon  = o.adr ? '<span title="Merce pericolosa" style="cursor:default;">⚠️</span>' : '';
            const placeIcon = o.place ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;background:#999;color:white;font-size:8px;font-weight:bold;cursor:help;margin-left:4px;flex-shrink:0;" title="' + o.place.replace(/"/g,"'") + '">?</span>' : '';
            return `<tr id="row-${sid}" style="${rowBg}${isNew?'outline:2px solid #e74c3c;':isMod?'outline:2px solid #f0a500;':''}"
                data-id="${o.id}" data-traffic="${o.traffic}" data-carrier="${o.carrier}"
                data-cont="${o.cont}" data-delivery="${o.delivery}" data-paired="${isPaired}" data-rt="${o.reqTruck?'1':'0'}" data-port="${(o.port||'').toLowerCase()}" data-address="${o.address}">
                <td style="text-align:center;padding:4px;">
                    <input type="checkbox" id="chk-${sid}"
                        onchange="handleCheck('${o.id}','${o.traffic}')"
                        style="cursor:pointer;width:14px;height:14px;"
                        >
                </td>
                <td>${o.traffic}${newBadge}${modBadge}${missingBadge}</td>
                <td style="text-align:center;padding:2px 4px;">${pallino}</td>
                <td><b>${o.carrier}</b></td>
                <td>${o.cont}</td>
                <td style="text-align:center;">${adrIcon}</td>
                <td>${o.delivery}</td>
                <td>${o.address}${placeIcon}</td>
                <td>${o.port}</td>
                <td style="font-size:10px;color:#555;">${o.contNr}</td>
                <td style="text-align:center;">${rtIcon}</td>
                <td style="font-size:10px;">${o.branch}</td>
                <td style="font-size:10px;">${o.reqBranch}</td>
                <td style="text-align:center;">${ldvCell}</td>
                <td style="white-space:nowrap;">
                    <button onclick="if(window.opener)window.opener.tcpGoToRow('${o.id}')"
                        style="background:#1a65b8;color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;margin-right:2px;" title="Vai alla riga nel gestionale">→</button>
                    <button onclick="if(window.opener)window.opener.tcpSelectRow('${o.id}')"
                        style="background:#5a9ce0;color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;margin-right:2px;" title="Spunta checkbox nel gestionale">✓</button>
                    <button class="hl-btn" onclick="doHL('${o.id}')"
                        style="background:${hlBg};color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;margin-right:3px;">${o.highlighted?'★':'☆'}</button>
                    <button onclick="doDel('${o.id}')"
                        style="background:#c0392b;color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;">✕</button>
                </td>
                <td style="white-space:nowrap;color:#888;font-size:10px;">${o.created}</td>
            </tr>`;
        }).join('');

    // ── Tab Riutilizzi: HTML server-side ──
    function pairsHtml(pairs) {
        if (!pairs.length) return '<p style="color:#aaa;text-align:center;padding:40px;font-size:13px;">Nessun abbinamento ancora. Seleziona un Import e un Export dalla tab Viaggi e clicca Abbina.</p>';
        const groups = {};
        pairs.forEach((p,i) => {
            const k = p.imp.delivery.substring(0,8) || '?';
            (groups[k] = groups[k]||[]).push({p,i});
        });
        const cc = {};
        return Object.keys(groups)
            .sort((a,b) => (pd(groups[a][0].p.imp.delivery)||0) - (pd(groups[b][0].p.imp.delivery)||0))
            .map(k => {
                const dateLabel = groups[k][0].p.imp.delivery.substring(0,8);
                const rows = groups[k].map(({p,i}) => {
                        const pal = PAL[p.imp.carrier] || ['#ddd'];
                    cc[p.imp.carrier] = (cc[p.imp.carrier]||0);
                    const bg = pal[cc[p.imp.carrier]++ % pal.length];
                    return `<div class="pr" id="pair-${i}" style="border-left:4px solid ${bg};background:${bg}22;">
                        <span class="tag imp">📥 IMP</span>
                        <span class="tag">${p.imp.carrier}</span>
                        <span class="tag">${p.imp.cont}</span>
                        <span class="f">${p.imp.contNr||'—'}</span>
                        <span class="f"><b>${p.imp.address}</b></span>
                        <span class="f">${p.imp.delivery}</span>
                        <span class="f">${p.imp.port}</span>
                        <span class="f dim">LEF: ${p.imp.reqBranch||'—'}</span>
                        <span class="sep">↕ Riutilizza con</span>
                        <span class="tag exp">📤 EXP</span>
                        <span class="tag">${p.exp.carrier}</span>
                        <span class="tag">${p.exp.cont}</span>
                        <span class="f"><b>${p.exp.address}</b></span>
                        <span class="f">${p.exp.delivery}</span>
                        <span class="f">${p.exp.port}</span>
                        <span class="f dim">LEF: ${p.exp.reqBranch||'—'}</span>
                        <button class="cbtn" onclick="doEditPair(${i})" style="background:#27ae60;color:white;">✏️</button>
                      <button class="cbtn" onclick="cpPair(${i})">📋 Copia</button>
                        <button class="dbtn" onclick="rmPair(${i})">✕</button>
                    </div>`;
                }).join('');
                return `<div class="sec-title">📅 Import del ${dateLabel}</div>${rows}`;
            }).join('');
    }

    return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>Monitor Nuovi Viaggi</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:12px;color:#002856;background:#f0f5ff;}
.topbar{background:#002856;color:white;padding:10px 18px;display:flex;align-items:center;gap:14px;flex-shrink:0;}
.topbar h2{font-size:15px;font-weight:bold;}
.meta{margin-left:auto;font-size:11px;color:#bdf3fc;}
.tabbar{display:flex;background:#e0eaf8;border-bottom:2px solid #002856;flex-shrink:0;align-items:center;padding-right:6px;}
.tb{padding:9px 26px;cursor:pointer;font-weight:bold;font-size:12px;color:#002856;border:none;background:none;border-bottom:3px solid transparent;}
.tb.on{border-bottom:3px solid #e74c3c;background:white;}
.tc{display:none;padding:14px 18px;overflow-y:auto;}
.tc.on{display:block;}#t-viaggi.on{display:flex;flex-direction:column;}
/* Tabella viaggi */
.actions{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;}
.actions button{color:white;border:none;border-radius:4px;padding:5px 13px;cursor:pointer;font-size:11px;}
#btn-clear{background:#c0392b;}
#btn-abbina{background:#27ae60;display:none;font-weight:bold;}
#notif-bar{background:#fff8e1;border:1px solid #f0c040;border-radius:5px;padding:6px 12px;margin-bottom:10px;font-size:11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
#notif-banner{display:none;background:#e74c3c;color:white;padding:8px 16px;border-radius:5px;margin-bottom:10px;font-weight:bold;font-size:12px;}
table.mt{width:100%;border-collapse:collapse;background:white;font-size:11px;}
table.mt thead th{position:sticky;top:0;z-index:6;background:#bdf3fc;color:#002856;font-weight:bold;padding:7px 8px;text-align:left;border-bottom:2px solid #002856;white-space:nowrap;}
th.sort{cursor:pointer;user-select:none;}
th.sort:hover{background:#a0e8f8;}
table.mt tbody tr{border-bottom:1px solid #e5eef8;transition:opacity .25s;}
table.mt tbody tr.dim{opacity:.2;}
table.mt tbody td{padding:5px 8px;vertical-align:middle;}
/* Pairs */
.sec-title{font-size:13px;font-weight:bold;color:#002856;border-bottom:1px solid #bdf3fc;padding:6px 0 4px;margin:16px 0 6px;}
.pr{display:flex;align-items:center;gap:6px;border:1px solid #bdf3fc;border-radius:6px;padding:7px 10px;margin-bottom:6px;font-size:11px;flex-wrap:wrap;}
.tag{border-radius:3px;padding:2px 6px;font-weight:bold;white-space:nowrap;font-size:11px;}
.tag.imp{background:#d0f0ff;color:#005580;}
.tag.exp{background:#d4f5d4;color:#1a5c1a;}
.f{white-space:nowrap;}
.dim{color:#888;font-size:10px;}
.sep{color:#002856;font-weight:bold;margin:0 4px;white-space:nowrap;}
.cbtn{margin-left:auto;background:#002856;color:white;border:none;border-radius:3px;padding:3px 9px;cursor:pointer;font-size:10px;white-space:nowrap;}
.dbtn{background:#c0392b;color:white;border:none;border-radius:3px;padding:3px 9px;cursor:pointer;font-size:10px;}
/* Planner */
.pl-nav{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
.pl-nav button{background:#002856;color:white;border:none;border-radius:4px;padding:5px 14px;cursor:pointer;font-size:11px;}
.wklbl{font-weight:bold;font-size:13px;}
.plt{width:100%;border-collapse:collapse;table-layout:fixed;}
.plt th{background:#002856;color:white;text-align:center;padding:6px 3px;font-size:11px;border:1px solid #001840;}
.plt th .dn{font-size:15px;font-weight:bold;display:block;}
.plt td{vertical-align:top;border:1px solid #c8d8f0;padding:3px;background:white;min-height:55px;}
.plt td.today{background:#fffde7;}
.pc{border-radius:4px;padding:3px 5px;margin-bottom:3px;font-size:10px;line-height:1.4;}
</style>
<script>
const OK=${okJ}, PK=${pkJ};
const PAL=${palJ};
let SC=null,SA=true,selI=null,selE=null,plOff=0;

function lo(){try{return JSON.parse(localStorage.getItem(OK))||[];}catch{return[];}}
function so(o){localStorage.setItem(OK,JSON.stringify(o));}
function lp(){try{return JSON.parse(localStorage.getItem(PK))||[];}catch{return[];}}
function sp(p){localStorage.setItem(PK,JSON.stringify(p));}
function pids(){const s=new Set();lp().forEach(p=>{s.add(p.imp.id);s.add(p.exp.id);});return s;}

function pdt(s){const m=s.match(/(\\d{2})\\/(\\d{2})\\/(\\d{2}),?\\s*(\\d{2}):(\\d{2})/);if(!m)return 0;return new Date(2000+parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1]),parseInt(m[4]),parseInt(m[5])).getTime();}
function pd(s){const m=s.match(/(\\d{2})\\/(\\d{2})\\/(\\d{2})/);if(!m)return null;const d=new Date(2000+parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1]));d.setHours(0,0,0,0);return d;}
function compat(ic,ec){if(ic==="20'")return ec==="20'";if(ic==='40HC')return ec==="40'"||ec==='40HC';if(ic==="40'")return ec==="40'";return false;}
function portA(p){if(!p)return'';if(/spezia/i.test(p))return'SPZ';if(/livorno/i.test(p))return'LIV';if(/genova/i.test(p))return'GEN';return p.substring(0,3).toUpperCase();}
function wkNum(d){const dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));dt.setUTCDate(dt.getUTCDate()+4-(dt.getUTCDay()||7));const ys=new Date(Date.UTC(dt.getUTCFullYear(),0,1));return Math.ceil((((dt-ys)/86400000)+1)/7);}
function monday(off){const n=new Date();n.setHours(0,0,0,0);const day=n.getDay()||7;const m=new Date(n);m.setDate(n.getDate()-day+1+off*7);return m;}
function sameDay(a,b){return a&&b&&a.toDateString()===b.toDateString();}

// ── FILTRO TRAFFIC TYPE ──
function applyTTFilter(){
    const chks=[...document.querySelectorAll('.ntt')];
    const active=chks.length?chks.filter(c=>c.checked).map(c=>c.value):['import','export'];
    const ports=[...document.querySelectorAll('.ntp:checked')].map(x=>x.value.toLowerCase());
    document.querySelectorAll('#tbody tr[data-id]').forEach(r=>{
        const t=r.dataset.traffic?.toLowerCase()||'';
        const portTxt=r.dataset.port||'';
        const okT=active.includes(t)||active.length===0;
        const okP=!ports.length||ports.some(p=>portTxt.includes(p));
        r.style.display=(okT&&okP)?'':'none';
    });
    if(typeof updCounter==='function')updCounter();
}

// ── TAB ──
function showTab(t){
    document.querySelectorAll('.tb').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
    document.querySelectorAll('.tc').forEach(c=>{
        const active=c.id==='t-'+t;
        c.classList.toggle('on',active);
        if(c.id==='t-viaggi')c.style.display=active?'flex':'none';
    });
    const dsel=document.getElementById('btn-deselect-float');if(dsel)dsel.style.display='none';
    const editFlt2=document.getElementById('btn-edit-float');if(editFlt2)editFlt2.style.display='none';
    if(t==='pairs')rPairs();
    if(t==='planner')rPlanner();
    if(t==='tratte'){
        tcpRenderAlias();
        var _tr=[];try{_tr=JSON.parse(localStorage.getItem('tcp_tratte')||'[]');}catch(e){}
        var _tb=document.querySelector('.tb[data-t="tratte"]');
        if(_tb)_tb.textContent='🗺️ Tratte';
        var _tc=document.getElementById('tratte-count');
        if(_tc)_tc.textContent='('+_tr.length+')';
    }

    const flt=document.getElementById('btn-abbina-float');
    if(flt&&t!=='viaggi')flt.style.display='none';
}

// ── SORT ──
function sortBy(col){
    if(SC===col){SA=!SA;}else{SC=col;SA=true;}
    const tbody=document.getElementById('tbody');if(!tbody)return;
    const rows=[...tbody.querySelectorAll('tr[data-id]')];
    rows.sort((a,b)=>{
        let va,vb;
        if(col==='delivery'){va=pd(a.cells[6]?.innerText||'');vb=pd(b.cells[6]?.innerText||'');return SA?(va||0)-(vb||0):(vb||0)-(va||0);}
        if(col==='created'){va=pdt(a.cells[15]?.innerText||'');vb=pdt(b.cells[15]?.innerText||'');return SA?va-vb:vb-va;}
        va=a.cells[col==='traffic'?1:2]?.innerText||'';vb=b.cells[col==='traffic'?1:2]?.innerText||'';
        return SA?va.localeCompare(vb):vb.localeCompare(va);
    });
    rows.forEach(r=>tbody.appendChild(r));
    document.querySelectorAll('th.sort').forEach(th=>th.textContent=th.textContent.replace(/ [▲▼]$/,''));
    const th=document.getElementById('th-'+col);if(th)th.textContent+=(SA?' ▲':' ▼');
}

// ── CHECK + PIN + FILTRO ──
function pinRow(row,o){
    const tbody=document.getElementById('tbody');if(!tbody||!row)return;
    row.dataset.origBg=row.style.background||'';
    tbody.insertBefore(row,tbody.firstChild);
    const theadEl=document.querySelector('table.mt thead');
    const theadH=theadEl?theadEl.offsetHeight:38;
    Array.from(row.cells).forEach(td=>{
        td.style.position='sticky';td.style.top=theadH+'px';
        td.style.background='#c8e0ff';td.style.zIndex='5';
        td.style.boxShadow='0 2px 6px rgba(0,40,120,0.18)';
        td.style.borderTop='2px solid #1a65b8';
        td.style.borderBottom='2px solid #1a65b8';
    });
    row.firstElementChild.style.borderLeft='2px solid #1a65b8';
    row.lastElementChild.style.borderRight='2px solid #1a65b8';
    row.dataset.pinned='true';
}
function unpinRow(row){
    if(!row)return;
    Array.from(row.cells).forEach(td=>{
        td.style.position='';td.style.top='';td.style.zIndex='';
        td.style.boxShadow='';td.style.background='';
        td.style.borderTop='';td.style.borderBottom='';
        td.style.borderLeft='';td.style.borderRight='';
    });
    row.style.background=row.dataset.origBg||'';
    row.dataset.pinned='false';
}
function handleCheck(id,traffic){
    const o=lo().find(x=>x.id===id);if(!o)return;
    const sid=id.replace(/[^a-z0-9]/gi,'_');
    const chk=document.getElementById('chk-'+sid);
    const isChecked=chk?.checked;
    // Deseleziona eventuale selezione precedente dello stesso tipo
    if(traffic.toLowerCase()==='import'){
        if(selI&&selI.id!==id){
            const p=document.getElementById('chk-'+selI.id.replace(/[^a-z0-9]/gi,'_'));if(p)p.checked=false;
            unpinRow(document.getElementById('row-'+selI.id.replace(/[^a-z0-9]/gi,'_')));
        }
        selI=isChecked?o:null;
    }else{
        if(selE&&selE.id!==id){
            const p=document.getElementById('chk-'+selE.id.replace(/[^a-z0-9]/gi,'_'));if(p)p.checked=false;
            unpinRow(document.getElementById('row-'+selE.id.replace(/[^a-z0-9]/gi,'_')));
        }
        selE=isChecked?o:null;
    }
    const row=document.getElementById('row-'+sid);
    if(isChecked){
        pinRow(row,o);
    }else{
        unpinRow(row);
        // Se non c'è più nessuna selezione attiva, ripristina tutte le righe
        if(!selI&&!selE) document.querySelectorAll('#tbody tr[data-id]').forEach(r=>r.style.display='');
    }
    updAbbina();updDim();
}

function tcpResolviAlias(addr) {
    // Restituisce lista di indirizzi equivalenti (incluso addr stesso)
    var alias = [];
    try { alias = JSON.parse(localStorage.getItem('tcp_tratte_alias') || '[]'); } catch(e) {}
    var norm = function(s){ return (s||'').toLowerCase().replace(/\s+/g,' ').trim(); };
    var nAddr = norm(addr);
    for (var i = 0; i < alias.length; i++) {
        var a = alias[i];
        var match = a.indirizzi.find(function(x){ return norm(x) === nAddr; });
        if (match) return a.indirizzi; // restituisce tutti gli indirizzi dell'alias
    }
    return [addr]; // nessun alias trovato, restituisce solo se stesso
}

function tcpTrattaBadge(){
    document.querySelectorAll('.tcp-tratta-badge').forEach(function(el){el.remove();});
    if(!selI&&!selE)return;
    var tratte=[];try{tratte=JSON.parse(localStorage.getItem('tcp_tratte')||'[]');}catch(e){}
    if(!tratte.length)return;
    var ref=selI||selE;
    var isI=!!selI;
    function norm(s){return(s||'').toLowerCase().replace(/\s+/g,' ').trim();}
    var refAddr=norm(ref.address||'');
    var mapKm={};
    var refAliases=tcpResolviAlias(ref.address||'').map(function(a){return norm(a);});
    tratte.filter(function(t2){return !t2.tappa&&t2.km>0;}).forEach(function(t2){
        if(isI&&refAliases.indexOf(norm(t2.scarico))>=0)mapKm[norm(t2.carico)]=t2.km;
        if(!isI&&refAliases.indexOf(norm(t2.carico))>=0)mapKm[norm(t2.scarico)]=t2.km;
    });
    if(!Object.keys(mapKm).length)return;
    var orders=lo();
    var targetType=isI?'export':'import';
    orders.forEach(function(o){
        if((o.traffic||'').toLowerCase()!==targetType)return;
        var km=mapKm[norm(o.address||'')];
        if(!km)return;
        var sid=o.id.replace(/[^a-z0-9]/gi,'_');
        var row=document.getElementById('row-'+sid);
        if(!row||row.style.display==='none')return;
        // Cerca cella address tramite querySelector sull'id della riga
        var addrCell=row.querySelector('td:nth-child(8)'); // Address = cells[7] (0-based) = nth-child(8)
        if(!addrCell)return;
        // Rimuovi badge precedente su questa cella se presente
        addrCell.querySelectorAll('.tcp-tratta-badge').forEach(function(b){b.remove();});
        var badge=document.createElement('span');
        badge.className='tcp-tratta-badge';
        badge.style.cssText='display:inline-flex;align-items:center;gap:2px;background:#1a5c1a;color:white;border-radius:3px;padding:1px 5px;font-size:10px;font-weight:bold;margin-left:5px;white-space:nowrap;cursor:default;vertical-align:middle;';
        badge.textContent='\uD83D\uDDFA '+km+' km';
        addrCell.appendChild(badge);
    });
}

function updDim(){
    const rows=[...document.querySelectorAll('#tbody tr[data-id]')];
    if(!selI&&!selE){
        rows.forEach(r=>{r.classList.remove('dim');r.style.display='';});
        var _af=[...document.querySelectorAll('.fs-c:checked,.fs-co:checked,.fs-t:checked,.fs-p:checked')].length>0||document.getElementById('fs-hl')?.checked;
        if(_af)applyShowOnly();else updCounter();
        return;
    }
    const ref=selI||selE;const isI=!!selI;
    const refDate=pd(ref.delivery)||0;
    rows.forEach(r=>{
        const id=r.dataset.id||'';
        if(id===(selI?.id||'')||id===(selE?.id||'')){r.classList.remove('dim');r.style.display='';return;}
        const t=r.dataset.traffic?.toLowerCase()||'';
        const carr=r.dataset.carrier||'';const co=r.dataset.cont||'';
        const del=pd(r.dataset.delivery||r.cells[6]?.innerText||'')||0;
        const compatDate=isI?(t==='export'&&del>=refDate):(t==='import'&&del<=refDate);
        const compatCont=isI?compat(ref.cont,co):compat(co,ref.cont);
        const isMissing=r.style.opacity==='0.55'||r.style.opacity==='.55'||parseFloat(r.style.opacity||'1')<0.9;
        const ok=carr===ref.carrier&&compatCont&&compatDate&&!isMissing;
        const activePorts=[...document.querySelectorAll('.fs-p:checked')].map(x=>x.value.toLowerCase());
        const portTxt=(r.dataset.port||'').toLowerCase();
        const okPort=!activePorts.length||activePorts.some(p=>portTxt.includes(p));
        const finalOk=ok&&okPort;
        r.classList.toggle('dim',!finalOk);
        r.style.display=finalOk?'':'none';
    });
    // Riordina le righe visibili per data più vicina al riferimento
    const tbody=document.getElementById('tbody');if(tbody){
        const pinned=[...tbody.querySelectorAll('tr[data-id][data-pinned="true"]')];
        const visible=[...tbody.querySelectorAll('tr[data-id]')].filter(r=>r.style.display!=='none'&&r.dataset.pinned!=='true');
        visible.sort((a,b)=>{
            const da=pd(a.dataset.delivery||a.cells[6]?.innerText||'')||0;
            const db=pd(b.dataset.delivery||b.cells[6]?.innerText||'')||0;
            const da_t=da?Math.abs(da-refDate):Infinity;
            const db_t=db?Math.abs(db-refDate):Infinity;
            return da_t-db_t;
        });
        pinned.forEach(r=>tbody.insertBefore(r,tbody.firstChild));
        visible.forEach(r=>tbody.appendChild(r));
    }
    tcpTrattaBadge();
    updCounter();
}

function updAbbina(){
    const btn=document.getElementById('btn-abbina');if(!btn)return;
    const flt=document.getElementById('btn-abbina-float');
    const dsel=document.getElementById('btn-deselect-float');if(dsel){const onViaggi=document.getElementById('t-viaggi')?.classList.contains('on');dsel.style.display=(selI||selE)&&onViaggi?'block':'none';}
    const editFlt=document.getElementById('btn-edit-float');if(editFlt){const onViaggi2=document.getElementById('t-viaggi')?.classList.contains('on');const selOne=selI||selE;editFlt.style.display=selOne&&onViaggi2?'block':'none';if(selOne)editFlt.onclick=()=>doEdit(selOne.id);}
    if(selI&&selE&&selI.carrier===selE.carrier&&compat(selI.cont,selE.cont)){
        const di=pd(selI.delivery),de=pd(selE.delivery);
        if(di&&de&&de<di){
            btn.style.cssText='display:inline-block;background:#c0392b;color:white;border:none;border-radius:4px;padding:5px 13px;cursor:pointer;font-size:11px;font-weight:bold;';
            btn.textContent='⚠️ Export prima di Import!';btn.onclick=null;
            if(flt){flt.style.display='block';flt.textContent='⚠️ Export prima di Import!';flt.style.background='#c0392b';flt.onclick=null;}
        }else{
            btn.style.cssText='display:inline-block;background:#27ae60;color:white;border:none;border-radius:4px;padding:5px 13px;cursor:pointer;font-size:11px;font-weight:bold;';
            btn.textContent='🔗 Abbina ('+selI.carrier+' · '+selI.cont+' ↔ '+selE.cont+')';
            btn.onclick=doAbbina;
            if(flt){flt.style.display='block';flt.textContent='🔗 Abbina ('+selI.carrier+' · '+selI.cont+' ↔ '+selE.cont+')';flt.style.background='#27ae60';flt.onclick=doAbbina;}
        }
    }else{
        btn.style.display='none';
        if(flt)flt.style.display='none';
    }
}

function doAbbina(){
    if(!selI||!selE)return;
    const di=pd(selI.delivery),de=pd(selE.delivery);
    if(di&&de&&de<di){alert("La data dell'export non può essere antecedente a quella dell'import.");return;}
    _pushUndo();
    const pairs=lp();
    // Salva cliente semplificato nel momento dell'abbinamento
    function _cb(b){
        if(!b)return'';
        if(/carrier.*hapag|hapag.*carrier/i.test(b))return'CARRIER HAPAG';
        if(/life.*petcare|petcare/i.test(b))return'LIFE PETCARE';
        if(/carrier.*cma|cma.*carrier/i.test(b))return'CARRIER CMA';
        if(/savino.*del.*bene|savino.*bene/i.test(b)){
            if(/livorno/i.test(b))return'SDB LI';
            if(/firenze|florence/i.test(b))return'SDB FI';
            if(/genova|genoa/i.test(b))return'SDB GE';
            if(/milano.*dp|dp.*milano|divisione.*prog/i.test(b))return'SDB MI DP';
            if(/milano|milan/i.test(b))return'SDB MI';
            if(/roma|rome/i.test(b))return'SDB RM';
            if(/napoli|naples/i.test(b))return'SDB NA';
            if(/torino|turin/i.test(b))return'SDB TO';
            if(/bergamo/i.test(b))return'SDB BG';
            if(/catania/i.test(b))return'SDB CT';
            if(/fidenza/i.test(b))return'SDB PR';
            if(/montecosaro/i.test(b))return'SDB MC';
            if(/montemurlo/i.test(b))return'SDB PO';
            if(/montichiari/i.test(b))return'SDB BS';
            if(/san.*miniato/i.test(b))return'SDB SM';
            if(/udine/i.test(b))return'SDB UD';
            if(/verona/i.test(b))return'SDB VR';
            if(/vicenza/i.test(b))return'SDB VI';
            if(/campogalliano/i.test(b))return'SDB MO';
            if(/montebelluna/i.test(b))return'SDB TV';
            if(/pisa/i.test(b))return'SDB PI';
            if(/stabio/i.test(b))return'SDB STABIO';
            if(/padova|padua/i.test(b))return'SDB PD';
            return'SDB';
        }
        if(/albatrans/i.test(b))return'ALBATRANS';
        if(/aprile/i.test(b))return'APRILE';
        if(/arimar/i.test(b))return'ARIMAR';
        if(/c\.d\.c|cdc/i.test(b))return'CDC';
        if(/danesi/i.test(b))return'DANESI';
        if(/general.*noli|noli/i.test(b))return'GENERAL NOLI';
        if(/bortesi/i.test(b))return'BORTESI';
        return b;
    }
    const _impClient=_cb(selI.branch||'');
    const _expClient=_cb(selE.branch||'');
    const _impSelI=Object.assign({},selI,{clienteExcel:_impClient});
    const _expSelE=Object.assign({},selE,{clienteExcel:_expClient});
    pairs.push({imp:_impSelI,exp:_expSelE,at:new Date().toISOString()});
    sp(pairs);
    var _rSt=null;try{_rSt=JSON.parse(localStorage.getItem('tcp_stats')||'null');}catch(_x){}
    if(!_rSt)_rSt={total:0,monthly:{}};
    var _rMn=new Date().getFullYear()+'-'+('0'+(new Date().getMonth()+1)).slice(-2);
    if(!_rSt.monthly[_rMn])_rSt.monthly[_rMn]={total:0};
    _rSt.total=(_rSt.total||0)+1;
    _rSt.monthly[_rMn].total=(_rSt.monthly[_rMn].total||0)+1;
    var _rCar=selI.carrier||'';var _rCo=(selI.cont||'').replace("'","");
    var _rK=_rCar+'_'+_rCo;
    _rSt.monthly[_rMn][_rK]=(_rSt.monthly[_rMn][_rK]||0)+1;
    localStorage.setItem('tcp_stats',JSON.stringify(_rSt));
    [selI.id,selE.id].forEach(id=>{
        const r=document.getElementById('row-'+id.replace(/[^a-z0-9]/gi,'_'));
        if(r){unpinRow(r);r.style.background='#d4f5d4';r.style.outline='';r.dataset.paired='true';}
        const chk=document.getElementById('chk-'+id.replace(/[^a-z0-9]/gi,'_'));
        if(chk){chk.checked=false;chk.disabled=true;}
    });
    document.querySelectorAll('#tbody tr[data-id]').forEach(r=>r.style.display='');
    selI=null;selE=null;
    document.getElementById('btn-abbina').style.display='none';
    var _flt=document.getElementById('btn-abbina-float');if(_flt)_flt.style.display='none';
    var _dsl=document.getElementById('btn-deselect-float');if(_dsl)_dsl.style.display='none';
    var _edt=document.getElementById('btn-edit-float');if(_edt)_edt.style.display='none';
    document.querySelectorAll('.tcp-tratta-badge').forEach(function(el){el.remove();});
    updDim();rPairs();
}

// ── DESELECT ──
function doDeselect(){
    if(selI){unpinRow(document.getElementById('row-'+selI.id.replace(/[^a-z0-9]/gi,'_')));const chk=document.getElementById('chk-'+selI.id.replace(/[^a-z0-9]/gi,'_'));if(chk)chk.checked=false;selI=null;}
    if(selE){unpinRow(document.getElementById('row-'+selE.id.replace(/[^a-z0-9]/gi,'_')));const chk=document.getElementById('chk-'+selE.id.replace(/[^a-z0-9]/gi,'_'));if(chk)chk.checked=false;selE=null;}
    document.querySelectorAll('#tbody tr[data-id]').forEach(r=>r.style.display='');
    document.querySelectorAll('.tcp-tratta-badge').forEach(function(el){el.remove();});
    updDim();updAbbina();
}

function tcpMaskDate(el){var v=el.value.replace(/[^0-9]/g,'');if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);if(v.length>5)v=v.slice(0,5)+'/'+v.slice(5,7);el.value=v;}
function tcpMaskTime(el){var v=el.value.replace(/[^0-9]/g,'');if(v.length>2)v=v.slice(0,2)+':'+v.slice(2,4);el.value=v;}
// ── REFRESH TABELLA ──
function tcpRefresh(){
    const orders=lo();
    const pid=pids();
    orders.forEach(o=>{
        const sid=o.id.replace(/[^a-z0-9]/gi,'_');
        const row=document.getElementById('row-'+sid);
        if(!row)return;
        if(pid.has(o.id)&&row.dataset.paired!=='true'){
            row.style.background='#d4f5d4';row.dataset.paired='true';
            const chk=document.getElementById('chk-'+sid);
            if(chk){chk.checked=false;chk.disabled=true;}
        }
    });
    updCounter();rPairs();
}
// ── MODIFICA VIAGGIO DA RIUTILIZZO ──
var _editPairIdx=null;
function doEditPair(i){
    var p=lp()[i];if(!p)return;
    _editPairIdx=i;
    var m=document.getElementById('pair-choice-modal');if(!m)return;
    m.style.display='flex';
}
function doEditPairChoice(side){
    var m=document.getElementById('pair-choice-modal');if(m)m.style.display='none';
    if(_editPairIdx===null)return;
    var p=lp()[_editPairIdx];if(!p)return;
    var o=side==='imp'?p.imp:p.exp;
    var orders=lo();
    if(!orders.find(function(x){return x.id===o.id;}))orders.push(o);
    so(orders);
    doEdit(o.id);
}
function closePairChoice(){
    var m=document.getElementById('pair-choice-modal');if(m)m.style.display='none';
}
// ── MODIFICA VIAGGIO ──

function doEdit(id){
    const orders=lo();const o=orders.find(x=>x.id===id);if(!o)return;
    const m=document.getElementById('edit-modal');if(!m)return;
    document.getElementById('edit-id').value=id;
    document.getElementById('edit-traffic').value=o.traffic||'';
    document.getElementById('edit-carrier').value=o.carrier||'';
    document.getElementById('edit-cont').value=o.cont||'';
    document.getElementById('edit-port').value=o.port||'';
    document.getElementById('edit-delivery').value=o.delivery||'';
    document.getElementById('edit-address').value=o.address||'';
    document.getElementById('edit-branch').value=o.branch||'';
    document.getElementById('edit-contNr').value=o.contNr||'';
    m.style.display='flex';
}
function saveEdit(){
    const id=document.getElementById('edit-id').value;
    const orders=lo();const o=orders.find(x=>x.id===id);if(!o)return;
    o.traffic=document.getElementById('edit-traffic').value.trim()||o.traffic;
    o.carrier=document.getElementById('edit-carrier').value.trim()||o.carrier;
    o.cont=document.getElementById('edit-cont').value.trim()||o.cont;
    o.port=document.getElementById('edit-port').value.trim()||o.port;
    o.delivery=document.getElementById('edit-delivery').value.trim()||o.delivery;
    o.address=document.getElementById('edit-address').value.trim()||o.address;
    o.branch=document.getElementById('edit-branch').value.trim();
    const newContNr=document.getElementById('edit-contNr').value.trim();
    if(newContNr)o.contNr=newContNr.toUpperCase();
    so(orders);
    // Aggiorna anche la coppia abbinata se esiste
    const pairs=lp();let pairsChanged=false;
    pairs.forEach(p=>{
        if(p.imp.id===id){Object.assign(p.imp,{carrier:o.carrier,cont:o.cont,contNr:o.contNr,address:o.address,delivery:o.delivery,port:o.port,branch:o.branch});pairsChanged=true;}
        if(p.exp.id===id){Object.assign(p.exp,{carrier:o.carrier,cont:o.cont,contNr:o.contNr,address:o.address,delivery:o.delivery,port:o.port,branch:o.branch});pairsChanged=true;}
    });
    if(pairsChanged){sp(pairs);rPairs();}
    closeEdit();
    // Aggiorna data-* sulla riga senza re-render completo
    const sid=id.replace(/[^a-z0-9]/gi,'_');
    const row=document.getElementById('row-'+sid);
    if(row){
        row.dataset.carrier=o.carrier;row.dataset.cont=o.cont;
        row.dataset.traffic=o.traffic;row.dataset.port=(o.port||'').toLowerCase();
        row.dataset.delivery=o.delivery;
        if(row.cells[1])row.cells[1].innerHTML=o.traffic;
        if(row.cells[3])row.cells[3].innerHTML='<b>'+o.carrier+'</b>';
        if(row.cells[4])row.cells[4].textContent=o.cont;
        if(row.cells[6])row.cells[6].textContent=o.delivery;
        if(row.cells[7])row.cells[7].textContent=o.address;
        if(row.cells[8])row.cells[8].textContent=o.port;
    }
}
function closeEdit(){document.getElementById('edit-modal').style.display='none';}

// ── AGGIUNGI VIAGGIO MANUALE ──
function openAddManual(){
    const m=document.getElementById('add-modal');if(!m)return;
    document.getElementById('add-traffic').value='Import';
    document.getElementById('add-carrier').value='';
    document.getElementById('add-cont').value="40HC";
    document.getElementById('add-port').value='La Spezia - IT';
    document.getElementById('add-delivery-date').value='';
    document.getElementById('add-delivery-time').value='';
    document.getElementById('add-address').value='';
    document.getElementById('add-contNr').value='';
    document.getElementById('add-branch').value='';
    document.getElementById('add-prov').value='';
    m.style.display='flex';
}
function saveAddManual(){
    const traffic=document.getElementById('add-traffic').value.trim();
    const carrier=document.getElementById('add-carrier').value.trim();
    const cont=document.getElementById('add-cont').value.trim();
    const port=document.getElementById('add-port').value.trim();
    const delivDate=document.getElementById('add-delivery-date').value.trim();
    const delivTime=document.getElementById('add-delivery-time').value.trim();
    const delivery=delivDate&&delivTime?delivDate+', '+delivTime:delivDate||delivTime;
    const addrRaw=document.getElementById('add-address').value.trim();
    const prov=document.getElementById('add-prov').value.trim().toUpperCase();
    const address=addrRaw+(prov?' ('+prov+')':'');
    const contNr=document.getElementById('add-contNr').value.trim();
    const branch=document.getElementById('add-branch').value.trim();
    if(!carrier||!delivery||!address){alert('Carrier, Delivery e Indirizzo sono obbligatori.');return;}
    const now=new Date();
    const createdStr=now.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit'})+', '+now.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    const ts=Date.now();
    const normCarrier=carrier; // già normalizzato dal dropdown
    const contUpper=cont.toUpperCase().replace('40HC','40HC').replace("20'","20'").replace("40'","40'");
    const fakeLef='MAN'+ts.toString().slice(-6)+'(MAN)';
    const id=(traffic==='Import'?'IMP':'EXP')+'_'+normCarrier+'_'+delivery.replace(/[^0-9]/g,'')+'_'+ts;
    const orders=lo();
    orders.unshift({
        id,traffic,carrier:normCarrier,cont:contUpper,contNr,address,delivery,port,
        reqBranch:fakeLef,branch:branch,reqTruck:'',ldv:'',adr:'',place:'',
        highlighted:false,missing:false,created:createdStr,
        addedAt:now.toISOString(),manual:true
    });
    so(orders);
    closeAddManual();
    // Ricostruisce solo il tbody senza rebuild completo
    const tbody=document.getElementById('tbody');
    if(tbody){
        const pid=pids();
        const nset=new Set();
        const o=orders[0];
        const sid=o.id.replace(/[^a-z0-9]/gi,'_');
        const isPaired=pid.has(o.id);
        const manualBadge='<span style="background:#1a65b8;color:white;border-radius:3px;padding:1px 5px;font-size:9px;margin-left:4px;vertical-align:middle;">manuale</span>';
        const hlBg='#002856';
        const newRow=document.createElement('tr');
        newRow.id='row-'+sid;
        newRow.dataset.id=o.id;newRow.dataset.traffic=o.traffic;newRow.dataset.carrier=o.carrier;
        newRow.dataset.cont=o.cont;newRow.dataset.delivery=o.delivery;newRow.dataset.paired='false';
        newRow.dataset.rt='0';newRow.dataset.port=(o.port||'').toLowerCase();
        // Costruisci la riga senza inline handlers per evitare problemi di escaping
        const tds = [
            '<td style="text-align:center;padding:4px;"><input type="checkbox" id="chk-'+sid+'" style="cursor:pointer;width:14px;height:14px;"></td>',
            '<td>'+o.traffic+manualBadge+'</td>',
            '<td style="text-align:center;padding:2px 4px;"></td>',
            '<td><b>'+o.carrier+'</b></td>',
            '<td>'+o.cont+'</td>',
            '<td style="text-align:center;"></td>',
            '<td>'+o.delivery+'</td>',
            '<td>'+o.address+'</td>',
            '<td>'+o.port+'</td>',
            '<td style="font-size:10px;color:#555;">'+(o.contNr||'')+'</td>',
            '<td style="text-align:center;"></td>',
            '<td style="font-size:10px;">'+(o.branch||'')+'</td>',
            '<td style="font-size:10px;"></td>',
            '<td style="text-align:center;"></td>',
            '<td style="white-space:nowrap;">'+
              '<button style="background:#1a65b8;color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;margin-right:2px;" data-act="goto">→</button>'+
              '<button style="background:#5a9ce0;color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;margin-right:2px;" data-act="sel">✓</button>'+
              '<button class="hl-btn" style="background:'+hlBg+';color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;margin-right:3px;" data-act="hl">☆</button>'+
              '<button style="background:#c0392b;color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;" data-act="del">✕</button>'+
            '</td>',
            '<td style="white-space:nowrap;color:#888;font-size:10px;">'+o.created+'<br><span style="color:#1a65b8;font-size:9px;">manuale</span></td>'
        ];
        newRow.innerHTML = tds.join('');
        // Aggiungi handlers via JS (nessun problema di escaping)
        newRow.querySelector('[data-act="goto"]').addEventListener('click',function(){if(window.opener)window.opener.tcpGoToRow(o.id);});
        newRow.querySelector('[data-act="sel"]').addEventListener('click',function(){if(window.opener)window.opener.tcpSelectRow(o.id);});
        newRow.querySelector('[data-act="hl"]').addEventListener('click',function(){doHL(o.id);});
        newRow.querySelector('[data-act="del"]').addEventListener('click',function(){doDel(o.id);});
        newRow.querySelector('input[type="checkbox"]').addEventListener('change',function(){handleCheck(o.id,o.traffic);});

        tbody.insertBefore(newRow,tbody.firstChild);
        newRow.style.outline='2px solid #1a65b8';
        newRow.scrollIntoView({behavior:'smooth',block:'nearest'});
        setTimeout(()=>{newRow.style.outline='';},3000);
    }
    updCounter();
}
function closeAddManual(){document.getElementById('add-modal').style.display='none';}

// ── HIGHLIGHT / DELETE ordine ──
function doHL(id){
    const orders=lo();const o=orders.find(x=>x.id===id);if(!o)return;
    o.highlighted=!o.highlighted;so(orders);
    const row=document.getElementById('row-'+id.replace(/[^a-z0-9]/gi,'_'));
    if(row&&row.dataset.paired!=='true'){
        row.style.background=o.highlighted?'#fff3cd':'';
        const btn=row.querySelector('button.hl-btn');
        if(btn){btn.textContent=o.highlighted?'★':'☆';btn.style.background=o.highlighted?'#f0a500':'#002856';}
    }
}
function doDel(id){
    so(lo().filter(x=>x.id!==id));
    const r=document.getElementById('row-'+id.replace(/[^a-z0-9]/gi,'_'));
    if(r)r.remove();
}
function clearAll(){
    if(!confirm('Eliminare tutti i viaggi dalla lista?'))return;
    so([]);location.reload();
}

// ── PAIRS render ──
function buildPairsHtml(){
    const allPairs=lp();
    if(!allPairs.length)return'<p style="color:#aaa;text-align:center;padding:40px;font-size:13px;">Nessun abbinamento. Seleziona un Import + Export nella tab Viaggi e clicca Abbina.</p>';
    const today=new Date();today.setHours(0,0,0,0);
    const ieri=new Date(today);ieri.setDate(today.getDate()-1);
    const pairs=allPairs.filter((p,i)=>{const de=pd(p.exp.delivery);return !de||de>=ieri;});
    const hidden=allPairs.length-pairs.length;
    if(!pairs.length)return'<p style="color:#aaa;text-align:center;padding:40px;font-size:13px;">Nessun riutilizzo attivo.</p>'+(hidden?'<p style="color:#aaa;font-size:11px;text-align:center;">'+hidden+' riutilizzi precedenti nascosti</p>':'');
    const groups={};
    pairs.forEach((p,i)=>{const k=p.imp.delivery.substring(0,8)||'?';(groups[k]=groups[k]||[]).push({p,i});});
    const cc={};
    return Object.keys(groups).sort((a,b)=>(pd(groups[a][0].p.imp.delivery)||0)-(pd(groups[b][0].p.imp.delivery)||0))
        .map(k=>{
            const dl=groups[k][0].p.imp.delivery.substring(0,8);
            const rs=groups[k].map(({p,i})=>{
                const realIdx=allPairs.indexOf(p);
                const pal=PAL[p.imp.carrier]||['#ddd'];
                cc[p.imp.carrier]=(cc[p.imp.carrier]||0);
                const bg=pal[cc[p.imp.carrier]++%pal.length];
                var _alerts={};
                try{_alerts=JSON.parse(localStorage.getItem('tcp_pair_alerts')||'{}');}catch(e){}
                var _al=_alerts[String(realIdx)];
                var _alTip=_al?_al.tooltip.split('"').join('&#34;').split(String.fromCharCode(10)).join(' | '):'';
                var _alSpan='<span onclick="tcpDismissPairAlert('+realIdx+',event)" title="'+_alTip+'" style="cursor:pointer;background:#e67e22;color:white;border-radius:3px;padding:2px 7px;font-size:11px;font-weight:bold;margin-right:4px;">\u26a0\ufe0f Modificato \u2715</span>';
                var _alBadge=(_al&&!_al.dismissed)?_alSpan:'';
                var _alBorder=(_al&&!_al.dismissed)?'outline:2px solid #e67e22;':'';
                return \`<div class="pr" id="pair-\${realIdx}" style="border-left:4px solid \${bg};background:\${bg}22;\${_alBorder}">
                    \${_alBadge}<span class="tag imp">📥 IMP</span>
                    <span class="tag">\${p.imp.carrier}</span><span class="tag">\${p.imp.cont}</span>
                    <span class="f">\${p.imp.contNr||'—'}</span>
                    <span class="f"><b>\${p.imp.address}</b></span>
                    <span class="f">\${p.imp.delivery}</span>
                    <span class="f">\${p.imp.port}</span>
                    <span class="f dim">LEF: \${p.imp.reqBranch||'—'}</span>
                    <span class="sep">↕</span>
                    \${p.tappa?'<span style="background:#1a7a1a;color:white;border-radius:4px;font-size:10px;font-weight:bold;padding:2px 7px;margin:0 4px;cursor:pointer;" onclick="tcpOpenTappa('+realIdx+')" title="Modifica tappa">⚑ via '+p.tappa+'</span>':''}
                    <span class="tag exp">📤 EXP</span>
                    <span class="tag">\${p.exp.carrier}</span><span class="tag">\${p.exp.cont}</span>
                    <span class="f"><b>\${p.exp.address}</b></span>
                    <span class="f">\${p.exp.delivery}</span>
                    <span class="f">\${p.exp.port}</span>
                    <span class="f dim">LEF: \${p.exp.reqBranch||'—'}</span>
                    <div style="margin-left:auto;display:flex;align-items:center;gap:4px;flex-shrink:0;">\${tcpKmBadge(p,realIdx)}<button class="cbtn" onclick="doEditPair(\${realIdx})" style="background:#27ae60;color:white;padding:3px 6px;">✏️</button><button class="cbtn" onclick="cpPair(\${realIdx})">📋 Copia</button><button class="cbtn" onclick="tcpCopiaExcel(\${realIdx})" style="background:#1a5c1a;color:white;" title="Copia per Excel">📊 Excel</button><button class="dbtn" onclick="rmPair(\${realIdx})">✕</button></div>
                </div>\`;
            }).join('');
            return \`<div class="sec-title" style="text-align:center;">\${tcpPairTitle(dl,groups[k].length)}</div>\${rs}\`;
        }).join('');
}
function rPairs(){
    const c=document.getElementById('pairs-content');
    if(c)c.innerHTML=buildPairsHtml();
    const btn=document.querySelector('.tb[data-t="pairs"]');
    if(btn)btn.textContent='🔗 Riutilizzi ('+lp().length+')';
}

function cpPair(i){
    const p=lp()[i];if(!p)return;
    const t='📥 IMPORT | '+p.imp.carrier+' | '+p.imp.cont+' | '+(p.imp.contNr||'—')+' | '+p.imp.address+' | '+p.imp.delivery+' | '+p.imp.port+' | LEF: '+(p.imp.reqBranch||'—')+'\\n↕ Riutilizza con\\n📤 EXPORT | '+p.exp.carrier+' | '+p.exp.cont+' | '+(p.exp.contNr||'—')+' | '+p.exp.address+' | '+p.exp.delivery+' | '+p.exp.port+' | LEF: '+(p.exp.reqBranch||'—');
    navigator.clipboard.writeText(t).then(()=>{
        const btn=document.querySelector('#pair-'+i+' .cbtn[onclick*="cpPair"]');
        if(btn){btn.textContent='✓ Copiato!';setTimeout(()=>btn.textContent='📋 Copia',2000);}
    });
}
function importPair(txt){
    _pushUndo();
    if(!txt||!txt.trim()){alert('Incolla prima il testo del riutilizzo.');return;}
    try{
        var lines=txt.trim().split('\\n').map(function(l){return l.trim();}).filter(function(l){return l.length>0;});
        if(lines.length<2){alert('Formato non valido: servono almeno 2 righe.');return;}
        var impLine=lines.find(function(l){return l.indexOf('IMPORT')>=0&&l.indexOf(' | ')>=0;});
        var expLine=lines.find(function(l){return l.indexOf('EXPORT')>=0&&l.indexOf(' | ')>=0;});
        if(!impLine){alert('Riga IMPORT non trovata nel testo incollato.');return;}
        if(!expLine){alert('Riga EXPORT non trovata nel testo incollato.');return;}
        var ip=impLine.split(' | ');
        var ep=expLine.split(' | ');
        if(ip.length<8){alert('Riga IMPORT non completa ('+ip.length+' campi trovati).');return;}
        if(ep.length<8){alert('Riga EXPORT non completa ('+ep.length+' campi trovati).');return;}
        var lef=function(s){var m=(s||'').match(/LEF:\\s*(.*)/i);return m&&m[1].trim()!=='\\u2014'?m[1].trim():'';};
        var cNr=ip[3].trim()==='\\u2014'?'':ip[3].trim();
        var impCarr=ip[1].trim();
        var imp={
            id:cNr||('IMP_'+impCarr+'_'+ip[5].trim()),
            traffic:'Import',carrier:impCarr,cont:ip[2].trim(),contNr:cNr,
            address:ip[4].trim(),delivery:ip[5].trim(),port:ip[6].trim(),
            reqBranch:lef(ip[7]),branch:'',reqTruck:'',ldv:'',adr:'',place:'',
            highlighted:false,created:'',addedAt:new Date().toISOString()
        };
        var expCarr=ep[1].trim();
        var eNr=ep[3].trim()==='—'?'':ep[3].trim();
        var exp={
            id:eNr||('EXP_'+expCarr+'_'+ep[4].trim()+'_'+ep[5].trim()),
            traffic:'Export',carrier:expCarr,cont:ep[2].trim(),contNr:eNr,
            address:ep[4].trim(),delivery:ep[5].trim(),port:ep[6].trim(),
            reqBranch:lef(ep[7]),branch:'',reqTruck:'',ldv:'',adr:'',place:'',
            highlighted:false,created:'',addedAt:new Date().toISOString()
        };
        var existing=lp();
        if(existing.some(function(p){return p.imp.id===imp.id&&p.exp.id===exp.id;})){alert('Questo riutilizzo è già presente.');return;}
        existing.push({imp:imp,exp:exp,at:new Date().toISOString(),imported:true});
        sp(existing);
        var orders=lo();
        var _t=function(s){return(s||'').trim();};
        var _lef=function(s){return _t(s).replace(/\s*\(.*?\)\s*$/,'').trim();};
        var impIsMAN=/\(MAN\)\s*$/i.test(_t(imp.reqBranch));
        var expIsMAN=/\(MAN\)\s*$/i.test(_t(exp.reqBranch));
        if(impIsMAN){
            var alreadyI=orders.find(function(o){return o.traffic.toLowerCase()==='import'&&o.manual&&(_t(o.contNr)===_t(imp.contNr)||(o.carrier===imp.carrier&&o.address===imp.address&&o.delivery===imp.delivery));});
            if(!alreadyI){
                var nowI=new Date();
                var crI=nowI.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit'})+', '+nowI.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
                var manI={id:imp.id,traffic:'Import',carrier:imp.carrier,cont:imp.cont,contNr:imp.contNr,address:imp.address,delivery:imp.delivery,port:imp.port,reqBranch:imp.reqBranch,branch:'',reqTruck:'',ldv:'',adr:'',place:'',highlighted:false,missing:false,created:crI,addedAt:nowI.toISOString(),manual:true};
                orders.unshift(manI);so(orders);
            }
        }
        if(expIsMAN){
            var alreadyE=orders.find(function(o){return o.traffic.toLowerCase()==='export'&&o.manual&&(_lef(o.reqBranch)===_lef(exp.reqBranch)||(o.carrier===exp.carrier&&o.address===exp.address&&o.delivery===exp.delivery));});
            if(!alreadyE){
                var nowE=new Date();
                var crE=nowE.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit'})+', '+nowE.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
                var manE={id:exp.id,traffic:'Export',carrier:exp.carrier,cont:exp.cont,contNr:'',address:exp.address,delivery:exp.delivery,port:exp.port,reqBranch:exp.reqBranch,branch:'',reqTruck:'',ldv:'',adr:'',place:'',highlighted:false,missing:false,created:crE,addedAt:nowE.toISOString(),manual:true};
                orders.unshift(manE);so(orders);
            }
        }
        orders=lo();
        var foundI=-1,foundE=-1;
        for(var _oi=0;_oi<orders.length;_oi++){
            var _o=orders[_oi];
            if(foundI<0&&_o.traffic.toLowerCase()==='import'){
                if(imp.contNr&&_o.contNr&&_t(_o.contNr)===_t(imp.contNr)){foundI=_oi;}
                else if(!imp.contNr&&_t(_o.carrier)===_t(imp.carrier)&&_t(_o.address)===_t(imp.address)&&_t(_o.delivery)===_t(imp.delivery)){foundI=_oi;}
            }
            if(foundE<0&&_o.traffic.toLowerCase()==='export'){
                if(exp.contNr&&_o.contNr&&_t(_o.contNr)===_t(exp.contNr)){foundE=_oi;}
                else if(!exp.contNr&&_t(_o.reqBranch)&&_t(_o.reqBranch)===_t(exp.reqBranch)&&_t(_o.carrier)===_t(exp.carrier)&&_t(_o.delivery)===_t(exp.delivery)){foundE=_oi;}
                else if(!exp.contNr&&!exp.reqBranch&&_t(_o.carrier)===_t(exp.carrier)&&_t(_o.address)===_t(exp.address)&&_t(_o.delivery)===_t(exp.delivery)){foundE=_oi;}
            }
            if(foundI>=0&&foundE>=0)break;
        }
        [[foundI,imp],[foundE,exp]].forEach(function(pair){
            var fi=pair[0],ref=pair[1];
            if(fi<0)return;
            var o=orders[fi];
            var disc=[];
            if(_t(o.carrier)!==_t(ref.carrier)) disc.push('Carrier: '+o.carrier+' vs '+ref.carrier);
            if(_t(o.address)!==_t(ref.address)) disc.push('Indirizzo: '+o.address+' vs '+ref.address);
            if(_t(o.delivery)!==_t(ref.delivery)) disc.push('Delivery: '+o.delivery+' vs '+ref.delivery);
            if(disc.length>0){
                var msg='Discrepanza '+o.traffic+' ('+o.carrier+'): '+disc.join(' | ')+' - OK=sistema Annulla=importato';
                if(!confirm(msg)){o.carrier=ref.carrier;o.address=ref.address;o.delivery=ref.delivery;so(orders);}
            }
            var r=document.getElementById('row-'+o.id.replace(/[^a-z0-9]/gi,'_'));
            if(r){r.style.background='#d4f5d4';r.dataset.paired='true';}
            var c=document.getElementById('chk-'+o.id.replace(/[^a-z0-9]/gi,'_'));
            if(c)c.disabled=true;
        });
        rPairs();rPlanner();
        document.getElementById('import-pair-txt').value='';
        tcpToast('\u2713 Riutilizzo importato!');
    }catch(e){alert('Errore nel parsing: '+e.message);}
}
function removePair(txt){
    if(!txt||!txt.trim()){alert('Incolla il testo del riutilizzo da rimuovere.');return;}
    try{
        var lines=txt.trim().split('\\n').map(function(l){return l.trim();}).filter(function(l){return l.length>0;});
        if(lines.length<2){alert('Formato non valido: servono almeno 2 righe.');return;}
        var impLine=lines.find(function(l){return l.indexOf('IMPORT')>=0&&l.indexOf(' | ')>=0;});
        var expLine=lines.find(function(l){return l.indexOf('EXPORT')>=0&&l.indexOf(' | ')>=0;});
        if(!impLine||!expLine){alert('Formato non riconosciuto.');return;}
        var ip=impLine.split(' | ');
        var ep=expLine.split(' | ');
        if(ip.length<6||ep.length<5){alert('Formato non riconosciuto.');return;}
        var pairs=lp();
        var idx=pairs.findIndex(function(p){
            return p.imp.carrier===ip[1].trim()&&p.imp.cont===ip[2].trim()&&p.imp.address===ip[4].trim()&&p.imp.delivery===ip[5].trim()&&p.exp.carrier===ep[1].trim()&&p.exp.address===ep[3].trim()&&p.exp.delivery===ep[4].trim();
        });
        if(idx<0){alert('Riutilizzo non trovato.');return;}
        var p=pairs[idx];
        if(!confirm('Rimuovere il riutilizzo?')){return;}
        _pushUndo();rmPair(idx);
        document.getElementById('import-pair-txt').value='';
        tcpToast('\u2713 Riutilizzo rimosso.');
    }catch(e){alert('Errore: '+e.message);}
}
// ── UNDO STACK (sessionStorage, max 5 snapshot) ──
function _getUndoStack(){try{return JSON.parse(sessionStorage.getItem('tcp_undo')||'[]');}catch(e){return [];}}
function _setUndoStack(s){try{sessionStorage.setItem('tcp_undo',JSON.stringify(s));}catch(e){}}
function _pushUndo(){
    var s=_getUndoStack();
    s.push(JSON.stringify(lp()));
    if(s.length>5)s.shift();
    _setUndoStack(s);
}
function tcpUndo(){
    var s=_getUndoStack();
    if(!s.length)return;
    sp(JSON.parse(s.pop()));
    _setUndoStack(s);
    rPairs();
}
// Ripristina visibilità bottone undo al caricamento

function tcpCopiaExcel(i){
    const p=lp()[i];if(!p)return;
    function _carrier(s){var m={'MSC':'MSC','Hapag':'HAPAG','ONE':'ONE','CMA':'CMA','OOCL':'OOCL','ZIM':'ZIM','Yang Ming':'YANG MING','Maersk':'MAERSK'};return m[s]||s||'';}
    function _cont(s){var m={"20'":'20 BOX',"40'":'40 BOX','40HC':'40 HC'};return m[s]||s||'';}
    function _client(b){
        if(!b)return'';
        if(/carrier.*hapag|hapag.*carrier/i.test(b))return'CARRIER HAPAG';
        if(/life.*petcare|petcare/i.test(b))return'LIFE PETCARE';
        if(/carrier.*cma|cma.*carrier/i.test(b))return'CARRIER CMA';
        if(/savino.*del.*bene|savino.*bene/i.test(b)){
            if(/livorno/i.test(b))return'SDB LI';
            if(/firenze|florence/i.test(b))return'SDB FI';
            if(/genova|genoa/i.test(b))return'SDB GE';
            if(/milano.*dp|dp.*milano|divisione.*prog/i.test(b))return'SDB MI DP';
            if(/milano|milan/i.test(b))return'SDB MI';
            if(/roma|rome/i.test(b))return'SDB RM';
            if(/napoli|naples/i.test(b))return'SDB NA';
            if(/torino|turin/i.test(b))return'SDB TO';
            if(/bergamo/i.test(b))return'SDB BG';
            if(/catania/i.test(b))return'SDB CT';
            if(/fidenza/i.test(b))return'SDB PR';
            if(/montecosaro/i.test(b))return'SDB MC';
            if(/montemurlo/i.test(b))return'SDB PO';
            if(/montichiari/i.test(b))return'SDB BS';
            if(/san.*miniato/i.test(b))return'SDB SM';
            if(/udine/i.test(b))return'SDB UD';
            if(/verona/i.test(b))return'SDB VR';
            if(/vicenza/i.test(b))return'SDB VI';
            if(/campogalliano/i.test(b))return'SDB MO';
            if(/montebelluna/i.test(b))return'SDB TV';
            if(/pisa/i.test(b))return'SDB PI';
            if(/stabio/i.test(b))return'SDB STABIO';
            if(/padova|padua/i.test(b))return'SDB PD';
            return'SDB';
        }
        if(/albatrans/i.test(b))return'ALBATRANS';
        if(/aprile/i.test(b))return'APRILE';
        if(/arimar/i.test(b))return'ARIMAR';
        if(/c\.d\.c|cdc/i.test(b))return'CDC';
        if(/danesi/i.test(b))return'DANESI';
        if(/general.*noli|noli/i.test(b))return'GENERAL NOLI';
        if(/bortesi/i.test(b))return'BORTESI';
        return b;
    }
    function _citta(addr){
        if(!addr)return'';
        var part=addr.split('+')[0].trim();
        // Tronca tutto da '(' in poi: 'SCANDICCI (FI) 50018' -> 'SCANDICCI'
        var paren=part.indexOf('(');
        if(paren>0)part=part.substring(0,paren).trim();
        else part=part.replace(/\d{5}/g,'').trim();
        return part.toUpperCase();
    }
    const compagnia=_carrier(p.imp.carrier);
    const tipo=_cont(p.imp.cont);
    const matricola=p.imp.contNr||'';
    const clienteImp=p.imp.clienteExcel||_client(p.imp.branch||'');
    const clienteExp=p.exp.clienteExcel||_client(p.exp.branch||'');
    const dataRiut=(p.exp.delivery||'').substring(0,8);
    const scarico=_citta(p.imp.address);
    const ricarico=_citta(p.exp.address);
    const row=[compagnia,tipo,matricola,clienteImp,clienteExp,dataRiut,scarico,ricarico].join('\t');
    function _feedback(){
        const btn=document.querySelector('#pair-'+i+' .cbtn[title="Copia per Excel"]');
        if(btn){var orig=btn.textContent;btn.textContent='\u2713 Copiato!';setTimeout(function(){btn.textContent=orig;},2000);}
    }
    if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(row).then(_feedback).catch(function(){
            var ta=document.createElement('textarea');ta.value=row;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);_feedback();
        });
    }else{
        var ta=document.createElement('textarea');ta.value=row;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);_feedback();
    }
}
function rmPair(i){
    _pushUndo();
    const pairs=lp();const p=pairs[i];
    if(p){[p.imp.id,p.exp.id].forEach(id=>{
        const r=document.getElementById('row-'+id.replace(/[^a-z0-9]/gi,'_'));
        if(r){r.style.background='';r.dataset.paired='false';}
        const c=document.getElementById('chk-'+id.replace(/[^a-z0-9]/gi,'_'));
        if(c)c.disabled=false;
    });}
    var _dSt=null;try{_dSt=JSON.parse(localStorage.getItem('tcp_stats')||'null');}catch(_y){}
    if(_dSt&&_dSt.monthly&&pairs[i]&&pairs[i].at){
        var _dMn=pairs[i].at.substring(0,7);
        if(_dSt.monthly[_dMn]){
            _dSt.total=Math.max(0,(_dSt.total||0)-1);
            _dSt.monthly[_dMn].total=Math.max(0,(_dSt.monthly[_dMn].total||0)-1);
            var _dCar=pairs[i].imp.carrier||'';var _dCo=(pairs[i].imp.cont||'').replace("'","");
            var _dK=_dCar+'_'+_dCo;
            if(_dSt.monthly[_dMn][_dK])_dSt.monthly[_dMn][_dK]=Math.max(0,_dSt.monthly[_dMn][_dK]-1);
            localStorage.setItem('tcp_stats',JSON.stringify(_dSt));
        }
    }
    if(p){
        var removed=[];
        try{removed=JSON.parse(localStorage.getItem('tcp_removed_pairs')||'[]');}catch(e){}
        var rKey=(p.imp.contNr||p.imp.id)+'|'+(p.exp.contNr||p.exp.id);
        if(!removed.some(function(r){return(r.key||r)===rKey;}))removed.push({key:rKey,at:new Date().toISOString()});
        localStorage.setItem('tcp_removed_pairs',JSON.stringify(removed));
    }
    pairs.splice(i,1);sp(pairs);rPairs();rPlanner();
}
// -- GIST SETTINGS --
function tcpGistSettings(){
    var tok=localStorage.getItem('tcp_gist_token')||'';
    var gid=localStorage.getItem('tcp_gist_id')||'';
    var gidc=localStorage.getItem('tcp_gist_id_collega')||'';
    var m=document.getElementById('gist-settings-modal');if(!m)return;
    document.getElementById('gist-token-input').value=tok;
    document.getElementById('gist-id-input').value=gid;
    document.getElementById('gist-id-collega-input').value=gidc;
    m.style.display='flex';
}
function tcpSaveGistSettings(){
    var tok=(document.getElementById('gist-token-input').value||'').trim();
    var gid=(document.getElementById('gist-id-input').value||'').trim();
    var gidc=(document.getElementById('gist-id-collega-input').value||'').trim();
    localStorage.setItem('tcp_gist_token',tok);
    localStorage.setItem('tcp_gist_id',gid);
    localStorage.setItem('tcp_gist_id_collega',gidc);
    document.getElementById('gist-settings-modal').style.display='none';
    var n=document.getElementById('gist-save-note');
    if(n){n.textContent='Salvato';setTimeout(function(){n.textContent='';},2000);}
}
function tcpCloseGistSettings(){
    document.getElementById('gist-settings-modal').style.display='none';
}
// -- EXPORT RIUTILIZZI FILE --
function tcpExportPairs(){
    var pairs=lp();
    if(!pairs.length){alert('Nessun riutilizzo da esportare.');return;}
    var data=JSON.stringify({version:1,exported:new Date().toISOString(),pairs:pairs},null,2);
    var blob=new Blob([data],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='riutilizzi_'+new Date().toISOString().slice(0,10)+'.tcp';
    a.click();URL.revokeObjectURL(a.href);
}
// -- MERGE LOGIC --
function tcpDoMerge(incoming){
    var existing=lp();
    var toAdd=[];var conflicts=[];var ignored=0;
    var t=function(s){return(s||'').trim();};
    var removed=[];
    try{removed=JSON.parse(localStorage.getItem('tcp_removed_pairs')||'[]');}catch(e){}
    incoming.forEach(function(inc){
        var rKey=(t(inc.imp&&inc.imp.contNr)||t(inc.imp&&inc.imp.id))+'|'+(t(inc.exp&&inc.exp.contNr)||t(inc.exp&&inc.exp.id));
        if(removed.some(function(r){return(r.key||r)===rKey;})){ignored++;return;}
        var iNr=t(inc.imp&&inc.imp.contNr);
        var eNr=t(inc.exp&&inc.exp.contNr);
        var found=null;var foundType=null;
        for(var i=0;i<existing.length;i++){
            var ex=existing[i];
            var exINr=t(ex.imp&&ex.imp.contNr);
            var exENr=t(ex.exp&&ex.exp.contNr);
            if(iNr&&eNr&&exINr&&exENr){
                if(iNr===exINr&&eNr===exENr){found=ex;foundType='exact';break;}
                if(iNr===exINr&&eNr!==exENr){found=ex;foundType='conflict-exp';break;}
                if(eNr===exENr&&iNr!==exINr){found=ex;foundType='conflict-imp';break;}
            }
            if(iNr&&exINr&&iNr===exINr&&(!eNr||!exENr)){found=ex;foundType='exact';break;}
            if(eNr&&exENr&&eNr===exENr&&(!iNr||!exINr)){found=ex;foundType='exact';break;}
        }
        if(!found&&!iNr&&!eNr){
            for(var j=0;j<existing.length;j++){
                var ex2=existing[j];
                if(t(ex2.imp.carrier)===t(inc.imp.carrier)&&t(ex2.imp.address)===t(inc.imp.address)&&t(ex2.imp.delivery)===t(inc.imp.delivery)){
                    found=ex2;foundType='exact';break;
                }
            }
        }
        if(!found){toAdd.push(inc);}
        else if(foundType==='exact'){ignored++;}
        else{
            var _resolved=[];
            try{_resolved=JSON.parse(localStorage.getItem('tcp_resolved_conflicts')||'[]');}catch(e){}
            var _rKey=(found.imp.contNr||found.imp.id)+'|'+(found.exp.contNr||found.exp.id)
                     +'||'+(inc.imp.contNr||inc.imp.id)+'|'+(inc.exp.contNr||inc.exp.id);
            var _prevRes=_resolved.find(function(r){return r.key===_rKey;});
            if(_prevRes&&_prevRes.choice==='theirs'){
                conflicts.push({inc:inc,ex:found,type:foundType,autoChoice:'theirs'});
            }else if(_prevRes){
                ignored++;
            }else{
                conflicts.push({inc:inc,ex:found,type:foundType});
            }
        }
    });
    return{toAdd:toAdd,conflicts:conflicts,ignored:ignored};
}
function tcpApplyMergePairs(toAdd,conflictResolutions){
    _pushUndo();
    var pairs=lp();
    toAdd.forEach(function(p){pairs.push(p);});
    var resolved=[];
    try{resolved=JSON.parse(localStorage.getItem('tcp_resolved_conflicts')||'[]');}catch(e){}
    conflictResolutions.forEach(function(res){
        if(res.choice==='skip')return;
        var rKey=(res.ex.imp.contNr||res.ex.imp.id)+'|'+(res.ex.exp.contNr||res.ex.exp.id)
                +'||'+(res.inc.imp.contNr||res.inc.imp.id)+'|'+(res.inc.exp.contNr||res.inc.exp.id);
        var existing=resolved.find(function(r){return r.key===rKey;});
        if(existing){existing.choice=res.choice;}
        else{resolved.push({key:rKey,choice:res.choice,at:new Date().toISOString()});}
        if(res.choice==='theirs'){
            var idx=pairs.findIndex(function(p){return p===res.ex;});
            if(idx>=0)pairs[idx]=res.inc;
        }
    });
    localStorage.setItem('tcp_resolved_conflicts',JSON.stringify(resolved));
    sp(pairs);rPairs();rPlanner();
}
// -- IMPORT RIUTILIZZI DA FILE --
var _mergePayload=null;
function tcpImportPairsFile(input){
    var file=input.files&&input.files[0];input.value='';
    if(!file)return;
    var reader=new FileReader();
    reader.onload=function(e){
        try{
            var data=JSON.parse(e.target.result);
            if(!data.pairs||!Array.isArray(data.pairs)){alert('File non valido: manca array pairs.');return;}
            var result=tcpDoMerge(data.pairs);
            _mergePayload={toAdd:result.toAdd,conflicts:result.conflicts,source:'file'};
            tcpShowMergePairsModal(result);
        }catch(err){alert('Errore lettura file: '+err.message);}
    };
    reader.readAsText(file,'UTF-8');
}
// -- PUBLISH SU GIST --
function tcpPublishGist(){
    var tok=localStorage.getItem('tcp_gist_token')||'';
    if(!tok){alert('Imposta prima il token GitHub nelle impostazioni Gist.');tcpGistSettings();return;}
    var gid=localStorage.getItem('tcp_gist_id')||'';
    var ts=new Date().toISOString();
    var pairs=lp();
    var tratte=[];try{tratte=JSON.parse(localStorage.getItem('tcp_tratte')||'[]');}catch(e){}
    var alias=[];try{alias=JSON.parse(localStorage.getItem('tcp_tratte_alias')||'[]');}catch(e){}
    var files={
        'tcp_pairs.json':{content:JSON.stringify({version:1,exported:ts,pairs:pairs},null,2)},
        'tcp_tratte.json':{content:JSON.stringify({version:1,exported:ts,tratte:tratte},null,2)},
        'tcp_alias.json':{content:JSON.stringify({version:1,exported:ts,alias:alias},null,2)}
    };
    var body=JSON.stringify({description:'S.R.C sync',public:false,files:files});
    var url=gid?'https://api.github.com/gists/'+gid:'https://api.github.com/gists';
    var method=gid?'PATCH':'POST';
    var btn=document.getElementById('btn-gist-publish');
    if(btn){btn.textContent='Pubblicazione...';btn.disabled=true;}
    fetch(url,{method:method,headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json'},body:body})
        .then(function(r){return r.json();})
        .then(function(data){
            if(data.id){
                localStorage.setItem('tcp_gist_id',data.id);
                if(btn){btn.textContent='\u2601\uFE0F Pubblica';btn.disabled=false;}
                tcpToast('\u2601\uFE0F Pubblicato'+(gid?'':' - ID: '+data.id+' (salvato)'));
            }else{
                if(btn){btn.textContent='\u2601\uFE0F Pubblica';btn.disabled=false;}
                alert('Errore: '+(data.message||JSON.stringify(data)));
            }
        })
        .catch(function(err){
            if(btn){btn.textContent='\u2601\uFE0F Pubblica';btn.disabled=false;}
            alert('Errore di rete: '+err.message);
        });
}
// -- MERGE HELPERS --
function tcpDoMergeTratte(incoming){
    var existing=[];try{existing=JSON.parse(localStorage.getItem('tcp_tratte')||'[]');}catch(e){}
    var toAdd=[];var conflicts=[];var ignored=0;
    incoming.forEach(function(t){
        var ex=existing.find(function(x){return x.id===t.id;});
        if(!ex){toAdd.push(t);}
        else if(ex.km!==t.km){conflicts.push({ex:ex,inc:t});}
        else{ignored++;}
    });
    return{toAdd:toAdd,conflicts:conflicts,ignored:ignored};
}
function tcpDoMergeAlias(incoming){
    var existing=[];try{existing=JSON.parse(localStorage.getItem('tcp_tratte_alias')||'[]');}catch(e){}
    var added=0;
    incoming.forEach(function(a){
        var ex=existing.find(function(x){return x.nome.toLowerCase()===a.nome.toLowerCase();});
        if(!ex){existing.push(a);added++;}
        else{a.indirizzi.forEach(function(ind){if(ex.indirizzi.indexOf(ind)<0){ex.indirizzi.push(ind);added++;}});}
    });
    if(added>0)localStorage.setItem('tcp_tratte_alias',JSON.stringify(existing));
    return{added:added};
}
function tcpDoMergeTariffario(incoming){
    var existing=[];try{existing=JSON.parse(localStorage.getItem('tcp_tariffario')||'[]');}catch(e){}
    var toAdd=[];var conflicts=[];var ignored=0;
    incoming.forEach(function(t){
        var ex=existing.find(function(x){return x.km===t.km;});
        if(!ex){toAdd.push(t);}
        else if(ex.c20!==t.c20||ex.c40!==t.c40){conflicts.push({ex:ex,inc:t});}
        else{ignored++;}
    });
    return{toAdd:toAdd,conflicts:conflicts,ignored:ignored};
}
// -- SYNC DA GIST --
function tcpFetchCollegaGist(tok,gidc,autoPublish,btnId){
    var btn=document.getElementById(btnId);
    fetch('https://api.github.com/gists/'+gidc,{headers:{'Authorization':'Bearer '+tok}})
        .then(function(r){return r.json();})
        .then(function(data){
            if(btn){btn.textContent=btn.dataset.label;btn.disabled=false;}
            if(!data.files){alert('Gist collega non trovato o vuoto.');return;}
            var pairsResult={toAdd:[],conflicts:[],ignored:0};
            if(data.files['tcp_pairs.json']){
                var pp=JSON.parse(data.files['tcp_pairs.json'].content);
                if(pp.pairs)pairsResult=tcpDoMerge(pp.pairs);
            }
            var tratteResult={toAdd:[],conflicts:[],ignored:0};
            if(data.files['tcp_tratte.json']){
                var tt=JSON.parse(data.files['tcp_tratte.json'].content);
                if(tt.tratte)tratteResult=tcpDoMergeTratte(tt.tratte);
            }
            if(data.files['tcp_alias.json']){
                var aa=JSON.parse(data.files['tcp_alias.json'].content);
                if(aa.alias)tcpDoMergeAlias(aa.alias);
            }
            _mergePayload={pairs:pairsResult,tratte:tratteResult,tariffario:{toAdd:[],conflicts:[],ignored:0},source:'gist',autoPublish:autoPublish};
            tcpSetPairsBadge(0);
            tcpShowSyncModal(_mergePayload);
        })
        .catch(function(err){
            if(btn){btn.textContent=btn.dataset.label;btn.disabled=false;}
            alert('Errore: '+err.message);
        });
}
function tcpSyncGist(){
    var tok=localStorage.getItem('tcp_gist_token')||'';
    var gidc=localStorage.getItem('tcp_gist_id_collega')||'';
    if(!tok){alert('Imposta prima il token GitHub nelle impostazioni.');tcpGistSettings();return;}
    if(!gidc){alert('Imposta il Gist ID del collega nelle impostazioni.');tcpGistSettings();return;}
    var btn=document.getElementById('btn-gist-sync');
    if(btn){btn.textContent='Scaricamento...';btn.disabled=true;}
    tcpFetchCollegaGist(tok,gidc,false,'btn-gist-sync');
}
function tcpSyncAndPublish(){
    var tok=localStorage.getItem('tcp_gist_token')||'';
    var gidc=localStorage.getItem('tcp_gist_id_collega')||'';
    if(!tok){alert('Imposta prima il token GitHub nelle impostazioni.');tcpGistSettings();return;}
    if(!gidc){alert('Imposta il Gist ID del collega nelle impostazioni.');tcpGistSettings();return;}
    var btn=document.getElementById('btn-gist-syncpub');
    if(btn){btn.textContent='Sincronizzazione...';btn.disabled=true;}
    tcpFetchCollegaGist(tok,gidc,true,'btn-gist-syncpub');
}
// -- MODAL MERGE RIUTILIZZI --
function tcpShowMergePairsModal(result){tcpShowSyncModal({pairs:result,tratte:{toAdd:[],conflicts:[],ignored:0},tariffario:{toAdd:[],conflicts:[],ignored:0}});}
function tcpShowSyncModal(payload){
    var pD=payload.pairs||payload;
    var tD=payload.tratte||{toAdd:[],conflicts:[],ignored:0};
    var rD=payload.tariffario||{toAdd:[],conflicts:[],ignored:0};
    var totNew=(pD.toAdd||[]).length+(tD.toAdd||[]).length+(rD.toAdd||[]).length;
    var totConf=(pD.conflicts||[]).length+(tD.conflicts||[]).length+(rD.conflicts||[]).length;
    var totIgn=(pD.ignored||0)+(tD.ignored||0)+(rD.ignored||0);
    // Se non ci sono conflitti: applica automaticamente e mostra toast
    if(totConf===0){
        _mergePayload=payload;
        tcpApplyMergePairsModal();
        var msg=totNew>0?('\u2713 Sync: +'+totNew+' nuovi aggiunti automaticamente.'):'\u2713 Sync: tutto aggiornato.';
        tcpToast(msg,4000);
        return;
    }
    // Ci sono conflitti: apri la tab
    showTab('syncreport');
    var sumEl=document.getElementById('sr-summary');
    var confEl=document.getElementById('sr-conflicts');
    var sum='';
    if(totNew)sum+=totNew+' nuovi da aggiungere. ';
    if(totIgn)sum+=totIgn+' gia presenti ignorati. ';
    if(totConf)sum+=totConf+' conflitti da risolvere.';
    if(sumEl)sumEl.textContent=sum;
    if(confEl){
        var html='';
        if((pD.conflicts||[]).length){
            html+='<div style="font-weight:bold;color:#002856;font-size:12px;margin:8px 0 4px;">Riutilizzi</div>';
            html+=(pD.conflicts||[]).map(function(cf,ci){
                var _diffField=cf.type==='conflict-exp'?'contNr_exp':'contNr_imp';
                var _label=cf.type==='conflict-exp'?'Nr. Container EXP diverso':'Nr. Container IMP diverso';
                function _hl(val,isDiff){return isDiff?('<b style="background:#fff3cd;border-radius:3px;padding:1px 4px;">'+val+'</b>'):val;}
                var _isExpConfl=cf.type==='conflict-exp';
                function _pairHtml(p){
                    return '<div style="font-size:11px;line-height:1.8;">'
                        +'<div><b>IMP:</b> '+p.imp.carrier+' '+p.imp.cont
                            +' &nbsp;<span style="color:#555;">Nr:</span> '+_hl(p.imp.contNr||'\u2014',!_isExpConfl)
                            +' &nbsp;<span style="color:#555;">del</span> '+p.imp.delivery+'</div>'
                        +'<div style="color:#555;font-size:11px;padding-left:8px;">'+p.imp.address+' &nbsp;|&nbsp; '+p.imp.port+'</div>'
                        +'<div style="color:#aaa;font-size:10px;text-align:center;padding:2px 0;">\u2195</div>'
                        +'<div><b>EXP:</b> '+p.exp.carrier+' '+p.exp.cont
                            +' &nbsp;<span style="color:#555;">Nr:</span> '+_hl(p.exp.contNr||'\u2014',_isExpConfl)
                            +' &nbsp;<span style="color:#555;">del</span> '+p.exp.delivery+'</div>'
                        +'<div style="color:#555;font-size:11px;padding-left:8px;">'+p.exp.address+' &nbsp;|&nbsp; '+p.exp.port+'</div>'
                        +'</div>';
                }
                return '<div style="border:1px solid #f0c040;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:12px;">'
                    +'<div style="font-weight:bold;color:#e67e22;margin-bottom:8px;font-size:12px;">\u26a0\ufe0f '+_label+'</div>'
                    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'
                    +'<div style="background:#f0f4fa;border-radius:4px;padding:8px;"><div style="font-size:10px;color:#1a65b8;font-weight:bold;margin-bottom:4px;">MIO</div>'+_pairHtml(cf.ex)+'</div>'
                    +'<div style="background:#f0f8f0;border-radius:4px;padding:8px;"><div style="font-size:10px;color:#27ae60;font-weight:bold;margin-bottom:4px;">COLLEGA</div>'+_pairHtml(cf.inc)+'</div>'
                    +'</div>'
                    +'<div style="display:flex;gap:6px;">'
                    +'<label style="display:flex;align-items:center;gap:3px;cursor:pointer;padding:3px 8px;border-radius:4px;border:2px solid #1a65b8;font-size:11px;"><input type="radio" name="mpc'+ci+'" value="mine" checked> <span style="color:#1a65b8;font-weight:bold;">Il mio</span></label>'
                    +'<label style="display:flex;align-items:center;gap:3px;cursor:pointer;padding:3px 8px;border-radius:4px;border:2px solid #27ae60;font-size:11px;"><input type="radio" name="mpc'+ci+'" value="theirs"> <span style="color:#27ae60;font-weight:bold;">Collega</span></label>'
                    +'<label style="display:flex;align-items:center;gap:3px;cursor:pointer;padding:3px 8px;border-radius:4px;border:2px solid #aaa;font-size:11px;"><input type="radio" name="mpc'+ci+'" value="skip"> <span style="color:#888;">Salta</span></label>'
                    +'</div></div>';
            }).join('');
        }
        if((tD.conflicts||[]).length){
            html+='<div style="font-weight:bold;color:#002856;font-size:12px;margin:8px 0 4px;">Tratte</div>';
            html+=(tD.conflicts||[]).map(function(cf,ci){
                return '<div style="border:1px solid #d0dff0;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:12px;">'
                    +'<b>'+cf.ex.scarico+' - '+cf.ex.carico+'</b>'
                    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0;">'
                    +'<div style="background:#f0f4fa;border-radius:4px;padding:5px 8px;"><div style="font-size:10px;color:#888;font-weight:bold;">MIO</div><div>'+cf.ex.km+' km</div></div>'
                    +'<div style="background:#f0f8f0;border-radius:4px;padding:5px 8px;"><div style="font-size:10px;color:#888;font-weight:bold;">COLLEGA</div><div>'+cf.inc.km+' km</div></div></div>'
                    +'<div style="display:flex;gap:6px;">'
                    +'<label style="display:flex;align-items:center;gap:3px;cursor:pointer;padding:3px 8px;border-radius:4px;border:2px solid #1a65b8;font-size:11px;"><input type="radio" name="mtc'+ci+'" value="mine" checked> <span style="color:#1a65b8;font-weight:bold;">Il mio</span></label>'
                    +'<label style="display:flex;align-items:center;gap:3px;cursor:pointer;padding:3px 8px;border-radius:4px;border:2px solid #27ae60;font-size:11px;"><input type="radio" name="mtc'+ci+'" value="theirs"> <span style="color:#27ae60;font-weight:bold;">Collega</span></label>'
                    +'</div></div>';
            }).join('');
        }
        if((rD.conflicts||[]).length){
            html+='<div style="font-weight:bold;color:#002856;font-size:12px;margin:8px 0 4px;">Tariffario</div>';
            html+=(rD.conflicts||[]).map(function(cf,ci){
                return '<div style="border:1px solid #d0dff0;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:12px;">'
                    +'<b>'+cf.ex.km+' km</b>'
                    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0;">'
                    +'<div style="background:#f0f4fa;border-radius:4px;padding:5px 8px;"><div style="font-size:10px;color:#888;font-weight:bold;">MIO</div><div>20: '+(cf.ex.c20||'-')+' 40: '+(cf.ex.c40||'-')+'</div></div>'
                    +'<div style="background:#f0f8f0;border-radius:4px;padding:5px 8px;"><div style="font-size:10px;color:#888;font-weight:bold;">COLLEGA</div><div>20: '+(cf.inc.c20||'-')+' 40: '+(cf.inc.c40||'-')+'</div></div></div>'
                    +'<div style="display:flex;gap:6px;">'
                    +'<label style="display:flex;align-items:center;gap:3px;cursor:pointer;padding:3px 8px;border-radius:4px;border:2px solid #1a65b8;font-size:11px;"><input type="radio" name="mtr'+ci+'" value="mine" checked> <span style="color:#1a65b8;font-weight:bold;">Il mio</span></label>'
                    +'<label style="display:flex;align-items:center;gap:3px;cursor:pointer;padding:3px 8px;border-radius:4px;border:2px solid #27ae60;font-size:11px;"><input type="radio" name="mtr'+ci+'" value="theirs"> <span style="color:#27ae60;font-weight:bold;">Collega</span></label>'
                    +'</div></div>';
            }).join('');
        }
        if(!html)html='<p style="color:#27ae60;font-size:12px;">Nessun conflitto.</p>';
        confEl.innerHTML=html;
    }
}
function tcpApplyMergePairsModal(){
    if(!_mergePayload)return;
    var autoPublish=_mergePayload.autoPublish||false;
    var pD=_mergePayload.pairs||_mergePayload;
    var tD=_mergePayload.tratte||{toAdd:[],conflicts:[]};
    var rD=_mergePayload.tariffario||{toAdd:[],conflicts:[]};
    // Pairs
    var pRes=(pD.conflicts||[]).map(function(cf,ci){
        if(cf.autoChoice)return{ex:cf.ex,inc:cf.inc,choice:cf.autoChoice};
        var sel=document.querySelector('input[name="mpc'+ci+'"]:checked');
        return{ex:cf.ex,inc:cf.inc,choice:sel?sel.value:'mine'};
    });
    tcpApplyMergePairs(pD.toAdd||[],pRes);
    tcpRefresh();
    // Tratte
    var tratte=[];try{tratte=JSON.parse(localStorage.getItem('tcp_tratte')||'[]');}catch(e){}
    (tD.toAdd||[]).forEach(function(t){tratte.push(t);});
    (tD.conflicts||[]).forEach(function(cf,ci){
        var sel=document.querySelector('input[name="mtc'+ci+'"]:checked');
        if(sel&&sel.value==='theirs'){var ex=tratte.find(function(x){return x.id===cf.ex.id;});if(ex)ex.km=cf.inc.km;}
    });
    localStorage.setItem('tcp_tratte',JSON.stringify(tratte));
    if(window.tcpRenderTratte)tcpRenderTratte();
    // Tariffario
    var tar=[];try{tar=JSON.parse(localStorage.getItem('tcp_tariffario')||'[]');}catch(e){}
    (rD.toAdd||[]).forEach(function(t){tar.push(t);});
    (rD.conflicts||[]).forEach(function(cf,ci){
        var sel=document.querySelector('input[name="mtr'+ci+'"]:checked');
        if(sel&&sel.value==='theirs'){var ex=tar.find(function(x){return x.km===cf.ex.km;});if(ex){ex.c20=cf.inc.c20;ex.c40=cf.inc.c40;}}
    });
    localStorage.setItem('tcp_tariffario',JSON.stringify(tar));
    _mergePayload=null;
    var srEl=document.getElementById('sr-conflicts');
    if(srEl)srEl.innerHTML="<p style='color:#27ae60;font-size:12px;padding:20px;text-align:center;'>&#10003; Sync applicato.</p>";
    var srSum=document.getElementById('sr-summary');
    if(srSum)srSum.textContent='';
    if(autoPublish){setTimeout(function(){tcpPublishGist();},400);}
}
function tcpCloseMergePairsModal(){
    _mergePayload=null;
    var srEl=document.getElementById('sr-conflicts');
    if(srEl)srEl.innerHTML="<p style='color:#aaa;font-size:12px;padding:20px;text-align:center;'>Sync annullato.</p>";
    var srSum=document.getElementById('sr-summary');
    if(srSum)srSum.textContent='';
}

function cleanExpired(){
    const today=new Date();today.setHours(0,0,0,0);
    const monStart=monday(0);
    sp(lp().filter(p=>{const d=pd(p.exp.delivery);return!d||d>=monStart;}));
    const h24=24*60*60*1000;
    const h5d=5*h24;
    const orders=lo().filter(o=>{
        if(o.missing&&o.missingFrom&&(Date.now()-o.missingFrom)>h24)return false;
        if(o.manual){
            const d=pd(o.delivery);
            if(d&&(today-d)>h5d)return false;
        }
        return true;
    });
    so(orders);
    // Pulizia resolved conflicts (10gg)
    (function(){
        var resolved=[];
        try{resolved=JSON.parse(localStorage.getItem('tcp_resolved_conflicts')||'[]');}catch(e){}
        var h10d=10*24*60*60*1000;
        resolved=resolved.filter(function(r){
            return !r.at||(Date.now()-new Date(r.at).getTime())<h10d;
        });
        localStorage.setItem('tcp_resolved_conflicts',JSON.stringify(resolved));
    })();
    // Pulizia removed_pairs (14gg)
    (function(){
        var removed=[];
        try{removed=JSON.parse(localStorage.getItem('tcp_removed_pairs')||'[]');}catch(e){}
        var h14d=14*24*60*60*1000;
        removed=removed.filter(function(r){
            if(typeof r==='string')return true; // retrocompatibilità
            return !r.at||(Date.now()-new Date(r.at).getTime())<h14d;
        });
        localStorage.setItem('tcp_removed_pairs',JSON.stringify(removed));
    })();
    // Pulizia alerts scaduti (7gg dopo exp.delivery)
    (function(){
        var alerts={};
        try{alerts=JSON.parse(localStorage.getItem('tcp_pair_alerts')||'{}');}catch(e){}
        var pairs=ls.pairs();
        var h7d=7*24*60*60*1000;
        Object.keys(alerts).forEach(function(key){
            var p=pairs[parseInt(key)];
            if(!p){delete alerts[key];return;}
            var de=pd(p.exp.delivery);
            if(de&&(Date.now()-de.getTime())>h7d)delete alerts[key];
        });
        localStorage.setItem('tcp_pair_alerts',JSON.stringify(alerts));
    })();
}

// ── PLANNER render ──

var TCP_TAPPE=['Livorno','La Spezia','Arezzo','Tortona','Genova'];
function tcpGetTappe(){var c=[];try{c=JSON.parse(localStorage.getItem('tcp_tappe_custom')||'[]');}catch(e){}return TCP_TAPPE.concat(c.filter(function(x){return TCP_TAPPE.indexOf(x)<0;}));}
function tcpIsWeekend(p){var di=pd(p.imp.delivery);var de=pd(p.exp.delivery);if(!di||!de)return false;return di.getDay()===5&&de.getDay()===1;}
function tcpOpenTappa(i){
    var p=lp()[i];if(!p)return;
    var tappe=tcpGetTappe();
    var cur=p.tappa||'';
    // Rimuovi modal esistente
    var old=document.getElementById('tcp-tappa-modal');if(old)old.remove();
    // Overlay
    var ov=document.createElement('div');
    ov.id='tcp-tappa-modal';
    ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
    // Box
    var box=document.createElement('div');
    box.style.cssText='background:white;border-radius:10px;padding:20px;min-width:320px;max-width:380px;box-shadow:0 4px 30px rgba(0,0,0,.3);';
    // Titolo
    var titolo=document.createElement('div');
    titolo.style.cssText='font-weight:bold;color:#e07b00;font-size:14px;margin-bottom:12px;';
    titolo.textContent='⚑ Tappa intermedia';
    box.appendChild(titolo);
    // Bottoni tappe
    var btnRow=document.createElement('div');
    btnRow.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;';
    tappe.forEach(function(t){
        var b=document.createElement('button');
        b.textContent=t;
        b.style.cssText='padding:6px 14px;border-radius:5px;border:none;cursor:pointer;font-size:13px;'+(cur===t?'background:#1a7a1a;color:white;font-weight:bold;':'background:#eee;color:#333;');
        b.onclick=function(){tcpSetTappa(i,t);};
        btnRow.appendChild(b);
    });
    box.appendChild(btnRow);
    // Aggiungi nuova tappa
    var addRow=document.createElement('div');
    addRow.style.cssText='display:flex;gap:6px;margin-bottom:12px;';
    var inp=document.createElement('input');
    inp.id='tcp-tappa-new';
    inp.placeholder='Aggiungi nuova...';
    inp.style.cssText='flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:12px;';
    var addBtn=document.createElement('button');
    addBtn.textContent='+';
    addBtn.style.cssText='background:#002856;color:white;border:none;border-radius:5px;padding:6px 10px;cursor:pointer;font-size:13px;font-weight:bold;';
    addBtn.onclick=function(){
        var val=inp.value.trim();if(!val)return;
        var cc=[];try{cc=JSON.parse(localStorage.getItem('tcp_tappe_custom')||'[]');}catch(e){}
        if(cc.indexOf(val)<0){cc.push(val);localStorage.setItem('tcp_tappe_custom',JSON.stringify(cc));}
        tcpSetTappa(i,val);
    };
    addRow.appendChild(inp);addRow.appendChild(addBtn);
    box.appendChild(addRow);
    // Riga bottoni azione
    var actRow=document.createElement('div');
    actRow.style.cssText='display:flex;gap:8px;';
    if(cur){
        var rmBtn=document.createElement('button');
        rmBtn.textContent='✖ Rimuovi tappa';
        rmBtn.style.cssText='background:#c00;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-size:12px;';
        rmBtn.onclick=function(){tcpSetTappa(i,'');};
        actRow.appendChild(rmBtn);
    }
    var closeBtn=document.createElement('button');
    closeBtn.textContent='Chiudi';
    closeBtn.style.cssText='background:#aaa;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-size:12px;margin-left:auto;';
    closeBtn.onclick=function(){ov.remove();};
    actRow.appendChild(closeBtn);
    box.appendChild(actRow);
    ov.appendChild(box);
    // Chiudi cliccando fuori
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){inp.focus();},50);
}
function tcpSetTappa(i,val){
    var pairs=lp();var p=pairs[i];if(!p)return;
    if(p.tappa!==val){
        // tappa cambiata: azzera km/costo per forzare ricerca nuova tratta
        p.km=0;p.costoGrezzo=0;
    }
    p.tappa=val;
    sp(pairs);
    var old=document.getElementById('tcp-tappa-modal');if(old)old.remove();
    rPairs();
}

function rPlanner(){
    const tbody=document.getElementById('pl-tbody');if(!tbody)return;
    const mon=monday(plOff);
    const today=new Date();today.setHours(0,0,0,0);
    document.getElementById('wklbl').textContent='Settimana '+wkNum(mon)+' — '+mon.getFullYear();
    const badge=document.getElementById('wk-badge');
    if(badge)badge.style.display=plOff===0?'inline':'none';
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);sun.setHours(23,59,59,999);
    const wkPairs=lp().filter(p=>{const d=pd(p.imp.delivery);return d&&d>=mon&&d<=sun;});
    const counter=document.getElementById('wk-counter');
    if(counter){
        if(wkPairs.length){counter.textContent='🔗 '+wkPairs.length+(wkPairs.length===1?' riutilizzo':' riutilizzi');counter.style.display='inline';}
        else counter.style.display='none';
    }
    const DAYS=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
    const days=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
    const hr=document.getElementById('pl-head');
    if(hr)hr.innerHTML=days.map(d=>'<th style="width:14.28%;"><span class="dn">'+d.getDate()+'/'+(d.getMonth()+1).toString().padStart(2,'0')+'</span>'+DAYS[d.getDay()===0?6:d.getDay()-1]+'</th>').join('');
    const allPairs=lp();
    const pairs=allPairs.filter(p=>{const di=pd(p.imp.delivery),de=pd(p.exp.delivery);return(di&&di>=mon&&di<=sun)||(de&&de>=mon&&de<=sun);});
    if(!pairs.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:#aaa;padding:30px;">Nessun abbinamento in questa settimana</td></tr>';return;}
    // Ordina: span minore → va in slot per primo (riempie i buchi),
    // a parità di span: start date crescente
    pairs.sort((a,b)=>{
        const diA=pd(a.imp.delivery),deA=pd(a.exp.delivery);
        const diB=pd(b.imp.delivery),deB=pd(b.exp.delivery);
        const iA=diA?days.findIndex(d=>sameDay(d,diA)):-1;
        const eA=deA?days.findIndex(d=>sameDay(d,deA)):-1;
        const iB=diB?days.findIndex(d=>sameDay(d,diB)):-1;
        const eB=deB?days.findIndex(d=>sameDay(d,deB)):-1;
        const spanA=(iA>=0&&eA>=0)?Math.abs(eA-iA):1;
        const spanB=(iB>=0&&eB>=0)?Math.abs(eB-iB):1;
        if(spanA!==spanB)return spanA-spanB;
        const startA=iA>=0?iA:(eA>=0?eA:7);
        const startB=iB>=0?iB:(eB>=0?eB:7);
        return startA-startB;
    });
    const slotOcc=[];
    pairs.forEach(p=>{
        const di=pd(p.imp.delivery),de=pd(p.exp.delivery);
        const iDay=di?days.findIndex(d=>sameDay(d,di)):-1;
        const eDay=de?days.findIndex(d=>sameDay(d,de)):-1;
        let s=0;
        while(true){
            if(!slotOcc[s])slotOcc[s]=new Set();
            const iOk=iDay<0||!slotOcc[s].has(iDay);
            const eOk=eDay<0||!slotOcc[s].has(eDay);
            if(iOk&&eOk)break;
            s++;
        }
        if(!slotOcc[s])slotOcc[s]=new Set();
        if(iDay>=0)slotOcc[s].add(iDay);
        if(eDay>=0)slotOcc[s].add(eDay);
        p._slot=s;
    });
    const maxSlot=Math.max(...pairs.map(p=>p._slot||0));
    const rows=[];
    for(let s=0;s<=maxSlot;s++){
        const cells=days.map((d,dayIdx)=>{
            const pInCell=pairs.filter(p=>p._slot===s&&(sameDay(d,pd(p.imp.delivery))||sameDay(d,pd(p.exp.delivery))));
            const isT=sameDay(d,today);
            let html='';
            // Card tappa giorni intermedi
            pairs.filter(function(pp){return pp._slot===s&&pp.tappa;}).forEach(function(pp){
                var _di=pd(pp.imp.delivery),_de=pd(pp.exp.delivery);
                if(!_di||!_de)return;
                if(!(d>_di&&d<_de&&!sameDay(d,_di)&&!sameDay(d,_de)))return;
                var _gi=allPairs.indexOf(pp);
                var _pal=PAL[pp.imp.carrier]||['#ddd'];
                var _bg=_pal[_gi%_pal.length];
                var _badge='<span style="background:rgba(0,0,0,.25);color:white;border-radius:50%;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;margin-right:2px;">'+(_gi+1)+'</span>';
                var _carr='<span style="float:right;font-size:9px;font-weight:bold;opacity:.8;margin-left:3px;">'+pp.imp.carrier+'</span>';
                var _nextDay=new Date(_de.getTime());_nextDay.setDate(_de.getDate()-1);
                var _isDomVigilia=sameDay(d,_nextDay);
                var _dest=_isDomVigilia?('<div style="font-size:10px;font-weight:bold;color:#005580;margin-top:2px;">→ '+pp.exp.address+'</div><div style="font-size:9px;color:#1a5c1a;">'+portA(pp.exp.port)+'</div>')  :'';
                html+='<div class="pc" style="background:'+_bg+'44;color:#333;border:2px dashed '+_bg+';">'  +_carr+'<div style="display:flex;align-items:center;">'+_badge+'<b style="font-size:10px;">⚑ '+pp.tappa+'</b></div><div style="font-size:9px;color:#555;">ferma</div>'+_dest+'</div>';
            });
            pInCell.forEach(p=>{
                const globalI=allPairs.indexOf(p);
                const pal=PAL[p.imp.carrier]||['#ddd'];
                const bg=pal[globalI%pal.length];
                const badge='<span style="background:rgba(0,0,0,.25);color:white;border-radius:50%;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;margin-right:2px;">'+(globalI+1)+'</span>';
                const di=pd(p.imp.delivery),de=pd(p.exp.delivery);
                const isI=sameDay(d,di),isE=sameDay(d,de),both=isI&&isE;
                const carr='<span style="float:right;font-size:9px;font-weight:bold;opacity:.8;margin-left:3px;">'+p.imp.carrier+'</span>';
                if(both)html+='<div class="pc" style="background:'+bg+';color:#002856;border:2px solid '+bg+'aa;overflow:hidden;">'+carr+'<div style="display:flex;align-items:center;">'+badge+'<b style="font-size:9px;">📥 IMP</b></div><div style="font-size:12px;font-weight:bold;">'+p.imp.cont+'</div><div style="font-size:11px;font-weight:bold;">'+p.imp.address+'</div><div style="font-size:10px;font-weight:bold;color:#005580;">'+portA(p.imp.port)+'</div><div style="border-top:2px dashed rgba(0,0,0,.2);margin:4px 0;"></div><div style="display:flex;align-items:center;"><b style="font-size:9px;">📤 EXP</b></div><div style="font-size:12px;font-weight:bold;">'+p.exp.cont+'</div><div style="font-size:11px;font-weight:bold;">'+p.exp.address+'</div><div style="font-size:10px;font-weight:bold;color:#1a5c1a;">'+portA(p.exp.port)+'</div></div>';
                else if(isI)html+='<div class="pc" style="background:'+bg+';color:#002856;overflow:visible;border-right:4px solid '+bg+';position:relative;">'+carr+'<div style="display:flex;align-items:center;">'+badge+'<b style="font-size:9px;">📥 IMP</b></div><div style="font-size:12px;font-weight:bold;">'+p.imp.cont+'</div><div style="font-size:11px;font-weight:bold;">'+p.imp.address+'</div><div style="font-size:10px;font-weight:bold;color:#005580;">'+portA(p.imp.port)+'</div><div style="position:absolute;right:-10px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:8px solid transparent;border-bottom:8px solid transparent;border-left:10px solid '+bg+';z-index:5;"></div></div>';
                else if(isE){var _vt=p.tappa?'<div style="font-size:9px;color:#1a7a1a;font-weight:bold;">⚑ via '+p.tappa+'</div>':'';html+='<div class="pc" style="background:'+bg+'bb;color:#002856;border-left:4px solid '+bg+';overflow:visible;position:relative;">'+carr+'<div style="position:absolute;left:-10px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:8px solid transparent;border-bottom:8px solid transparent;border-right:10px solid '+bg+';z-index:5;"></div><div style="display:flex;align-items:center;">'+badge+'<b style="font-size:9px;">📤 EXP</b></div><div style="font-size:12px;font-weight:bold;">'+p.exp.cont+'</div>'+_vt+'<div style="font-size:11px;font-weight:bold;">'+p.exp.address+'</div><div style="font-size:10px;font-weight:bold;color:#1a5c1a;">'+portA(p.exp.port)+'</div></div>';}
            });
            return'<td'+(isT?' class="today"':'')+'>'+html+'</td>';
        }).join('');
        rows.push('<tr>'+cells+'</tr>');
    }
    tbody.innerHTML=rows.join('');
}
function applyShowOnly(){
    const carriers=[...document.querySelectorAll('.fs-c:checked')].map(x=>x.value);
    const conts=[...document.querySelectorAll('.fs-co:checked')].map(x=>x.value);
    const traffics=[...document.querySelectorAll('.fs-t:checked')].map(x=>x.value.toLowerCase());
    const ports=[...document.querySelectorAll('.fs-p:checked')].map(x=>x.value.toLowerCase());
    const onlyHl=document.getElementById('fs-hl')?.checked||false;
    const rtChecked=document.getElementById('toggle-rt')?.checked!==false;
    const orders=lo();
    const rows=[...document.querySelectorAll('#tbody tr[data-id]')];
    rows.forEach(r=>{
        const noFilter=!carriers.length&&!conts.length&&!traffics.length&&!ports.length&&!onlyHl;
        if(noFilter){r.style.display=rtChecked||r.dataset.rt!=='1'?'':'none';return;}
        const c=r.dataset.carrier||'';
        const co=r.dataset.cont||'';
        const t=(r.dataset.traffic||'').toLowerCase();
        const portTxt=r.dataset.port||'';
        const okC=!carriers.length||carriers.includes(c);
        const okCo=!conts.length||conts.includes(co);
        const okT=!traffics.length||traffics.includes(t);
        const okP=!ports.length||ports.some(p=>portTxt.includes(p));
        const okHl=!onlyHl||orders.find(function(o){return o.id===r.dataset.id&&o.highlighted;});
        const okRT=rtChecked||r.dataset.rt!=='1';
        r.style.display=(okC&&okCo&&okT&&okP&&okHl&&okRT)?'':'none';
    });
    if(typeof updCounter==='function')updCounter();
}

function tcpKmBadge(p,i){
    var km=p.km||0;
    var fuel=parseFloat(localStorage.getItem('tcp_fuel')||'0');
    var tipo=p.imp.cont==="20'"?'c20':'c40';
    var tar=[]; try{tar=JSON.parse(localStorage.getItem('tcp_tariffario')||'[]');}catch(e){}
    var fromArchivio=false;
    if(!km){
        var tratte=[]; try{tratte=JSON.parse(localStorage.getItem('tcp_tratte')||'[]');}catch(e){}
        var tid=[p.imp.port,p.imp.address,p.tappa||'',p.exp.address,p.exp.port].join('||');
        var tratta=tratte.find(function(x){return x.id===tid;});
        if(!tratta){
            var impAliases=tcpResolviAlias(p.imp.address||'');
            var expAliases=tcpResolviAlias(p.exp.address||'');
            for(var _ia=0;_ia<impAliases.length&&!tratta;_ia++){
                for(var _ea=0;_ea<expAliases.length&&!tratta;_ea++){
                    var _tid=[p.imp.port,impAliases[_ia],p.tappa||'',expAliases[_ea],p.exp.port].join('||');
                    tratta=tratte.find(function(x){return x.id===_tid;});
                }
            }
        }
        if(tratta&&tratta.km){km=tratta.km;fromArchivio=true;}
    }
    var r=tar.find(function(x){return x.km===km;})||{};
    var grezzo=p.costoGrezzo||(r[tipo]||0);
    var ex=tcpCalcExtra(p);
    var html='';
    if(km) html+='<span style="font-size:11px;font-weight:bold;color:#002856;margin-right:3px;">'+km+' km</span>';
    if(grezzo){
        var conFuel=Math.round(grezzo*(1+fuel/100));
        var totale=conFuel+ex.extra;
        var cs=fromArchivio?'color:#c47a00;':'color:#1a5c1a;';
        if(ex.extra>0){
            html+='<span style="font-size:11px;font-weight:bold;'+cs+'margin-right:2px;">€ '+conFuel+'</span>';
            html+='<span style="font-size:10px;color:#888;margin-right:2px;" title="'+ex.label+'">+€ '+ex.extra+'</span>';
            html+='<span style="font-size:11px;color:#555;margin-right:3px;">=</span>';
            html+='<span style="font-size:12px;font-weight:bold;color:#8b1a1a;margin-right:3px;">€ '+totale+'</span>';
        } else {
            html+='<span style="font-size:11px;font-weight:bold;'+cs+'margin-right:3px;">€ '+conFuel+'</span>';
        }
        if(fromArchivio) html+='<span style="font-size:9px;color:#8b1a1a;margin-right:3px;">(arch.)</span>';
    }
    html+='<button onclick="tcpOpenKm('+i+')" style="background:#5b7fa6;color:white;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:10px;margin-right:3px;" title="Km e costi">🚚</button>';
    var _tw=tcpIsWeekend(p);
    var _th=p.tappa?'#1a7a1a':(_tw?'#c4a800':'#888');
    var _tt=p.tappa?('Tappa: '+p.tappa):(_tw?'Riutilizzo weekend - imposta tappa':'Tappa intermedia');
    var _tl=p.tappa?('&#9873; '+p.tappa):'&#9873;';
    html+='<button onclick="tcpOpenTappa('+i+')" style="background:'+_th+';color:white;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:10px;margin-right:3px;" title="'+_tt+'">'+_tl+'</button>';

    return html;
}
function plPrev(){plOff--;rPlanner();}
function plNext(){plOff++;rPlanner();}
function plNow(){plOff=0;rPlanner();}

function tcpSearchViaggi(q){
    var s=q.trim().toLowerCase();
    document.querySelectorAll('#tbody tr[data-id]').forEach(function(r){
        r.style.display=(!s||r.innerText.toLowerCase().indexOf(s)>-1)?'':'none';
    });
    updCounter();
}
function updCounter(){
    var rows=[...document.querySelectorAll('#tbody tr[data-id]')];
    var visible=rows.filter(function(r){
        if(r.style.display==='none')return false;
        var op=parseFloat(r.style.opacity||'1');
        return op>=0.9;
    }).length;
    var el=document.getElementById('visible-count');
    if(el)el.textContent='Mostrati: '+visible+' / '+rows.length;
}
var _kmIdx=null;
function tcpOpenKm(i){
    _kmIdx=i;
    var p=lp()[i];if(!p)return;
    var km=p.km||0;
    var ki=document.getElementById('tcp-km-modal-km');
    if(ki)ki.value=km||'';
    var m=document.getElementById('tcp-km-modal');
    if(m)m.style.display='flex';
    setTimeout(function(){if(ki)ki.focus();},50);
}
function tcpSaveKm(i){
    if(i===undefined||i===null)i=_kmIdx;
    var ki=document.getElementById('tcp-km-modal-km');
    if(!ki)return;
    var km=parseInt(ki.value)||0;
    var pairs=lp();var p=pairs[i];if(!p)return;
    p.km=km;sp(pairs);
    if(km>0){
        var tratte=[];try{tratte=JSON.parse(localStorage.getItem('tcp_tratte')||'[]');}catch(e){}
        var tid=[p.imp.port,p.imp.address,p.tappa||'',p.exp.address,p.exp.port].join('||');
        var ex=tratte.find(function(x){return x.id===tid;});
        if(ex){ex.km=km;}
        else{tratte.push({id:tid,portoImp:p.imp.port,scarico:p.imp.address,tappa:p.tappa||'',carico:p.exp.address,portoExp:p.exp.port,km:km});}
        localStorage.setItem('tcp_tratte',JSON.stringify(tratte));
    }
    var m=document.getElementById('tcp-km-modal');if(m)m.style.display='none';
    rPairs();
    if(window.tcpRenderTratte)tcpRenderTratte();
}

var _aliasSelected = [];
function tcpSelAlias(btn) {
    var tipo = btn.dataset.tipo;
    var loc = btn.dataset.v;
    // Controlla se gia selezionato
    var idx = window._aliasSelected.findIndex(function(x){ return x.loc === loc; });
    if (idx >= 0) {
        // Deseleziona
        window._aliasSelected.splice(idx, 1);
        btn.style.background = tipo === 'I' ? '#e8f0fa' : '#e8f4ee';
        btn.style.color = tipo === 'I' ? '#002856' : '#1a5c1a';
    } else {
        // Seleziona
        window._aliasSelected.push({tipo: tipo, loc: loc});
        btn.style.background = tipo === 'I' ? '#002856' : '#1a5c1a';
        btn.style.color = 'white';
    }
    // Mostra/nascondi bottone Crea Alias
    var bar = document.getElementById('alias-bar');
    if (bar) {
        if (window._aliasSelected.length >= 2) {
            bar.style.display = 'flex';
            var lbl = document.getElementById('alias-sel-count');
            if (lbl) lbl.textContent = window._aliasSelected.length + ' localita selezionate';
        } else {
            bar.style.display = 'none';
        }
    }
};
function tcpClearAliasSelection() {
    _aliasSelected = [];
    // Ripristina tutti i bottoni
    document.querySelectorAll('[onclick*="tcpSelAlias"]').forEach(function(btn) {
        var isI = btn.innerText === 'I';
        btn.style.background = isI ? '#e8f0fa' : '#e8f4ee';
        btn.style.color = isI ? '#002856' : '#1a5c1a';
    });
    var bar = document.getElementById('alias-bar');
    if (bar) bar.style.display = 'none';
};
function tcpOpenCreaAlias() {
    if (window._aliasSelected.length < 2) return;
    var nome = prompt('Nome alias (es. Pistrino):');
    if (!nome || !nome.trim()) return;
    nome = nome.trim();
    var alias = [];
    try { alias = JSON.parse(localStorage.getItem('tcp_tratte_alias') || '[]'); } catch(e) {}
    // Cerca alias esistente con stesso nome
    var ex = alias.find(function(a){ return a.nome.toLowerCase() === nome.toLowerCase(); });
    if (ex) {
        // Aggiungi localita mancanti
        window._aliasSelected.forEach(function(s){
            if (!ex.indirizzi.includes(s.loc)) ex.indirizzi.push(s.loc);
        });
    } else {
        alias.push({ nome: nome, indirizzi: window._aliasSelected.map(function(s){ return s.loc; }) });
    }
    localStorage.setItem('tcp_tratte_alias', JSON.stringify(alias));
    window.tcpClearAliasSelection();
    tcpRenderAlias();
    alert('Alias "' + nome + '" salvato con ' + alias.find(function(a){return a.nome.toLowerCase()===nome.toLowerCase();}).indirizzi.length + ' localita.');
}

function tcpAddToAlias(i){
    if(!_aliasSelected||!_aliasSelected.length){alert('Seleziona prima una o piu localita con i bottoni [I] o [E] nelle tratte qui sopra.');return;}
    var alias=[];try{alias=JSON.parse(localStorage.getItem('tcp_tratte_alias')||'[]');}catch(e){}
    if(!alias[i])return;
    var aggiunti=0;
    _aliasSelected.forEach(function(s){
        if(alias[i].indirizzi.indexOf(s.loc)<0){alias[i].indirizzi.push(s.loc);aggiunti++;}
    });
    localStorage.setItem('tcp_tratte_alias',JSON.stringify(alias));
    tcpClearAliasSelection();
    tcpRenderAlias();
    alert('Aggiunte '+aggiunti+' localita all alias "'+alias[i].nome+'".');
}
function tcpRenderAlias(){
    var el=document.getElementById('alias-list-section');
    if(!el)return;
    var alias=[];try{alias=JSON.parse(localStorage.getItem('tcp_tratte_alias')||'[]');}catch(e){}
    if(!alias.length){el.innerHTML='';return;}
    var html='<div style="background:#fffbe6;border:1px solid #f0c040;border-radius:5px;padding:8px 12px;">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
        +'<b style="font-size:11px;color:#c47a00;">Alias salvati ('+alias.length+')</b>'
        +'<button onclick="document.getElementById(&quot;t-tratte&quot;).scrollTop=0" style="background:#888;color:white;border:none;border-radius:4px;padding:2px 9px;cursor:pointer;font-size:11px;">&#8593; Su</button>'
        +'</div>'
        +'<div style="font-size:10px;color:#888;margin-bottom:6px;">Seleziona [I] o [E] da una tratta, poi clicca + Agg. per espandere un alias.</div>';
    alias.forEach(function(a,i){
        html+='<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;border-bottom:1px solid #f0e0a0;flex-wrap:wrap;">'
            +'<b style="color:#002856;min-width:80px;">'+a.nome+'</b>'
            +'<span style="color:#555;flex:1;">'+a.indirizzi.join(' | ')+'</span>'
            +'<button onclick="tcpAddToAlias('+i+')" style="background:#1a65b8;color:white;border:none;border-radius:3px;padding:1px 7px;cursor:pointer;font-size:10px;flex-shrink:0;">+ Agg.</button>'
            +'<button onclick="tcpDelAlias('+i+')" style="background:#a93226;color:white;border:none;border-radius:3px;padding:1px 7px;cursor:pointer;font-size:10px;flex-shrink:0;">X</button>'
            +'</div>';
    });
    html+='</div>';
    el.innerHTML=html;
}
function tcpDelAlias(i){
    var alias=[];try{alias=JSON.parse(localStorage.getItem('tcp_tratte_alias')||'[]');}catch(e){}
    alias.splice(i,1);
    localStorage.setItem('tcp_tratte_alias',JSON.stringify(alias));
    tcpRenderAlias();
}

function tcpDeleteTratta(id){
    var tratte=[];try{tratte=JSON.parse(localStorage.getItem('tcp_tratte')||'[]');}catch(e){}
    var t=tratte.find(function(x){return x.id===id;});
    var msg=t?('Eliminare tratta: '+t.scarico+' - '+t.carico+' ('+t.km+' km)?'):'Eliminare questa tratta?';
    if(!confirm(msg))return;
    localStorage.setItem('tcp_tratte',JSON.stringify(tratte.filter(function(x){return x.id!==id;})));
    if(window.tcpRenderTratte)tcpRenderTratte();
}
function tcpFuelChange(v){
    localStorage.setItem('tcp_fuel',String(parseFloat(v)||0));
    var n=document.getElementById('fuel-note');
    if(n){n.textContent='Salvato';setTimeout(function(){if(n)n.textContent='';},2000);}
    var fuel=parseFloat(v)||0;
    var tar=[];try{tar=JSON.parse(localStorage.getItem('tcp_tariffario')||'[]');}catch(e){}
    tar.forEach(function(r){
        ['c20','c40'].forEach(function(tipo){
            var cell=document.getElementById('tf-'+r.km+'-'+tipo);
            if(!cell)return;
            var g=r[tipo]||0;
            cell.textContent=g?('\u20ac '+Math.round(g*(1+fuel/100))):'\u2014';
        });
    });
}
function tcpTarUpdate(inp){
    var km=parseInt(inp.dataset.km);
    var tipo=inp.dataset.tipo;
    var val=parseFloat(inp.value)||0;
    var tar=[];try{tar=JSON.parse(localStorage.getItem('tcp_tariffario')||'[]');}catch(e){}
    var r=tar.find(function(x){return x.km===km;});
    if(!r){r={km:km,c20:0,c40:0};tar.push(r);}
    r[tipo]=val;
    localStorage.setItem('tcp_tariffario',JSON.stringify(tar));
    var fuel=parseFloat(localStorage.getItem('tcp_fuel')||'0');
    var cell=document.getElementById('tf-'+km+'-'+tipo);
    if(cell)cell.textContent=val?('\u20ac '+Math.round(val*(1+fuel/100))):'\u2014';
}
function tcpCalcRapido(v){
    var km=parseInt(v);
    var r20=document.getElementById('calc-r20');
    var r40=document.getElementById('calc-r40');
    if(!r20||!r40)return;
    if(!km||km<100||km>1500){r20.textContent='\u2014';r40.textContent='\u2014';return;}
    var tar=[];try{tar=JSON.parse(localStorage.getItem('tcp_tariffario')||'[]');}catch(e){}
    var r=tar.find(function(x){return x.km===km;})||{};
    var fuel=parseFloat(localStorage.getItem('tcp_fuel')||'0');
    r20.textContent=r.c20?('\u20ac '+Math.round(r.c20*(1+fuel/100))):'\u2014';
    r40.textContent=r.c40?('\u20ac '+Math.round(r.c40*(1+fuel/100))):'\u2014';
}
function tcpGetAddizionali(){
    try{return JSON.parse(localStorage.getItem('tcp_addizionali')||'null');}catch(e){}
    return null;
}
function tcpDefaultAddizionali(){
    return {
        stessoGiorno:   {base:100, hc:30},
        giornoSucc:     {base:100, notte:30, hc:30},
        weekend:        {base:50,  hc:30},
        altri:          {base:50,  hc:30}
    };
}
function tcpSaveAddizionali(){
    var a={
        stessoGiorno: {
            base: parseFloat(document.getElementById('add-sg-base').value)||0,
            hc:   parseFloat(document.getElementById('add-sg-hc').value)||0
        },
        giornoSucc: {
            base:  parseFloat(document.getElementById('add-gd-base').value)||0,
            notte: parseFloat(document.getElementById('add-gd-sosta').value)||0,
            hc:    parseFloat(document.getElementById('add-gd-hc').value)||0
        },
        weekend: {
            base: parseFloat(document.getElementById('add-we-base').value)||0,
            hc:   parseFloat(document.getElementById('add-we-hc').value)||0
        },
        altri: {
            base: parseFloat(document.getElementById('add-al-base').value)||0,
            hc:   parseFloat(document.getElementById('add-al-hc').value)||0
        }
    };
    localStorage.setItem('tcp_addizionali',JSON.stringify(a));
    var n=document.getElementById('add-note');
    if(n){n.textContent='Salvato';setTimeout(function(){if(n)n.textContent='';},2000);}
    rPairs();
}
function tcpCalcExtra(p){
    var a=tcpGetAddizionali()||tcpDefaultAddizionali();
    var isHC=p.imp.cont==='40HC';
    var di=pd(p.imp.delivery);
    var de=pd(p.exp.delivery);
    if(!di||!de) return {extra:0,label:'',scenario:''};
    var diffDays=Math.round((de-di)/(1000*60*60*24));
    var diDay=di.getDay(); // 0=dom,5=ven,1=lun
    var deDay=de.getDay();
    var scenario, cfg;
    if(diffDays===0){
        scenario='Stesso giorno'; cfg=a.stessoGiorno;
        var extra=cfg.base+(isHC?cfg.hc:0);
        var label='stesso giorno: +€'+cfg.base+(isHC?' +€'+cfg.hc+' HC':'');
        return {extra:extra,label:label,scenario:scenario};
    }
    if(diDay===5&&deDay===1&&diffDays===3){
        scenario='Weekend (ven→lun)'; cfg=a.weekend;
        var extra=cfg.base+(isHC?cfg.hc:0);
        var label='weekend: +€'+cfg.base+(isHC?' +€'+cfg.hc+' HC':'');
        return {extra:extra,label:label,scenario:scenario};
    }
    if(diffDays===1){
        scenario='Giorno successivo'; cfg=a.giornoSucc;
        var extra=cfg.base+(cfg.notte||cfg.sosta||0)+(isHC?cfg.hc:0);
        var label='giorno succ.: +€'+cfg.base+' +€'+(cfg.notte||cfg.sosta||0)+' notte'+(isHC?' +€'+cfg.hc+' HC':'');
        return {extra:extra,label:label,scenario:scenario};
    }
    scenario='Altri'; cfg=a.altri;
    var extra=cfg.base+(isHC?cfg.hc:0);
    var label='altri: +€'+cfg.base+(isHC?' +€'+cfg.hc+' HC':'');
    return {extra:extra,label:label,scenario:scenario};
}
function tcpFiltraTratte(q){
    var s=(q||"").toLowerCase().trim();
    var items=document.querySelectorAll("#tratte-content > div, #tratte-content > table");
    items.forEach(function(el){
        el.style.display=(!s||el.innerText.toLowerCase().indexOf(s)>-1)?"":"none";
    });
}
function tcpToggleRT(){
    var chk=document.getElementById('toggle-rt');
    var show=chk?chk.checked:true;
    document.querySelectorAll('#tbody tr[data-id]').forEach(function(r){
        if(r.dataset.rt==='1'&&!show)r.style.display='none';
        else if(r.dataset.rt==='1')r.style.display='';
    });
}
function tcpPairTitle(dl,count){
    const today=new Date();today.setHours(0,0,0,0);
    var d=pd(dl);var isToday=d&&d.getTime()===today.getTime();
    var badge=isToday?' <span style="background:#f0a500;color:white;border-radius:3px;padding:1px 7px;font-size:10px;font-weight:bold;vertical-align:middle;">OGGI</span>':'';
    return '📅 Riutilizzi del '+dl+' &nbsp;·&nbsp; <span style="color:#555;font-weight:normal;font-size:12px;">'+count+(count===1?' abbinamento':' abbinamenti')+'</span>'+badge;
}
// -- CONTROLLO SILENZIOSO GIST COLLEGA --
function tcpSetPairsBadge(nPairs,nTratte){
    nPairs=nPairs||0;nTratte=nTratte||0;
    var tot=nPairs+nTratte;
    // Badge sul tab Riutilizzi
    var btn=document.querySelector('.tb[data-t="pairs"]');
    if(btn){
        var existing=btn.querySelector('.tcp-new-badge');
        if(tot>0){
            if(!existing){
                var badge=document.createElement('span');
                badge.className='tcp-new-badge';
                badge.style.cssText='background:#e74c3c;color:white;border-radius:10px;padding:1px 6px;font-size:9px;font-weight:bold;margin-left:5px;vertical-align:middle;';
                badge.textContent='+'+tot;
                btn.appendChild(badge);
            }else{
                existing.textContent='+'+tot;
            }
        }else{
            if(existing)existing.remove();
        }
    }
    // Widget floating colleghi
    var w=document.getElementById('tcp-colleghi-widget');
    if(tot>0){
        if(!w){
            w=document.createElement('div');
            w.id='tcp-colleghi-widget';
            w.style.cssText='position:fixed;bottom:10px;right:240px;background:#e74c3c;color:white;border-radius:6px;padding:8px 14px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;z-index:9999;box-shadow:0 3px 10px rgba(0,0,0,.3);cursor:pointer;display:flex;align-items:center;gap:8px;';
            var ico=document.createElement('span');ico.textContent='\uD83D\uDD14';ico.style.fontSize='16px';
            var msg=document.createElement('span');msg.id='tcp-colleghi-msg';
            var btnSync=document.createElement('button');
            btnSync.textContent='Sync';
            btnSync.style.cssText='margin-left:8px;background:white;color:#e74c3c;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;font-weight:bold;';
            btnSync.addEventListener('click',function(e){e.stopPropagation();showTab('pairs');tcpSyncAndPublish();});
            var btnClose=document.createElement('button');
            btnClose.textContent='x';
            btnClose.style.cssText='margin-left:4px;background:rgba(255,255,255,.25);color:white;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px;';
            btnClose.addEventListener('click',function(e){e.stopPropagation();w.remove();});
            w.appendChild(ico);w.appendChild(msg);w.appendChild(btnSync);w.appendChild(btnClose);
            document.body.appendChild(w);
        }
        // Build message
        var parts=[];
        if(nPairs>0)parts.push('+'+nPairs+' riutil'+(nPairs===1?'izzo':'izzi'));
        if(nTratte>0)parts.push('+'+nTratte+' tratt'+(nTratte===1?'a':'e'));
        var msgEl=document.getElementById('tcp-colleghi-msg');
        if(msgEl)msgEl.textContent='Collega: '+parts.join(', ');
    }else{
        if(w)w.remove();
    }
}
function tcpCheckCollegaSilent(){
    var tok=localStorage.getItem('tcp_gist_token')||'';
    var gidc=localStorage.getItem('tcp_gist_id_collega')||'';
    if(!tok||!gidc)return;
    fetch('https://api.github.com/gists/'+gidc,{headers:{'Authorization':'Bearer '+tok}})
        .then(function(r){return r.json();})
        .then(function(data){
            if(!data.files)return;
            var newPairs=0,newTratte=0;
            if(data.files['tcp_pairs.json']){
                var pp=JSON.parse(data.files['tcp_pairs.json'].content);
                if(pp.pairs)newPairs=tcpDoMerge(pp.pairs).toAdd.length;
            }
            if(data.files['tcp_tratte.json']){
                var tt=JSON.parse(data.files['tcp_tratte.json'].content);
                if(tt.tratte)newTratte=tcpDoMergeTratte(tt.tratte).toAdd.length;
            }
            tcpSetPairsBadge(newPairs,newTratte);
        })
        .catch(function(){});
}
var _checkCollegaTimer=null;
function tcpStartAutoCheck(intervalMin){
    if(_checkCollegaTimer)clearInterval(_checkCollegaTimer);
    if(!intervalMin||intervalMin<=0)return;
    _checkCollegaTimer=setInterval(function(){
        tcpCheckCollegaSilent();
    },intervalMin*60000);
}
function tcpToast(msg,duration){
    var t=document.getElementById('tcp-toast');
    if(!t){
        t=document.createElement('div');t.id='tcp-toast';
        t.style.cssText='position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#002856;color:white;padding:8px 20px;border-radius:6px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;z-index:99999;box-shadow:0 3px 10px rgba(0,0,0,.3);transition:opacity .4s;pointer-events:none;';
        document.body.appendChild(t);
    }
    t.textContent=msg;t.style.opacity='1';
    clearTimeout(t._timer);
    t._timer=setTimeout(function(){t.style.opacity='0';},duration||4000);
}
function tcpDismissPairAlert(idx,ev){
    if(ev){ev.stopPropagation();ev.preventDefault();}
    var alerts={};
    try{alerts=JSON.parse(localStorage.getItem('tcp_pair_alerts')||'{}');}catch(e){}
    if(alerts[idx]){
        alerts[idx].dismissed=true;
        alerts[idx].dismissedTooltip=alerts[idx].tooltip;
    }
    localStorage.setItem('tcp_pair_alerts',JSON.stringify(alerts));
    rPairs();
}
function tcpSaveFilters(){
    var f={
        c:[...document.querySelectorAll('.fs-c:checked')].map(x=>x.value),
        co:[...document.querySelectorAll('.fs-co:checked')].map(x=>x.value),
        t:[...document.querySelectorAll('.fs-t:checked')].map(x=>x.value),
        p:[...document.querySelectorAll('.fs-p:checked')].map(x=>x.value),
        hl:document.getElementById('fs-hl')?.checked||false,
        rt:document.getElementById('toggle-rt')?.checked!==false
    };
    localStorage.setItem('tcp_saved_filters',JSON.stringify(f));
    var n=document.getElementById('fs-save-note');
    if(n){n.textContent='Salvato';setTimeout(function(){n.textContent='';},2000);}
}
function tcpResetSavedFilters(){
    localStorage.removeItem('tcp_saved_filters');
    document.querySelectorAll('.fs-c,.fs-co,.fs-t,.fs-p').forEach(function(x){x.checked=false;});
    var hl=document.getElementById('fs-hl');if(hl)hl.checked=false;
    var rt=document.getElementById('toggle-rt');if(rt){rt.checked=true;tcpToggleRT();}
    applyShowOnly();
    var n=document.getElementById('fs-save-note');
    if(n){n.textContent='Reset effettuato';setTimeout(function(){n.textContent='';},2000);}
}
function tcpRestoreSavedFilters(){
    var raw=localStorage.getItem('tcp_saved_filters');if(!raw)return;
    try{
        var f=JSON.parse(raw);
        document.querySelectorAll('.fs-c').forEach(function(x){x.checked=(f.c||[]).includes(x.value);});
        document.querySelectorAll('.fs-co').forEach(function(x){x.checked=(f.co||[]).includes(x.value);});
        document.querySelectorAll('.fs-t').forEach(function(x){x.checked=(f.t||[]).includes(x.value);});
        document.querySelectorAll('.fs-p').forEach(function(x){x.checked=(f.p||[]).includes(x.value);});
        var hl=document.getElementById('fs-hl');if(hl)hl.checked=f.hl||false;
        applyShowOnly();
        var rt=document.getElementById('toggle-rt');
        if(rt){rt.checked=f.rt!==false;tcpToggleRT();}
    }catch(e){}
}
document.addEventListener('DOMContentLoaded',()=>{cleanExpired();rPairs();rPlanner();tcpRenderAlias();SC='created';SA=true;sortBy('created');tcpRestoreSavedFilters();setTimeout(updCounter,300);setTimeout(updCounter,800);setTimeout(function(){
        tcpCheckCollegaSilent();
        var _ci=parseInt(localStorage.getItem('tcp_gist_check_interval')||'0');
        if(_ci>0)tcpStartAutoCheck(_ci);
    },3000);});
<\/script>
</head><body style="display:flex;flex-direction:column;height:100vh;overflow:hidden;">

<div class="topbar">
    <h2>🔍 Monitor Nuovi Viaggi</h2>
    <span class="meta">Aggiornato: ${lastUpdate} &nbsp;·&nbsp; ${orders.length} in lista &nbsp;·&nbsp; <b style="color:${newCount>0?'#5dfc82':'#bdf3fc'};">+${newCount} nuovi</b> &nbsp;·&nbsp; Ultimi ${settings.extractVal} ${settings.extractUnit==='days'?'giorni':'ore'}</span>
</div>

<div class="tabbar">
    <button class="tb on" data-t="viaggi" onclick="showTab('viaggi')">📋 Nuovi Viaggi (${orders.length})</button>
    <button class="tb" data-t="pairs" onclick="showTab('pairs')">🔗 Riutilizzi (${pairs.length})</button>
    <button class="tb" data-t="planner" onclick="showTab('planner')">📅 Planner</button>
    <button class="tb" data-t="tratte" onclick="showTab('tratte')">🗺️ Tratte</button>
    <button class="tb" data-t="tariffario" onclick="showTab('tariffario')">💰 Tariffario</button>
    <button class="tb" data-t="report" onclick="showTab('report')" style="margin-left:auto;">&#128202; Stats</button>
    <button class="tb" data-t="syncreport" onclick="showTab('syncreport')">&#128260; Sync Report</button>
  </div>

<div id="t-viaggi" class="tc on" style="flex:1;flex-direction:column;overflow:hidden;min-height:0;">
    <div id="notif-banner"></div>
    <div id="notif-bar">🔔 Notifica per:
        ${['MSC','Hapag','ONE','CMA','OOCL','ZIM','Yang Ming','Maersk','Evergreen'].map(c=>`<label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="nc" value="${c}"> ${c}</label>`).join('')}
        &nbsp;|&nbsp;
        ${[["20'","20'"],["40'","40'"],["40HC","40HC"]].map(([l,v])=>`<label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="nco" value="${v}"> ${l}</label>`).join('')}
        &nbsp;|&nbsp;
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="ntt" value="import"> Import</label>
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="ntt" value="export"> Export</label>
        &nbsp;|&nbsp;
        <span style="color:#666;">Porto:</span>
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="ntp" value="la spezia"> SPZ</label>
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="ntp" value="livorno"> LIV</label>
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="ntp" value="genova"> GOA</label>
    </div>
    <div id="filter-bar" style="background:#f0f4fa;border-bottom:1px solid #d0dff0;padding:6px 12px;font-size:11px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-weight:bold;color:#002856;">👁 Mostra solo:</span>
        ${['MSC','Hapag','ONE','CMA','OOCL','ZIM','Yang Ming','Maersk','Evergreen'].map(c=>`<label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="fs-c" value="${c}" onchange="applyShowOnly()"> ${c}</label>`).join('')}
        &nbsp;|&nbsp;
        ${[["20'","20'"],["40'","40'"],["40HC","40HC"]].map(([l,v])=>`<label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="fs-co" value="${v}" onchange="applyShowOnly()"> ${l}</label>`).join('')}
        &nbsp;|&nbsp;
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="fs-t" value="import" onchange="applyShowOnly()"> Import</label>
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="fs-t" value="export" onchange="applyShowOnly()"> Export</label>
        &nbsp;|&nbsp;
        <span style="color:#666;">Porto:</span>
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="fs-p" value="la spezia" onchange="applyShowOnly()"> SPZ</label>
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="fs-p" value="livorno" onchange="applyShowOnly()"> LIV</label>
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" class="fs-p" value="genova" onchange="applyShowOnly()"> GOA</label>
        &nbsp;|&nbsp;
        <label style="display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" id="fs-hl" onchange="applyShowOnly()"> \u2605 Evidenziati</label>
        &nbsp;|&nbsp;
        <button onclick="tcpSaveFilters()" style="background:#002856;color:white;border:none;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:bold;" title="Salva filtri attivi come predefiniti">&#128190; Salva</button>
        <button onclick="tcpResetSavedFilters()" style="background:#a93226;color:white;border:none;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:11px;" title="Cancella filtri salvati">&#128465; Reset</button>
        <span id="fs-save-note" style="font-size:10px;color:#27ae60;"></span>
    </div>
    <div class="actions">
        <button id="btn-clear" onclick="clearAll()">✕ Svuota lista</button>
        <button onclick="openAddManual()" style="background:#1a65b8;color:white;border:none;border-radius:4px;padding:5px 9px;cursor:pointer;font-size:11px;font-weight:bold;margin-right:4px;">➕ Aggiungi</button>
        <button id="btn-abbina">🔗 Abbina</button>
        <label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;margin-left:8px;cursor:pointer;" title="Mostra/nascondi viaggi con Requested Trucker">
            <input id="toggle-rt" type="checkbox" checked onchange="tcpToggleRT()"> RT
        </label>
        <input id="search-viaggi" type="text" placeholder="container, indirizzo, porto..." style="border:1px solid #aac4e0;border-radius:4px;padding:4px 10px;font-size:11px;width:260px;margin-left:8px;">
        <button onclick="tcpSearchViaggi(document.getElementById('search-viaggi').value)" style="background:#002856;color:white;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:11px;">🔍 Cerca</button>
        <button onclick="document.getElementById('search-viaggi').value='';tcpSearchViaggi('');" style="background:#888;color:white;border:none;border-radius:4px;padding:5px 9px;cursor:pointer;font-size:11px;">✕ Pulisci</button>
        <button id="btn-undo" onclick="tcpUndo()" style="background:#e67e22;color:white;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:11px;font-weight:bold;" title="Annulla ultima operazione">↩ Annulla</button>
        <span id="visible-count" style="margin-left:auto;font-size:11px;color:#555;white-space:nowrap;font-weight:bold;"></span>
    </div>
    <div id="mt-scroll" style="overflow-y:auto;flex:1;min-height:0;">
    <table class="mt">
        <thead><tr>
            <th style="width:18px;"></th>
            <th id="th-traffic" class="sort" onclick="sortBy('traffic')">Traffic</th>
            <th style="width:14px;" title="Alert (Req.Truck / LDV / ADR)"></th>
            <th id="th-carrier" class="sort" onclick="sortBy('carrier')">Carrier</th>
            <th>Container</th>
            <th title="Merci Pericolose">ADR</th>
            <th id="th-delivery" class="sort" onclick="sortBy('delivery')">Delivery</th>
            <th>Address</th><th>Port</th><th>Cont. Nr</th>
            <th title="Req. Trucking">RT</th>
            <th>Branch</th><th>Req. LEF</th>
            <th title="LDV Emessa">LDV</th>
            <th>Azioni</th>
            <th id="th-created" class="sort" onclick="sortBy('created')">Created On</th>
        </tr></thead>
        <tbody id="tbody">${tableRows}</tbody>
    </table>
    </div>
</div>

<div id="t-pairs" class="tc" style="flex:1;overflow-y:auto;">
    <div style="padding:10px 16px 12px;border-bottom:2px solid #bdf3fc;background:#f8fbff;">
        <div style="font-weight:bold;font-size:12px;color:#002856;margin-bottom:5px;">📥 Importa riutilizzo da collega</div>
        <textarea id="import-pair-txt" rows="3" style="width:100%;border:1px solid #aac4e0;border-radius:4px;padding:5px 7px;font-size:11px;font-family:Arial,sans-serif;resize:vertical;color:#002856;" placeholder="Incolla qui il testo copiato dal collega con 📋 Copia"></textarea>
        <button onclick="importPair(document.getElementById('import-pair-txt').value)" style="margin-top:5px;background:#002856;color:white;border:none;border-radius:4px;padding:5px 14px;cursor:pointer;font-size:11px;font-weight:bold;">📥 Importa</button>
        <button onclick="removePair(document.getElementById('import-pair-txt').value)" style="margin-top:5px;margin-left:6px;background:#a93226;color:white;border:none;border-radius:4px;padding:5px 14px;cursor:pointer;font-size:11px;font-weight:bold;">X Rimuovi</button>
    </div>
    <div style="padding:8px 16px 10px;border-bottom:1px solid #d0dff0;background:#f0f5ff;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span style="font-size:11px;font-weight:bold;color:#002856;margin-right:4px;">&#128230; Condivisione:</span>
        <button id="btn-gist-publish" data-label="&#9729; Pubblica" onclick="tcpPublishGist()" style="background:#002856;color:white;border:none;border-radius:4px;padding:4px 11px;cursor:pointer;font-size:11px;font-weight:bold;">&#9729; Pubblica</button>
        <button id="btn-gist-sync" data-label="&#8635; Sincronizza" onclick="tcpSyncGist()" style="background:#1a65b8;color:white;border:none;border-radius:4px;padding:4px 11px;cursor:pointer;font-size:11px;font-weight:bold;">&#8635; Sincronizza</button>
        <button id="btn-gist-syncpub" data-label="&#8644; Sync+Pubblica" onclick="tcpSyncAndPublish()" style="background:#6a1fb8;color:white;border:none;border-radius:4px;padding:4px 11px;cursor:pointer;font-size:11px;font-weight:bold;">&#8644; Sync+Pubblica</button>
        <label style="background:#1a7a1a;color:white;border:none;border-radius:4px;padding:4px 11px;cursor:pointer;font-size:11px;font-weight:bold;">&#128194; Importa file<input type="file" accept=".tcp,.json" style="display:none;" onchange="tcpImportPairsFile(this)"></label>
        <button onclick="tcpExportPairs()" style="background:#27ae60;color:white;border:none;border-radius:4px;padding:4px 11px;cursor:pointer;font-size:11px;font-weight:bold;">&#128228; Esporta file</button>
        <button onclick="tcpGistSettings()" style="background:#888;color:white;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px;">&#9881; Impostazioni</button>
    </div>
    <div id="pairs-content" style="padding:6px 16px;">${pairsHtml(pairs)}</div>
</div>

<div id="t-planner" class="tc" style="flex:1;overflow-y:auto;">
    <div class="pl-nav">
        <button onclick="plPrev()">◀ Prec.</button>
        <button onclick="plNow()" style="background:#e74c3c;font-weight:bold;">📅 Oggi</button>
        <button onclick="plNext()">Succ. ▶</button>
        <span id="wklbl" class="wklbl"></span>
        <span id="wk-badge" style="font-size:11px;background:#002856;color:#bdf3fc;border-radius:4px;padding:2px 8px;display:none;">← settimana corrente</span>
        <span id="wk-counter" style="font-size:11px;background:#27ae60;color:white;border-radius:4px;padding:2px 8px;display:none;margin-left:auto;"></span>
    </div>
    <table class="plt">
        <thead><tr id="pl-head"></tr></thead>
        <tbody id="pl-tbody"></tbody>
    </table>
</div>

<div id="t-tratte" class="tc" style="flex:1;overflow-y:auto;padding:12px 16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <b style="color:#002856;font-size:13px;">🗺️ Tratte <span id="tratte-count" style="font-size:11px;color:#888;font-weight:normal;"></span></b>
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11px;color:#888;">Le tratte si creano salvando km su un riutilizzo (✏️)</span>
            <button onclick="document.getElementById('alias-list-section').scrollIntoView({behavior:'smooth'})" style="background:#c47a00;color:white;border:none;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:11px;">Alias &#8595;</button>
        </div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px;">
        <input id="tratte-search" type="text" placeholder="Filtra per citta..." style="flex:1;border:1px solid #aac4e0;border-radius:4px;padding:5px 10px;font-size:11px;" oninput="tcpFiltraTratte(this.value)">
        <button onclick="tcpFiltraTratte('');document.getElementById('tratte-search').value='';" style="background:#888;color:white;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:11px;">X</button>
    </div>
    <div id="alias-bar" style="display:none;align-items:center;gap:8px;background:#fffbe6;border:1px solid #f0c040;border-radius:5px;padding:6px 12px;margin-bottom:8px;">
        <span id="alias-sel-count" style="font-size:11px;color:#555;"></span>
        <button onclick="tcpOpenCreaAlias()" style="background:#c47a00;color:white;border:none;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:11px;font-weight:bold;">+ Crea Alias</button>
        <button onclick="tcpClearAliasSelection()" style="background:#888;color:white;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px;">X Annulla</button>
    </div>
    <div id="tratte-content">${tratteHtml}</div>
    <div id="alias-list-section" style="margin-top:16px;"></div>
</div>

<div id="t-tariffario" class="tc" style="flex:1;overflow-y:auto;padding:12px 16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <b style="color:#002856;font-size:13px;">&#128176; Tariffario</b>
        <div style="display:flex;align-items:center;gap:7px;">
            <span style="font-size:12px;color:#555;">Fuel Surcharge:</span>
            <input id="fuel-input" type="number" min="0" step="0.1" value="${fuelVal}" style="width:65px;border:1px solid #aac4e0;border-radius:4px;padding:3px 6px;font-size:12px;" oninput="tcpFuelChange(this.value)">
            <span style="font-size:12px;color:#555;">%</span>
            <span id="fuel-note" style="font-size:11px;color:#27ae60;"></span>
        </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;background:#f0f4fa;border:1px solid #d0dff0;border-radius:5px;padding:8px 12px;">
        <span style="font-size:12px;font-weight:bold;color:#002856;">🔍 Calcolo rapido:</span>
        <input id="calc-km" type="number" min="100" max="1500" placeholder="km" style="width:65px;border:1px solid #aac4e0;border-radius:4px;padding:3px 6px;font-size:12px;" oninput="tcpCalcRapido(this.value)">
        <span style="font-size:12px;color:#555;">→</span>
        <span style="font-size:12px;color:#555;">20':</span>
        <span id="calc-r20" style="font-size:13px;font-weight:bold;color:#1a5c1a;min-width:55px;">—</span>
        <span style="font-size:12px;color:#555;">40'/40HC:</span>
        <span id="calc-r40" style="font-size:13px;font-weight:bold;color:#1a5c1a;min-width:55px;">—</span>
    </div>
    <div style="background:#f8f0e8;border:1px solid #e8c88a;border-radius:6px;padding:10px 14px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <b style="color:#002856;font-size:12px;">⚙️ Costi Addizionali Riutilizzo</b>
            <span id="add-note" style="font-size:11px;color:#27ae60;"></span>
            <button onclick="tcpSaveAddizionali()" style="background:#c47a00;color:white;border:none;border-radius:4px;padding:3px 12px;cursor:pointer;font-size:11px;font-weight:bold;">💾 Salva</button>
        </div>
        <table style="font-size:11px;border-collapse:collapse;width:100%;">
            <thead><tr style="color:#888;">
                <th style="text-align:left;padding:3px 8px;font-weight:normal;">Scenario</th>
                <th style="text-align:center;padding:3px 8px;font-weight:normal;">Base €</th>
                <th style="text-align:center;padding:3px 8px;font-weight:normal;">Notte €</th>
                <th style="text-align:center;padding:3px 8px;font-weight:normal;">HC €</th>
            </tr></thead>
            <tbody>
                <tr style="border-top:1px solid #e8c88a;">
                    <td style="padding:5px 8px;font-weight:bold;color:#002856;">Stesso giorno</td>
                    <td style="text-align:center;padding:5px 4px;"><input id="add-sg-base" type="number" value="${addiz.stessoGiorno.base}" style="width:55px;border:1px solid #d0a060;border-radius:3px;padding:2px 4px;text-align:center;font-size:11px;"></td>
                    <td style="text-align:center;padding:5px 4px;color:#ccc;">—</td>
                    <td style="text-align:center;padding:5px 4px;"><input id="add-sg-hc" type="number" value="${addiz.stessoGiorno.hc}" style="width:55px;border:1px solid #d0a060;border-radius:3px;padding:2px 4px;text-align:center;font-size:11px;"></td>
                </tr>
                <tr style="border-top:1px solid #e8c88a;">
                    <td style="padding:5px 8px;font-weight:bold;color:#002856;">Giorno successivo</td>
                    <td style="text-align:center;padding:5px 4px;"><input id="add-gd-base" type="number" value="${addiz.giornoSucc.base}" style="width:55px;border:1px solid #d0a060;border-radius:3px;padding:2px 4px;text-align:center;font-size:11px;"></td>
                    <td style="text-align:center;padding:5px 4px;"><input id="add-gd-sosta" type="number" value="${addiz.giornoSucc.notte||addiz.giornoSucc.sosta||30}" style="width:55px;border:1px solid #d0a060;border-radius:3px;padding:2px 4px;text-align:center;font-size:11px;"></td>
                    <td style="text-align:center;padding:5px 4px;"><input id="add-gd-hc" type="number" value="${addiz.giornoSucc.hc}" style="width:55px;border:1px solid #d0a060;border-radius:3px;padding:2px 4px;text-align:center;font-size:11px;"></td>
                </tr>
                <tr style="border-top:1px solid #e8c88a;">
                    <td style="padding:5px 8px;font-weight:bold;color:#002856;">Weekend (ven→lun)</td>
                    <td style="text-align:center;padding:5px 4px;"><input id="add-we-base" type="number" value="${addiz.weekend.base}" style="width:55px;border:1px solid #d0a060;border-radius:3px;padding:2px 4px;text-align:center;font-size:11px;"></td>
                    <td style="text-align:center;padding:5px 4px;color:#ccc;">—</td>
                    <td style="text-align:center;padding:5px 4px;"><input id="add-we-hc" type="number" value="${addiz.weekend.hc}" style="width:55px;border:1px solid #d0a060;border-radius:3px;padding:2px 4px;text-align:center;font-size:11px;"></td>
                </tr>
                <tr style="border-top:1px solid #e8c88a;">
                    <td style="padding:5px 8px;font-weight:bold;color:#002856;">Altri (2+ giorni)</td>
                    <td style="text-align:center;padding:5px 4px;"><input id="add-al-base" type="number" value="${addiz.altri.base}" style="width:55px;border:1px solid #d0a060;border-radius:3px;padding:2px 4px;text-align:center;font-size:11px;"></td>
                    <td style="text-align:center;padding:5px 4px;color:#ccc;">—</td>
                    <td style="text-align:center;padding:5px 4px;"><input id="add-al-hc" type="number" value="${addiz.altri.hc}" style="width:55px;border:1px solid #d0a060;border-radius:3px;padding:2px 4px;text-align:center;font-size:11px;"></td>
                </tr>
            </tbody>
        </table>
    </div>
    ${tarHtml}
</div>

<div id="t-report" class="tc" style="flex:1;overflow-y:auto;padding:12px 16px;">${reportHtml}</div>
<div id="t-syncreport" class="tc" style="flex:1;overflow-y:auto;padding:12px 16px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;border-bottom:2px solid #bdf3fc;padding-bottom:8px;"><b style="color:#002856;font-size:13px;">&#128260; Sync Report</b><div style="display:flex;gap:8px;align-items:center;"><button onclick="tcpApplyMergePairsModal()" style="background:#1a65b8;color:white;border:none;border-radius:4px;padding:5px 16px;cursor:pointer;font-size:12px;font-weight:bold;">&#10003; Applica</button><button onclick="tcpCloseMergePairsModal()" style="background:#aaa;color:white;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-size:12px;">Annulla</button></div></div><p id="sr-summary" style="font-size:11px;color:#555;margin-bottom:12px;"></p><div id="sr-conflicts"><p style="color:#aaa;text-align:center;padding:40px;font-size:13px;">Nessun sync in corso.</p></div></div>

<script>
(function(){
var _tar=function(){try{return JSON.parse(localStorage.getItem("tcp_tariffario")||"[]");}catch(e){return[];}};
var _sTar=function(t){localStorage.setItem("tcp_tariffario",JSON.stringify(t));};
var _fuel=function(){return parseFloat(localStorage.getItem("tcp_fuel")||"0");};
var KMS=[];for(var _k=100;_k<=1500;_k++)KMS.push(_k);


window.tcpRenderTratte=function(){
    var el=document.getElementById("tratte-content");if(!el)return;
    var tratte=[];try{tratte=JSON.parse(localStorage.getItem("tcp_tratte")||"[]");}catch(e){}
    if(!tratte.length){el.innerHTML='<p style="color:#aaa;text-align:center;padding:30px;font-size:13px;">Nessuna tratta salvata.</p>';return;}
    el.innerHTML=tratte.map(function(t,idx){
        var bg=idx%2===0?"#f8fbff":"white";
        var id=t.id.replace(/'/g,"\\'");
        var sc=t.scarico.replace(/"/g,'&#34;');
        var ca=t.carico.replace(/"/g,'&#34;');
        return '<table style="width:100%;border-collapse:collapse;background:'+bg+';border:1px solid #d0dff0;border-radius:4px;margin-bottom:4px;font-size:12px;"><tr>'
            +'<td style="padding:5px 10px;">'
            +'<span style="font-size:10px;color:#888;">'+t.portoImp+'</span> → '
            +'<button onclick="tcpSelAlias(this)" data-tipo="I" data-v="'+sc+'" style="background:#e8f0fa;color:#002856;border:1px solid #aac4e0;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:10px;font-weight:bold;">I</button>'
            +' <b style="color:#002856;">'+t.scarico+'</b> ↕ '
            +'<b style="color:#1a5c1a;">'+t.carico+'</b> '
            +'<button onclick="tcpSelAlias(this)" data-tipo="E" data-v="'+ca+'" style="background:#e8f4ee;color:#1a5c1a;border:1px solid #a8d5b5;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:10px;font-weight:bold;">E</button>'
            +' → <span style="font-size:10px;color:#888;">'+t.portoExp+'</span>'
            +' <b style="color:#002856;">'+t.km+' km</b>'
            +(t.tappa?' <span style="color:#1a7a1a;font-weight:bold;font-size:11px;">(ferma '+t.tappa+')</span>':'')
            +'</td>'
            +'<td style="white-space:nowrap;padding:5px 8px;width:1px;">'
            +'<button onclick="tcpDeleteTratta(\''+id+'\')" style="background:#a93226;color:white;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:10px;">✕</button>'
            +'</td></tr></table>';
    }).join('');
};
window.tcpScaricaTariffario=function(){
    var tar=[];try{tar=JSON.parse(localStorage.getItem('tcp_tariffario')||'[]');}catch(e){}
    if(!tar.length){alert('Nessun tariffario salvato da scaricare.');return;}
    var rows=["km;Costo grezzo 20';Costo grezzo 40'/40HC"];
    tar.sort(function(a,b){return a.km-b.km;}).forEach(function(r){
        rows.push(r.km+';'+(r.c20||'')+';'+(r.c40||''));
    });
    var csv='﻿'+rows.join('
');
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='tariffario_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
    URL.revokeObjectURL(a.href);
};


window.tcpEsportaTratte=function(){
    var tratte=[];try{tratte=JSON.parse(localStorage.getItem("tcp_tratte")||"[]");}catch(e){}
    if(!tratte.length){alert("Nessuna tratta da esportare.");return;}
    var script=document.createElement("script");
    script.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload=function(){
        var XLSX=window.XLSX;
        var headers=["Porto Imp","Scarico","Carico","Porto Exp","Km"];
        var rows=tratte.map(function(t){return[t.portoImp,t.scarico,t.carico,t.portoExp,t.km];});
        var ws=XLSX.utils.aoa_to_sheet([headers].concat(rows));
        ws["!cols"]=[{wch:20},{wch:30},{wch:30},{wch:20},{wch:8}];
        ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:4}})};
        var headerStyle={fill:{fgColor:{rgb:"002856"}},font:{bold:true,color:{rgb:"FFFFFF"},sz:10},alignment:{horizontal:"center"}};
        headers.forEach(function(_,ci){var ref=XLSX.utils.encode_cell({r:0,c:ci});if(ws[ref])ws[ref].s=headerStyle;});
        rows.forEach(function(_,ri){var bg=ri%2===0?"EAF4FB":"FFFFFF";[0,1,2,3,4].forEach(function(ci){var ref=XLSX.utils.encode_cell({r:ri+1,c:ci});if(!ws[ref])ws[ref]={v:"",t:"s"};ws[ref].s={fill:{fgColor:{rgb:bg}},font:{sz:10}};});});
        var wb=XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb,ws,"Tratte");
        XLSX.writeFile(wb,"tratte_"+new Date().toISOString().slice(0,10)+".xlsx");
    };
    script.onerror=function(){alert("Impossibile caricare SheetJS.");}
    if(!window.XLSX)document.head.appendChild(script);
    else script.onload();
};

window._mergePending=null;
window.tcpMergeTratte=function(input){
    var file=input.files&&input.files[0];input.value="";
    if(!file)return;
    var script=document.createElement("script");
    script.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload=function(){
        var reader=new FileReader();
        reader.onload=function(e){
            try{
                var XLSX=window.XLSX;
                var wb=XLSX.read(e.target.result,{type:"array"});
                var ws=wb.Sheets[wb.SheetNames[0]];
                var data=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
                if(data.length<2){alert("File vuoto o non valido.");return;}
                // Salta header, leggi righe
                var incoming=[];
                for(var i=1;i<data.length;i++){
                    var r=data[i];
                    var portoImp=String(r[0]||"").trim();
                    var scarico=String(r[1]||"").trim();
                    var carico=String(r[2]||"").trim();
                    var portoExp=String(r[3]||"").trim();
                    var km=parseInt(r[4])||0;
                    if(!scarico||!carico||!km)continue;
                    var id=[portoImp,scarico,carico,portoExp].join("||");
                    incoming.push({id:id,portoImp:portoImp,scarico:scarico,carico:carico,portoExp:portoExp,km:km});
                }
                if(!incoming.length){alert("Nessuna tratta valida nel file.");return;}
                var existing=[];try{existing=JSON.parse(localStorage.getItem("tcp_tratte")||"[]");}catch(e){}
                var toAdd=[];
                var conflicts=[];
                incoming.forEach(function(t){
                    var ex=existing.find(function(x){return x.id===t.id;});
                    if(!ex){toAdd.push(t);}
                    else if(ex.km!==t.km){conflicts.push({existing:ex,incoming:t});}
                });
                window._mergePending={toAdd:toAdd,conflicts:conflicts,existing:existing};
                // Mostra modal
                var sumEl=document.getElementById("merge-summary");
                var confEl=document.getElementById("merge-conflicts");
                if(sumEl)sumEl.textContent=(toAdd.length?" +"+ toAdd.length+" tratte nuove":"")+(conflicts.length?" · "+conflicts.length+" conflitti":"")+(toAdd.length===0&&conflicts.length===0?" Nessuna differenza, tutto già aggiornato.":"");
                if(confEl){
                    if(!conflicts.length){confEl.innerHTML="<p style='color:#27ae60;font-size:12px;'>Nessun conflitto.</p>";}
                    else{
                        confEl.innerHTML=conflicts.map(function(cf,ci){
                            return '<div style="border:1px solid #d0dff0;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:12px;">'
                                +'<b style="color:#002856;">'+cf.existing.scarico+' ↕ '+cf.existing.carico+'</b>'
                                +'<div style="display:flex;gap:12px;margin-top:6px;">'
                                +'<label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 10px;border-radius:4px;border:2px solid #1a65b8;flex:1;">'
                                +'<input type="radio" name="cf'+ci+'" value="mine" checked style="cursor:pointer;">'
                                +'<span><b style="color:#1a65b8;">Mio:</b> '+cf.existing.km+' km</span></label>'
                                +'<label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 10px;border-radius:4px;border:2px solid #27ae60;flex:1;">'
                                +'<input type="radio" name="cf'+ci+'" value="theirs" style="cursor:pointer;">'
                                +'<span><b style="color:#27ae60;">Collega:</b> '+cf.incoming.km+' km</span></label>'
                                +'</div></div>';
                        }).join("");
                    }
                }
                var m=document.getElementById("merge-modal");
                if(m)m.style.display="flex";
            }catch(err){alert("Errore lettura file: "+err.message);}
        };
        reader.readAsArrayBuffer(file);
    };
    script.onerror=function(){alert("Impossibile caricare SheetJS.");}
    if(!window.XLSX)document.head.appendChild(script);
    else script.onload();
};

window.tcpApplicaMerge=function(){
    var mp=window._mergePending;if(!mp)return;
    var tratte=mp.existing.slice();
    // Aggiungi nuove
    mp.toAdd.forEach(function(t){tratte.push(t);});
    // Risolvi conflitti
    mp.conflicts.forEach(function(cf,ci){
        var sel=document.querySelector("input[name='cf"+ci+"']:checked");
        if(sel&&sel.value==="theirs"){
            var ex=tratte.find(function(x){return x.id===cf.existing.id;});
            if(ex)ex.km=cf.incoming.km;
        }
    });
    localStorage.setItem("tcp_tratte",JSON.stringify(tratte));
    document.getElementById("merge-modal").style.display="none";
    window._mergePending=null;
    if(window.tcpRenderTratte)tcpRenderTratte();
    alert("Merge completato: +"+(mp.toAdd.length)+" nuove, "+mp.conflicts.length+" conflitti risolti.");
};


})();
<\/script>

<!-- MODAL EDIT -->
<div id="edit-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;align-items:center;justify-content:center;">
  <div style="background:white;border-radius:10px;padding:24px;min-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.3);">
    <h3 style="margin:0 0 16px;color:#002856;font-size:14px;">✏️ Modifica Viaggio</h3>
    <input type="hidden" id="edit-id">
    <div style="display:grid;gap:8px;">
      <label style="font-size:11px;color:#555;">Traffico<br>
        <select id="edit-traffic" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;">
          <option>Import</option><option>Export</option>
        </select></label>
      <label style="font-size:11px;color:#555;">Carrier<br>
        <input id="edit-carrier" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
      <label style="font-size:11px;color:#555;">Container<br>
        <select id="edit-cont" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;">
          <option>20'</option><option>40'</option><option>40HC</option><option>20 Reefer</option><option>40 Reefer</option><option>40 Reefer high cube</option>
        </select></label>
      <label style="font-size:11px;color:#555;">Porto<br>
        <input id="edit-port" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
      <label style="font-size:11px;color:#555;">Delivery<br>
        <input id="edit-delivery" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
      <label style="font-size:11px;color:#555;">Indirizzo<br>
        <input id="edit-address" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
      <label style="font-size:11px;color:#555;">Branch (filiale)<br>
        <input id="edit-branch" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
      <label style="font-size:11px;color:#555;">Nr. Container<br>
        <input id="edit-contNr" placeholder="es. TCKU1234567" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
      <button onclick="closeEdit()" style="background:#aaa;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;">Annulla</button>
      <button onclick="saveEdit()" style="background:#27ae60;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;font-weight:bold;">✓ Salva</button>
    </div>
  </div>
</div>

<!-- MODAL KM/COSTO -->
<div id="tcp-km-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10001;align-items:center;justify-content:center;">
  <div style="background:white;border-radius:10px;padding:22px 24px;min-width:240px;box-shadow:0 8px 32px rgba(0,0,0,.3);">
    <h3 style="margin:0 0 14px;color:#002856;font-size:14px;">🚚 Km e costo grezzo</h3>
    <div style="display:grid;gap:10px;">
      <label style="font-size:11px;color:#555;">Km<br>
        <input id="tcp-km-modal-km" type="number" placeholder="es. 320" style="width:100%;padding:5px 7px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;margin-top:3px;">
      </label>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
      <button onclick="document.getElementById('tcp-km-modal').style.display='none'" style="background:#aaa;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;">Annulla</button>
      <button onclick="tcpSaveKm()" style="background:#27ae60;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;font-weight:bold;">✓ Salva</button>
    </div>
  </div>
</div>

<!-- MODAL SCELTA IMP/EXP -->
<div id="pair-choice-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10001;align-items:center;justify-content:center;">
  <div style="background:white;border-radius:10px;padding:24px;min-width:280px;box-shadow:0 8px 32px rgba(0,0,0,.3);text-align:center;">
    <h3 style="margin:0 0 16px;color:#002856;font-size:14px;">✏️ Cosa vuoi modificare?</h3>
    <div style="display:flex;gap:10px;justify-content:center;margin-bottom:12px;">
      <button onclick="doEditPairChoice('imp')" style="background:#005580;color:white;border:none;border-radius:5px;padding:9px 20px;cursor:pointer;font-size:12px;font-weight:bold;">📥 Modifica IMP</button>
      <button onclick="doEditPairChoice('exp')" style="background:#1a5c1a;color:white;border:none;border-radius:5px;padding:9px 20px;cursor:pointer;font-size:12px;font-weight:bold;">📤 Modifica EXP</button>
    </div>
    <button onclick="closePairChoice()" style="background:#aaa;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;">Annulla</button>
  </div>
</div>

<!-- MODAL AGGIUNGI MANUALE -->
<div id="add-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;align-items:center;justify-content:center;">
  <div style="background:white;border-radius:10px;padding:24px;min-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.3);">
    <h3 style="margin:0 0 16px;color:#002856;font-size:14px;">➕ Aggiungi Viaggio Manuale</h3>
    <div style="display:grid;gap:8px;">
      <label style="font-size:11px;color:#555;">Traffico<br>
        <select id="add-traffic" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;">
          <option>Import</option><option>Export</option>
        </select></label>
      <label style="font-size:11px;color:#555;">Carrier *<br>
        <select id="add-carrier" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;">
          <option value="">-- seleziona --</option>
          <option>Hapag</option><option>MSC</option><option>ONE</option><option>CMA</option>
          <option>Maersk</option><option>OOCL</option><option>ZIM</option>
          <option>Yang Ming</option><option>Evergreen</option>
        </select></label>
      <label style="font-size:11px;color:#555;">Container<br>
        <select id="add-cont" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;">
          <option>20'</option><option>40'</option><option selected>40HC</option>
        </select></label>
      <label style="font-size:11px;color:#555;">Porto<br>
        <select id="add-port" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;">
          <option>La Spezia - IT</option><option>Livorno - IT</option><option>Genova - IT</option>
        </select></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <label style="font-size:11px;color:#555;">Data Delivery * (gg/mm/aa)<br>
          <input id="add-delivery-date" placeholder="gg/mm/aa" maxlength="8" oninput="tcpMaskDate(this)" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
        <label style="font-size:11px;color:#555;">Orario *<br>
          <input id="add-delivery-time" placeholder="hh:mm" maxlength="5" oninput="tcpMaskTime(this)" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
      </div>
      <label style="font-size:11px;color:#555;">Indirizzo * (Città CAP)<br>
      <div style="display:grid;grid-template-columns:1fr 56px;gap:6px;align-items:end;">
        <input id="add-address" placeholder="es. Firenze 50100" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;">
        <div>
          <div style="font-size:10px;color:#888;margin-bottom:2px;">Prov.</div>
          <input id="add-prov" placeholder="FI" maxlength="2" oninput="this.value=this.value.toUpperCase()" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;text-align:center;">
        </div>
      </div></label>
      <label style="font-size:11px;color:#555;">Nr. Container<br>
        <input id="add-contNr" placeholder="es. TCKU1234567" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
      <label style="font-size:11px;color:#555;">Branch (filiale)<br>
        <input id="add-branch" placeholder="es. Savino Del Bene S.p.A. Firenze" style="width:100%;padding:5px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></label>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
      <button onclick="closeAddManual()" style="background:#aaa;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;">Annulla</button>
      <button onclick="saveAddManual()" style="background:#1a65b8;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;font-weight:bold;">➕ Aggiungi</button>
    </div>
  </div>
</div>

<!-- FLOATING BUTTONS -->
<button id="btn-edit-float" style="display:none;position:fixed;bottom:24px;right:20px;background:#27ae60;color:white;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:11px;font-weight:bold;box-shadow:0 3px 8px rgba(0,0,0,0.2);z-index:9999;">✏️ Modifica</button>

<button id="btn-deselect-float" style="display:none;position:fixed;bottom:24px;left:20px;background:#e67e22;color:white;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:11px;font-weight:bold;box-shadow:0 3px 8px rgba(0,0,0,0.2);z-index:9999;" onclick="doDeselect()">✕ Annulla selezione</button>

<button id="btn-abbina-float" style="display:none;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#27ae60;color:white;border:none;border-radius:6px;padding:10px 28px;cursor:pointer;font-size:13px;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:9999;">🔗 Abbina</button>


<!-- MODAL MERGE TRATTE -->
<div id="merge-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10002;align-items:center;justify-content:center;">
  <div style="background:white;border-radius:10px;padding:24px;width:600px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.3);">
    <h3 style="margin:0 0 6px;color:#002856;font-size:14px;">🔀 Merge Tratte</h3>
    <p id="merge-summary" style="font-size:11px;color:#555;margin-bottom:12px;"></p>
    <div id="merge-conflicts" style="margin-bottom:14px;"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button onclick="document.getElementById('merge-modal').style.display='none'" style="background:#aaa;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;">Annulla</button>
      <button onclick="tcpApplicaMerge()" style="background:#1a65b8;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;font-weight:bold;">✓ Applica merge</button>
    </div>
  </div>
</div>

<!-- MODAL GIST SETTINGS -->
<div id="gist-settings-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10003;align-items:center;justify-content:center;">
  <div style="background:white;border-radius:10px;padding:24px;min-width:420px;box-shadow:0 8px 32px rgba(0,0,0,.3);">
    <h3 style="margin:0 0 6px;color:#002856;font-size:14px;">&#9881; Impostazioni Gist GitHub</h3>
    <p style="font-size:11px;color:#888;margin-bottom:14px;">Crea un Personal Access Token su GitHub (Settings &rarr; Developer settings &rarr; Fine-grained tokens) con scope <b>Gist</b>. Il Gist ID viene generato automaticamente alla prima pubblicazione.</p>
    <div style="display:grid;gap:10px;">
      <label style="font-size:11px;color:#555;">Token GitHub *<br>
        <input id="gist-token-input" type="password" placeholder="github_pat_..." style="width:100%;padding:5px 7px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;margin-top:3px;font-family:monospace;">
      </label>
      <label style="font-size:11px;color:#555;">Mio Gist ID (auto-compilato alla prima pubblicazione)<br>
        <input id="gist-id-input" type="text" placeholder="es. a1b2c3d4e5f6..." style="width:100%;padding:5px 7px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;margin-top:3px;font-family:monospace;">
      </label>
      <label style="font-size:11px;color:#555;">Gist ID collega (ricevuto dal collega - da cui sincronizzi)<br>
        <input id="gist-id-collega-input" type="text" placeholder="es. b2c3d4e5f6a1..." style="width:100%;padding:5px 7px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;margin-top:3px;font-family:monospace;">
      </label>
      <p style="font-size:11px;color:#888;">Ognuno pubblica sul proprio Gist e legge da quello del collega. Usa Sync+Pubblica per fare tutto in un colpo.</p>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;align-items:center;">
      <span id="gist-save-note" style="font-size:11px;color:#27ae60;margin-right:auto;"></span>
      <button onclick="tcpCloseGistSettings()" style="background:#aaa;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;">Annulla</button>
      <button onclick="tcpSaveGistSettings()" style="background:#002856;color:white;border:none;border-radius:5px;padding:7px 16px;cursor:pointer;font-size:12px;font-weight:bold;">&#10003; Salva</button>
    </div>
  </div>
</div>



</body></html>`;
}


// ────────────────────────────────────────────────
//  APRI / AGGIORNA FINESTRA
// ────────────────────────────────────────────────
let win = null;




function openOrUpdate(settings, lastUpdate, newCount, newIds, modIds) {
    if (!win || win.closed)
        win = window.open('', 'tcp_monitor_win', 'width=1500,height=850,resizable=yes,scrollbars=yes');
    window.tcpMonitorWin = win;
    const html = buildHTML(ls.orders(), settings, lastUpdate, newCount, newIds, modIds);
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Forza layout flex su #t-viaggi dopo rebuild
    try{ win.showTab('viaggi'); }catch(e){}
    setTimeout(function(){ try{ win.tcpRestoreSavedFilters(); }catch(e){} }, 300);
    // Toast se ci sono nuovi alert coppie
    try{
        var _alerts=JSON.parse(localStorage.getItem('tcp_pair_alerts')||'{}');
        var _nAlert=Object.values(_alerts).filter(function(a){return !a.dismissed;}).length;
        if(_nAlert>0&&win&&!win.closed&&win.tcpToast){
            win.tcpToast('\u26a0\ufe0f '+_nAlert+' riutilizz'+(parseInt(_nAlert)===1?'o':'i')+' con dati modificati',6000);
        }
    }catch(e){}
}

// ────────────────────────────────────────────────
//  CICLO MONITOR
// ────────────────────────────────────────────────
let timer = null;
let statusEl = null;
function setStatus(t) { if (statusEl) statusEl.textContent = t; }

function runCycle() {
    const state = ss.load();
    if (!state?.running) return;
    const { newCount, newIds, modIds } = collect(state.intervalMin, state.carriers, state.containers);
    const ts = new Date().toLocaleTimeString('it-IT');
    openOrUpdate(state, ts, newCount, newIds, modIds);
    setStatus('Aggiornato: ' + ts + ' (+' + newCount + ')');
    timer = setTimeout(() => { doSearch(); }, state.interval * 60000);
}

function doSearch() {
    const btn = document.querySelector('#searchForm\\:searchColumnsButtons\\:searchButton_button') ||
                document.querySelector('button[id*="searchButton_button"]');
    if (btn) btn.click();
}

function getFormSettings() {
    const ev = parseInt(document.getElementById('mon-ev')?.value) || 24;
    const eu = document.getElementById('mon-eu')?.value || 'hours';
    var ci = parseInt(document.getElementById('mon-check-interval')?.value) || 0;
    return {
        interval:      10,
        intervalMin:   eu === 'days' ? ev * 1440 : ev * 60,
        extractVal:    ev,
        extractUnit:   eu,
        checkInterval: ci,
        carriers:      ['MSC','Hapag','ONE','CMA','OOCL','ZIM','Yang Ming','Maersk','Evergreen'].filter(c => document.getElementById('mon-c-'+c.replace(' ',''))?.checked),
        containers:    ["20'","40'","40HC"].filter(t => document.getElementById('mon-t-'+t.replace("'",""))?.checked),
    };
}

function start() {
    const s = getFormSettings();
    if (!s.carriers.length) { alert('Seleziona almeno una compagnia.'); return; }
    if (!s.containers.length) { alert('Seleziona almeno un tipo container.'); return; }
    ss.save({ running: true, ...s });
    document.getElementById('mon-btn').textContent = '⏹ Ferma';
    document.getElementById('mon-btn').style.background = '#c0392b';
    setStatus('Avviato...');
    runCycle();
}

function stop() {
    ss.clear();
    clearTimeout(timer);
    document.getElementById('mon-btn').textContent = '▶ Avvia';
    document.getElementById('mon-btn').style.background = '#002856';
    setStatus('Fermo');
}

// ────────────────────────────────────────────────
//  WIDGET GESTIONALE
// ────────────────────────────────────────────────
function tcpToggleAutoGist(mode) {
    var st = ss.load() || {};
    st.autoGist = (st.autoGist === mode) ? null : mode;
    ss.save(st);
    var map = {sync:'mon-auto-sync', pub:'mon-auto-pub', syncpub:'mon-auto-syncpub'};
    var colors = {sync:'#1a65b8', pub:'#1a65b8', syncpub:'#6a1fb8'};
    Object.keys(map).forEach(function(k) {
        var b = document.getElementById(map[k]);
        if (!b) return;
        var active = st.autoGist === k;
        b.style.background = active ? colors[k] : '#e8ecf4';
        b.style.color = active ? 'white' : '#002856';
    });
}

function buildWidget() {
    if (document.getElementById('tcp-mon-widget')) return;
    let state = ss.load();
    if(!state){state={autoGist:'syncpub'};ss.save(state);}
    else if(!state.autoGist){state.autoGist='syncpub';ss.save(state);}
    const run = state?.running || false;
    const box = document.createElement('div');
    box.id = 'tcp-mon-widget';
    box.style.cssText = 'position:fixed;bottom:10px;left:15px;background:white;border:2px solid #002856;border-radius:6px;padding:9px 13px;font-family:Arial,sans-serif;font-size:12px;color:#002856;z-index:9999;width:215px;box-shadow:2px 2px 10px rgba(0,0,0,.18);';
    box.innerHTML = `
        <div style="font-weight:bold;font-size:13px;margin-bottom:8px;border-bottom:1px solid #002856;padding-bottom:4px;">🔍 Monitor Viaggi</div>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;margin-bottom:5px;">
            <span style="white-space:nowrap;">Estrai ultimi:</span>
            <input id="mon-ev" type="number" value="${state?.extractVal||1}" min="1" max="9999"
                style="width:40px;border:1px solid #002856;border-radius:3px;padding:2px 3px;color:#002856;font-size:11px;">
            <select id="mon-eu" style="border:1px solid #002856;border-radius:3px;padding:2px;color:#002856;font-size:11px;">
                <option value="hours" ${(!state?.extractUnit||state.extractUnit==='hours')?'selected':''}>ore</option>
                <option value="days" ${state?.extractUnit==='days'?'selected':''}>giorni</option>
            </select>
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;margin-bottom:5px;">
            <span style="white-space:nowrap;">Controlla collega ogni:</span>
            <input id="mon-check-interval" type="number" min="0" max="999" value="${state?.checkInterval||10}"
                style="width:36px;border:1px solid #002856;border-radius:3px;padding:2px 3px;color:#002856;font-size:11px;">
            <span>min (0=mai)</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;margin-bottom:7px;">
            <button id="mon-auto-sync" style="background:${state?.autoGist==='sync'?'#1a65b8':'#e8ecf4'};color:${state?.autoGist==='sync'?'white':'#002856'};border:1px solid #002856;border-radius:4px;padding:3px 2px;font-size:10px;font-weight:bold;cursor:pointer;">Auto Sync</button>
            <button id="mon-auto-pub" style="background:${state?.autoGist==='pub'?'#1a65b8':'#e8ecf4'};color:${state?.autoGist==='pub'?'white':'#002856'};border:1px solid #002856;border-radius:4px;padding:3px 2px;font-size:10px;font-weight:bold;cursor:pointer;">Auto Pub</button>
            <button id="mon-auto-syncpub" style="background:${state?.autoGist==='syncpub'?'#6a1fb8':'#e8ecf4'};color:${state?.autoGist==='syncpub'?'white':'#002856'};border:1px solid #002856;border-radius:4px;padding:3px 2px;font-size:10px;font-weight:bold;cursor:pointer;">Sync+Pub</button>
        </div>
        <div style="font-weight:bold;margin-bottom:3px;font-size:11px;">Compagnie:</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;margin-bottom:7px;font-size:11px;">
            ${['MSC','Hapag','ONE','CMA'].map(c=>`<label style="display:flex;align-items:center;gap:3px;"><input id="mon-c-${c}" type="checkbox" ${!state||state.carriers?.includes(c)?'checked':''}> ${c}</label>`).join('')}
            ${['OOCL','ZIM','Yang Ming','Maersk','Evergreen'].map(c=>`<label style="display:flex;align-items:center;gap:3px;"><input id="mon-c-${c.replace(' ','')}" type="checkbox" ${state&&state.carriers?.includes(c)?'checked':''}> ${c}</label>`).join('')}
        </div>
        <div style="font-weight:bold;margin-bottom:3px;font-size:11px;">Container:</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;margin-bottom:9px;font-size:11px;">
            ${[["20'","20"],["40'","40"],["40HC","40HC"]].map(([l,id])=>`<label style="display:flex;align-items:center;gap:2px;"><input id="mon-t-${id}" type="checkbox" ${!state||state.containers?.includes(l)?'checked':''}> ${l}</label>`).join('')}
        </div>
        <hr style="border:none;border-top:1px solid #c8d8f0;margin:6px 0;">
        <button id="mon-btn" style="width:100%;background:#002856;color:white;border:none;border-radius:4px;padding:6px;font-size:12px;cursor:pointer;font-weight:bold;margin-bottom:5px;">
            ▶ Esegui Scansione
        </button>
        <div id="mon-status" style="font-size:10px;color:#777;text-align:center;">${state?.lastScan?'Ultima: '+state.lastScan:'–'}</div>
    `;
    document.body.appendChild(box);
    tcpMakeDraggable(box, 'tcp_widget_monitor_pos');
    ['sync','pub','syncpub'].forEach(function(mode) {
        var bid = mode === 'syncpub' ? 'mon-auto-syncpub' : 'mon-auto-' + mode;
        var b = document.getElementById(bid);
        if (b) b.addEventListener('click', function() { tcpToggleAutoGist(mode); });
    });
    statusEl = document.getElementById('mon-status');

    function _updateScanBtnColor() {
        const st = ss.load();
        const btn = document.getElementById('mon-btn');
        if (!btn) return;
        if (st?.lastScanTs && Date.now() - st.lastScanTs > 3600000) {
            btn.style.background = '#c0392b'; // rosso dopo 1h
        } else {
            btn.style.background = '#002856';
        }
    }
    _updateScanBtnColor();
    setInterval(_updateScanBtnColor, 30000);

    document.getElementById('mon-btn').addEventListener('click', () => {
        const s = getFormSettings();
        const st = ss.load() || {};
        s.autoGist = st.autoGist || null;
        s.autoRun = false;
        const now = new Date();
        s.lastScan = now.toLocaleTimeString('it-IT');
        s.lastScanTs = now.getTime();
        s.running = false;
        ss.save(s);
        clearTimeout(timer);
        const { newCount, newIds, modIds } = collect(s.intervalMin, s.carriers, s.containers);
        openOrUpdate(s, s.lastScan, newCount, newIds, modIds);
        setStatus('Scansione: ' + s.lastScan + ' (+' + newCount + ')');
        document.getElementById('mon-btn').style.background = '#002856';
        // Save check interval and restart auto-check
        localStorage.setItem('tcp_gist_check_interval', String(s.checkInterval || 0));
        if (win && !win.closed && win.tcpStartAutoCheck) {
            win.tcpStartAutoCheck(s.checkInterval || 0);
        }
        // Auto Gist dopo scansione
        var autoGist = s.autoGist;
        if (autoGist === 'sync') {
            setTimeout(function() {
                if (window.tcpMonitorWin && !window.tcpMonitorWin.closed && window.tcpMonitorWin.tcpSyncGist) {
                    window.tcpMonitorWin.tcpSyncGist();
                }
            }, 1500);
        } else if (autoGist === 'pub') {
            setTimeout(function() {
                if (window.tcpMonitorWin && !window.tcpMonitorWin.closed && window.tcpMonitorWin.tcpPublishGist) {
                    window.tcpMonitorWin.tcpPublishGist();
                }
            }, 1500);
        } else if (autoGist === 'syncpub') {
            setTimeout(function() {
                if (window.tcpMonitorWin && !window.tcpMonitorWin.closed && window.tcpMonitorWin.tcpSyncAndPublish) {
                    window.tcpMonitorWin.tcpSyncAndPublish();
                }
            }, 1500);
        }
    });
}

// ────────────────────────────────────────────────
//  AVVIO
// ────────────────────────────────────────────────
function waitForTable(cb) {
    const obs = new MutationObserver(() => {
        const h = document.querySelector('#searchForm\\:resultTable_TRANSPORT_ORDER_DM_head tr');
        if (h && h.children.length > 0) { obs.disconnect(); cb(); }
    });
    obs.observe(document.body, { childList:true, subtree:true });
}

waitForTable(() => {
    buildWidget();
    const state = ss.load();
    if (state?.running) runCycle();
});


})(); // fine S.R.C v1.0 | (c) 2026 Vittorio Zingoni
