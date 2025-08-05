window.catalogData = {};
window.catalogCounts = {};

function productSortFun(a, b) {
  // Group A: Available products (closingQuantity > 0)
  const aAvailable = a.closingQuantity > 0;
  const bAvailable = b.closingQuantity > 0;
  if (aAvailable && bAvailable) {
    // Both are available – sort by highest sold first
    return (b.sold ?? 0) - (a.sold ?? 0);
  }
  if (aAvailable !== bAvailable) {
    // Available products come first
    return aAvailable ? -1 : 1;
  }

  // Group B: Not available products (closingQuantity == 0)
  const aOrdered = a.alreadyOrdered ? 1 : 0;
  const bOrdered = b.alreadyOrdered ? 1 : 0;

  // First: alreadyOrdered products (descending)
  if (aOrdered !== bOrdered) return bOrdered - aOrdered;

  // Otherwise, maintain relative order
  return 0;
}

function attachBarcodeScanner(inputElem) {
  // 1) wrap the input in a relative-positioned container
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  inputElem.parentNode.insertBefore(wrapper, inputElem);
  wrapper.appendChild(inputElem);

  // 2) style the input a bit
  inputElem.style.padding = '8px 40px 8px 8px';
  inputElem.style.boxSizing = 'border-box';
  inputElem.style.width = '100%';

  // 3) create the scan button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Scan barcode');
  btn.style.position = 'absolute';
  btn.style.top = '50%';
  btn.style.right = '0px';
  btn.style.transform = 'translateY(-50%)';
  btn.style.border = 'none';
  btn.style.background = 'transparent';
  btn.style.cursor = 'pointer';
  btn.style.width = '54px';
  btn.style.opacity = '0.2';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" style="height:auto;fill:currentColor;">
      <!-- Top-left corner -->
      <rect x="20" y="20" width="50" height="10" rx="5"/>
      <rect x="20" y="20" width="10" height="50" rx="5"/>

      <!-- Top-right corner -->
      <rect x="230" y="20" width="50" height="10" rx="5"/>
      <rect x="270" y="20" width="10" height="50" rx="5"/>

      <!-- Bottom-left corner -->
      <rect x="20" y="170" width="50" height="10" rx="5"/>
      <rect x="20" y="130" width="10" height="50" rx="5"/>

      <!-- Bottom-right corner -->
      <rect x="230" y="170" width="50" height="10" rx="5"/>
      <rect x="270" y="130" width="10" height="50" rx="5"/>

      <!-- Six barcode bars -->
      <rect x="74"  y="40" width="12" height="120" rx="6"/>
      <rect x="102" y="40" width="12" height="120" rx="6"/>
      <rect x="130" y="40" width="12" height="120" rx="6"/>
      <rect x="158" y="40" width="12" height="120" rx="6"/>
      <rect x="186" y="40" width="12" height="120" rx="6"/>
      <rect x="214" y="40" width="12" height="120" rx="6"/>
    </svg>
  `;
  wrapper.appendChild(btn);

  // 4) when clicked, open the scanner
  btn.addEventListener('click', () => openScanner(inputElem));
}

// Opens the full-screen scanner overlay, runs Quagga, and cleans up.
function openScanner(targetInput) {
  // overlay backdrop
  const overlay = document.createElement('div');
  overlay.id = 'barcode-scanner-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000
  });

  // scanning container to center the video
  const container = document.createElement('div');
  container.id = 'scanner-container';
  Object.assign(container.style, {
    position: 'relative',
    width: '80%',
    maxWidth: '600px',
    aspectRatio: '4/3',
    background: '#000',
    overflow: 'hidden'
  });
  overlay.appendChild(container);

  // close button
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.innerText = '✕';
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '8px',
    right: '8px',
    fontSize: '1.5rem',
    color: '#fff',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    zIndex: 10001
  });
  container.appendChild(closeBtn);

  // add to DOM
  document.body.appendChild(overlay);

  // teardown helper
  function cleanup() {
    try {
      Quagga.stop();
    } catch (e) {
      /*ignore*/
    }
    Quagga.offDetected(onDetected);
    document.body.removeChild(overlay);
  }

  closeBtn.addEventListener('click', cleanup);

  // start Quagga
  Quagga.init(
    {
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: container,
        constraints: { facingMode: 'environment' }
      },
      decoder: {
        readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'upc_reader']
      },
      locate: true
    },
    (err) => {
      if (err) {
        console.error('Quagga init error:', err);
        cleanup();
        return;
      }
      Quagga.start();
    }
  );

  // on detection, fill input and close
  function onDetected(result) {
    const code = result.codeResult.code;
    targetInput.value = code;
    cleanup();
  }
  Quagga.onDetected(onDetected);
}

/**
 * Internal: Initialize Quagga and listen for barcodes.
 * @param {function(string)} callback - Called with decoded code.
 */
function startQuagga(callback) {
  Quagga.init(
    {
      inputStream: {
        type: 'LiveStream',
        target: document.getElementById('barcode-video-container'),
        constraints: { facingMode: 'environment' }
      },
      decoder: {
        readers: ['ean_reader', 'code_128_reader', 'upc_reader']
      }
    },
    (err) => {
      if (err) {
        console.error(err);
        return;
      }
      Quagga.start();
      Quagga.onDetected((res) => {
        callback(res.codeResult.code);
        Quagga.offDetected();
      });
    }
  );
}

// Expose globally
window.attachBarcodeScanner = attachBarcodeScanner;

function getThumbnailImage(url) {
  return url.replace(/(\.jpg|\.png|\.webp|\.jpeg)(\?.*)?$/, '_150x150$1$2');
}

function showLoader(show = true) {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.toggle('hidden', !show);
}

function showProductsFromCatalog(catalog) {
  const catalogList = document.getElementById('catalogList');
  const productList = document.getElementById('productList');
  const productListWrapper = document.getElementById('productListWrapper');
  const mapWrapper = document.getElementById('mapWrapper');
  const categoryTitle = document.getElementById('categoryTitle');

  if (
    !catalogList ||
    !productListWrapper ||
    !mapWrapper ||
    !categoryTitle ||
    !productList
  )
    return;
  catalogList.classList.add('hidden');
  productListWrapper.classList.remove('hidden');
  mapWrapper.classList.add('hidden');

  productList.innerHTML = '';
  categoryTitle.textContent = catalog.replace(/-/g, ' ');

  if (catalog === 'these-products-are-in-transport-and-they-will-arrive-soon') {
    Object.values(productInfo)
      .filter((p) => p?.stock === 0 && p.alreadyOrdered !== undefined)
      .forEach((product) =>
        createProductItem(product, productList, { skipStock: true })
      );
  } else {
    Object.values(productInfo)
      .filter((p) => p?.catalog === catalog)
      .sort(productSortFun)
      .forEach((product) => {
        createProductItem(product, productList);
      });
  }
}

function showCatalogs() {
  if (!catalogList || !productListWrapper || !mapWrapper) return;
  catalogList.classList.remove('hidden');
  productListWrapper.classList.add('hidden');
  mapWrapper.classList.remove('hidden');
  catalogList.innerHTML = '';

  // const div = document.createElement('div');
  // div.className = 'catalog-item';
  // div.innerHTML = `
  //     <img src="https://static.vecteezy.com/system/resources/previews/002/544/264/non_2x/cartoon-semi-truck-illustration-vector.jpg" alt="New" />
  //     <div class="catalog-title">Arriving Soon</div>
  //   `;
  // div.onclick = () =>
  //   window.location.hash = `#catalog/these-products-are-in-transport-and-they-will-arrive-soon`;
  // catalogList.appendChild(div);

  Object.entries(window.catalogData).forEach(([catalog, image]) => {
    const div = document.createElement('div');
    div.className = 'catalog-item';
    div.innerHTML = `
        <img src="${getThumbnailImage(image)}" alt="${catalog}" />
        <div class="catalog-title">${catalog.replace(/-/g, ' ')}<br>(${
      window.catalogCounts[catalog] || 0
    } items)</div>
      `;
    div.onclick = () => (window.location.hash = `#catalog/${catalog}`);
    catalogList.appendChild(div);
  });
}
function doesProductMatchSearch(query, product) {
  if (!query || !product) return false;

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;

  const fields = [product.title, product.handle, product.sku]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');

  const searchableTokens = fields.split(/\s+/).concat(product.sku || '');

  const queryWords = normalizedQuery.split(/\s+/);
  return queryWords.every((queryWord) =>
    searchableTokens.some((token) => token.includes(queryWord))
  );
}

