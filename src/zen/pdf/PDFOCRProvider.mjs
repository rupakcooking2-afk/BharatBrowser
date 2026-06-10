/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Placeholder interface for future OCR integration.
 * Currently not implemented.
 */
export class nsPDFOCRProvider {
  /**
   * Checks if OCR capability is available.
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }

  /**
   * Performs OCR on a given page canvas or image data.
   * @param {object} pageCanvas
   * @returns {Promise<string>}
   */
  async recognize(pageCanvas) {
    throw new Error("OCR Provider not implemented.");
  }
}
