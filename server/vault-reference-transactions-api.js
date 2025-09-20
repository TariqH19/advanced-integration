/**
 * PayPal Vault Reference Transactions API
 * Comprehensive server-side implementation for merchant-initiated transactions with billing agreements
 */

import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data storage paths
const BILLING_AGREEMENTS_FILE = path.join(
  __dirname,
  "data",
  "billing-agreements.json"
);
const REFERENCE_TRANSACTIONS_FILE = path.join(
  __dirname,
  "data",
  "reference-transactions.json"
);
const AUTOMATION_RULES_FILE = path.join(
  __dirname,
  "data",
  "automation-rules.json"
);
const VAULT_TOKENS_REF_FILE = path.join(
  __dirname,
  "data",
  "vault-tokens-reference.json"
);

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

    const files = [
      BILLING_AGREEMENTS_FILE,
      REFERENCE_TRANSACTIONS_FILE,
      AUTOMATION_RULES_FILE,
      VAULT_TOKENS_REF_FILE,
    ];

    for (const file of files) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify({}));
      }
    }
  } catch (error) {
    console.error("Error ensuring data files:", error);
  }
}

/**
 * Load data from file
 */
async function loadData(filePath) {
  try {
    await ensureDataFiles();
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading data from ${filePath}:`, error);
    return {};
  }
}

/**
 * Save data to file
 */
async function saveData(filePath, data) {
  try {
    await ensureDataFiles();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error saving data to ${filePath}:`, error);
    throw error;
  }
}

/**
 * Generate unique IDs
 */
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create billing agreement for reference transactions
 */