function handleRoute() {
  const hash = window.location.hash;
  const modal = document.getElementById('product-modal');
  if (
    modal &&
    modal.style.display !== 'none' &&
    !hash.startsWith('#product/')
  ) {
    modal.style.display = 'none';
  }

  const parts = hash.slice(1).split('/');
  const searchInput = document.getElementById('searchInput');

  if (parts.length <= 1 || parts[0] === '') {
    showCatalogs();
    if (searchInput) searchInput.value = '';
    return;
  }

  if (parts[0] === 'catalog' && parts[1]) {
    const catalog = parts[1];
    showProductsFromCatalog(catalog);
    if (searchInput) searchInput.value = '';
    return;
  }

  if (parts[0] === 'search' && parts[1]) {
    const query = decodeURIComponent(parts[1]);
    if (searchInput) searchInput.value = query;
    searchProducts(query);
    return;
  }

  if (parts[0] === 'product' && parts[1]) {
    const handle = parts[1];
    const product = Object.values(window.productInfo).find(
      (p) => p.handle === handle
    );
    if (product) {
      if (product.catalog) {
        showProductsFromCatalog(product.catalog);
      } else {
        showCatalogs();
      }
      showProductDetails(product);
    } else {
      showCatalogs();
    }
    if (searchInput) searchInput.value = '';
    return;
  }

  // default
  showCatalogs();
  if (searchInput) searchInput.value = '';
}

