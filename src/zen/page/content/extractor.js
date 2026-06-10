/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(() => {
  const cleanElement = (el) => {
    const clone = el.cloneNode(true);
    const selectorsToRemove = [
      'script', 'style', 'nav', 'footer', 'header', 'aside', 
      'iframe', 'noscript', '.ads', '#ads', '.menu', '.sidebar'
    ];
    selectorsToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(s => s.remove());
    });
    return clone;
  };

  const findPrimaryContent = () => {
    const prioritySelectors = ['article', 'main', '[role="main"]'];
    for (const selector of prioritySelectors) {
      const el = document.querySelector(selector);
      if (el) return cleanElement(el);
    }

    // Fallback: Largest text container
    const body = document.body;
    if (!body) return null;
    return cleanElement(body);
  };

  const primary = findPrimaryContent();
  if (!primary) return null;

  const content = primary.innerText
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 20000);

  return {
    title: document.title,
    url: window.location.href,
    content: content
  };
})();
