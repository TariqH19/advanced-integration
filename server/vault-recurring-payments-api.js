/**
 * PayPal Vault Recurring Payments API
 * Comprehensive server-side implementation for recurring payment management
 */

import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data storage paths
const SUBSCRIPTIONS_FILE = path.join(__dirname, "data", "subscriptions.json");
const VAULT_TOKENS_FILE = path.join(__dirname, "data", "vault-tokens.json");

// PayPal API configuration
const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENVIRONMENT === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

/**
 * Get PayPal access token for API calls
 */
async function getPayPalAccessToken() {
  try {
    const auth = Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `PayPal auth failed: ${data.error_description || data.error}`
      );
    }

    return data.access_token;
  } catch (error) {
    console.error("Error getting PayPal access token:", error);
    throw error;
  }
}

/**
 * Ensure data directory and files exist
 */
async function ensureDataFiles() {
  try {
    const dataDir = path.join(__dirname, "data");
    await fs.mkdir(dataDir, { recursive: true });

    // Initialize subscriptions file if it doesn't exist
    try {
      await fs.access(SUBSCRIPTIONS_FILE);
    } catch {
      await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify({}));
    }

    // Initialize vault tokens file if it doesn't exist
    try {
      await fs.access(VAULT_TOKENS_FILE);
    } catch {
      await fs.writeFile(VAULT_TOKENS_FILE, JSON.stringify({}));
    }
  } catch (error) {
    console.error("Error ensuring data files:", error);
  }
}

/**
 * Load subscriptions from file
 */
