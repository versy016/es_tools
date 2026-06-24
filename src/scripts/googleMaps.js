const getGoogleMapsApiKey = async () => {
  try {
    const response = await fetch(`https://jflxgo3g5f.execute-api.ap-southeast-2.amazonaws.com/dev/?service=googleMaps`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data.apiKey;
  } catch (error) {
    console.error('Error fetching API key:', error);
    return null;
  }
};

const loadGoogleMapsScript = async (callback) => {
  const apiKey = await getGoogleMapsApiKey();

  if (apiKey) {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = callback;
    document.head.appendChild(script);
  } else {
    console.error('Google Maps API key not available');
  }
};

// Shared address-autocomplete setup for the report tools: restricts to Australia and
// calls onSelect(formattedAddress) when the user picks a place. Returns the Autocomplete
// instance (or null if Maps isn't loaded yet). Call inside loadGoogleMapsScript's callback.
const attachAddressAutocomplete = (input, onSelect) => {
  if (!input || !window.google?.maps?.places) return null;
  const autocomplete = new window.google.maps.places.Autocomplete(input, {
    types: ['geocode', 'establishment'],
    componentRestrictions: { country: 'au' },
  });
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    onSelect(place.formatted_address || place.name || '');
  });
  return autocomplete;
};

export { loadGoogleMapsScript, attachAddressAutocomplete };
