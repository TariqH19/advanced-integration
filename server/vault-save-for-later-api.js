// PayPal Vault Save-for-Later API Integration
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateAccessToken } from "./standard-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PayPal API configuration
const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

// Data file path
const VAULT_DATA_FILE = path.join(__dirname, "..", "vault-data.json");

// Load vault data from JSON file
function loadVaultData() {
  try {
    if (fs.existsSync(VAULT_DATA_FILE)) {
      const data = fs.readFileSync(VAULT_DATA_FILE, "utf8");
      return JSON.parse(data);
    } else {
      // Initialize with default structure
      const defaultData = {
        customers: {
          customer_001: {
            name: "John Smith",
            email: "john.smith@example.com",
            payment_tokens: [],
          },
          customer_002: {
            name: "Sarah Johnson",
            email: "sarah.johnson@example.com",
            payment_tokens: [],
          },
          customer_003: {
            name: "Michael Chen",
            email: "michael.chen@example.com",
            payment_tokens: [],
          },
        },
      };
      saveVaultData(defaultData);
      return defaultData;
    }
  } catch (error) {
    console.error("❌ Error loading vault data:", error);
    throw error;
  }
}

// Save vault data to JSON file
function saveVaultData(data) {
  try {
    fs.writeFileSync(VAULT_DATA_FILE, JSON.stringify(data, null, 2));
    console.log("💾 Vault data saved successfully");
  } catch (error) {
    console.error("❌ Error saving vault data:", error);
    throw error;
  }
}

// Create Setup Token for Card
export async function createCardSetupToken(req, res) {
  console.log("🔐 Creating card setup token for save-for-later");

  try {
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        error: "customer_id is required",
      });
    }

    console.log(`👤 Creating setup token for customer: ${customer_id}`);

    const accessToken = await generateAccessToken();

    // Create setup token with empty card object (PayPal pattern for save-for-later)
    const setupTokenRequest = {
      payment_source: {
        card: {}, // Empty card object for vault-only flow
      },
      customer: {
        id: customer_id,
      },
    };

    console.log(
      "📝 Setup token request:",
      JSON.stringify(setupTokenRequest, null, 2)
    );

    const response = await fetch(`${PAYPAL_API_BASE}/v3/vault/setup-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `setup-token-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      },
      body: JSON.stringify(setupTokenRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ PayPal setup token creation failed:",
        response.status,
        errorText
      );
      throw new Error(
        `PayPal API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("✅ Card setup token created successfully:", data.id);

    res.json(data);
  } catch (error) {
    console.error("❌ Create card setup token error:", error);
    res.status(500).json({
      error: "Failed to create card setup token",
      details: error.message,
    });
  }
}

// Create Setup Token for PayPal
export async function createPayPalSetupToken(req, res) {
  console.log("🔐 Creating PayPal setup token for save-for-later");

  try {
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        error: "customer_id is required",
      });
    }

    console.log(`👤 Creating PayPal setup token for customer: ${customer_id}`);

    const accessToken = await generateAccessToken();

    // Create setup token for PayPal wallet (requires experience context)
    const setupTokenRequest = {
      payment_source: {
        paypal: {
          usage_type: "MERCHANT",
          experience_context: {
            return_url: "https://example.com/returnUrl",
            cancel_url: "https://example.com/cancelUrl",
          },
        },
      },
      customer: {
        id: customer_id,
      },
    };

    console.log(
      "📝 PayPal setup token request:",
      JSON.stringify(setupTokenRequest, null, 2)
    );

    const response = await fetch(`${PAYPAL_API_BASE}/v3/vault/setup-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `paypal-setup-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      },
      body: JSON.stringify(setupTokenRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ PayPal setup token creation failed:",
        response.status,
        errorText
      );
      throw new Error(
        `PayPal API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("✅ PayPal setup token created successfully:", data.id);

    res.json(data);
  } catch (error) {
    console.error("❌ Create PayPal setup token error:", error);
    res.status(500).json({
      error: "Failed to create PayPal setup token",
      details: error.message,
    });
  }
}

