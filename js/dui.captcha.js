(function (dui) {
    if (!dui) throw new Error('dui gerekli.');

    let captchaStr;
    let eli;
    let elc;
    let elm;
    let sbmt;

    function captchaGenerate() {

        // Clear old input
        eli.value = "";

        // Access the element to store
        // the generated captcha
        //captcha = elc;
        let uniquechar = "";

        const randomchar =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        // Generate captcha for length of
        // 5 with random character
        for (let i = 1; i < 5; i++) {
            uniquechar += randomchar.charAt(
                Math.random() * randomchar.length)
        }

        // Store generated input
        captchaStr = uniquechar;

        elc.innerHTML = captchaStr;
    }

    function captchaPrintmsg(prm) {
        if (prm == 0) {
            elm.innerHTML = "Hatalı veya yanlış güvenlik kodu";
            return;

        } else if (prm == 1) {
            elm.innerHTML = "Doğru";
            return;
        }

        elm.innerHTML = "";
    }

    function validate() {
        const usr_input = eli.value;

        if (usr_input == "" && elc.innerHTML == "") {
            captchaGenerate();
            return 2;//null
        }
        else if (usr_input == elc.innerHTML) {
            captchaGenerate();
            return 1;//true
        }
        else {
            captchaGenerate();
            return 0;//false
        }
    }

    function generate(el, opts) {
        elc = el;
        eli = dui.select(opts.input).elements[0];
        elm = dui.select(opts.msgdiv).elements[0];

        if (opts.submit) {
            sbmt = dui.select(opts.submit).elements[0];

            if (sbmt) {
                dui.bindSmartEvent(sbmt, "click", (e) => {
                    const vld = validate();
                    captchaPrintmsg(vld);

                    if (vld != 1) {
                        e.preventDefault();
                    }
                });
            }
        }

        captchaGenerate();

        //const vld = validate();

        //captchaPrintmsg(vld);
    }

    dui.extend('captcha', function (opts) {
        opts = opts || {};
        const elc = this.elements[0] || this;
        if (!elc || !elc.tagName) throw new Error('captcha: bir HTML element verin (template desteklenmez).');

        if (!opts.input) return;
        if (!opts.msgdiv) return;

        var api = {
            generate: function () {
                generate(elc, opts);


            }
        }

        return api;
    });

})(window.dui);