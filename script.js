/* =========================================================
   GREY PITORI — site behaviour
   Cart (saved in the browser), product dialog, checkout demo,
   shop filters, form validation, lookbook lightbox.
   ========================================================= */
(() => {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const money = n => 'R' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const FREE_DELIVERY_OVER = 1500;
    const DELIVERY_FEE = 99;
    const STORAGE_KEY = 'gp_cart_v1';

    /* ---------- Cart state ---------- */
    const storage = {
        read() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; } },
        write(v) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
    };
    let cart = storage.read();

    const count = () => cart.reduce((n, i) => n + i.qty, 0);
    const subtotal = () => cart.reduce((n, i) => n + i.qty * i.price, 0);
    const delivery = () => (cart.length === 0 || subtotal() >= FREE_DELIVERY_OVER) ? 0 : DELIVERY_FEE;

    /* ---------- Shared UI shell (cart drawer + dialogs) ---------- */
    let drawer, overlay, productDialog, checkoutDialog, statusEl;
    let lastFocus = null;

    function injectUI() {
        document.body.insertAdjacentHTML('beforeend', `
<div class="overlay" data-overlay></div>
<p class="sr-only" id="cart-status" role="status" aria-live="polite"></p>

<aside class="drawer" id="cart-drawer" aria-label="Shopping cart" inert>
    <div class="drawer-head">
        <h2>Your cart</h2>
        <button type="button" class="icon-btn" data-cart-close aria-label="Close cart">&#10005;</button>
    </div>
    <div class="drawer-body" data-cart-items></div>
    <div class="drawer-foot" data-cart-foot>
        <dl class="totals">
            <div><dt>Subtotal</dt><dd data-cart-subtotal>R0</dd></div>
        </dl>
        <p class="note">Delivery is worked out at checkout. Free on orders over ${money(FREE_DELIVERY_OVER)}.</p>
        <button type="button" class="btn btn-block" data-checkout>Checkout</button>
        <p style="text-align:center;margin:.9rem 0 0"><button type="button" class="link-btn" data-cart-clear>Clear cart</button></p>
    </div>
</aside>

<dialog class="modal" id="product-dialog" aria-labelledby="pd-title">
    <button type="button" class="icon-btn modal-close" data-close aria-label="Close">&#10005;</button>
    <div class="pd-grid">
        <div class="pd-gallery">
            <div class="pd-main"><img id="pd-main" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="" width="1000" height="1250"></div>
            <div class="pd-thumbs" id="pd-thumbs" hidden></div>
        </div>
        <div class="pd-info">
            <h2 id="pd-title"></h2>
            <p class="price" id="pd-price"></p>
            <p id="pd-desc"></p>
            <ul id="pd-details"></ul>
            <fieldset class="opt" id="pd-colour-wrap">
                <legend>Colour: <span id="pd-colour-label"></span></legend>
                <div class="options" id="pd-colours"></div>
            </fieldset>
            <fieldset class="opt" id="pd-size-wrap">
                <legend>Size</legend>
                <div class="options" id="pd-sizes"></div>
            </fieldset>
            <p class="pd-error" id="pd-error" role="alert"></p>
            <button type="button" class="btn btn-block" id="pd-add">Add to cart</button>
        </div>
    </div>
</dialog>

<dialog class="modal" id="checkout-dialog" aria-labelledby="co-title">
    <button type="button" class="icon-btn modal-close" data-close aria-label="Close">&#10005;</button>
    <div class="co-grid" id="co-main">
        <form class="co-form" id="checkout-form" novalidate>
            <h2 id="co-title" style="margin-bottom:.8rem">Checkout</h2>
            <p class="note">Demo checkout. No payment is taken and no order is sent.</p>
            <div class="field">
                <label for="co-name">Full name</label>
                <input type="text" id="co-name" name="name" autocomplete="name" required data-msg-required="Enter your full name." aria-describedby="co-name-err">
                <p class="field-error" id="co-name-err" hidden></p>
            </div>
            <div class="field">
                <label for="co-email">Email address</label>
                <input type="email" id="co-email" name="email" autocomplete="email" required data-msg-required="Enter your email address." data-msg-invalid="Enter a valid email address, like name@example.com." aria-describedby="co-email-err">
                <p class="field-error" id="co-email-err" hidden></p>
            </div>
            <div class="field">
                <label for="co-phone">Cell number</label>
                <input type="tel" id="co-phone" name="phone" autocomplete="tel" required pattern="[0-9 +\\-]{9,16}" data-msg-required="Enter a cell number so the courier can reach you." data-msg-invalid="Enter a valid cell number, like 082 123 4567." aria-describedby="co-phone-err">
                <p class="field-error" id="co-phone-err" hidden></p>
            </div>
            <div class="field">
                <label for="co-address">Street address</label>
                <input type="text" id="co-address" name="address" autocomplete="street-address" required data-msg-required="Enter your delivery address." aria-describedby="co-address-err">
                <p class="field-error" id="co-address-err" hidden></p>
            </div>
            <div class="field-row">
                <div class="field">
                    <label for="co-city">City or town</label>
                    <input type="text" id="co-city" name="city" autocomplete="address-level2" required data-msg-required="Enter your city or town." aria-describedby="co-city-err">
                    <p class="field-error" id="co-city-err" hidden></p>
                </div>
                <div class="field">
                    <label for="co-code">Postal code</label>
                    <input type="text" id="co-code" name="code" autocomplete="postal-code" inputmode="numeric" required pattern="[0-9]{4}" data-msg-required="Enter your postal code." data-msg-invalid="Postal codes in South Africa have 4 digits." aria-describedby="co-code-err">
                    <p class="field-error" id="co-code-err" hidden></p>
                </div>
            </div>
            <button type="submit" class="btn btn-block">Place order</button>
        </form>
        <div class="co-summary">
            <h3 style="margin-bottom:1rem">Order summary</h3>
            <ul id="co-lines"></ul>
            <dl class="totals">
                <div><dt>Subtotal</dt><dd id="co-sub"></dd></div>
                <div><dt>Delivery</dt><dd id="co-del"></dd></div>
                <div class="grand"><dt>Total</dt><dd id="co-total"></dd></div>
            </dl>
        </div>
    </div>
    <div class="co-done" id="co-done" hidden tabindex="-1">
        <h2>Order confirmed</h2>
        <p id="co-done-text"></p>
        <p class="note">This is a demo. No payment was taken.</p>
        <button type="button" class="btn" data-close>Keep browsing</button>
    </div>
</dialog>`);

        drawer = $('#cart-drawer');
        overlay = $('[data-overlay]');
        productDialog = $('#product-dialog');
        checkoutDialog = $('#checkout-dialog');
        statusEl = $('#cart-status');
    }

    function syncScrollLock() {
        const open = drawer.classList.contains('is-open') || $('dialog[open]');
        document.body.classList.toggle('no-scroll', !!open);
    }

    function announce(msg) {
        statusEl.textContent = '';
        setTimeout(() => { statusEl.textContent = msg; }, 50);
    }

    /* ---------- Cart drawer ---------- */
    function openCart() {
        lastFocus = document.activeElement;
        renderCart();
        drawer.inert = false;
        drawer.classList.add('is-open');
        overlay.classList.add('is-open');
        syncScrollLock();
        $('[data-cart-close]', drawer).focus();
    }
    function closeCart(restoreFocus = true) {
        drawer.classList.remove('is-open');
        overlay.classList.remove('is-open');
        drawer.inert = true;
        syncScrollLock();
        if (restoreFocus && lastFocus && document.contains(lastFocus)) lastFocus.focus();
    }

    function renderCart() {
        const body = $('[data-cart-items]', drawer);
        const foot = $('[data-cart-foot]', drawer);
        if (cart.length === 0) {
            body.innerHTML = `<div class="cart-empty"><p>Your cart is empty.</p><a class="btn" href="shop.html">Shop the collection</a></div>`;
            foot.hidden = true;
        } else {
            foot.hidden = false;
            body.innerHTML = `<ul>` + cart.map(i => `
<li class="line" data-key="${esc(i.key)}">
    <img src="${esc(i.img)}" alt="" width="84" height="105">
    <div>
        <p class="line-name">${esc(i.name)}</p>
        <p class="line-meta">${esc(cap(i.colour))}${i.size && i.size !== 'One size' ? ' / ' + esc(i.size) : ''}</p>
        <div class="qty" role="group" aria-label="Quantity of ${esc(i.name)}">
            <button type="button" data-qty="-1" aria-label="Decrease quantity">&minus;</button>
            <span>${i.qty}</span>
            <button type="button" data-qty="1" aria-label="Increase quantity">+</button>
        </div>
    </div>
    <div class="line-side">
        <p class="line-price">${money(i.price * i.qty)}</p>
        <button type="button" class="link-btn" data-remove>Remove</button>
    </div>
</li>`).join('') + `</ul>`;
            $('[data-cart-subtotal]', drawer).textContent = money(subtotal());
        }
        $$('[data-cart-count]').forEach(el => { el.textContent = count(); });
    }

    function save() { storage.write(cart); renderCart(); }

    function addToCart(item) {
        const key = [item.id, item.colour, item.size].join('|');
        const existing = cart.find(i => i.key === key);
        if (existing) existing.qty += 1;
        else cart.push({ key, qty: 1, ...item });
        save();
        announce(`Added ${item.name}, ${item.colour}${item.size && item.size !== 'One size' ? ', ' + item.size : ''} to your cart.`);
    }

    function bindDrawer() {
        document.addEventListener('click', e => {
            if (e.target.closest('[data-cart-open]')) { e.preventDefault(); openCart(); }
        });
        overlay.addEventListener('click', () => closeCart());
        $('[data-cart-close]', drawer).addEventListener('click', () => closeCart());
        drawer.addEventListener('click', e => {
            const line = e.target.closest('.line');
            if (e.target.closest('[data-cart-clear]')) { cart = []; save(); return; }
            if (e.target.closest('[data-checkout]')) { closeCart(false); openCheckout(); return; }
            if (!line) return;
            const item = cart.find(i => i.key === line.dataset.key);
            if (!item) return;
            const q = e.target.closest('[data-qty]');
            if (q) {
                item.qty += Number(q.dataset.qty);
                if (item.qty < 1) cart = cart.filter(i => i !== item);
                save();
                const again = $(`.line[data-key="${CSS.escape(line.dataset.key)}"] [data-qty="${q.dataset.qty}"]`, drawer);
                if (again) again.focus();
            }
            if (e.target.closest('[data-remove]')) { cart = cart.filter(i => i !== item); save(); }
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeCart();
        });
    }

    /* ---------- Dialog helpers ---------- */
    function bindDialog(dlg) {
        dlg.addEventListener('click', e => {
            if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
        });
        dlg.addEventListener('close', () => {
            syncScrollLock();
            if (lastFocus && document.contains(lastFocus) && !drawer.classList.contains('is-open')) lastFocus.focus();
        });
    }
    function showDialog(dlg) {
        lastFocus = document.activeElement;
        dlg.showModal();
        syncScrollLock();
    }

    /* ---------- Product cards (colour swatches + image swap) ---------- */
    function cardImages(card, colour) {
        const raw = card.getAttribute('data-imgs-' + colour) || '';
        return raw.split('|').filter(Boolean);
    }

    function setCardColour(card, colour) {
        const imgs = cardImages(card, colour);
        if (!imgs.length) return;
        card.dataset.colour = colour;
        const media = $('.card-media', card);
        const main = $('.main', media);
        main.src = imgs[0];
        main.alt = `${card.dataset.name} in ${colour}`;
        let alt = $('.alt', media);
        if (imgs[1]) {
            if (!alt) {
                alt = document.createElement('img');
                alt.className = 'alt'; alt.alt = ''; alt.loading = 'lazy'; alt.width = 1000; alt.height = 1250;
                media.appendChild(alt);
            }
            alt.src = imgs[1];
            media.classList.add('has-alt');
        } else {
            if (alt) alt.remove();
            media.classList.remove('has-alt');
        }
        $$('.swatch', card).forEach(s => s.setAttribute('aria-pressed', String(s.dataset.colour === colour)));
    }

    function productFromCard(card) {
        const d = card.dataset;
        return {
            id: d.id, name: d.name, price: Number(d.price),
            sizes: d.sizes.split(','), colours: d.colours.split(','),
            desc: d.desc, details: (d.details || '').split('|').filter(Boolean),
            colour: d.colour || d.colours.split(',')[0],
            imgs: Object.fromEntries(d.colours.split(',').map(c => [c, cardImages(card, c)]))
        };
    }

    function bindCards() {
        document.addEventListener('click', e => {
            const card = e.target.closest('.card');
            if (!card) return;

            const sw = e.target.closest('.swatch');
            if (sw) { setCardColour(card, sw.dataset.colour); return; }

            if (e.target.closest('.card-media')) { openProduct(card); return; }

            const add = e.target.closest('[data-card-add]');
            if (add) {
                const p = productFromCard(card);
                if (p.sizes.length === 1) {
                    addToCart({ id: p.id, name: p.name, price: p.price, colour: p.colour, size: p.sizes[0], img: p.imgs[p.colour][0] });
                    openCart();
                } else {
                    openProduct(card);
                }
            }
        });
    }

    /* ---------- Product dialog ---------- */
    let pd = null;

    function openProduct(card) {
        pd = productFromCard(card);
        $('#pd-title').textContent = pd.name;
        $('#pd-price').textContent = money(pd.price);
        $('#pd-desc').textContent = pd.desc;
        $('#pd-details').innerHTML = pd.details.map(t => `<li>${esc(t)}</li>`).join('');
        $('#pd-error').textContent = '';

        const colourWrap = $('#pd-colours');
        colourWrap.innerHTML = pd.colours.map(c => `
<label class="option swatch-opt" data-colour="${c}">
    <input type="radio" name="pd-colour" value="${c}" ${c === pd.colour ? 'checked' : ''}>
    <span><span class="sr-only">${cap(c)}</span></span>
</label>`).join('');
        $('#pd-colour-wrap').hidden = pd.colours.length < 2;

        const sizeWrap = $('#pd-sizes');
        sizeWrap.innerHTML = pd.sizes.map(s => `
<label class="option">
    <input type="radio" name="pd-size" value="${esc(s)}" ${pd.sizes.length === 1 ? 'checked' : ''}>
    <span>${esc(s)}</span>
</label>`).join('');
        $('#pd-size-wrap').hidden = pd.sizes.length === 1;

        paintGallery(pd.colour);
        showDialog(productDialog);
    }

    function paintGallery(colour) {
        pd.colour = colour;
        $('#pd-colour-label').textContent = cap(colour);
        const imgs = pd.imgs[colour];
        const main = $('#pd-main');
        main.src = imgs[0];
        main.alt = `${pd.name} in ${colour}`;
        const thumbs = $('#pd-thumbs');
        if (imgs.length > 1) {
            thumbs.hidden = false;
            thumbs.innerHTML = imgs.map((src, i) => `
<button type="button" data-src="${esc(src)}" aria-label="View image ${i + 1} of ${imgs.length}" ${i === 0 ? 'aria-current="true"' : ''}>
    <img src="${esc(src)}" alt="">
</button>`).join('');
        } else {
            thumbs.hidden = true;
            thumbs.innerHTML = '';
        }
    }

    function bindProductDialog() {
        bindDialog(productDialog);
        productDialog.addEventListener('change', e => {
            if (e.target.name === 'pd-colour') paintGallery(e.target.value);
            if (e.target.name === 'pd-size') $('#pd-error').textContent = '';
        });
        $('#pd-thumbs').addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            $('#pd-main').src = b.dataset.src;
            $$('#pd-thumbs button').forEach(x => x.removeAttribute('aria-current'));
            b.setAttribute('aria-current', 'true');
        });
        $('#pd-add').addEventListener('click', () => {
            const size = $('input[name="pd-size"]:checked', productDialog);
            if (!size) {
                $('#pd-error').textContent = 'Choose a size before adding to your cart.';
                $('input[name="pd-size"]', productDialog).focus();
                return;
            }
            addToCart({ id: pd.id, name: pd.name, price: pd.price, colour: pd.colour, size: size.value, img: pd.imgs[pd.colour][0] });
            productDialog.close();
            openCart();
        });
    }

    /* ---------- Checkout (demo) ---------- */
    function openCheckout() {
        if (cart.length === 0) { openCart(); return; }
        $('#co-main').hidden = false;
        $('#co-done').hidden = true;
        $('#co-lines').innerHTML = cart.map(i => `
<li><span>${i.qty} &times; ${esc(i.name)} (${esc(cap(i.colour))}${i.size && i.size !== 'One size' ? ', ' + esc(i.size) : ''})</span><span>${money(i.qty * i.price)}</span></li>`).join('');
        $('#co-sub').textContent = money(subtotal());
        $('#co-del').textContent = delivery() === 0 ? 'Free' : money(delivery());
        $('#co-total').textContent = money(subtotal() + delivery());
        showDialog(checkoutDialog);
    }

    function bindCheckout() {
        bindDialog(checkoutDialog);
        const form = $('#checkout-form');
        form.addEventListener('submit', e => {
            e.preventDefault();
            if (!validateForm(form)) return;
            const ref = 'GP-' + Math.floor(100000 + Math.random() * 900000);
            const name = form.elements.name.value.trim().split(' ')[0];
            $('#co-done-text').textContent = `Thanks, ${name}. Your order ${ref} is confirmed. Total: ${money(subtotal() + delivery())}.`;
            cart = [];
            save();
            form.reset();
            $('#co-main').hidden = true;
            const done = $('#co-done');
            done.hidden = false;
            done.focus();
        });
    }

    /* ---------- Form validation (all forms with data-form) ---------- */
    function fieldMessage(el) {
        const v = el.validity;
        if (v.valueMissing) return el.dataset.msgRequired || 'This field is required.';
        if (v.typeMismatch || v.patternMismatch) return el.dataset.msgInvalid || 'Check this value and try again.';
        if (v.tooShort) return el.dataset.msgShort || `Use at least ${el.minLength} characters.`;
        return '';
    }

    function showFieldError(el, msg) {
        const field = el.closest('.field');
        const out = field && $('.field-error', field);
        el.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (out) { out.textContent = msg; out.hidden = !msg; }
    }

    function validateForm(form) {
        let firstBad = null;
        $$('input, select, textarea', form).forEach(el => {
            if (el.type === 'hidden' || el.type === 'submit') return;
            const msg = el.checkValidity() ? '' : fieldMessage(el);
            showFieldError(el, msg);
            if (msg && !firstBad) firstBad = el;
        });
        if (firstBad) firstBad.focus();
        return !firstBad;
    }

    function initForms() {
        $$('form[data-form]').forEach(form => {
            form.noValidate = true;
            form.addEventListener('input', e => {
                if (e.target.getAttribute('aria-invalid') === 'true' && e.target.checkValidity()) showFieldError(e.target, '');
            });
            form.addEventListener('submit', e => {
                e.preventDefault();
                if (!validateForm(form)) return;
                const success = $('[data-success]', form.parentElement);
                form.hidden = true;
                if (success) { success.hidden = false; success.focus(); }
            });
            const wrap = form.parentElement;
            const again = $('[data-form-reset]', wrap);
            if (again) again.addEventListener('click', () => {
                form.reset();
                $$('[aria-invalid]', form).forEach(el => showFieldError(el, ''));
                $('[data-success]', wrap).hidden = true;
                form.hidden = false;
                $('input, textarea, select', form).focus();
            });
        });
    }

    /* ---------- Mobile navigation ---------- */
    function initNav() {
        const toggle = $('.nav-toggle');
        const nav = $('#site-nav');
        if (!toggle || !nav) return;
        const set = open => {
            nav.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.innerHTML = open ? '&#10005;' : '&#9776;';
            toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        };
        toggle.addEventListener('click', () => set(!nav.classList.contains('is-open')));
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); toggle.focus(); } });
        window.matchMedia('(min-width: 981px)').addEventListener('change', () => set(false));
    }

    /* ---------- Shop filters ---------- */
    function initShop() {
        const grid = $('#product-grid');
        if (!grid) return;
        const cards = $$('.card', grid);
        const state = { cat: 'all', colour: 'all', sort: 'featured' };
        const params = new URLSearchParams(location.search);
        const wanted = params.get('cat');
        if (wanted && $(`[data-filter-cat="${CSS.escape(wanted)}"]`)) state.cat = wanted;

        const countEl = $('#result-count');
        const empty = $('#empty-state');

        function apply() {
            let shown = 0;
            cards.forEach(c => {
                const okCat = state.cat === 'all' || c.dataset.category === state.cat;
                const okColour = state.colour === 'all' || c.dataset.colours.split(',').includes(state.colour);
                c.hidden = !(okCat && okColour);
                if (!c.hidden) {
                    shown++;
                    if (state.colour !== 'all') setCardColour(c, state.colour);
                }
            });
            const sorted = cards.slice().sort((a, b) => {
                if (state.sort === 'low') return a.dataset.price - b.dataset.price;
                if (state.sort === 'high') return b.dataset.price - a.dataset.price;
                return a.dataset.order - b.dataset.order;
            });
            sorted.forEach(c => grid.appendChild(c));
            countEl.textContent = shown === 1 ? '1 product' : `${shown} products`;
            empty.hidden = shown !== 0;
            grid.hidden = shown === 0;
            $$('[data-filter-cat]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filterCat === state.cat)));
            $$('[data-filter-colour]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filterColour === state.colour)));
        }

        document.addEventListener('click', e => {
            const cat = e.target.closest('[data-filter-cat]');
            const col = e.target.closest('[data-filter-colour]');
            if (cat) { state.cat = cat.dataset.filterCat; apply(); }
            if (col) { state.colour = col.dataset.filterColour; apply(); }
            if (e.target.closest('[data-clear-filters]')) { state.cat = 'all'; state.colour = 'all'; apply(); }
        });
        $('#sort').addEventListener('change', e => { state.sort = e.target.value; apply(); });
        apply();
    }

    /* ---------- Lookbook ---------- */
    function initLookbook() {
        const grid = $('#look-grid');
        if (!grid) return;
        const items = $$('.look', grid);
        const box = $('#lightbox');
        const img = $('#lightbox-img');
        const caption = $('#lightbox-cap');
        let index = 0;

        const visible = () => items.filter(i => !i.hidden);
        function show(i) {
            const list = visible();
            index = (i + list.length) % list.length;
            const el = list[index];
            img.src = el.dataset.src;
            img.alt = el.dataset.alt;
            caption.textContent = el.dataset.caption;
        }

        grid.addEventListener('click', e => {
            const b = e.target.closest('.look');
            if (!b) return;
            lastFocus = b;
            show(visible().indexOf(b));
            box.showModal();
            syncScrollLock();
        });
        $('#lightbox-prev').addEventListener('click', () => show(index - 1));
        $('#lightbox-next').addEventListener('click', () => show(index + 1));
        box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) box.close(); });
        box.addEventListener('close', () => { syncScrollLock(); if (lastFocus) lastFocus.focus(); });
        box.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') show(index - 1);
            if (e.key === 'ArrowRight') show(index + 1);
        });

        $$('[data-look-filter]').forEach(btn => btn.addEventListener('click', () => {
            const tone = btn.dataset.lookFilter;
            items.forEach(i => { i.hidden = !(tone === 'all' || i.dataset.tone === tone); });
            $$('[data-look-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
            $('#look-count').textContent = `${visible().length} looks`;
        }));
    }

    /* ---------- Init ---------- */
    document.addEventListener('DOMContentLoaded', () => {
        injectUI();
        bindDrawer();
        bindProductDialog();
        bindCheckout();
        bindCards();
        initNav();
        initForms();
        initShop();
        initLookbook();
        renderCart();
        // keep multiple tabs in sync
        window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) { cart = storage.read(); renderCart(); } });
    });
})();
