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

const displayDropdown = (inputElement, results, displayAttribute, onSelect) => {
  const dropdown = document.createElement('div');
  dropdown.classList.add('dropdown');
  
  results.forEach(result => {
    const item = document.createElement('div');
    item.classList.add('dropdown-item');
    item.textContent = result[displayAttribute];
    item.addEventListener('click', () => {
      inputElement.value = result[displayAttribute];
      inputElement.dataset.selected = JSON.stringify(result);  // Store selected item data
      clearDropdown(inputElement);
      onSelect(result);  // Call the onSelect function with the selected value
    });
    dropdown.appendChild(item);
  });

  clearDropdown(inputElement);
  inputElement.parentNode.appendChild(dropdown);
};

const clearDropdown = (inputElement) => {
  const existingDropdown = inputElement.parentNode.querySelector('.dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
  }
};

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

  inputElement.addEventListener('blur', () => {
    setTimeout(() => clearDropdown(inputElement), 200); // Delay to allow click event
  });
};

// Export the setup functions for use in other scripts
export const setupTendersSearch = (inputElement, onSelect) => setupSearch(inputElement, 'tenders', 'name', onSelect);
export const setupClientsSearch = (inputElement, onSelect) => setupSearch(inputElement, 'clients', 'title', onSelect);
export const setupProjectsSearch = (inputElement, onSelect) => setupSearch(inputElement, 'projects', 'project', onSelect);
export const setupContactsSearch = (inputElement, onSelect) => setupSearch(inputElement, 'contacts', 'name', onSelect);
export const setupUsersSearch = (inputElement, onSelect) => setupSearch(inputElement, 'users', 'name', onSelect);
