/* cart.js — shared cart logic for Anavai */
(function() {
  let cart = JSON.parse(sessionStorage.getItem('anavai_cart') || '[]');
  let lastCount = cart.reduce((s, i) => s + i.qty, 0);

  function saveCart() {
    sessionStorage.setItem('anavai_cart', JSON.stringify(cart));
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
  };
  window.closeCheckout = function() {
    document.getElementById('checkoutModal')?.classList.remove('open');
    document.body.style.overflow = '';
  };

  window.placeOrder = function() {
    const box = document.getElementById('checkoutBox');
    if (!box) return;
    box.innerHTML = `
      <div class="order-confirm">
        <span class="confirm-mark">✦</span>
        <h2>Enquiry Received</h2>
        <p>Thank you. Our founders will review your project and reach out personally within 48 hours to begin the conversation.<br><br>In the meantime, we are preparing a tailored sample proposal for your space.</p>
        <button onclick="closeCheckout(); cart=[]; saveCart && saveCart(); updateCartUI();" style="margin-top:2.5rem;background:var(--charcoal);color:var(--cream);border:none;cursor:pointer;padding:0.9rem 2.5rem;font-family:var(--font-body);font-size:0.68rem;letter-spacing:0.2em;text-transform:uppercase;font-weight:400;">Close</button>
      </div>
    `;
    cart = [];
    saveCart();
    updateCartUI();
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
