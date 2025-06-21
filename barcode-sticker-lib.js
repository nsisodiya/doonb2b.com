(function (global) {
  const mmToPx = (mm) => mm * (96 / 25.4);

  function generate(containerElement, stickerData) {
    const container = containerElement;
    container.innerHTML = '';

    const stickers = [];
    stickerData.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        const sticker = document.createElement('div');
        sticker.setAttribute(
          'style',
          `
              width: 50mm;
              height: 25mm;
              background: white;
              border: 1px solid #ccc;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              box-sizing: border-box;
              padding: 2mm;
              text-align: center;
            `
        );

        const priceLine = document.createElement('div');
        priceLine.setAttribute(
          'style',
          `
              margin-top: 1mm;
              font-size: 4mm;
              text-align: center;
              display: flex;
              align-items: center;
              gap: 2mm;
              box-sizing: border-box;
            `
        );
        priceLine.innerHTML = `
              <span style="font-family: 'Courier New', monospace; font-weight: bold; box-sizing: border-box;">DoonB2B Price</span>
              <span style="font-family: monospace; box-sizing: border-box;">₹${item.price}</span>
            `;

        const skuLine = document.createElement('div');
        skuLine.setAttribute(
          'style',
          `
              font-size: 2.2mm;
              text-align: center;
              font-family: monospace;
              max-width: 48mm;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
              box-sizing: border-box;
            `
        );
        skuLine.textContent = item.sku;

        const barcodeSvg = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg'
        );
        barcodeSvg.setAttribute(
          'style',
          'width: 100%; height: auto; box-sizing: border-box;'
        );

        sticker.appendChild(priceLine);
        sticker.appendChild(skuLine);
        sticker.appendChild(barcodeSvg);

        JsBarcode(barcodeSvg, String(item.itemCode), {
          format: 'CODE128',
          displayValue: true,
          fontSize: 10,
          height: 35,
          margin: 4
        });

        stickers.push(sticker);
      }
    });

    const rows = Math.ceil(stickers.length / 2);
    const containerHeightMM = 25 * rows + 2 * (rows - 1);
    container.setAttribute(
      'style',
      `width: 100mm; height: ${containerHeightMM}mm; box-sizing: border-box;`
    );

    for (let i = 0; i < stickers.length; i += 2) {
      const row = document.createElement('div');
      const isFirstRow = i === 0;
      row.setAttribute(
        'style',
        `
            display: flex;
            box-sizing: border-box;
            margin-top: ${isFirstRow ? '0' : '2mm'};
          `
      );
      row.appendChild(stickers[i]);
      if (stickers[i + 1]) {
        row.appendChild(stickers[i + 1]);
      }
      container.appendChild(row);
    }
  }

  function downloadPNG(containerElement) {
    const node = containerElement;
    const mmWidth = 100;
    const pxWidth = mmToPx(mmWidth);
    const pxHeight = node.scrollHeight;

    htmlToImage
      .toPng(node, { width: pxWidth, height: pxHeight, pixelRatio: 4 })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'stickers.png';
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => console.error('Download failed', err));
  }

  function downloadPDF(containerElement) {
    const node = containerElement;
    const mmWidth = 100;
    const pxWidth = mmToPx(mmWidth);
    const pxHeight = node.scrollHeight;
    const mmHeight = (pxHeight * 25.4) / 96;

    htmlToImage
      .toPng(node, { width: pxWidth, height: pxHeight, pixelRatio: 4 })
      .then((dataUrl) => {
        const { jsPDF } = window.jspdf;
        const orientation = mmWidth > mmHeight ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
          unit: 'mm',
          format: [mmWidth, mmHeight],
          orientation
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, mmWidth, mmHeight);
        pdf.save('stickers.pdf');
      })
      .catch((err) => console.error('PDF generation failed', err));
  }

  global.BarcodeStickerLib = {
    generate,
    downloadPNG,
    downloadPDF
  };
})(window);
