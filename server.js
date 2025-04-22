const express = require('express');
const geoip = require('geoip-country');

const app = express();
const PORT = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.send('Hello from the home endpoint!');
});

/**
 * POST /validate-geo-region
 * Extracts IP from additionalHeaders and checks if it's from an allowed country.
 * If IP cannot be resolved or the country is restricted, returns a failure response.
 */
app.post('/validate-geo-region', (req, res) => {
  const additionalHeaders = req.body?.event?.request?.additionalHeaders;
  const allowedCountries = ['United States'];
  let clientIp = '101.2.176.0'; // Default fallback IP

// Extract IP address from custom header array
  if (Array.isArray(additionalHeaders)) {
    const ipHeaderEntry = additionalHeaders.find(
        (header) => header.name?.toLowerCase() === 'x-client-source-ip'
    );

    if (ipHeaderEntry && Array.isArray(ipHeaderEntry.value) && ipHeaderEntry.value.length > 0) {
      clientIp = ipHeaderEntry.value[0];
      console.log('Extracted client IP:', clientIp);
    } else {
      console.warn('x-client-source-ip header is missing or empty.');
    }
  } else {
    console.warn('additionalHeaders is not an array.');
  }

  // Handle failure if default IP was not overridden
  if (clientIp === '101.2.176.0') {
    return res.status(200).json({
      actionStatus: 'FAILED',
      failureReason: 'ip_not_resolved',
      failureDescription: 'Unable to determine the IP.'
    });
  }

  // Lookup country by IP
  const geo = geoip.lookup(clientIp);
  const countryName = geo?.name;
  console.log('Resolved country:', countryName);

  // Reject if the country is in the restricted list
  if (allowedCountries.includes(countryName)) {
    return res.status(200).json({
      actionStatus: 'FAILED',
      failureReason: 'geo_request',
      failureDescription: `Access token issuance is blocked from your region: ${countryName}`
    });
  }

  // Allow the request
  return res.status(200).json({
    actionStatus: 'SUCCESS'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