// Create Payment Token from Setup Token
export async function createPaymentToken(req, res) {
  console.log("💳 Creating payment token from setup token");

  try {
    const { vault_setup_token, customer_id } = req.body;

    if (!vault_setup_token || !customer_id) {
      return res.status(400).json({
        error: "vault_setup_token and customer_id are required",
      });
    }

    console.log(
      `🔄 Converting setup token ${vault_setup_token} to payment token for ${customer_id}`
    );

    const accessToken = await generateAccessToken();

    // Create payment token from setup token
    const paymentTokenRequest = {
      payment_source: {
        token: {
          id: vault_setup_token,
          type: "SETUP_TOKEN",
        },
      },
      customer: {
        id: customer_id,
      },
    };

    console.log(
      "📝 Payment token request:",
      JSON.stringify(paymentTokenRequest, null, 2)
    );

    const response = await fetch(`${PAYPAL_API_BASE}/v3/vault/payment-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `payment-token-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      },
      body: JSON.stringify(paymentTokenRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ PayPal payment token creation failed:",
        response.status,
        errorText
      );
      throw new Error(
        `PayPal API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("✅ Payment token created successfully:", data.id);

    // Store payment token in local data
    const vaultData = loadVaultData();

    if (!vaultData.customers[customer_id]) {
      vaultData.customers[customer_id] = {
        name: `Customer ${customer_id}`,
        email: `${customer_id}@example.com`,
        payment_tokens: [],
      };
    }

    // Extract relevant payment method details for storage
    let paymentMethodInfo = {
      id: data.id,
      customer_id: customer_id,
      created_at: new Date().toISOString(),
      payment_source: data.payment_source,
    };

    // Add card details if it's a card payment method
    if (data.payment_source.card) {
      const card = data.payment_source.card;
      paymentMethodInfo.card_details = {
        brand: card.brand,
        last_digits: card.last_digits,
        expiry: card.expiry,
        name: card.name,
      };
    }

    vaultData.customers[customer_id].payment_tokens.push(paymentMethodInfo);
    saveVaultData(vaultData);

    console.log(`💾 Payment token stored for customer ${customer_id}`);

    res.json(data);
  } catch (error) {
    console.error("❌ Create payment token error:", error);
    res.status(500).json({
      error: "Failed to create payment token",
      details: error.message,
    });
  }
}

// Get Payment Tokens for Customer
export async function getCustomerPaymentTokens(req, res) {
  console.log("📋 Getting payment tokens for customer");

  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        error: "customer_id is required",
      });
    }

    console.log(`👤 Loading payment tokens for customer: ${customer_id}`);

    const vaultData = loadVaultData();
    const customer = vaultData.customers[customer_id];

    if (!customer) {
      return res.json({
        customer_id: customer_id,
        payment_tokens: [],
      });
    }

    // Format response similar to PayPal API
    const response = {
      customer: {
        id: customer_id,
        name: customer.name,
        email: customer.email,
      },
      payment_tokens: customer.payment_tokens || [],
    };

    console.log(
      `✅ Found ${response.payment_tokens.length} payment tokens for ${customer_id}`
    );

    res.json(response);
  } catch (error) {
    console.error("❌ Get customer payment tokens error:", error);
    res.status(500).json({
      error: "Failed to get customer payment tokens",
      details: error.message,
    });
  }
}

// Delete Payment Token
export async function deletePaymentToken(req, res) {
  console.log("🗑️ Deleting payment token");

  try {
    const { token_id } = req.params;

    if (!token_id) {
      return res.status(400).json({
        error: "token_id is required",
      });
    }

    console.log(`🗑️ Deleting payment token: ${token_id}`);

    // Delete from PayPal
    const accessToken = await generateAccessToken();

    const response = await fetch(
      `${PAYPAL_API_BASE}/v3/vault/payment-tokens/${token_id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": `delete-token-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.error(
        "❌ PayPal payment token deletion failed:",
        response.status,
        errorText
      );
      // Continue with local deletion even if PayPal deletion fails
    } else {
      console.log("✅ Payment token deleted from PayPal");
    }

    // Delete from local data
    const vaultData = loadVaultData();
    let found = false;

    for (const customerId in vaultData.customers) {
      const customer = vaultData.customers[customerId];
      const tokenIndex = customer.payment_tokens.findIndex(
        (token) => token.id === token_id
      );

      if (tokenIndex !== -1) {
        customer.payment_tokens.splice(tokenIndex, 1);
        found = true;
        console.log(
          `💾 Payment token removed from customer ${customerId} local data`
        );
        break;
      }
    }

    if (found) {
      saveVaultData(vaultData);
    }

    res.status(204).send(); // No content response for successful deletion
  } catch (error) {
    console.error("❌ Delete payment token error:", error);
    res.status(500).json({
      error: "Failed to delete payment token",
      details: error.message,
    });
  }
}

