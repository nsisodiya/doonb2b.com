function getThumbnailImage(url) {
  return url.replace(/(\.jpg|\.png|\.webp|\.jpeg)(\?.*)?$/, '_150x150$1$2');
}

function refreshVisibleProductsWithRackInfo() {
  const keyword = document.getElementById('searchInput')?.value.trim();
  if (keyword) {
    searchProducts(keyword); // rerun search with updated rack data
  } else if (
    !document.getElementById('catalogList').classList.contains('hidden')
  ) {
    showCatalogs(); // reload catalog tiles if that's the current view
  } else {
    // We are in a product list view, refresh visible category
    const currentCategory = document
      .getElementById('categoryTitle')
      ?.textContent.trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (currentCategory) showProducts(currentCategory);
  }
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

  const searchableTokens = fields.split(/\s+/);
  searchableTokens.push(product.sku);

  const queryWords = normalizedQuery.split(/\s+/);
  return queryWords.every((queryWord) =>
    searchableTokens.some((token) => token.includes(queryWord))
  );
}

async function fetchRackData() {
  try {
    const response = await fetch('https://stock.doonb2b.com/api/rack-data');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching rack data:', error);
    return {}; // return empty object on failure
  }
}
window.addEventListener('load', async () => {
  window.skuToRackDataMap = await fetchRackData();
  const catalogData = {};
  const catalogCounts = {};
  const productInfo = window.productInfo;

  for (const sku in productInfo.skuToProductInfo) {
    const product = productInfo.skuToProductInfo[sku];
    if (!catalogData[product.catalog]) {
      if (!product.images || product.images.length === 0) {
        console.error(`No images found for product: ${sku}`);
        continue;
      }
      catalogData[product.catalog] = product.images[0];
      catalogCounts[product.catalog] = 1;
    } else {
      catalogCounts[product.catalog]++;
    }
  }

  const catalogList = document.getElementById('catalogList');
  const productList = document.getElementById('productList');
  const productListWrapper = document.getElementById('productListWrapper');
  const mapWrapper = document.getElementById('mapWrapper');
  const backLink = document.getElementById('backLink');
  const header = document.getElementById('header');
  const categoryTitle = document.getElementById('categoryTitle');
  const searchInput = document.getElementById('searchInput');

  function showCatalogs() {
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
        catalogCounts[catalog]
      } items)</div>
      `;
      div.onclick = () => showProducts(catalog);
      catalogList.appendChild(div);
    });
  }

  function createProductItem(product, productList) {
    const div = document.createElement('div');
    div.className = 'product-item';

    const salePrice = product.items_per_bag
      ? Math.round(product.salePrice / product.items_per_bag)
      : null;

    const productUrl = `./info.html?sku=${encodeURIComponent(product.sku)}`;
    const rack = window.skuToRackDataMap?.[product.sku]?.rackNumber || '';
    const imageUrl = getThumbnailImage(product.images?.[0] || 'default.jpg');

    div.innerHTML = `
    <a href="${productUrl}" class="product-link" style="text-decoration: none; color: inherit;">
      <div class="product-price">
        ₹ ${salePrice !== null ? `${salePrice} per item` : product.salePrice}
      </div>
      <img src="${imageUrl}" alt="${product.title}" />
      <div class="product-title">${product.sku}</div>
      <div class="product-title">${product.title}</div>
      <div class="product-stock">
        Stock: ${
          product.items_per_bag
            ? Math.round(product.closingQuantity * product.items_per_bag) +
              ' items'
            : product.closingQuantity
        }
        ${rack ? `<br>Rack: ${rack}` : ''}
      </div>
    </a>
  `;

    productList.appendChild(div);
  }

  function showProducts(catalog) {
    catalogList.classList.add('hidden');
    productListWrapper.classList.remove('hidden');
    mapWrapper.classList.add('hidden');

    productList.innerHTML = '';
    categoryTitle.textContent = catalog.replace(/-/g, ' ');

    Object.values(productInfo.skuToProductInfo)
      .filter((p) => p.catalog === catalog)
      .forEach((product) => {
        createProductItem(product, productList);
      });
  }

  function searchProducts(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    catalogList.classList.add('hidden');
    productListWrapper.classList.remove('hidden');
    categoryTitle.textContent = ``;
    productList.innerHTML = '';

    const results = Object.values(productInfo.skuToProductInfo).filter((p) =>
      doesProductMatchSearch(lowerKeyword, p)
    );

    if (results.length === 0) {
      productList.innerHTML = '<p style="margin: 1rem;">No products found.</p>';
      return;
    }

    results.forEach((product) => {
      createProductItem(product, productList);
    });
  }

  searchInput.addEventListener('input', () => {
    const keyword = searchInput.value.trim();
    if (keyword === '') {
      showCatalogs();
    } else {
      searchProducts(keyword);
    }
  });

  backLink.onclick = (e) => {
    e.preventDefault();
    searchInput.value = '';
    showCatalogs();
  };

  header.onclick = (e) => {
    e.preventDefault();
    searchInput.value = '';
    showCatalogs();
  };

  showCatalogs();
});
