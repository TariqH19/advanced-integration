const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 8888 } = process.env;
const base = "https://api-m.sandbox.paypal.com";

// Generate OAuth 2.0 access token
export async function generateAccessToken() {
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  const data = await response.json();
  return data.access_token;
}

// Create an order
export async function createOrder(cart) {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders`;
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "GBP",
          value: "10.00",
        },
        shipping: {
          options: [
            {
              id: "SHIP_123",
              label: "Free Shipping",
              type: "SHIPPING",
              selected: true,
              amount: {
                value: "0.00",
                currency_code: "GBP",
              },
            },
            {
              id: "SHIP_456",
              label: "Expedited Shipping",
              type: "SHIPPING",
              selected: false,
              amount: {
                value: "5.00",
                currency_code: "GBP",
              },
            },
          ],
        },
      },
    ],
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.json();
}

// Capture an order
export async function captureOrder(orderID) {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.json();
}

// Update shipping options
export async function updateShippingOption(orderID, selectedShippingOption) {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}`;
  const payload = {
    purchase_units: [
      {
        shipping: {
          options: [
            {
              id: selectedShippingOption.id,
              label: selectedShippingOption.label,
              type: selectedShippingOption.type,
              amount: selectedShippingOption.amount,
            },
          ],
        },
      },
    ],
  };

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify([
      {
        op: "replace",
        path: "/purchase_units/@reference_id=='default'/shipping",
        value: payload.purchase_units[0].shipping,
      },
    ]),
  });

  return response.json();
}

// Update shipping address
export async function updateShippingAddress(orderID, shippingAddress) {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify([
      {
        op: "replace",
        path: "/purchase_units/@reference_id=='default'/shipping/address",
        value: shippingAddress,
      },
    ]),
  });
  const responseBody = await response.json();
  console.log("Response Status:", response.status);
  console.log("Response Body:", responseBody);
  return responseBody;
}