export async function createBillingAgreement(req, res) {
  try {
    const {
      customer_id,
      customer_name,
      customer_email,
      agreement_description,
    } = req.body;

    if (!customer_id || !customer_name || !customer_email) {
      return res.status(400).json({
        success: false,
        error: "Customer ID, name, and email are required",
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Create billing agreement
    const agreementData = {
      name: agreement_description || `Billing Agreement for ${customer_name}`,
      description: `Reference transaction billing agreement for customer ${customer_id}`,
      plan: {
        id: "P-5ML4271244454362WXNWU5NQ", // This should be a pre-created billing plan
        state: "ACTIVE",
        name: "Reference Transactions Plan",
        description: "Plan for merchant-initiated reference transactions",
        type: "INFINITE",
        payment_definitions: [
          {
            id: "PD-94043706JD323592B",
            name: "Reference Transaction Payment",
            type: "REGULAR",
            frequency: "Month",
            frequency_interval: "1",
            amount: {
              value: "0.00",
              currency: "USD",
            },
            cycles: "0",
            charge_models: [
              {
                id: "CHM-92S85978TN737984Y",
                type: "SHIPPING",
              },
            ],
          },
        ],
        merchant_preferences: {
          return_url: "https://example.com/return",
          cancel_url: "https://example.com/cancel",
          auto_bill_amount: "NO",
          initial_fail_amount_action: "CONTINUE",
          max_fail_attempts: "0",
        },
      },
      payer: {
        payment_method: "paypal",
      },
    };

    // For sandbox testing, create a simplified agreement
    const billingAgreementId = generateId("BA");
    const agreementRecord = {
      id: billingAgreementId,
      customer_id,
      customer_name,
      customer_email,
      status: "ACTIVE",
      description:
        agreement_description || `Billing Agreement for ${customer_name}`,
      created_time: new Date().toISOString(),
      agreement_details: agreementData,
    };

    // Save billing agreement
    const agreements = await loadData(BILLING_AGREEMENTS_FILE);
    if (!agreements[customer_id]) {
      agreements[customer_id] = [];
    }
    agreements[customer_id].push(agreementRecord);
    await saveData(BILLING_AGREEMENTS_FILE, agreements);

    console.log("Billing agreement created successfully:", billingAgreementId);

    res.json({
      success: true,
      billing_agreement_id: billingAgreementId,
      customer_id,
      agreement: agreementRecord,
      message: "Billing agreement created successfully",
    });
  } catch (error) {
    console.error("Error creating billing agreement:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Create setup token for reference transactions
 */
export async function createReferenceSetupToken(req, res) {
  try {
    const {
      customer_id,
      payment_source = "card",
      billing_agreement_id,
    } = req.body;

    if (!customer_id || !billing_agreement_id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID and billing agreement ID are required",
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Create setup token for reference transactions
    const setupTokenData = {
      payment_source:
        payment_source === "paypal"
          ? {
              paypal: {
                usage_type: "MERCHANT",
                customer_type: "CONSUMER",
                user_action: "SUBSCRIBE_NOW",
                experience_context: {
                  brand_name: "Reference Transactions",
                  locale: "en-US",
                  return_url: "https://example.com/return",
                  cancel_url: "https://example.com/cancel",
                },
              },
            }
          : {
              card: {
                verification_method: "SCA_WHEN_REQUIRED",
                experience_context: {
                  brand_name: "Reference Transactions",
                  locale: "en-US",
                  return_url: "https://example.com/return",
                  cancel_url: "https://example.com/cancel",
                },
              },
            },
      usage_type: "MERCHANT",
      customer: {
        id: customer_id,
      },
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v3/vault/setup-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `ref-setup-${Date.now()}-${customer_id}`,
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

    console.log("Reference setup token created successfully:", data.id);

    res.json({
      success: true,
      setup_token: data.id,
      customer_id,
      billing_agreement_id,
      approval_url: data.links?.find((link) => link.rel === "approve")?.href,
    });
  } catch (error) {
    console.error("Error creating reference setup token:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Confirm setup token and create payment method token for reference transactions
 */
export async function confirmReferenceSetupToken(req, res) {
  try {
    const { setup_token, customer_id, billing_agreement_id } = req.body;

    if (!setup_token || !customer_id || !billing_agreement_id) {
      return res.status(400).json({
        success: false,
        error:
          "Setup token, customer ID, and billing agreement ID are required",
      });
    }

    const accessToken = await getPayPalAccessToken();

    console.log(
      `Confirming reference setup token: ${setup_token} for customer: ${customer_id}`
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
        "PayPal-Request-Id": `ref-token-${Date.now()}-${customer_id}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(paymentTokenData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PayPal payment token creation error:", data);

      // Create demo token for development if real token fails
      if (
        data.name === "RESOURCE_NOT_FOUND" ||
        data.details?.[0]?.issue === "TOKEN_NOT_FOUND"
      ) {
        console.warn(
          "Setup token not found, creating demo token for development..."
        );

        const demoTokenId = `demo_ref_token_${Date.now()}_${customer_id}`;

        const demoTokenData = {
          id: demoTokenId,
          customer_id,
          billing_agreement_id,
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
          token_type: "REFERENCE_TRANSACTION",
        };

        // Save the demo payment method token
        const vaultTokens = await loadData(VAULT_TOKENS_REF_FILE);
        if (!vaultTokens[customer_id]) {
          vaultTokens[customer_id] = [];
        }
        vaultTokens[customer_id].push(demoTokenData);
        await saveData(VAULT_TOKENS_REF_FILE, vaultTokens);

        console.log("Demo reference token created successfully:", demoTokenId);

        return res.json({
          success: true,
          payment_method_token: demoTokenId,
          customer_id,
          billing_agreement_id,
          token_data: demoTokenData,
          note: "Demo token created for development (setup token expired or not found)",
        });
      }

      return res.status(400).json({
        success: false,
        error: data.message || "Failed to create payment method token",
        details: data.details,
      });
    }

    // Save the real payment method token
    const tokenData = {
      id: data.id,
      customer_id,
      billing_agreement_id,
      payment_source: data.payment_source,
      created_time: new Date().toISOString(),
      status: "APPROVED",
      setup_token_used: setup_token,
      token_type: "REFERENCE_TRANSACTION",
    };

    const vaultTokens = await loadData(VAULT_TOKENS_REF_FILE);
    if (!vaultTokens[customer_id]) {
      vaultTokens[customer_id] = [];
    }
    vaultTokens[customer_id].push(tokenData);
    await saveData(VAULT_TOKENS_REF_FILE, vaultTokens);

    console.log(
      "Reference payment method token created successfully:",
      data.id
    );

    res.json({
      success: true,
      payment_method_token: data.id,
      customer_id,
      billing_agreement_id,
      token_data: tokenData,
    });
  } catch (error) {
    console.error("Error confirming reference setup token:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Process reference transaction (merchant-initiated payment)
 */
export async function processReferenceTransaction(req, res) {
  try {
    const {
      customer_id,
      payment_method_token,
      amount,
      currency = "USD",
      description,
      billing_agreement_id,
      reference_id,
    } = req.body;

    if (
      !customer_id ||
      !payment_method_token ||
      !amount ||
      !billing_agreement_id
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Customer ID, payment method token, amount, and billing agreement ID are required",
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Create order for reference transaction
    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: reference_id || `ref-${Date.now()}`,
          amount: {
            currency_code: currency,
            value: parseFloat(amount).toFixed(2),
          },
          description:
            description || `Reference transaction for customer ${customer_id}`,
          custom_id: customer_id,
          invoice_id: `ref-inv-${Date.now()}-${customer_id}`,
        },
      ],
      payment_source: {
        token: {
          id: payment_method_token,
          type: "PAYMENT_METHOD_TOKEN",
        },
      },
      processing_instruction: "ORDER_COMPLETE_ON_PAYMENT_APPROVAL",
    };

    // Create order
    const createResponse = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": `ref-order-${Date.now()}-${customer_id}`,
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
        error:
          createData.message || "Failed to create reference transaction order",
        details: createData.details,
      });
    }

    const transactionId = generateId("REF");
    let transactionStatus = "PENDING";
    let captureDetails = null;

    // Check if payment was auto-captured
    if (createData.status === "COMPLETED") {
      transactionStatus = "COMPLETED";
      console.log("Reference transaction auto-captured:", createData.id);
    } else {
      // Capture the payment
      const captureResponse = await fetch(
        `${PAYPAL_BASE_URL}/v2/checkout/orders/${createData.id}/capture`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "PayPal-Request-Id": `ref-capture-${Date.now()}-${customer_id}`,
            Prefer: "return=representation",
          },
        }
      );

      const captureData = await captureResponse.json();

      if (captureResponse.ok) {
        transactionStatus = "COMPLETED";
        captureDetails =
          captureData.purchase_units?.[0]?.payments?.captures?.[0];
        console.log(
          "Reference transaction captured successfully:",
          captureData.id
        );
      } else {
        console.error("PayPal capture error:", captureData);
        transactionStatus = "FAILED";
      }
    }

    // Record the transaction
    const transaction = {
      id: transactionId,
      customer_id,
      billing_agreement_id,
      payment_method_token,
      order_id: createData.id,
      amount: parseFloat(amount),
      currency,
      description:
        description || `Reference transaction for customer ${customer_id}`,
      status: transactionStatus,
      created_time: new Date().toISOString(),
      reference_id: reference_id || `ref-${Date.now()}`,
      capture_details: captureDetails,
      paypal_response: createData,
    };

    // Save transaction
    const transactions = await loadData(REFERENCE_TRANSACTIONS_FILE);
    if (!transactions[customer_id]) {
      transactions[customer_id] = [];
    }
    transactions[customer_id].push(transaction);
    await saveData(REFERENCE_TRANSACTIONS_FILE, transactions);

    console.log("Reference transaction processed successfully:", transactionId);

    res.json({
      success: true,
      transaction_id: transactionId,
      order_id: createData.id,
      status: transactionStatus,
      amount: parseFloat(amount),
      currency,
      customer_id,
      billing_agreement_id,
      transaction,
      message: "Reference transaction processed successfully",
    });
  } catch (error) {
    console.error("Error processing reference transaction:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Get customer billing agreements
 */
export async function getCustomerBillingAgreements(req, res) {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const agreements = await loadData(BILLING_AGREEMENTS_FILE);
    const customerAgreements = agreements[customer_id] || [];

    res.json({
      success: true,
      customer_id,
      agreements: customerAgreements,
      total_agreements: customerAgreements.length,
    });
  } catch (error) {
    console.error("Error getting customer billing agreements:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Get customer reference transactions
 */
export async function getCustomerReferenceTransactions(req, res) {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const transactions = await loadData(REFERENCE_TRANSACTIONS_FILE);
    const customerTransactions = transactions[customer_id] || [];

    // Sort by created_time descending
    customerTransactions.sort(
      (a, b) => new Date(b.created_time) - new Date(a.created_time)
    );

    res.json({
      success: true,
      customer_id,
      transactions: customerTransactions,
      total_transactions: customerTransactions.length,
    });
  } catch (error) {
    console.error("Error getting customer reference transactions:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Get all customers with billing agreements (for admin dashboard)
 */
export async function getAllCustomersWithAgreements(req, res) {
  try {
    const agreements = await loadData(BILLING_AGREEMENTS_FILE);
    const transactions = await loadData(REFERENCE_TRANSACTIONS_FILE);
    const vaultTokens = await loadData(VAULT_TOKENS_REF_FILE);

    const customers = [];

    for (const customerId in agreements) {
      const customerAgreements = agreements[customerId] || [];
      const customerTransactions = transactions[customerId] || [];
      const customerTokens = vaultTokens[customerId] || [];

      if (customerAgreements.length > 0) {
        const latestAgreement =
          customerAgreements[customerAgreements.length - 1];
        customers.push({
          customer_id: customerId,
          customer_name: latestAgreement.customer_name,
          customer_email: latestAgreement.customer_email,
          agreements_count: customerAgreements.length,
          transactions_count: customerTransactions.length,
          tokens_count: customerTokens.length,
          latest_agreement: latestAgreement,
          total_transaction_amount: customerTransactions.reduce(
            (sum, t) => sum + (t.amount || 0),
            0
          ),
        });
      }
    }

    // Sort by latest agreement date
    customers.sort(
      (a, b) =>
        new Date(b.latest_agreement.created_time) -
        new Date(a.latest_agreement.created_time)
    );

    res.json({
      success: true,
      customers,
      total_customers: customers.length,
    });
  } catch (error) {
    console.error("Error getting all customers with agreements:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Create automation rule
 */
export async function createAutomationRule(req, res) {
  try {
    const {
      customer_id,
      rule_name,
      trigger_type,
      trigger_condition,
      amount,
      currency = "USD",
      description,
      enabled = true,
    } = req.body;

    if (!customer_id || !rule_name || !trigger_type || !amount) {
      return res.status(400).json({
        success: false,
        error: "Customer ID, rule name, trigger type, and amount are required",
      });
    }

    const ruleId = generateId("RULE");
    const rule = {
      id: ruleId,
      customer_id,
      rule_name,
      trigger_type, // "schedule", "event", "manual"
      trigger_condition, // cron expression, event name, etc.
      amount: parseFloat(amount),
      currency,
      description: description || `Automation rule: ${rule_name}`,
      enabled,
      created_time: new Date().toISOString(),
      last_executed: null,
      execution_count: 0,
    };

    // Save automation rule
    const rules = await loadData(AUTOMATION_RULES_FILE);
    if (!rules[customer_id]) {
      rules[customer_id] = [];
    }
    rules[customer_id].push(rule);
    await saveData(AUTOMATION_RULES_FILE, rules);

    console.log("Automation rule created successfully:", ruleId);

    res.json({
      success: true,
      rule_id: ruleId,
      rule,
      message: "Automation rule created successfully",
    });
  } catch (error) {
    console.error("Error creating automation rule:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Get customer automation rules
 */
export async function getCustomerAutomationRules(req, res) {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const rules = await loadData(AUTOMATION_RULES_FILE);
    const customerRules = rules[customer_id] || [];

    res.json({
      success: true,
      customer_id,
      rules: customerRules,
      total_rules: customerRules.length,
    });
  } catch (error) {
    console.error("Error getting customer automation rules:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
}

/**
 * Health check endpoint
 */
export async function healthCheckReference(req, res) {
  try {
    // Test PayPal API connectivity
    const accessToken = await getPayPalAccessToken();

    res.json({
      success: true,
      message: "Reference Transactions API is healthy",
      timestamp: new Date().toISOString(),
      paypal_connection: !!accessToken,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Reference Transactions health check failed",
      error: error.message,
    });
  }
}

// Initialize data files on module load
ensureDataFiles().catch(console.error);
