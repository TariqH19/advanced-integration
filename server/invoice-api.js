const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MERCHANT_ID } =
  process.env;
const BASE_URL = "https://api-m.sandbox.paypal.com";
// const production = "https://api-m.paypal.com";
const base = `${BASE_URL}`;

export async function generateAccessToken() {
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const data = await response.json();
  return data.access_token;
}

// Fetch function to create the invoice
export async function createInvoice(accessToken, invoiceData) {
  const response = await fetch(`${base}/v2/invoicing/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(invoiceData),
  });

  const createResponse = await response.json();
  console.log("Invoice Creation Response:", createResponse); // Log the creation response

  // Check if the response includes a link to retrieve the invoice details
  const retrieveHref = createResponse.href;
  if (!retrieveHref) {
    throw new Error("Failed to retrieve invoice link.");
  }

  // Make a request to fetch the complete invoice details (including ID)
  const invoiceDetailsResponse = await fetch(retrieveHref, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const invoiceDetails = await invoiceDetailsResponse.json();
  console.log("Invoice Details Response:", invoiceDetails); // Log the details response
  return invoiceDetails;
}

export async function sendInvoice(accessToken, invoiceId) {
  const response = await fetch(
    `${base}/v2/invoicing/invoices/${invoiceId}/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.json();
}
