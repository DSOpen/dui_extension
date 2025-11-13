// dui-modal.flex.js — ES5, Proxy yok, içerik tamamen geliştiricide
(function (dui) {
    if (!dui) throw new Error('dui gerekli.');

    function isArray(a) { return Array.isArray(a); }
    function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
    function uniq(arr) { var s = {}; var out = []; for (var i = 0; i < arr.length; i++) { if (!s[arr[i]]) { s[arr[i]] = 1; out.push(arr[i]); } } return out; }
    function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

    // CSV hücre kaçışları (RFC 4180 uyumlu)
    function escapeCell(v, delimiter, quoteChar) {
        if (v == null) return '';
        // Nesne/array ise JSON stringle
        if (typeof v === 'object') {
            try { v = JSON.stringify(v); } catch (e) { v = String(v); }
        } else {
            v = String(v);
        }

        var mustQuote = v.indexOf('\n') >= 0 || v.indexOf('\r') >= 0 ||
            v.indexOf(delimiter) >= 0 || v.indexOf(quoteChar) >= 0 ||
            /^\s|\s$/.test(v); // baş/son boşluk

        if (v.indexOf(quoteChar) >= 0) {
            // çift tırnak kaçışı -> "" (iki katına çıkar)
            var re = new RegExp(quoteChar, 'g');
            v = v.replace(re, quoteChar + quoteChar);
            mustQuote = true;
        }

        return mustQuote ? (quoteChar + v + quoteChar) : v;
    }

    /**
     * toCSV(data, options?)
     * options:
     *  - delimiter: varsayılan ","
     *  - quoteChar: varsayılan '"'
     *  - newline:   varsayılan "\r\n" (Excel için ideal)
     *  - columns:   header sabitlemek için kolon listesi (sıra bu olur)
     *  - includeHeader: true/false (varsayılan true)
     *  - bom:       true/false (varsayılan true) -> indirmede kullanılır
     */
    function toCSV(input, options) {
        options = options || {};
        var delimiter = options.delimiter == null ? ',' : String(options.delimiter);
        var quoteChar = options.quoteChar == null ? '"' : String(options.quoteChar);
        var newline = options.newline == null ? '\r\n' : String(options.newline);
        var includeHeader = options.includeHeader !== false;

        // JSON string ise parse et
        var data = input;
        if (typeof input === 'string') {
            try { data = JSON.parse(input); } catch (e) {
                throw new Error('Geçersiz JSON string.');
            }
        }

        // Tek object -> [object]
        if (isObj(data)) data = [data];

        // Boş ise
        if (!data || (isArray(data) && data.length === 0)) return '';

        // Array<Array> mi, Array<Object> mi?
        var isArrayOfArrays = isArray(data[0]) || (isArray(data) && data.every(isArray));
        var rows = [];
        var header = [];

        if (isArrayOfArrays) {
            // header bilinmiyor; doğrudan satırları yaz
            // Eğer header istersen options.columns ile verebilirsin
            if (includeHeader && isArray(options.columns) && options.columns.length) {
                rows.push(options.columns.slice(0));
            }
            for (var i = 0; i < data.length; i++) {
                rows.push(data[i]);
            }
        } else {
            // Array<Object>
            if (isArray(options.columns) && options.columns.length) {
                header = options.columns.slice(0);
            } else {
                // Tüm objelerin anahtarlarını topla (sabit sıra: ilk görülen sırayı korumaya çalışır)
                var keys = [];
                for (var i = 0; i < data.length; i++) {
                    var o = data[i];
                    if (o && typeof o === 'object') {
                        for (var k in o) if (hasOwn(o, k)) keys.push(k);
                    }
                }
                header = uniq(keys);
            }
            if (includeHeader) rows.push(header);
            // Objeleri sırayla hücrele
            for (var r = 0; r < data.length; r++) {
                var obj = data[r] || {};
                var line = new Array(header.length);
                for (var c = 0; c < header.length; c++) {
                    var key = header[c];
                    line[c] = hasOwn(obj, key) ? obj[key] : '';
                }
                rows.push(line);
            }
        }

        // Stringe çevir
        var out = '';
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var cells = new Array(row.length);
            for (var j = 0; j < row.length; j++) {
                cells[j] = escapeCell(row[j], delimiter, quoteChar);
            }
            out += cells.join(delimiter) + (i < rows.length - 1 ? newline : '');
        }
        return out;
    }

    /**
     * CSV’yi dosya olarak indirir.
     * filename ör: "data.csv"
     * options.bom varsayılan true -> Excel/Türkçe uyumu
     */
    function downloadCSV(csvString, filename, options) {
        options = options || {};
        var bom = options.bom !== false; // default true
        var blobParts = bom ? [new Uint8Array([0xEF, 0xBB, 0xBF]), csvString] : [csvString];
        var blob = new Blob(blobParts, { type: 'text/csv;charset=utf-8;' });

        // IE eski sürümlerde msSaveBlob desteği
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
            return;
        }

        var link = document.createElement('a');
        var url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename || 'export.csv';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }


    dui.extendStatic({
        downloadCSV: function(csvString, filename, options) {
            downloadCSV(csvString, filename, options);
            return;
        }
    });

    dui.extendStatic({
        toCSV: function (input, options) {
            return toCSV(input, options);
        }
    });

})(window.dui);
