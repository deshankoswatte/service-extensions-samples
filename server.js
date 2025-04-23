const express = require('express');
const geoip = require('geoip-country');
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
require("dotenv").config();

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

// Middleware
app.use(bodyParser.json());

// Mock: valid department list (simulating a directory check)
const validDepartments = ["Engineering", "HR", "Sales", "Finance"];

// Email transporter config
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS
  }
});

// Helper to extract claim values
const getClaimValue = (claims, uri) => {
  const claim = claims.find(c => c.uri === uri);
  return claim ? claim.value : null;
};

app.post("/validate-user-profile-update", async (req, res) => {
  const payload = req.body;

  if (payload.actionType !== "PRE_UPDATE_PROFILE") {
    return res.status(200).json({
      actionStatus: "FAILED",
      failureReason: "invalid_input",
      failureDescription: "Invalid actionType provided."
    });
  }

  const claims = payload?.event?.request?.claims || [];
  const userId = payload?.event?.user?.id || "Unknown User";

  const department = getClaimValue(claims, "http://wso2.org/claims/department");
  const email = getClaimValue(claims, "http://wso2.org/claims/emailaddress");
  const phone = getClaimValue(claims, "http://wso2.org/claims/mobile");

  // Department validation
  if (department && !validDepartments.includes(department)) {
    return res.status(200).json({
      actionStatus: "FAILED",
      failureReason: "invalid_department_input",
      failureDescription: "Provided user department value is invalid."
    });
  }

  // Send security alert email if sensitive attributes are being updated
  const changes = [];
  if (department) changes.push(`Department: ${department}`);
  if (email) changes.push(`Email: ${email}`);
  if (phone) changes.push(`Phone: ${phone}`);

  if (changes.length > 0) {
    try {
      await transporter.sendMail({
        from: '"Security Alert" <security-notifications@wso2.com>',
        to: "security-team@wso2.com", // Replace with actual security email
        subject: "Sensitive Attribute Update Request",
        text: `User ${userId} is attempting to update:\n\n${changes.join("\n")}`
      });
    } catch (error) {
      console.error("Failed to send security email:", error);
      return res.status(200).json({
        actionStatus: "FAILED",
        failureReason: "email_error",
        failureDescription: "Failed to notify security team about sensitive data update."
      });
    }
  }

  // All validations passed
  return res.status(200).json({ actionStatus: "SUCCESS" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
