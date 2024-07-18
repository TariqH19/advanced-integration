const baseUrl = {
  sandbox: "https://api.sandbox.paypal.com",
};

// Generate Access Token
export async function generateAccessToken() {
  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");
    const response = await fetch(`${baseUrl.sandbox}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
  }
}

export async function createOrder(task, saveCard = false) {
  const accessToken = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/checkout/orders`;
  const orderData = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "GBP",
          value: "240.00",
          breakdown: {
            tax_total: {
              currency_code: "GBP",
              value: "30.00",
            },
            insurance: {
              currency_code: "GBP",
              value: "7.00",
            },
            shipping: {
              currency_code: "GBP",
              value: "13.00",
            },
            item_total: {
              currency_code: "GBP",
              value: "190.00",
            },
          },
        },
        description: "Apparel Department",
        items: [
          {
            name: "Batman T-Shirt",
            quantity: "2",
            unit_amount: {
              currency_code: "GBP",
              value: "50.00",
            },
            description: "The most amazing DC fashion line.",
            sku: "SKU-920391",
            tax: {
              currency_code: "GBP",
              value: "10.00",
            },
          },
          {
            name: "Superman T-Shirt",
            quantity: "1",
            unit_amount: {
              currency_code: "GBP",
              value: "90.00",
            },
            description: "The most amazing DC fashion line.",
            sku: "SKU-920199",
            tax: {
              currency_code: "GBP",
              value: "10.00",
            },
          },
        ],
        shipping: {
          name: {
            full_name: "Walter White",
          },
          address: {
            address_line_1: "308 Negra Arroyo Lane",
            admin_area_2: "Roma",
            admin_area_1: "RM",
            postal_code: "00100",
            country_code: "GB",
          },
          type: "SHIPPING",
        },
        soft_descriptor: "Primark web",
      },
    ],
  };

  const paymentSource = {
    paypal: {
      experience_context: {
        brand_name: "Primark Stores Limited",
        landing_page: "NO_PREFERENCE",
      },
    },
  };

  const advancedCreditCardSource = {
    card: {
      attributes: {
        verification: {
          method: "SCA_ALWAYS",
        },
        vault: {
          store_in_vault: "ON_SUCCESS",
        },
      },
    },
  };

  if (task === "button") {
    orderData.payment_source = paymentSource;
  } else if (task === "advancedCC") {
    orderData.payment_source = advancedCreditCardSource;
    if (saveCard) {
      orderData.payment_source.card.attributes.vault.store_in_vault =
        "ON_SUCCESS";
    }
  }

  const requestid = "new-order-" + new Date().toISOString();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "PayPal-Request-Id": requestid,
      Prefer: "return=representation",
    },
    body: JSON.stringify(orderData),
  });

  const data = await response.json();
  return data;
}

export async function capturePayment(orderId) {
  const accessToken = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/checkout/orders/${orderId}/capture`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Prefer: "return=representation",
    },
  });

  const data = await response.json();
  return data;
}

export async function listPaymentTokens(vaultID) {
  const accessToken = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v3/vault/payment-tokens/${vaultID}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  return data;
}

// Get 3DS payment source
export async function paymentSource(orderId) {
  const accessToken = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/checkout/orders/${orderId}?fields=payment_source`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  return handle3DSResponse(data);
}

// Handle 3DS response parameters
function handle3DSResponse(response) {
  const authenticationResult =
    response.payment_source.card.authentication_result;

  const LS = authenticationResult.liability_shift || "X";
  const ES = authenticationResult.three_d_secure.enrollment_status || "X";
  const AS = authenticationResult.three_d_secure.authentication_status || "X";

  const result = { ES, AS, LS };

  const CWA = [
    { ES: "Y", AS: "Y", LS: "POSSIBLE" },
    { ES: "Y", AS: "Y", LS: "YES" },
    { ES: "Y", AS: "A", LS: "POSSIBLE" },
    { ES: "N", AS: "X", LS: "NO" },
    { ES: "U", AS: "X", LS: "NO" },
    { ES: "B", AS: "X", LS: "NO" },
  ];

  const DNCWA = [
    { ES: "Y", AS: "N", LS: "NO" },
    { ES: "Y", AS: "R", LS: "NO" },
  ];

  const DNCWARCHTR = [
    { ES: "Y", AS: "U", LS: "UNKNOWN" },
    { ES: "Y", AS: "U", LS: "NO" },
    { ES: "Y", AS: "C", LS: "UNKNOWN" },
    { ES: "Y", AS: "X", LS: "NO" },
    { ES: "U", AS: "X", LS: "UNKNOWN" },
    { ES: "X", AS: "X", LS: "UNKNOWN" },
  ];

  if (CWA.some((action) => JSON.stringify(action) === JSON.stringify(result))) {
    return { result: "capture" };
  } else if (
    DNCWA.some((action) => JSON.stringify(action) === JSON.stringify(result))
  ) {
    return { result: "unknown" };
  } else if (
    DNCWARCHTR.some(
      (action) => JSON.stringify(action) === JSON.stringify(result)
    )
  ) {
    return { result: "retry" };
  } else {
    return { result: "genericIssue" };
  }
}
