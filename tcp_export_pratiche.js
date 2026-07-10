// ==UserScript==
// @name         S.R.C - Export Pratiche per Persona
// @version      1.0
// @description  Estrae LEF, Persona (Creato da), Branch e Nr Container dalle righe espanse nel gestionale ed esporta un Excel ordinato per persona
// @author       Vittorio Zingoni
// ==/UserScript==

(function() {
'use strict';

// ─────────────────────────────────────────────────────────────────
//  ESTRAZIONE DATI DALLE RIGHE ESPANSE
// ─────────────────────────────────────────────────────────────────
function tcpEstraiPratiche() {
    var map = {};

    document.querySelectorAll('tr.ui-expanded-row').forEach(function(row) {
        var lef = (row.querySelector('td:nth-child(7)') || {}).innerText || '';
        lef = lef.trim();
        if (!lef) return;

        var branch = (row.querySelector('td:nth-child(6)') || {}).innerText || '';
        branch = branch.trim();

        var contentRow = row.nextElementSibling;
        if (!contentRow || !contentRow.classList.contains('ui-expanded-row-content')) return;

        if (!map[lef]) map[lef] = { lef: lef, persona: '', branch: branch, containers: [] };

        contentRow.querySelectorAll('[id*="transportEquipmentsTable_data"] > tr').forEach(function(cRow) {
            var contNr = (cRow.querySelector('td:nth-child(3)') || {}).innerText || '';
            contNr = contNr.trim();
            var createdBy = (cRow.querySelector('td:nth-child(14)') || {}).innerText || '';
            createdBy = createdBy.trim();

            if (createdBy && !map[lef].persona) map[lef].persona = createdBy;
            if (contNr && map[lef].containers.indexOf(contNr) < 0) map[lef].containers.push(contNr);
        });
    });

    return Object.keys(map).map(function(k) { return map[k]; });
}

// ─────────────────────────────────────────────────────────────────
//  PULIZIA LEF — rimuove annotazioni tra parentesi (es. "(HOA)"), tiene solo il numero
// ─────────────────────────────────────────────────────────────────
function tcpPulisciLef(raw) {
    if (!raw) return '';
    return raw.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────
//  AGGREGAZIONE PER PERSONA — 1 riga per persona, con elenco LEF e Nr Container
// ─────────────────────────────────────────────────────────────────
function tcpAggregaPerPersona(pratiche) {
    var map = {};
    pratiche.forEach(function(p) {
        var persona = p.persona || '(sconosciuto)';
        if (!map[persona]) map[persona] = { persona: persona, branch: '', lefs: [], containers: [] };
        var entry = map[persona];

        if (!entry.branch && p.branch) entry.branch = p.branch;

        var lefClean = tcpPulisciLef(p.lef);
        if (lefClean && entry.lefs.indexOf(lefClean) < 0) entry.lefs.push(lefClean);

        p.containers.forEach(function(c) {
            if (entry.containers.indexOf(c) < 0) entry.containers.push(c);
        });
    });

    return Object.keys(map).map(function(k) { return map[k]; });
}

// ─────────────────────────────────────────────────────────────────
//  EXPORT EXCEL
// ─────────────────────────────────────────────────────────────────
function tcpEsportaPraticheExcel() {
    var pratiche = tcpEstraiPratiche();
    if (!pratiche.length) {
        alert('Nessuna pratica trovata. Espandi almeno una riga nel gestionale prima di eseguire lo script.');
        return;
    }

    var persone = tcpAggregaPerPersona(pratiche);

    // Ordina righe per Persona (A-Z)
    persone.sort(function(a, b) {
        var pa = (a.persona || '').toLowerCase();
        var pb = (b.persona || '').toLowerCase();
        return pa < pb ? -1 : (pa > pb ? 1 : 0);
    });

    // Ordina l'elenco LEF di ogni persona numericamente crescente
    persone.forEach(function(p) {
        p.lefs.sort(function(a, b) { return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0); });
    });

    var headers = ['Persona', 'LEF', 'Branch', 'Nr Container'];
    var dataRows = persone.map(function(p) {
        return [p.persona, p.lefs.join(', '), p.branch, p.containers.join(', ')];
    });

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

        // Autofilter
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

        XLSX.utils.book_append_sheet(wb, ws, 'LEF per Persona');
        XLSX.writeFile(wb, 'lef_per_persona_' + new Date().toISOString().slice(0,10) + '.xlsx');
    };
    script.onerror = function() {
        alert('Impossibile caricare SheetJS. Controlla la connessione o le impostazioni del browser.');
    };
    document.head.appendChild(script);
}

// Esecuzione immediata al caricamento del bookmarklet
tcpEsportaPraticheExcel();

})();
