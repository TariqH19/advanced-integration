const baseUrl = {
  sandbox: "https://api.sandbox.paypal.com",
};

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
export async function generateAccessToken() {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("Missing api creds");
    }

    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");
    const response = await fetch(`${baseUrl.sandbox}/v1/oauth2/token`, {
      method: "POST",
      body: `grant_type=client_credentials&response_type=idtoken&target_customer_id=iqOtguscgz`,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await response.json();
    console.log("Full api Response", data);

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
    };
  } catch (error) {
    console.error("Failed", error);
    // throw error;
  }
}

export async function createOrder(task, saveCard, paymentToken = null) {
  const { accessToken } = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/checkout/orders`;
  const payload = {
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

  const paypalSource = {
    paypal: {
      experience_context: {
        shipping_preference: "NO_SHIPPING",
        return_url: "https://example.com/returnUrl",
        cancel_url: "https://example.com/cancelUrl",
      },
      attributes: {
        vault: {
          store_in_vault: "ON_SUCCESS",
          usage_type: "MERCHANT",
          customer_type: "CONSUMER",
        },
      },
    },
  };

  const advancedCreditCardSource = {
    card: {
      attributes: {
        vault: {
          store_in_vault: "ON_SUCCESS",
        },
      },
    },
  };

  if (task === "button") {
    payload.payment_source = paypalSource;
  } else if (task === "advancedCC" && saveCard) {
    payload.payment_source = advancedCreditCardSource;
  } else if (paymentToken) {
    payload.payment_source = {
      token: {
        type: "PAYMENT_METHOD_TOKEN",
        id: paymentToken,
      },
    };
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
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to create order:", error);
  }
}

export async function getOrderDetails(orderId) {
  const { accessToken } = await generateAccessToken();
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
  const { accessToken } = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/checkout/orders/${orderId}/capture`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to capture payment:", errorData);
      const detailedMessage = `Failed to capture payment. HTTP Status: ${
        response.status
      }. Error: ${JSON.stringify(errorData, null, 2)}.`;
      throw new Error(detailedMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error during payment capture:", error.message);
    console.error("Stack trace:", error.stack);
    throw new Error(
      `An error occurred while capturing payment: ${error.message}`
    );
  }
}