// Create payment order with saved payment token
export async function createPaymentOrder(req, res) {
  console.log("🚀 Creating payment order with saved token");

  try {
    const {
      vault_id,
      amount,
      currency = "USD",
      description = "Payment",
      customer_id,
    } = req.body;

    if (!vault_id || !amount) {
      return res.status(400).json({
        error: "vault_id and amount are required",
      });
    }

    // Create order using PayPal Orders API with vault_id
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toString(),
          },
          description: description,
        },
      ],
      payment_source: {
        paypal: {
          vault_id: vault_id,
          stored_credential: {
            payment_initiator: "MERCHANT",
            payment_type: "UNSCHEDULED",
            usage: "SUBSEQUENT",
          },
        },
      },
    };

    console.log("📄 Order payload:", JSON.stringify(orderPayload, null, 2));

    const accessToken = await generateAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `payment-${Date.now()}-${Math.random()}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await response.json();
    console.log("✅ Order creation response:", orderData);

    if (!response.ok) {
      console.error("❌ Order creation failed:", orderData);
      return res.status(response.status).json({
        error: orderData.message || "Failed to create payment order",
        details: orderData,
      });
    }

    // Check if the order was auto-captured (common with vault payments)
    if (orderData.status === "COMPLETED") {
      console.log("🎉 Order was auto-captured successfully!");

      // Extract payment details from the completed order
      const capture = orderData.purchase_units?.[0]?.payments?.captures?.[0];

      return res.json({
        id: orderData.id,
        status: orderData.status,
        capture_id: capture?.id,
        amount: capture?.amount,
        create_time: capture?.create_time,
        purchase_units: orderData.purchase_units,
        auto_captured: true,
      });
    }

    res.json({
      order_id: orderData.id,
      status: orderData.status,
      links: orderData.links,
      auto_captured: false,
    });
  } catch (error) {
    console.error("❌ Error creating payment order:", error);
    res.status(500).json({
      error: "Internal server error during order creation",
      details: error.message,
    });
  }
}

// Capture payment order
export async function capturePayment(req, res) {
  console.log("💳 Capturing payment order");

  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        error: "order_id is required",
      });
    }

    console.log("🎯 Capturing order:", order_id);

    const accessToken = await generateAccessToken();
    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${order_id}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": `capture-${Date.now()}-${Math.random()}`,
        },
      }
    );

    const captureData = await response.json();
    console.log("💰 Capture response:", captureData);

    if (!response.ok) {
      console.error("❌ Payment capture failed:", captureData);

      // Check if the order was already captured
      if (
        captureData.name === "UNPROCESSABLE_ENTITY" &&
        captureData.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED"
      ) {
        console.log("ℹ️ Order was already captured, fetching order details...");

        // Fetch the order details to get capture information
        const orderResponse = await fetch(
          `${PAYPAL_API_BASE}/v2/checkout/orders/${order_id}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          const capture =
            orderData.purchase_units?.[0]?.payments?.captures?.[0];

          return res.json({
            id: orderData.id,
            status: orderData.status,
            capture_id: capture?.id,
            amount: capture?.amount,
            create_time: capture?.create_time,
            purchase_units: orderData.purchase_units,
            already_captured: true,
          });
        }
      }

      return res.status(response.status).json({
        error: captureData.message || "Failed to capture payment",
        details: captureData,
      });
    }

    // Extract capture details
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];

    res.json({
      id: captureData.id,
      status: captureData.status,
      capture_id: capture?.id,
      amount: capture?.amount,
      create_time: capture?.create_time,
      purchase_units: captureData.purchase_units,
    });
  } catch (error) {
    console.error("❌ Error capturing payment:", error);
    res.status(500).json({
      error: "Internal server error during payment capture",
      details: error.message,
    });
  }
}

// Health Check Endpoint
export async function healthCheck(req, res) {
  try {
    const vaultData = loadVaultData();
    const totalCustomers = Object.keys(vaultData.customers).length;
    const totalTokens = Object.values(vaultData.customers).reduce(
      (sum, customer) => sum + (customer.payment_tokens?.length || 0),
      0
    );

    res.json({
      status: "healthy",
      service: "vault-save-for-later",
      timestamp: new Date().toISOString(),
      stats: {
        customers: totalCustomers,
        payment_tokens: totalTokens,
      },
    });
  } catch (error) {
    console.error("❌ Health check error:", error);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
    });
  }
}
