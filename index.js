window.catalogData = {};
window.catalogCounts = {};

function productSortFun(a, b) {
  // 1) out-of-stock last
  const outA = a.closingQuantity === 0;
  const outB = b.closingQuantity === 0;
  if (outA !== outB) return outA ? 1 : -1;

  // 2) within each group, highest sold first (undefined → 0)
  const soldA = a.sold ?? 0;
  const soldB = b.sold ?? 0;
  return soldB - soldA;
}
/**
 * Attach barcode scanning behavior to an input element.
 * @param {HTMLInputElement} inputElem - The input to attach scanner to.
 */
function attachBarcodeScanner(inputElem) {
  // Wrap input in relative container
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  inputElem.parentNode.insertBefore(wrapper, inputElem);
  wrapper.appendChild(inputElem);

  // Add right padding to input
  const pad = window.getComputedStyle(inputElem).paddingRight;

  inputElem.style.padding = '10px';
  inputElem.style.width = '100%';
  inputElem.style.boxSizing = 'border-box';
  // Ensure single scanner overlay in DOM

  // Create scan button overlay using custom barcode SVG
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" style="height:auto;fill:currentColor;">
      <!-- Top‑left corner -->
      <rect x="20" y="20" width="50" height="10" rx="5"/>
      <rect x="20" y="20" width="10" height="50" rx="5"/>

      <!-- Top‑right corner -->
      <rect x="230" y="20" width="50" height="10" rx="5"/>
      <rect x="270" y="20" width="10" height="50" rx="5"/>

      <!-- Bottom‑left corner -->
      <rect x="20" y="170" width="50" height="10" rx="5"/>
      <rect x="20" y="130" width="10" height="50" rx="5"/>

      <!-- Bottom‑right corner -->
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
  Object.assign(btn.style, {
    position: 'absolute',
    width: '54px',
    border: 'none',
    marginRight: '10px',
    background: 'transparent',
    cursor: 'pointer',
    color: 'rgb(35, 101, 145)',
    padding: '0px',
    right: '0px',
    marginTop: '2px'
  });
  wrapper.appendChild(btn);

  // Ensure single scanner overlay in DOM
  let overlay = document.getElementById('barcode-scanner-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'barcode-scanner-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.5)',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '9999'
    });
    const videoC = document.createElement('div');
    videoC.id = 'barcode-video-container';
    Object.assign(videoC.style, {
      width: '90%',
      maxWidth: '500px',
      borderRadius: '8px',
      overflow: 'hidden'
    });
    overlay.appendChild(videoC);
    document.body.appendChild(overlay);
  }

  btn.addEventListener('click', () => {
    overlay.style.display = 'flex';
    startQuagga((code) => {
      inputElem.value = code;
      inputElem.dispatchEvent(new Event('input', { bubbles: true }));
      Quagga.stop();
      overlay.style.display = 'none';
    });
  });
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
  //   showProductsFromCatalog(`these-products-are-in-transport-and-they-will-arrive-soon`);
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
    div.onclick = () => showProductsFromCatalog(catalog);
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

  const productUrl = `./info.html?itemCode=${encodeURIComponent(
    product.itemCode || ''
  )}`;
  const imageUrl = getThumbnailImage(product.images?.[0] || 'default.jpg');
  //href="${productUrl}"
  div.innerHTML = `
      <div class="product-link" style="text-decoration: none; color: inherit;">
        <div class="product-price">
          ₹ ${salePrice}
        </div>
        <img src="${imageUrl}" alt="${product.title || 'Product'}" />
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
        ? `Stock: ${
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
      window.productInfo?.[product.itemCode]?.rackNumber
        ? `Rack: ${window.productInfo?.[product.itemCode]?.rackNumber}`
        : ''
    }
  </div>
`
        }
      </div>
    `;
  productList.appendChild(div);
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

window.addEventListener('load', () => {
  showLoader(true);
  attachBarcodeScanner(document.getElementById('searchInput'));
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
    });
  }

  if (backLink) {
    backLink.onclick = (e) => {
      e.preventDefault();
      if (searchInput) searchInput.value = '';
      showCatalogs();
    };
  }

  if (header) {
    header.onclick = (e) => {
      e.preventDefault();
      if (searchInput) searchInput.value = '';
      showCatalogs();
    };
  }

  showCatalogs();
  showLoader(false);
});
