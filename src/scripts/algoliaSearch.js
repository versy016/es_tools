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

const displayDropdown = (inputElement, results, displayAttribute) => {
  const dropdown = document.createElement('div');
  dropdown.classList.add('dropdown');
  
  results.forEach(result => {
    const item = document.createElement('div');
    item.classList.add('dropdown-item');
    item.textContent = result[displayAttribute];
    item.addEventListener('click', () => {
      inputElement.value = result[displayAttribute];
      clearDropdown(inputElement);
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

const setupSearch = (inputElement, indexName, displayAttribute) => {
  inputElement.addEventListener('input', (event) => {
    const query = event.target.value;
    if (query.length > 0) {
      searchAlgolia(indexName, query, (results) => {
        displayDropdown(inputElement, results, displayAttribute);
      });
    } else {
      clearDropdown(inputElement);
    }
  });
};

// Export the setup functions for use in other scripts
export const setupTendersSearch = (inputElement) => setupSearch(inputElement, 'tenders', 'name');
export const setupClientsSearch = (inputElement) => setupSearch(inputElement, 'clients', 'title');
export const setupProjectsSearch = (inputElement) => setupSearch(inputElement, 'projects', 'project');
