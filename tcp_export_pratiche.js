// ==UserScript==
// @name         S.R.C - Export Pratiche per Persona
// @version      1.1
// @description  Estrae LEF, Persona (Creato da), Branch e Nr Container dalle righe espanse nel gestionale, esporta un Excel ordinato per persona e apre una lista di email precompilate per Outlook Web
// @author       Vittorio Zingoni
// ==/UserScript==

(function() {
'use strict';

// ═══════════════════════════════════════════════════════════════════
//  CONFIGURAZIONE — modifica solo qui
// ═══════════════════════════════════════════════════════════════════

// Oggetto email: "LEF <numeri> - Fatturazione Lo/Lo"
var TCP_EMAIL_SUBJECT_PREFIX = 'LEF ';
var TCP_EMAIL_SUBJECT_SUFFIX = ' - Fatturazione Lo/Lo';

// CC fissi su ogni email
var TCP_EMAIL_CC = ['andrea.pratesi@crt-logistica.com', 'massimiliano.maggiorelli@crt-logistica.com'];

// Testo del corpo email
var TCP_EMAIL_BODY = 'Buongiorno,\n\n'
    + 'Per le LEF in oggetto l’importo delle LO/LO vi sarà addebitato da CRT.\n'
    + 'Vi preghiamo comunque di verificare che Msc/Spadoni non vi abbia erroneamente fatturato l’importo delle stesse.\n\n'
    + 'Per eventuali dubbi o chiarimenti potete contattare Fabio Maurilli - fabio.maurilli@crt-logistica.com\n\n'
    + 'Cordiali saluti';

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
//  COSTRUISCE E ORDINA LA LISTA PERSONE (condivisa da Excel ed email)
// ─────────────────────────────────────────────────────────────────
function tcpCostruisciPersone() {
    var pratiche = tcpEstraiPratiche();
    if (!pratiche.length) return [];

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

    return persone;
}

// ─────────────────────────────────────────────────────────────────
//  EXPORT EXCEL
// ─────────────────────────────────────────────────────────────────
function tcpEsportaPraticheExcel(persone) {
    if (!persone.length) {
        alert('Nessuna pratica trovata. Espandi almeno una riga nel gestionale prima di eseguire lo script.');
        return;
    }

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

// ─────────────────────────────────────────────────────────────────
//  FINESTRA CON LISTA EMAIL PRECOMPILATE (Outlook Web deeplink)
// ─────────────────────────────────────────────────────────────────
function tcpCostruisciLinkOutlook(persona, lefs) {
    var subject = TCP_EMAIL_SUBJECT_PREFIX + lefs.join(', ') + TCP_EMAIL_SUBJECT_SUFFIX;
    return 'https://outlook.office.com/mail/deeplink/compose?to='
        + encodeURIComponent(persona)
        + '&cc=' + encodeURIComponent(TCP_EMAIL_CC.join(';'))
        + '&subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(TCP_EMAIL_BODY);
}

function tcpApriListaEmail(persone) {
    if (!persone.length) return;

    function esc(s) {
        return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var rows = persone.map(function(p) {
        var url = tcpCostruisciLinkOutlook(p.persona, p.lefs);
        return '<tr>'
            + '<td style="padding:8px 12px;font-weight:bold;color:#002856;">' + esc(p.persona) + '</td>'
            + '<td style="padding:8px 12px;font-size:12px;color:#333;">' + esc(p.lefs.join(', ')) + '</td>'
            + '<td style="padding:8px 12px;font-size:11px;color:#666;">' + esc(p.branch) + '</td>'
            + '<td style="padding:8px 12px;text-align:center;">'
            + '<a href="' + url + '" target="_blank" rel="noopener" '
            + 'style="display:inline-block;background:#0072c6;color:white;text-decoration:none;border-radius:4px;padding:6px 14px;font-size:12px;font-weight:bold;">✉ Apri email</a>'
            + '</td></tr>';
    }).join('');

    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">'
        + '<title>Email per persona — S.R.C</title>'
        + '<style>body{font-family:Arial,sans-serif;background:#f0f5ff;margin:0;padding:20px;color:#002856;}'
        + 'h2{margin:0 0 14px;} table{width:100%;border-collapse:collapse;background:white;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,40,86,.1);}'
        + 'thead th{background:#002856;color:white;text-align:left;padding:8px 12px;font-size:12px;}'
        + 'tbody tr:nth-child(even){background:#eaf4fb;} tbody tr:hover{background:#d0e8fb;}'
        + 'p.note{font-size:11px;color:#888;margin-top:14px;}</style></head><body>'
        + '<h2>✉ Email per persona (' + persone.length + ')</h2>'
        + '<table><thead><tr><th>Persona</th><th>LEF</th><th>Branch</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table>'
        + '<p class="note">Ogni bottone apre Outlook Web con destinatario (risolto dalla rubrica aziendale), oggetto e corpo già compilati. Controlla comunque il destinatario risolto prima di inviare.</p>'
        + '</body></html>';

    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var win = window.open(url, 'tcp_email_list_win', 'width=900,height=700,resizable=yes,scrollbars=yes');
    if (!win) {
        alert('Il browser ha bloccato la finestra popup. Consenti i popup per questo sito e riprova.');
    }
    setTimeout(function() { URL.revokeObjectURL(url); }, 8000);
}

// Esecuzione immediata al caricamento del bookmarklet
(function tcpRun() {
    var persone = tcpCostruisciPersone();
    tcpEsportaPraticheExcel(persone);
    tcpApriListaEmail(persone);
})();

})();
