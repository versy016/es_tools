// Algolia-backed autocomplete for the report forms (tenders/clients/projects/contacts/
// users). The Algolia app/key never reach the browser: queries go through an AWS API
// Gateway Lambda proxy that injects them and returns the hits. This module manipulates
// the DOM directly (vanilla), so callers pass a raw <input> element, not a React ref.

// Query the Lambda proxy for one index and hand the raw hit array to `callback`. Network/
// parse errors are logged and swallowed (the dropdown simply doesn't appear).
const searchAlgolia = async (indexName, query, callback) => {
  try {
    const response = await fetch(`https://jflxgo3g5f.execute-api.ap-southeast-2.amazonaws.com/dev/?service=algolia&indexName=${indexName}&query=${query}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const hits = await response.json();
    callback(hits);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Render a suggestion dropdown under the input. `displayAttribute` is which hit field to
// show; on mousedown (fires before blur) the input is filled, the full hit is stashed on
// dataset.selected, and onSelect(hit) is invoked.
const displayDropdown = (inputElement, results, displayAttribute, onSelect) => {
  const dropdown = document.createElement('div');
  dropdown.classList.add('dropdown');
  
  results.forEach(result => {
    const item = document.createElement('div');
    item.classList.add('dropdown-item');
    item.textContent = result[displayAttribute];
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevents the blur event
      inputElement.value = result[displayAttribute];
      inputElement.dataset.selected = JSON.stringify(result);  // Store selected item data
      clearDropdown(inputElement);
      onSelect(result);  // Call the onSelect function with the selected value
    });
    dropdown.appendChild(item);
  });

  clearDropdown(inputElement);
  // Anchor the absolutely-positioned dropdown to the input's wrapper so it sits directly
  // under the input at the input's width, instead of overflowing across the form.
  inputElement.parentNode.style.position = 'relative';
  inputElement.parentNode.appendChild(dropdown);
};

// Remove any existing dropdown sibling of the input.
const clearDropdown = (inputElement) => {
  const existingDropdown = inputElement.parentNode.querySelector('.dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
  }
};

// Wire the input: on each keystroke (non-empty), query Algolia and render results;
// clear the dropdown when emptied. Generic over index + display field.
const setupSearch = (inputElement, indexName, displayAttribute, onSelect) => {
  inputElement.addEventListener('input', (event) => {
    const query = event.target.value;
    if (query.length > 0) {
      searchAlgolia(indexName, query, (results) => {
        displayDropdown(inputElement, results, displayAttribute, onSelect);
      });
    } else {
      clearDropdown(inputElement);
    }
  });

  // Remove the blur event handler
  inputElement.removeEventListener('blur', () => {
    setTimeout(() => clearDropdown(inputElement), 100); // Delay to allow click event
  });
};

// Per-index entry points (bind the index name + the field shown in the dropdown).
export const setupTendersSearch = (inputElement, onSelect) => setupSearch(inputElement, 'tenders', 'name', onSelect);
export const setupClientsSearch = (inputElement, onSelect) => setupSearch(inputElement, 'clients', 'title', onSelect);
export const setupProjectsSearch = (inputElement, onSelect) => setupSearch(inputElement, 'projects', 'project', onSelect);
export const setupContactsSearch = (inputElement, onSelect) => setupSearch(inputElement, 'contacts', 'name', onSelect);
export const setupUsersSearch = (inputElement, onSelect) => setupSearch(inputElement, 'users', 'name', onSelect);
