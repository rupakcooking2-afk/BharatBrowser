/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsPDFTextExtractor {
  /**
   * Generates the IIFE script to be executed in the PDF page global context.
   * This script accesses the PDFViewerApplication and extracts outline and text page by page.
   * @returns {string}
   */
  static getExtractionScript() {
    return `
      (async () => {
        try {
          const app = window.wrappedJSObject?.PDFViewerApplication || window.PDFViewerApplication;
          if (!app) {
            return { error: "PDF.js Viewer Application not found." };
          }
          if (!app.pdfDocument) {
            return { error: "PDF document is not ready." };
          }

          const pdfDocument = app.pdfDocument;
          const total = pdfDocument.numPages;
          const outlineData = await pdfDocument.getOutline().catch(() => []);

          const pages = [];
          
          for (let i = 1; i <= total; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            let pageText = "";
            let lastY = -1;
            
            for (const item of textContent.items) {
              if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                pageText += "\\n";
              }
              pageText += item.str + " ";
              lastY = item.transform[5];
            }
            
            pages.push({
              pageNumber: i,
              text: pageText.trim()
            });

            // Dispatch progress event
            const percent = Math.round((i / total) * 100);
            const event = new document.defaultView.CustomEvent("bharat-pdf-progress", {
              detail: { page: i, total: total, percent: percent },
              bubbles: true,
              cancelable: true,
              composed: true
            });
            document.dispatchEvent(event);

            // Yield control to prevent UI freezing
            await new Promise(resolve => setTimeout(resolve, 0));
          }

          return {
            title: document.title || "PDF Document",
            url: window.location.href,
            pageCount: total,
            pages: pages,
            outline: outlineData
          };
        } catch (err) {
          return { error: err.message };
        }
      })();
    `;
  }
}
