// dui-modal.flex.js — ES5, Proxy yok, içerik tamamen geliştiricide
(function (dui) {
    if (!dui) throw new Error('dui gerekli.');

    var Wm = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    function setData(el, v) {
        Wm ? Wm.set(el, v) : (el.__duiModal = v);
    }
    function getData(el) {
        return Wm ? Wm.get(el) : el.__duiModal;
    }

    // matches/closest polyfill'leri
    var proto = Element.prototype;
    var matches = proto.matches || proto.msMatchesSelector || proto.webkitMatchesSelector || function (s) {
        var list = (this.document || this.ownerDocument).querySelectorAll(s);
        for (var i = 0; i < list.length; i++) {
            if (list[i] === this) {
                return true;
            }
        }
        return false;
    };

    function closest(el, sel) {
        while (el && el.nodeType === 1) {
            if (matches.call(el, sel)) return el; el = el.parentElement;
        } return null;
    }

    function qsa(root, sel) {
        return Array.prototype.slice.call(root.querySelectorAll(sel));
    }

    function isFocusable(el) {
        if (!el || !el.focus) return false;
        var t = el.tagName ? el.tagName.toLowerCase() : '';
        var tabb = el.getAttribute && el.getAttribute('tabindex');
        var disabled = el.disabled || (el.getAttribute && el.getAttribute('disabled') != null);
        var hidden = (el.offsetParent === null && el !== document.activeElement);
        if (disabled || hidden) return false;
        if (t === 'a' && el.hasAttribute('href')) return true;
        return /^(input|select|textarea|button)$/.test(t) || tabb !== null;
    }
    function trapFocus(scope) {
        var focusables = qsa(scope, '*').filter(isFocusable);
        if (!focusables.length) return function () { };
        var first = focusables[0], last = focusables[focusables.length - 1];
        function onKey(e) {
            e = e || window.event;
            var key = e.key || (e.keyCode === 9 ? 'Tab' : '');
            if (key === 'Tab' || e.keyCode === 9) {
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
        scope.addEventListener('keydown', onKey);
        setTimeout(function () {
            var target = null;
            for (var i = 0; i < focusables.length; i++) {
                if (focusables[i].autofocus) {
                    target = focusables[i]; break;
                }
            }
            //   (target||first).focus();
        }, 0);
        return function () {
            scope.removeEventListener('keydown', onKey);
        };
    }

    var openStack = [];
    var Z_BASE = 1050;

    function lockScroll() {
        document.documentElement.classList.add('dui-modal-open');
        document.body.classList.add('dui-modal-open');
    }

    function unlockScroll() {
        if (!openStack.length) {
            document.documentElement.classList.remove('dui-modal-open');
            document.body.classList.remove('dui-modal-open');
        }
    }

    // asModal: sadece ELEMENT
    dui.extend('asModal', function (opts) {
        opts = opts || {};
        var el = this.elements[0] || this;
        if (!el || !el.tagName) throw new Error('asModal: bir HTML element verin (template desteklenmez).');

        // Kaynak eleman ilk yüklemede görünmesin istiyorsan: CSS'te .dui-modal-src { display:none }
        if (!el.classList.contains('dui-modal-src')) el.classList.add('dui-modal-src');

        var placeholder = null, parent = null, next = null;
        var wrap = document.createElement('div');     // overlay
        var backdrop = document.createElement('div'); // gölge

        wrap.className = 'dui-modal';
        backdrop.className = 'dui-backdrop';

        // Dialog sınıfını sadece açıkken ekle/çıkar
        var dialogClass = ('dialogClass' in opts) ? opts.dialogClass : 'dui-modal__dialog';
        var dialogClassAdded = false;

        var size = opts.size || 'md';                // sm|md|lg|xl
        var backdropMode = (typeof opts.backdrop === 'undefined') ? true : opts.backdrop; // true|'static'|false
        var closeOnEsc = (typeof opts.closeOnEsc === 'undefined') ? true : !!opts.closeOnEsc;
        var closeOnBackdrop = (typeof opts.closeOnBackdrop === 'undefined') ? (backdropMode !== 'static') : !!opts.closeOnBackdrop;
        var headerText = (typeof opts.headerText === 'undefined') ? "Uyarı" : opts.headerText;
        var bodyText = (typeof opts.bodyText === 'undefined') ? "" : opts.bodyText;

        // ARIA: varsa dokunma, yoksa ekle
        function ensureAria() {
            if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
            if (!el.getAttribute('aria-modal')) el.setAttribute('aria-modal', 'true');
            if (opts.ariaLabel && !el.getAttribute('aria-label')) el.setAttribute('aria-label', opts.ariaLabel);
        }

        function onEsc(e) {
            e = e || window.event;
            var key = e.key || (e.keyCode === 27 ? 'Escape' : '');
            if ((key === 'Escape' || e.keyCode === 27) && closeOnEsc) {
                e.preventDefault();
                api.close('esc');
            }
        }

        function onBackdropClick(e) {
            if (!closeOnBackdrop) return;
            // sadece içeriğin DIŞI tıklanınca
            if (e.target === wrap) {
                api.close('backdrop');
            }
        }

        // İçerik içinden data-dismiss (ve muadilleri) ile kapatma
        var dismissSel = '[data-dismiss="modal"], [data-modal-dismiss], .dui-modal-close, .modal-close, .btn-close';

        function onContentClick(e) {
            var trg = e.target;
            if (closest(trg, dismissSel)) {
                e.preventDefault();
                api.close('dismiss');
            }
        }

        var untrap = function () { };
        var removedHideClass = false;

        function mount() {
            ensureAria();

            // z-index katmanları
            var i = openStack.length;
            var zBackdrop = Z_BASE + i * 20;
            var zModal = zBackdrop + 10;
            backdrop.style.zIndex = String(zBackdrop);
            wrap.style.zIndex = String(zModal);

            var mh = el.querySelector("[name='modalheader']");
            var mb = el.querySelector(".modal-body");

            if (mh && headerText) {
                mh.innerHTML = headerText;
            }

            if (mb && bodyText) {
                mb.innerHTML = bodyText;
            }

            // DOM'a ekle
            if (backdropMode) document.body.appendChild(backdrop);
            document.body.appendChild(wrap);

            // Kaynaktan taşı
            if (!placeholder) {
                placeholder = document.createComment('dui-modal-placeholder');
                parent = el.parentNode;
                next = el.nextSibling;
            }
            if (parent) parent.insertBefore(placeholder, next);

            if (el.classList.contains('dui-modal-src')) {
                el.classList.remove('dui-modal-src');
                removedHideClass = true;
            }
            if (dialogClass && !el.classList.contains(dialogClass)) {
                el.classList.add(dialogClass);
                dialogClassAdded = true;
            }

            // wrap içine koy ve göster
            wrap.appendChild(el);
            wrap.className = 'dui-modal dui-modal--' + size;
            requestAnimationFrame(function () {
                if (backdropMode) backdrop.classList.add('show');
                wrap.classList.add('show');
            });

            // olaylar
            lockScroll();
            document.addEventListener('keydown', onEsc);
            wrap.addEventListener('click', onBackdropClick);  // wrap boş alanı yakalar
            el.addEventListener('click', onContentClick);     // içerikten dismiss
            untrap = trapFocus(el);

            if (typeof opts.onShow === 'function') opts.onShow({ wrap: wrap, el: el });
            setTimeout(function () {
                if (typeof opts.onShown === 'function') opts.onShown({ wrap: wrap, el: el });
            }, 0);
        }

        function unmount() {
            document.removeEventListener('keydown', onEsc);
            wrap.removeEventListener('click', onBackdropClick);
            el.removeEventListener('click', onContentClick);

            // elementi geri koy
            if (parent && placeholder) {
                parent.insertBefore(el, placeholder);
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
                placeholder = null;
            }
            if (dialogClassAdded) {
                el.classList.remove(dialogClass);
                dialogClassAdded = false;
            }
            if (removedHideClass) {
                el.classList.add('dui-modal-src');
                removedHideClass = false;
            }

            if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            untrap();
            unlockScroll();
            if (typeof opts.onHidden === 'function') opts.onHidden({ el: el });
        }

        var closing = false;
        var api = {
            open: function (conf) {
                if (conf) {
                    if (typeof conf.size !== 'undefined') size = conf.size;
                    if (typeof conf.backdrop !== 'undefined') {
                        backdropMode = conf.backdrop;
                        closeOnBackdrop = (conf.backdrop !== 'static') && conf.backdrop !== false;
                    }
                    if (typeof conf.closeOnBackdrop !== 'undefined') closeOnBackdrop = !!conf.closeOnBackdrop;
                    if (typeof conf.closeOnEsc !== 'undefined') closeOnEsc = !!conf.closeOnEsc;
                    if (typeof conf.headerText !== 'undefined') headerText = conf.headerText;
                    if (typeof conf.bodyText !== 'undefined') bodyText = conf.bodyText;
                }
                openStack.push(api);
                mount();
                return api;
            },
            close: function (reason) {
                if (closing) return;
                if (typeof opts.onHide === 'function') {
                    var r = opts.onHide({ reason: reason || 'api', el: el });
                    if (r === false) return; // veto
                }
                closing = true;
                wrap.classList.remove('show');
                if (backdropMode) backdrop.classList.remove('show');
                setTimeout(function () {
                    for (var i = 0; i < openStack.length; i++) {
                        if (openStack[i] === api) {
                            openStack.splice(i, 1); break;
                        }
                    }
                    unmount();
                    closing = false;
                }, 150);
            },
            setBackdrop: function (v) {
                backdropMode = v;
                closeOnBackdrop = (v !== 'static') && v !== false;
                return api;
            },
            setSize: function (v) {
                size = v || 'md';
                if (wrap.parentNode) { wrap.className = 'dui-modal dui-modal--' + size; }
                return api;
            },
            elements: { wrap: wrap, backdrop: backdrop, content: el }
        };

        setData(el, api);
        return api;
    });

    // Kısayol
    dui.extendStatic({
        modalOpenFrom: function (elOrSel, opts) {
            var el = (typeof elOrSel === 'string') ? document.querySelector(elOrSel) : elOrSel;
            if (!el) throw new Error('modalOpenFrom: element bulunamadı.');
            var api = getData(el) || dui.mt.asModal.call(el, opts || {});
            return api.open(opts || {});
        }
    });

})(window.dui);
