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
          value: "10.00",
        },
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
      attributes: {},
    },
  };

  // Add vaulting only if saveCard is true
  if (saveCard) {
    advancedCreditCardSource.card.attributes.vault = {
      store_in_vault: "ON_SUCCESS",
    };
  }

  if (task === "button") {
    orderData.payment_source = paymentSource;
  } else if (task === "advancedCC") {
    orderData.payment_source = advancedCreditCardSource;
  }

  const requestid = "new-order-" + new Date().toISOString();

  try {
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
  } catch (error) {
    console.error("Failed to create order:", error);
  }
}

export async function getOrderDetails(orderId) {
  const accessToken = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/checkout/orders/${orderId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error fetching order details: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching order details:", error);
    throw error;
  }
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
