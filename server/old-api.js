const baseUrl = {
  sandbox: "https://api.sandbox.paypal.com",
};
// Generate Access Token
export async function generateAccessToken() {
  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID_US}:${process.env.PAYPAL_CLIENT_SECRET_US}`
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
export async function vaultPaymentMethod(accessToken) {
  try {
    const response = await fetch(`${baseUrl.sandbox}/v3/vault/payment-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment_source: {
          card: {
            number: "4111111111111111", // Test card number
            expiry: "2025-12", // Expiration date
            name: "John Doe", // Cardholder name
            billing_address: {
              address_line_1: "123 Main St",
              admin_area_2: "San Jose",
              admin_area_1: "CA",
              postal_code: "95131",
              country_code: "US",
            },
          },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to vault payment method: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error("Failed to vault payment method:", error);
    throw error; // Re-throw the error for further handling
  }
}
// Create a Subscription
export async function createSubscription(accessToken, vaultedPaymentTokenId) {
  try {
    const response = await fetch(
      `${baseUrl.sandbox}/v1/billing/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: "P-3KR16366D6973461NM6KHYNA", // Replace with your plan ID
          name: "Basic Gym Plan",
          description: "Monthly subscription to the gym.",
          billing_cycles: [
            {
              frequency: {
                interval_unit: "MONTH",
                interval_count: 1,
              },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 12,
              pricing_scheme: {
                fixed_price: {
                  value: "35",
                  currency_code: "GBP",
                },
              },
            },
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: {
              value: "0",
              currency_code: "GBP",
            },
            setup_fee_failure_action: "CONTINUE",
            payment_failure_threshold: 3,
          },
          taxes: {
            percentage: "0",
            inclusive: false,
          },
          application_context: {
            brand_name: "Your Brand Name",
            locale: "en-US",
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            payment_method: {
              payer_selected: "PAYPAL",
              payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
            },
          },
          payment_source: {
            token: {
              id: vaultedPaymentTokenId, // Vaulted payment token ID
              type: "PAYMENT_METHOD_TOKEN",
            },
          },
        }),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to create subscription: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error("Failed to create subscription:", error);
    throw error; // Re-throw the error for further handling
  }
}
export async function createOrder(task, saveCard) {
  const accessToken = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/checkout/orders`;
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "GBP",
          value: "110.00",
        },
      },
    ],
    payment_source: {
      card: {
        attributes: {
          verification: {
            method: "SCA_ALWAYS",
          },
        },
      },
    },
  };
  const paypalSource = {
    paypal: {
      experience_context: {
        user_action: "PAY_NOW",

        return_url: "https://example.com/returnUrl",
        cancel_url: "https://example.com/cancelUrl",
      },
    },
  };
  if (task === "button") {
    payload.payment_source = paypalSource;
  } else if (task === "advancedCC" && saveCard) {
    payload.payment_source = advancedCreditCardSource;
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
// capture payment for an order
export async function capturePayment(orderId) {
  const accessToken = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/checkout/orders/${orderId}/capture`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();
  return data;
}
// Refund a captured payment using PayPal's API
export async function refundCapturedPayment(captureId) {
  const accessToken = await generateAccessToken();
  const url = `${baseUrl.sandbox}/v2/payments/captures/${captureId}/refund`;
  // No need to specify amount, as it will refund the full amount by default
  const payload = {}; // No need to pass amount to refund the full capture
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error processing refund: ${errorText}`);
    }
    const data = await response.json();
    return data; // Returns the PayPal refund response
  } catch (error) {
    console.error("Error refunding payment:", error);
    throw error;
  }
}
