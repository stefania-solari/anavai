/* cart.js — shared cart logic for Anavai */
(function() {
  let cart = JSON.parse(sessionStorage.getItem('anavai_cart') || '[]');
  let lastCount = cart.reduce((s, i) => s + i.qty, 0);
  const PRODUCT_MAP = {
    'Solara — Golden Light No.1': { item_id: 'solara-golden-light-01', item_name: 'Solara Golden Light No.1' },
    'Solara — Golden Light': { item_id: 'solara-golden-light', item_name: 'Solara Golden Light' },
    'Undara — Still Waters': { item_id: 'undara-still-waters', item_name: 'Undara Still Waters' },
    'Terrae — Foundation': { item_id: 'terrae-foundation', item_name: 'Terrae Foundation' },
    'Lunara — Night Sky': { item_id: 'lunara-night-sky', item_name: 'Lunara Night Sky' },
    'Aeris — White Breath': { item_id: 'aeris-white-breath', item_name: 'Aeris White Breath' },
    'Ignis — Ember Glow': { item_id: 'ignis-ember-glow', item_name: 'Ignis Ember Glow' },
    'Herbae — Botanical Garden': { item_id: 'herbae-botanical-garden', item_name: 'Herbae Botanical Garden' },
  };

  function saveCart() {
    sessionStorage.setItem('anavai_cart', JSON.stringify(cart));
  }

  function trackEcom(eventName, payload) {
    if (window.anavaiEcom?.track) window.anavaiEcom.track(eventName, payload);
  }

  function mapItems(items) {
    return items.map(item => {
      const mapped = PRODUCT_MAP[item.name] || { item_id: item.name.toLowerCase().replace(/\s+/g, '-'), item_name: item.name };
      return {
        ...mapped,
        price: item.price,
        quantity: item.qty,
        item_variant: item.detail,
      };
    });
  }

  function buildCheckoutPayload() {
    const box = document.getElementById('checkoutBox');
    if (!box) return null;
    const fields = {};
    box.querySelectorAll('input, textarea, select').forEach((el, idx) => {
      const key = (el.previousElementSibling?.textContent || el.placeholder || `field_${idx}`)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      fields[key || `field_${idx}`] = el.value?.trim() || '';
    });
    return {
      source: 'cart_checkout_modal',
      submitted_at: new Date().toISOString(),
      currency: window.anavaiEcom?.currency || 'EUR',
      customer: fields,
      cart_items: mapItems(cart),
      cart_total: cart.reduce((s, i) => s + i.price * i.qty, 0),
      note: 'Made-to-order enquiry',
    };
  }

  window.addToCart = function(name, detail, price) {
    const existing = cart.find(i => i.name === name);
    if (existing) {
      existing.qty++;
    } else {
      cart.push({ name, detail, price, qty: 1 });
    }
    saveCart();
    updateCartUI();
    showNotif('"' + name + '" added to enquiry');
    openCart();
    trackEcom('add_to_cart', {
      currency: window.anavaiEcom?.currency || 'EUR',
      value: price,
      items: mapItems([{ name, detail, price, qty: 1 }]),
    });
  };

  window.removeFromCart = function(idx) {
    cart.splice(idx, 1);
    saveCart();
    updateCartUI();
  };

  const THUMBS = {
    'Solara': '#EAD8B8',
    'Undara': '#C5D8D8',
    'Lunara': '#28263A',
    'Terrae': '#D2C39E',
    'Aeris':  '#E8EAE0',
    'Ignis':  '#2C1A14',
    'Herbae': '#D0DCCC',
  };
  function thumbColor(name) {
    for (const k in THUMBS) {
      if (name.includes(k)) return THUMBS[k];
    }
    return '#E8DDD0';
  }

  function updateCartUI() {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll('#cartCount').forEach(el => {
      el.textContent = count;
      if (count !== lastCount) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    });
    lastCount = count;

    const itemsEl = document.getElementById('cartItems');
    const footer  = document.getElementById('cartFooter');
    if (!itemsEl) return;

    if (cart.length === 0) {
      itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty</p>';
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'block';
    itemsEl.innerHTML = cart.map((item, i) => `
      <div class="cart-item">
        <div class="cart-item-thumb" style="background:${thumbColor(item.name)}"></div>
        <div class="cart-item-info">
          <p class="cart-item-name">${item.name}</p>
          <p class="cart-item-detail">${item.detail}</p>
          <button class="cart-item-remove" onclick="removeFromCart(${i})">Remove</button>
        </div>
        <div>
          <p class="cart-item-price">€${item.price}/m²</p>
        </div>
      </div>
    `).join('');

    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const sub = document.getElementById('cartSubtotal');
    const tot = document.getElementById('cartTotal');
    if (sub) sub.textContent = '€' + total.toLocaleString();
    if (tot) tot.textContent = '€' + total.toLocaleString();
  }

  window.openCart = function() {
    document.getElementById('cartSidebar')?.classList.add('open');
    document.getElementById('overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  window.closeCart = function() {
    document.getElementById('cartSidebar')?.classList.remove('open');
    document.getElementById('overlay')?.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.openCheckout = function() {
    closeCart();
    document.getElementById('checkoutModal')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    trackEcom('begin_checkout', {
      currency: window.anavaiEcom?.currency || 'EUR',
      value: cart.reduce((s, i) => s + i.price * i.qty, 0),
      items: mapItems(cart),
    });
  };
  window.closeCheckout = function() {
    document.getElementById('checkoutModal')?.classList.remove('open');
    document.body.style.overflow = '';
  };

  window.clearCart = function() {
    cart = [];
    saveCart();
    updateCartUI();
  };

  window.placeOrder = async function() {
    const box = document.getElementById('checkoutBox');
    if (!box) return;
    const payload = buildCheckoutPayload();
    const email = payload?.customer?.email || payload?.customer?.email_address || '';
    if (!email) {
      showNotif('Please add an email before sending');
      return;
    }
    const cta = box.querySelector('.btn-place-order');
    if (cta) {
      cta.disabled = true;
      cta.textContent = 'Sending...';
    }
    let mode = 'demo';
    try {
      if (window.anavaiEcom?.sendEnquiry && payload) {
        const res = await window.anavaiEcom.sendEnquiry(payload);
        mode = res.mode || 'endpoint';
      }
    } catch (err) {
      if (cta) {
        cta.disabled = false;
        cta.textContent = 'Send Enquiry →';
      }
      showNotif('Unable to send enquiry. Please try again.');
      return;
    }
    box.innerHTML = `
      <div class="order-confirm">
        <span class="confirm-mark">✦</span>
        <h2>Enquiry Received</h2>
        <p>Thank you. Our founders will review your project and reach out personally within 48 hours to begin the conversation.<br><br>${mode === 'demo' ? 'Demo mode is active: configure <code>window.ANAVAI_CONFIG.enquiryEndpoint</code> to send enquiries to your CRM/Shopify flow.' : 'Your request has been sent to our project intake system.'}</p>
        <button onclick="closeCheckout(); clearCart();" style="margin-top:2.5rem;background:var(--charcoal);color:var(--cream);border:none;cursor:pointer;padding:0.9rem 2.5rem;font-family:var(--font-body);font-size:0.68rem;letter-spacing:0.2em;text-transform:uppercase;font-weight:400;">Close</button>
      </div>
    `;
    trackEcom('generate_lead', payload || {});
    trackEcom('purchase_intent_submitted', {
      currency: window.anavaiEcom?.currency || 'EUR',
      value: cart.reduce((s, i) => s + i.price * i.qty, 0),
      items: mapItems(cart),
      mode,
    });
    clearCart();
  };

  window.showNotif = function(msg) {
    const el = document.getElementById('notif');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3200);
  };

  // Cart toggle
  document.getElementById('cartToggle')?.addEventListener('click', () => {
    const s = document.getElementById('cartSidebar');
    if (s?.classList.contains('open')) closeCart();
    else openCart();
  });

  // Init
  updateCartUI();
})();
