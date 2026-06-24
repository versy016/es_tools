// Algolia-backed autocomplete for the report forms (tenders/clients/projects/contacts/
// users). The Algolia app/key never reach the browser: queries go through an AWS API
// Gateway Lambda proxy that injects them and returns the hits. This module manipulates
// the DOM directly (vanilla), so callers pass a raw <input> element, not a React ref.

// Query the Lambda proxy for one index. `signal` lets an in-flight request be aborted
// when the user types again (avoids out-of-order responses). Returns the hit array.
const searchAlgolia = async (indexName, query, signal) => {
  const url = `https://jflxgo3g5f.execute-api.ap-southeast-2.amazonaws.com/dev/?service=algolia&indexName=${indexName}&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal });
  if (!response.ok) throw new Error('Network response was not ok');
  return response.json();
};

// Remove the dropdown for an input, if present.
const clearDropdown = (inputElement) => {
  const existing = inputElement.parentNode.querySelector('.dropdown');
  if (existing) existing.remove();
};

// Render (or update) the suggestion dropdown UNDER the input. The container is reused
// across keystrokes — only the item rows are swapped — so the box doesn't flash/recreate
// on every response (the previous teardown-and-recreate caused heavy flicker).
const renderDropdown = (inputElement, results, displayAttribute, onSelect) => {
  const parent = inputElement.parentNode;
  // No results → make sure nothing is shown.
  if (!Array.isArray(results) || results.length === 0) {
    clearDropdown(inputElement);
    return;
  }

  parent.style.position = 'relative'; // anchor the absolutely-positioned dropdown
  let dropdown = parent.querySelector('.dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.classList.add('dropdown');
    parent.appendChild(dropdown);
  }

  // Replace the rows in place (container stays mounted → no flicker).
  dropdown.replaceChildren();
  results.forEach((result) => {
    const item = document.createElement('div');
    item.classList.add('dropdown-item');
    item.textContent = result[displayAttribute] || '';
    // mousedown fires before the input's blur, so the selection isn't lost to the close.
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      inputElement.value = result[displayAttribute] || '';
      inputElement.dataset.selected = JSON.stringify(result);
      clearDropdown(inputElement);
      onSelect(result);
    });
    dropdown.appendChild(item);
  });
};

// Wire the input: debounce keystrokes, abort the previous request, ignore stale responses,
// and render results in place. Guarded so it only binds once per input (React StrictMode
// invokes effects twice in dev, which would otherwise stack listeners and double the flicker).
const setupSearch = (inputElement, indexName, displayAttribute, onSelect) => {
  if (!inputElement || inputElement.dataset.algoliaBound) return;
  inputElement.dataset.algoliaBound = '1';

  let debounce = null;   // keystroke debounce timer
  let controller = null; // aborts the in-flight fetch
  let seq = 0;           // request sequence, to drop out-of-order responses

  inputElement.addEventListener('input', (event) => {
    const query = event.target.value.trim();
    clearTimeout(debounce);
    if (controller) controller.abort();

    if (query.length === 0) { clearDropdown(inputElement); return; }

    debounce = setTimeout(() => {
      const mySeq = ++seq;
      controller = new AbortController();
      searchAlgolia(indexName, query, controller.signal)
        .then((results) => {
          if (mySeq === seq) renderDropdown(inputElement, results, displayAttribute, onSelect);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') console.error('Algolia error:', err);
        });
    }, 180);
  });

  // Close shortly after blur (the delay lets a suggestion's mousedown land first).
  inputElement.addEventListener('blur', () => {
    setTimeout(() => clearDropdown(inputElement), 120);
  });
};

// Per-index entry points (bind the index name + the field shown in the dropdown).
export const setupTendersSearch = (inputElement, onSelect) => setupSearch(inputElement, 'tenders', 'name', onSelect);
export const setupClientsSearch = (inputElement, onSelect) => setupSearch(inputElement, 'clients', 'title', onSelect);
export const setupProjectsSearch = (inputElement, onSelect) => setupSearch(inputElement, 'projects', 'project', onSelect);
export const setupContactsSearch = (inputElement, onSelect) => setupSearch(inputElement, 'contacts', 'name', onSelect);
export const setupUsersSearch = (inputElement, onSelect) => setupSearch(inputElement, 'users', 'name', onSelect);