function initProductModal() {
  let modal = document.getElementById('product-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'product-modal';
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0px',
      left: '0px',
      height: '100%',
      width: '100%',
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000,
      display: 'none' // Initially hidden
    });
    const content = document.createElement('div');
    content.className = 'modal-content';
    Object.assign(content.style, {
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      width: '90%',
      maxWidth: '500px',
      position: 'relative',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column'
    });
    content.innerHTML = `
      <span class="modal-close close-btn" style="position: absolute; top: 10px; right: 15px; font-size: 24px; cursor: pointer;">×</span>
      <div class="carousel" style="position: relative; overflow: hidden; touch-action: pan-y; user-select: none;">
        <div class="carousel-inner" style="display: flex; transition: transform 0.3s ease;">
          <!-- Images will be inserted here -->
        </div>
        <button class="modal-prev arrow" style="position: absolute; top: 50%; left: 10px; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; padding: 10px; font-size: 18px; cursor: pointer; display: none;">❮</button>
        <button class="modal-next arrow" style="position: absolute; top: 50%; right: 10px; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; padding: 10px; font-size: 18px; cursor: pointer; display: none;">❯</button>
        <div class="carousel-dots" style="position: absolute; bottom: 10px; width: 100%; text-align: center;"></div>
      </div>
      <h3 class="product-title" id="modal-title" style="margin: 15px 0 10px;"></h3>
      <p id="modal-sku" style="margin: 5px 0;"></p>
      <p class="product-price" id="modal-price" style="font-weight: bold;font-size: 34px;top: -15px;"></p>
      <p class="product-stock" id="modal-stock" style="margin: 5px 0;"></p>
      <p class="product-stock-rack" id="modal-rack" style="margin: 5px 0;"></p>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);
    const closeBtn = content.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      const hash = window.location.hash;
      if (hash.startsWith('#product/')) {
        const handle = hash.slice(9);
        const product = Object.values(window.productInfo).find(
          (p) => p.handle === handle
        );
        if (product && product.catalog) {
          window.location.hash = `#catalog/${product.catalog}`;
        } else {
          window.location.hash = '';
        }
      }
    });
  }
}

