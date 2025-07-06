window.addEventListener('load', () => {
  showLoader(true);

  function getThumbnailImage(url) {
    return url.replace(/(\.jpg|\.png|\.webp|\.jpeg)(\?.*)?$/, '_150x150$1$2');
  }

  function showLoader(show = true) {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.toggle('hidden', !show);
  }

  function showProducts(catalog) {
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

    Object.values(productInfo.skuToProductInfo)
      .filter((p) => p?.catalog === catalog)
      .forEach((product) => createProductItem(product, productList));
  }

  function showCatalogs() {
    if (!catalogList || !productListWrapper || !mapWrapper) return;
    catalogList.classList.remove('hidden');
    productListWrapper.classList.add('hidden');
    mapWrapper.classList.remove('hidden');
    catalogList.innerHTML = '';

    Object.entries(catalogData).forEach(([catalog, image]) => {
      const div = document.createElement('div');
      div.className = 'catalog-item';
      div.innerHTML = `
        <img src="${getThumbnailImage(image)}" alt="${catalog}" />
        <div class="catalog-title">${catalog.replace(/-/g, ' ')}<br>(${
        catalogCounts[catalog] || 0
      } items)</div>
      `;
      div.onclick = () => showProducts(catalog);
      catalogList.appendChild(div);
    });
  }
  function refreshVisibleProductsWithRackInfo() {
    const keyword = document.getElementById('searchInput')?.value.trim() || '';
    if (keyword) {
      searchProducts(keyword);
    } else if (
      !document.getElementById('catalogList')?.classList.contains('hidden')
    ) {
      showCatalogs();
    } else {
      const currentCategory =
        document
          .getElementById('categoryTitle')
          ?.textContent.trim()
          .toLowerCase()
          .replace(/\s+/g, '-') || '';
      if (currentCategory) showProducts(currentCategory);
    }

    // Update rack data for visible products
    const rackDataMap = window.skuToRackDataMap || {};
    document
      .querySelectorAll('.product-stock-rack[data-sku]')
      .forEach((rackDiv) => {
        const sku = rackDiv.getAttribute('data-sku');
        const rackNumber = rackDataMap[sku]?.rackNumber;
        console.log(sku, rackNumber);
        rackDiv.textContent = rackNumber ? `Rack: ${rackNumber}` : '';
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

  function fetchRackData() {
    return fetch('https://stock.doonb2b.com/api/rack-data')
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .catch((error) => {
        console.error('Error fetching rack data:', error);
        return {};
      });
  }

  function createProductItem(product, productList) {
    if (!product || !productList) return;
    const div = document.createElement('div');
    div.className = 'product-item';

    const salePrice = product.items_per_bag
      ? Math.round(product.salePrice / product.items_per_bag)
      : product.salePrice;

    const productUrl = `./info.html?sku=${encodeURIComponent(
      product.sku || ''
    )}`;
    const imageUrl = getThumbnailImage(product.images?.[0] || 'default.jpg');

    div.innerHTML = `
      <a href="${productUrl}" class="product-link" style="text-decoration: none; color: inherit;">
        <div class="product-price">
          ₹ ${
            salePrice !== null && !isNaN(salePrice)
              ? `${salePrice} per item`
              : product.salePrice || 'N/A'
          }
        </div>
        <img src="${imageUrl}" alt="${product.title || 'Product'}" />
        <div class="product-title">${product.sku || 'N/A'}</div>
        <div class="product-title">${product.title || 'Untitled'}</div>
        <div class="product-stock" data-sku="${product.sku || ''}">
            ${
              (product.items_per_bag
                ? Math.round(
                    (product.closingQuantity || 0) * product.items_per_bag
                  )
                : product.closingQuantity || 0) > 0
                ? `Stock: ${
                    product.items_per_bag
                      ? Math.round(
                          (product.closingQuantity || 0) * product.items_per_bag
                        ) + ' items'
                      : product.closingQuantity || 0
                  }`
                : 'Out of Stock'
            }
          </div>
        <div class="product-stock-rack" data-sku="${product.sku || ''}">
          ${
            window.skuToRackDataMap?.[product.sku]?.rackNumber
              ? `Rack: ${window.skuToRackDataMap[product.sku].rackNumber}`
              : ''
          }
        </div>
      </a>
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

    const results = Object.values(productInfo.skuToProductInfo).filter((p) =>
      doesProductMatchSearch(lowerKeyword, p)
    );

    if (results.length === 0) {
      productList.innerHTML = '<p style="margin: 1rem;">No products found.</p>';
      return;
    }

    results.forEach((product) => createProductItem(product, productList));
  }

  const catalogData = {};
  const catalogCounts = {};
  const productInfo = window.productInfo || { skuToProductInfo: {} };

  for (const sku in productInfo.skuToProductInfo) {
    const product = productInfo.skuToProductInfo[sku];
    if (!product?.catalog || !product?.images?.length) continue;
    if (!catalogData[product.catalog]) {
      catalogData[product.catalog] = product.images[0];
      catalogCounts[product.catalog] = 1;
    } else {
      catalogCounts[product.catalog]++;
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

  fetchRackData().then((rackData) => {
    window.skuToRackDataMap = rackData;
    refreshVisibleProductsWithRackInfo();
  });
});
