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

function initProductModal() {
  let modal = document.getElementById('product-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'product-modal';
    Object.assign(modal.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.5)',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '10000'
    });
    const content = document.createElement('div');
    content.className = 'modal-content';
    Object.assign(content.style, {
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      width: '90%',
      maxWidth: '500px',
      position: 'relative'
    });
    content.innerHTML = `
      <span class="modal-close close-btn">&times;</span>
      <div class="carousel" style="position: relative; overflow: hidden;">
        <img id="modal-image" style="width: 100%; height: auto;">
        <button class="modal-prev arrow" style="position: absolute; top: 50%; left: 10px; transform: translateY(-50%); ">❮</button>
        <button class="modal-next arrow" style="position: absolute; top: 50%; right: 10px; transform: translateY(-50%); ">❯</button>
      </div>
      <h3 class="product-title" id="modal-title"></h3>
      <p id="modal-sku"></p>
      <p class="product-price" id="modal-price"></p>
      <p class="product-stock" id="modal-stock"></p>
      <p class="product-stock-rack" id="modal-rack"></p>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);
    const closeBtn = content.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
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
  const imageElem = document.getElementById('modal-image');
  const prevBtn = document.querySelector('.modal-prev');
  const nextBtn = document.querySelector('.modal-next');
  let currentIndex = 0;

  function updateImage() {
    imageElem.src = images[currentIndex];
  }
  updateImage();

  if (images.length > 1) {
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';
  } else {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  }

  const prevFunc = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateImage();
  };
  const nextFunc = () => {
    currentIndex = (currentIndex + 1) % images.length;
    updateImage();
  };
  prevBtn.onclick = prevFunc;
  nextBtn.onclick = nextFunc;

  const carousel = document.querySelector('.carousel');
  let startX = 0;
  carousel.ontouchstart = (e) => {
    startX = e.touches[0].clientX;
  };
  carousel.ontouchend = (e) => {
    let endX = e.changedTouches[0].clientX;
    if (startX - endX > 50) nextFunc();
    if (endX - startX > 50) prevFunc();
  };

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
  div.addEventListener('click', () => showProductDetails(product));
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
      })
      .catch((error) => {
        console.error('Error fetching product info:', error);
        window.productInfo = {};
      });
  }
});