function showProductDetails(product) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  document.getElementById('modal-title').textContent =
    product.title || 'Untitled';
  document.getElementById('modal-sku').textContent = `SKU: ${
    product.sku || 'N/A'
  }`;

  const salePrice = product.items_per_bag
    ? Math.round(product.salePrice / product.items_per_bag) + ' per item'
    : product.salePrice;
  document.getElementById('modal-price').textContent = `₹ ${salePrice}`;

  const quantity = product.items_per_bag
    ? Math.round(product.closingQuantity * product.items_per_bag)
    : product.closingQuantity;
  let stockText =
    quantity > 0
      ? `Available: ${quantity}${product.items_per_bag ? ' items' : ''}`
      : product.alreadyOrdered > 0
      ? 'Arriving soon'
      : 'Out of Stock';
  document.getElementById('modal-stock').textContent = stockText;

  document.getElementById('modal-rack').textContent =
    product.rackNumber && quantity > 0 ? `Rack: ${product.rackNumber}` : '';

  const images = product.images || ['default.jpg'];
  const carousel = document.querySelector('.carousel');
  const inner = carousel.querySelector('.carousel-inner');
  const dotsContainer = carousel.querySelector('.carousel-dots');
  const prevBtn = carousel.querySelector('.modal-prev');
  const nextBtn = carousel.querySelector('.modal-next');
  let currentIndex = 0;
  let startX = 0;
  let isDragging = false;

  function updateCarousel() {
    inner.style.transform = `translateX(-${currentIndex * 100}%)`;
    const dots = dotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('active', i === currentIndex);
    }
  }

  function createDots() {
    dotsContainer.innerHTML = images
      .map(
        (_, i) => `
      <span class="dot" style="border: 1px solid black; display: inline-block; width: 8px; height: 8px; margin: 0 5px; border-radius: 50%; cursor: pointer;"></span>
    `
      )
      .join('');
  }

  inner.innerHTML = images
    .map(
      (img) => `
    <img src="${img}" style="width: 100%; height: auto;     max-height: 100vw; flex: 0 0 100%; object-fit: contain;">
  `
    )
    .join('');
  createDots();
  updateCarousel();

  prevBtn.style.display = images.length > 1 ? 'block' : 'none';
  nextBtn.style.display = images.length > 1 ? 'block' : 'none';

  function prevFunc() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateCarousel();
  }

  function nextFunc() {
    currentIndex = (currentIndex + 1) % images.length;
    updateCarousel();
  }

  prevBtn.onclick = prevFunc;
  nextBtn.onclick = nextFunc;

  dotsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('dot')) {
      currentIndex = Array.from(dotsContainer.children).indexOf(e.target);
      updateCarousel();
    }
  });

  carousel.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  });

  carousel.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = startX - currentX;
    if (Math.abs(diff) > 5) {
      e.preventDefault();
    }
  });

  carousel.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextFunc();
      else prevFunc();
    }
  });

  modal.style.display = 'flex';
}

function createProductItem(product, productList, config = {}) {
  if (!product || !productList) return;
  const div = document.createElement('div');
  div.className = 'product-item';
  // add out-of-stock class if stock is 0
  if (
    !config.skipStock &&
    product.closingQuantity === 0 &&
    !product.alreadyOrdered
  ) {
    div.classList.add('out-of-stock');
  }
  const salePrice = product.items_per_bag
    ? Math.round(product.salePrice / product.items_per_bag) + ' per item'
    : product.salePrice;

  const imageUrl = getThumbnailImage(product.images?.[0] || 'default.jpg');
  div.innerHTML = `
      <div class="product-link" style="text-decoration: none; color: inherit;">
        <div class="product-price">
          ₹ ${salePrice}
        </div>
        <div style="position: relative;">
          <img src="${imageUrl}" alt="${product.title || 'Product'}" />
          ${
            (product.items_per_bag
              ? Math.round(
                  (product.closingQuantity || 0) * product.items_per_bag
                )
              : product.closingQuantity || 0) > 0
              ? ''
              : product.alreadyOrdered > 0
              ? '<span class="truck">⛟</span>'
              : '<span class="not-available">Out of Stock</span>'
          }
        </div>
        <div class="product-title">${product.sku || 'N/A'}</div>
        <div class="product-title">${product.title || 'Untitled'}</div>
        ${
          config.skipStock === true
            ? ''
            : `
  <div class="product-stock" data-sku="${product.sku || ''}">
    ${
      (product.items_per_bag
        ? Math.round((product.closingQuantity || 0) * product.items_per_bag)
        : product.closingQuantity || 0) > 0
        ? `Available: ${
            product.items_per_bag
              ? Math.round(
                  (product.closingQuantity || 0) * product.items_per_bag
                ) + ' items'
              : product.closingQuantity || 0
          }`
        : product.alreadyOrdered > 0
        ? `Arriving soon`
        : 'Out of Stock'
    }
  </div>
  <div class="product-stock-rack" data-sku="${product.sku || ''}">
    ${
      window.productInfo?.[product.itemCode]?.rackNumber &&
      product.closingQuantity > 0
        ? `Rack: ${window.productInfo?.[product.itemCode]?.rackNumber}`
        : ''
    }
  </div>
`
        }
      </div>
    `;
  productList.appendChild(div);
  div.addEventListener('click', () => {
    window.location.hash = `#product/${product.handle}`;
  });
}