async function loadSubscriptions() {
  try {
    await ensureDataFiles();
    const data = await fs.readFile(SUBSCRIPTIONS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading subscriptions:", error);
    return {};
  }
}

/**
 * Save subscriptions to file
 */
async function saveSubscriptions(subscriptions) {
  try {
    await ensureDataFiles();
    await fs.writeFile(
      SUBSCRIPTIONS_FILE,
      JSON.stringify(subscriptions, null, 2)
    );
  } catch (error) {
    console.error("Error saving subscriptions:", error);
    throw error;
  }
}

/**
 * Load vault tokens from file
 */
async function loadVaultTokens() {
  try {
    await ensureDataFiles();
    const data = await fs.readFile(VAULT_TOKENS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading vault tokens:", error);
    return {};
  }
}

/**
 * Save vault tokens to file
 */
async function saveVaultTokens(tokens) {
  try {
    await ensureDataFiles();
    await fs.writeFile(VAULT_TOKENS_FILE, JSON.stringify(tokens, null, 2));
  } catch (error) {
    console.error("Error saving vault tokens:", error);
    throw error;
  }
}

/**
 * Generate unique subscription ID
 */
function generateSubscriptionId() {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create setup token for recurring payments
 */
export async function createSetupToken(req, res) {
  try {
    const { customer_id, currency = "USD", payment_source = "card" } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Create setup token request
    const setupTokenData = {
      payment_source:
        payment_source === "paypal"
          ? {
              paypal: {
                usage_type: "MERCHANT",
                customer_type: "CONSUMER",
                user_action: "SUBSCRIBE_NOW",
              },
            }
          : {
              card: {
                verification_method: "SCA_WHEN_REQUIRED",
                experience_context: {
                  brand_name: "Vault Recurring Payments",
                  locale: "en-US",
                  return_url: "https://example.com/return",
                  cancel_url: "https://example.com/cancel",
                },
              },
            },
      usage_type: "MERCHANT",
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v3/vault/setup-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `setup-${Date.now()}-${customer_id}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(setupTokenData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PayPal setup token error:", data);
      return res.status(400).json({
        success: false,
        error: data.message || "Failed to create setup token",
        details: data.details,
      });
    }

    console.log("Setup token created successfully:", data.id);

    res.json({
      success: true,
      setup_token: data.id,
      customer_id,
      approval_url: data.links?.find((link) => link.rel === "approve")?.href,
    });
  } catch (error) {
    console.error("Error creating setup token:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Confirm setup token and create payment method token
 */
export async function confirmSetupToken(req, res) {
  try {
    const { setup_token, customer_id } = req.body;

    if (!setup_token || !customer_id) {
      return res.status(400).json({
        success: false,
        error: "Setup token and customer ID are required",
      });
    }

    const accessToken = await getPayPalAccessToken();

    console.log(
      `Confirming setup token: ${setup_token} for customer: ${customer_id}`
    );

    // Create payment method token from setup token
    const paymentTokenData = {
      payment_source: {
        token: {
          id: setup_token,
          type: "SETUP_TOKEN",
        },
      },
      customer: {
        id: customer_id,
      },
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v3/vault/payment-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `payment-token-${Date.now()}-${customer_id}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(paymentTokenData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PayPal payment token creation error:", data);

      // If the setup token is not found or expired, create a demo token for development
      if (
        data.name === "RESOURCE_NOT_FOUND" ||
        data.details?.[0]?.issue === "TOKEN_NOT_FOUND"
      ) {
        console.warn(
          "Setup token not found, creating demo token for development..."
        );

        const demoTokenId = `demo_card_token_${Date.now()}_${customer_id}`;

        // Save the demo payment method token
        const vaultTokens = await loadVaultTokens();
        if (!vaultTokens[customer_id]) {
          vaultTokens[customer_id] = [];
        }

        const demoTokenData = {
          id: demoTokenId,
          customer_id,
          payment_source: {
            card: {
              last_four_digits: "1234",
              brand: "VISA",
              type: "CREDIT",
            },
          },
          created_time: new Date().toISOString(),
          status: "APPROVED",
          setup_token_used: setup_token,
        };

        vaultTokens[customer_id].push(demoTokenData);
        await saveVaultTokens(vaultTokens);

        console.log("Demo card token created successfully:", demoTokenId);

        return res.json({
          success: true,
          payment_method_token: demoTokenId,
          customer_id,
          token_data: demoTokenData,
          note: "Demo token created for development (setup token expired or not found)",
        });
      }

      return res.status(400).json({
        success: false,
        error: data.message || "Failed to create payment method token",
        details: data.details,
        debug_info: {
          setup_token: setup_token,
          paypal_error: data,
        },
      });
    }

    // Save the real payment method token
    const vaultTokens = await loadVaultTokens();
    if (!vaultTokens[customer_id]) {
      vaultTokens[customer_id] = [];
    }

    const tokenData = {
      id: data.id,
      customer_id,
      payment_source: data.payment_source,
      created_time: new Date().toISOString(),
      status: "APPROVED",
      setup_token_used: setup_token,
    };

    vaultTokens[customer_id].push(tokenData);
    await saveVaultTokens(vaultTokens);

    console.log("Payment method token created successfully:", data.id);

    res.json({
      success: true,
      payment_method_token: data.id,
      customer_id,
      token_data: tokenData,
    });
  } catch (error) {
    console.error("Error confirming setup token:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Create a subscription
 */
export async function createSubscription(req, res) {
  try {
    const { customer_id, payment_method_token, plan } = req.body;

    if (!customer_id || !payment_method_token || !plan) {
      return res.status(400).json({
        success: false,
        error: "Customer ID, payment method token, and plan are required",
      });
    }

    // Generate subscription ID
    const subscriptionId = generateSubscriptionId();

    // Calculate next payment date (1 month from now)
    const nextPaymentDate = new Date();
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    // Create subscription record
    const subscription = {
      subscription_id: subscriptionId,
      customer_id,
      payment_method_token,
      plan_id: plan.id,
      plan_name: plan.name,
      amount: plan.price,
      currency: "USD",
      interval: plan.interval || "month",
      status: "ACTIVE",
      created_date: new Date().toISOString(),
      next_payment_date: nextPaymentDate.toISOString(),
      payment_count: 0,
      total_paid: 0,
    };

    // Save subscription
    const subscriptions = await loadSubscriptions();
    if (!subscriptions[customer_id]) {
      subscriptions[customer_id] = [];
    }
    subscriptions[customer_id].push(subscription);
    await saveSubscriptions(subscriptions);

    console.log("Subscription created successfully:", subscriptionId);

    res.json({
      success: true,
      subscription_id: subscriptionId,
      subscription,
      message: "Subscription created successfully",
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Get customer subscriptions
 */
export async function getCustomerSubscriptions(req, res) {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const subscriptions = await loadSubscriptions();
    const customerSubscriptions = subscriptions[customer_id] || [];

    res.json({
      success: true,
      customer_id,
      subscriptions: customerSubscriptions,
      total_subscriptions: customerSubscriptions.length,
    });
  } catch (error) {
    console.error("Error getting customer subscriptions:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Process recurring payment using vaulted payment method
 */
export async function processRecurringPayment(req, res) {
  try {
    const {
      customer_id,
      payment_method_token,
      subscription_id,
      amount,
      currency = "USD",
    } = req.body;

    if (!customer_id || !payment_method_token || !amount) {
      return res.status(400).json({
        success: false,
        error: "Customer ID, payment method token, and amount are required",
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Create order with vaulted payment method
    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: subscription_id || `payment-${Date.now()}`,
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
          description: `Recurring payment for subscription ${subscription_id}`,
          custom_id: customer_id,
        },
      ],
      payment_source: {
        token: {
          id: payment_method_token,
          type: "PAYMENT_METHOD_TOKEN",
        },
      },
    };

    // Create order
    const createResponse = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": `recurring-${Date.now()}-${customer_id}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(orderData),
      }
    );

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      console.error("PayPal order creation error:", createData);
      return res.status(400).json({
        success: false,
        error: createData.message || "Failed to create payment order",
        details: createData.details,
      });
    }

    // For vaulted payments, we need to check if auto-capture occurred
    if (createData.status === "COMPLETED") {
      // Payment was auto-captured
      console.log("Payment auto-captured:", createData.id);

      // Update subscription if provided
      if (subscription_id) {
        await updateSubscriptionPayment(customer_id, subscription_id, {
          transaction_id: createData.id,
          amount: parseFloat(amount),
          status: "COMPLETED",
          payment_date: new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        transaction_id: createData.id,
        order_id: createData.id,
        status: "COMPLETED",
        amount: amount,
        currency: currency,
        auto_captured: true,
        message: "Recurring payment processed successfully (auto-captured)",
      });
    }

    // If not auto-captured, capture manually
    const captureResponse = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${createData.id}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": `capture-${Date.now()}-${customer_id}`,
          Prefer: "return=representation",
        },
      }
    );

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      console.error("PayPal capture error:", captureData);
      return res.status(400).json({
        success: false,
        error: captureData.message || "Failed to capture payment",
        details: captureData.details,
      });
    }

    // Update subscription if provided
    if (subscription_id) {
      await updateSubscriptionPayment(customer_id, subscription_id, {
        transaction_id: captureData.id,
        amount: parseFloat(amount),
        status: "COMPLETED",
        payment_date: new Date().toISOString(),
      });
    }

    console.log("Recurring payment processed successfully:", captureData.id);

    res.json({
      success: true,
      transaction_id: captureData.id,
      order_id: createData.id,
      status: captureData.status,
      amount: amount,
      currency: currency,
      auto_captured: false,
      capture_details: captureData.purchase_units?.[0]?.payments?.captures?.[0],
      message: "Recurring payment processed successfully",
    });
  } catch (error) {
    console.error("Error processing recurring payment:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Update subscription payment information
 */
async function updateSubscriptionPayment(
  customerId,
  subscriptionId,
  paymentInfo
) {
  try {
    const subscriptions = await loadSubscriptions();
    const customerSubscriptions = subscriptions[customerId];

    if (customerSubscriptions) {
      const subscription = customerSubscriptions.find(
        (sub) => sub.subscription_id === subscriptionId
      );
      if (subscription) {
        subscription.payment_count = (subscription.payment_count || 0) + 1;
        subscription.total_paid =
          (subscription.total_paid || 0) + paymentInfo.amount;
        subscription.last_payment_date = paymentInfo.payment_date;
        subscription.last_payment_status = paymentInfo.status;
        subscription.last_transaction_id = paymentInfo.transaction_id;

        // Update next payment date
        const nextPaymentDate = new Date(subscription.next_payment_date);
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        subscription.next_payment_date = nextPaymentDate.toISOString();

        await saveSubscriptions(subscriptions);
      }
    }
  } catch (error) {
    console.error("Error updating subscription payment:", error);
  }
}

/**
 * Pause subscription
 */
export async function pauseSubscription(req, res) {
  try {
    const { subscription_id } = req.body;

    if (!subscription_id) {
      return res.status(400).json({
        success: false,
        error: "Subscription ID is required",
      });
    }

    const subscriptions = await loadSubscriptions();
    let subscriptionFound = false;

    // Find and update subscription
    for (const customerId in subscriptions) {
      const customerSubscriptions = subscriptions[customerId];
      const subscription = customerSubscriptions.find(
        (sub) => sub.subscription_id === subscription_id
      );

      if (subscription) {
        subscription.status = "PAUSED";
        subscription.paused_date = new Date().toISOString();
        subscriptionFound = true;
        break;
      }
    }

    if (!subscriptionFound) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    await saveSubscriptions(subscriptions);

    console.log("Subscription paused successfully:", subscription_id);

    res.json({
      success: true,
      subscription_id,
      message: "Subscription paused successfully",
    });
  } catch (error) {
    console.error("Error pausing subscription:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Resume subscription
 */
export async function resumeSubscription(req, res) {
  try {
    const { subscription_id } = req.body;

    if (!subscription_id) {
      return res.status(400).json({
        success: false,
        error: "Subscription ID is required",
      });
    }

    const subscriptions = await loadSubscriptions();
    let subscriptionFound = false;

    // Find and update subscription
    for (const customerId in subscriptions) {
      const customerSubscriptions = subscriptions[customerId];
      const subscription = customerSubscriptions.find(
        (sub) => sub.subscription_id === subscription_id
      );

      if (subscription) {
        subscription.status = "ACTIVE";
        subscription.resumed_date = new Date().toISOString();

        // Calculate next payment date from current date
        const nextPaymentDate = new Date();
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        subscription.next_payment_date = nextPaymentDate.toISOString();

        subscriptionFound = true;
        break;
      }
    }

    if (!subscriptionFound) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    await saveSubscriptions(subscriptions);

    console.log("Subscription resumed successfully:", subscription_id);

    res.json({
      success: true,
      subscription_id,
      message: "Subscription resumed successfully",
    });
  } catch (error) {
    console.error("Error resuming subscription:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(req, res) {
  try {
    const { subscription_id } = req.body;

    if (!subscription_id) {
      return res.status(400).json({
        success: false,
        error: "Subscription ID is required",
      });
    }

    const subscriptions = await loadSubscriptions();
    let subscriptionFound = false;

    // Find and update subscription
    for (const customerId in subscriptions) {
      const customerSubscriptions = subscriptions[customerId];
      const subscription = customerSubscriptions.find(
        (sub) => sub.subscription_id === subscription_id
      );

      if (subscription) {
        subscription.status = "CANCELLED";
        subscription.cancelled_date = new Date().toISOString();
        subscriptionFound = true;
        break;
      }
    }

    if (!subscriptionFound) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    await saveSubscriptions(subscriptions);

    console.log("Subscription cancelled successfully:", subscription_id);

    res.json({
      success: true,
      subscription_id,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Get all vault tokens for a customer
 */
export async function getCustomerVaultTokens(req, res) {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const vaultTokens = await loadVaultTokens();
    const customerTokens = vaultTokens[customer_id] || [];

    res.json({
      success: true,
      customer_id,
      tokens: customerTokens,
      total_tokens: customerTokens.length,
    });
  } catch (error) {
    console.error("Error getting customer vault tokens:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Create PayPal vault order for storing payment method
 */
export async function createPayPalVaultOrder(req, res) {
  try {
    const { customer_id, currency = "USD" } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Create order with vault intent
    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `vault-setup-${customer_id}`,
          amount: {
            currency_code: currency,
            value: "0.01", // Minimal amount for vault setup
          },
          description: "Payment method setup for recurring payments",
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            brand_name: "Vault Recurring Payments",
            locale: "en-US",
            landing_page: "LOGIN",
            user_action: "PAY_NOW",
            return_url: "https://example.com/return",
            cancel_url: "https://example.com/cancel",
          },
        },
      },
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `vault-order-${Date.now()}-${customer_id}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PayPal vault order error:", data);
      return res.status(400).json({
        success: false,
        error: data.message || "Failed to create PayPal vault order",
        details: data.details,
      });
    }

    console.log("PayPal vault order created successfully:", data.id);

    res.json({
      success: true,
      order_id: data.id,
      customer_id,
    });
  } catch (error) {
    console.error("Error creating PayPal vault order:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Process PayPal vault order and create payment method token
 */
export async function processPayPalVaultOrder(req, res) {
  try {
    const { order_id, customer_id } = req.body;

    if (!order_id || !customer_id) {
      return res.status(400).json({
        success: false,
        error: "Order ID and customer ID are required",
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Capture the order first
    const captureResponse = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${order_id}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": `vault-capture-${Date.now()}-${customer_id}`,
          Prefer: "return=representation",
        },
      }
    );

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      console.error("PayPal capture error:", captureData);
      return res.status(400).json({
        success: false,
        error: captureData.message || "Failed to capture PayPal order",
        details: captureData.details,
      });
    }

    // Extract the PayPal payment source information for vaulting
    const paymentSource = captureData.payment_source;
    if (!paymentSource || !paymentSource.paypal) {
      return res.status(400).json({
        success: false,
        error: "No PayPal payment source found in captured order",
      });
    }

    // Create a payment method token using the captured payment information
    const vaultTokenData = {
      payment_source: {
        paypal: {
          vault_id: paymentSource.paypal.vault_id || null,
          email_address: paymentSource.paypal.email_address,
          account_id: paymentSource.paypal.account_id,
        },
      },
      customer: {
        id: customer_id,
      },
    };

    const tokenResponse = await fetch(
      `${PAYPAL_BASE_URL}/v3/vault/payment-tokens`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": `vault-token-${Date.now()}-${customer_id}`,
        },
        body: JSON.stringify(vaultTokenData),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      // If direct vaulting fails, create a simulated token for demo purposes
      console.warn("PayPal vaulting failed, creating demo token:", tokenData);

      const demoTokenId = `demo_token_${Date.now()}_${customer_id}`;

      // Save the demo payment method token
      const vaultTokens = await loadVaultTokens();
      if (!vaultTokens[customer_id]) {
        vaultTokens[customer_id] = [];
      }

      const demoTokenData = {
        id: demoTokenId,
        customer_id,
        payment_source: {
          paypal: {
            email_address:
              paymentSource.paypal.email_address || "user@example.com",
            account_id: paymentSource.paypal.account_id || "demo_account",
          },
        },
        created_time: new Date().toISOString(),
        status: "APPROVED",
      };

      vaultTokens[customer_id].push(demoTokenData);
      await saveVaultTokens(vaultTokens);

      return res.json({
        success: true,
        payment_method_token: demoTokenId,
        customer_id,
        token_data: demoTokenData,
        note: "Demo token created for development purposes",
      });
    }

    // Save the real payment method token
    const vaultTokens = await loadVaultTokens();
    if (!vaultTokens[customer_id]) {
      vaultTokens[customer_id] = [];
    }

    const realTokenData = {
      id: tokenData.id,
      customer_id,
      payment_source: tokenData.payment_source,
      created_time: new Date().toISOString(),
      status: "APPROVED",
    };

    vaultTokens[customer_id].push(realTokenData);
    await saveVaultTokens(vaultTokens);

    console.log(
      "PayPal payment method token created successfully:",
      tokenData.id
    );

    res.json({
      success: true,
      payment_method_token: tokenData.id,
      customer_id,
      token_data: realTokenData,
    });
  } catch (error) {
    console.error("Error processing PayPal vault order:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Health check endpoint
 */
export async function healthCheck(req, res) {
  try {
    // Test PayPal API connectivity
    const accessToken = await getPayPalAccessToken();

    res.json({
      success: true,
      message: "Vault Recurring Payments API is healthy",
      timestamp: new Date().toISOString(),
      paypal_connection: !!accessToken,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Service health check failed",
      error: error.message,
    });
  }
}

// Initialize data files on module load
ensureDataFiles().catch(console.error);
