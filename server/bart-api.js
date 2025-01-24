const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET = 8888 } = process.env;
const base = "https://api-m.sandbox.paypal.com";

const characters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateString(length) {
  let result = " ";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

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

export async function getBaToken() {
  const accessToken = await generateAccessToken();
  const url = `${base}/v1/billing-agreements/agreement-tokens`;
  const payload = {
    shipping_address: {
      line1: "1350 North First Street",
      city: "San Jose",
      state: "CA",
      postal_code: "95112",
      country_code: "GB",
      recipient_name: "John Doe",
    },
    payer: {
      payment_method: "PAYPAL",
    },
    plan: {
      type: "MERCHANT_INITIATED_BILLING",
      merchant_preferences: {
        return_url: "https://example.com/return",
        cancel_url: "https://example.com/cancel",
        notify_url: "https://example.com/notify",
        accepted_pymt_type: "INSTANT",
        skip_shipping_address: false,
        immutable_shipping_address: true,
      },
    },
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

export async function getBillingAgreement() {
  const accessToken = await generateAccessToken();
  const url = `${base}//v1/billing-agreements/agreements`;
  const payload = {
    token_id: baToken,
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

export async function getRefTrans() {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders`;
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "GBP",
          value: "50.00",
        },
      },
    ],
    payment_source: {
      token: {
        id: baId,
        type: "BILLING_AGREEMENT",
      },
    },
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "PayPal-Request-Id": generateString(9),
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.json();
}