function searchProducts(keyword) {
  if (!catalogList || !productListWrapper || !categoryTitle || !productList)
    return;
  const lowerKeyword = keyword.toLowerCase();
  catalogList.classList.add('hidden');
  productListWrapper.classList.remove('hidden');
  categoryTitle.textContent = '';
  productList.innerHTML = '';

  const results = Object.values(productInfo).filter((p) =>
    doesProductMatchSearch(lowerKeyword, p)
  );

  if (results.length === 0) {
    productList.innerHTML = '<p style="margin: 1rem;">No products found.</p>';
    return;
  }

  console.log('results', results);
  // Sort and show closingQuantity 0 products in the last
  results.sort(productSortFun);
  results.forEach((product) => createProductItem(product, productList));
}

let searchDebounce;

window.addEventListener('load', () => {
  showLoader(true);
  initProductModal();
  attachBarcodeScanner(document.getElementById('searchInput'));

  // Fetch productInfo from this api
  //
  if (!window.productInfo || Object.keys(window.productInfo).length === 0) {
    fetch(
      //'https://6000-firebase-studio-1750177395742.cluster-isls3qj2gbd5qs4jkjqvhahfv6.cloudworkstations.dev/api/public-data'
      'https://stock.doonb2b.com/api/public-data'
      // 'https://stock.doonb2b.com/api/rack-data'
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        window.productInfo = data;

        const productInfo = window.productInfo || {};

        for (const sku in productInfo) {
          const product = productInfo[sku];
          if (!product?.catalog || !product?.images?.length) continue;
          if (!window.catalogData[product.catalog]) {
            window.catalogData[product.catalog] = product.images[0];
            window.catalogCounts[product.catalog] = 1;
          } else {
            window.catalogCounts[product.catalog]++;
          }
        }

        const backLink = document.getElementById('backLink');
        const header = document.getElementById('header');
        const searchInput = document.getElementById('searchInput');

        if (searchInput) {
          searchInput.addEventListener('input', () => {
            const keyword = searchInput.value.trim();
            if (keyword === '') {
              showCatalogs();
            } else {
              searchProducts(keyword);
            }
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
              if (keyword === '') {
                window.location.hash = '';
              } else {
                window.location.hash = `#search/${encodeURIComponent(keyword)}`;
              }
            }, 500);
          });
        }

        if (backLink) {
          backLink.onclick = (e) => {
            e.preventDefault();
            window.location.hash = '';
          };
        }

        if (header) {
          header.onclick = (e) => {
            e.preventDefault();
            window.location.hash = '';
          };
        }

        showCatalogs();
        showLoader(false);
        window.addEventListener('hashchange', handleRoute);
        handleRoute();
      })
      .catch((error) => {
        console.error('Error fetching product info:', error);
        window.productInfo = {};
      });
  }
});

!(function () {
  var n;
  ((n =
    (((n = document.createElement('style')).innerHTML =
      '\n      .whatsapp-widget {\n        position: fixed;\n        bottom: 20px;\n        right: 20px;\n        z-index: 9999;\n      }\n      .whatsapp-button {\n        background-color: #25D366;\n        border-radius: 50%;\n        width: 60px;\n        height: 60px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);\n        cursor: pointer;\n        transition: transform 0.2s ease, box-shadow 0.2s ease;\n      }\n      .whatsapp-button:hover {\n        transform: scale(1.1);\n        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);\n      }\n      .whatsapp-icon {\n        width: 32px;\n        height: 32px;\n      }\n\n      @media (max-width: 600px) {\n        .whatsapp-button {\n          width: 50px;\n          height: 50px;\n        }\n        .whatsapp-icon {\n          width: 26px;\n          height: 26px;\n        }\n      }\n    '),
    document.head.appendChild(n),
    document.createElement('div'))).className = 'whatsapp-widget'),
    (n.innerHTML =
      '\n      <div class="whatsapp-button" id="whatsapp-btn">\n        <img class="whatsapp-icon" src="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/whatsapp.svg" alt="WhatsApp">\n      </div>\n    '),
    document.body.appendChild(n),
    document
      .getElementById('whatsapp-btn')
      .addEventListener('click', function () {
        var n = encodeURIComponent('location');
        window.open('https://wa.me/+919834763808?text=' + n, '_blank');
      });
})();
