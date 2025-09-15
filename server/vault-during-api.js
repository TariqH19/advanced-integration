import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Health check endpoint
router.get("/health-check", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "PayPal Vault API",
  });
});

// Get environment variables (adjust based on your config)
const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID ||
  "AYKEHhMOHxkycKjSnN548FOs6qDSY-FT_97BIziC-GvhPIbXgb5pdunsni91NhaBvD590azAxRqkZntY";
const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET ||
  "ENqFyKT5bUrAkNlAL1gFwEDxR8vnNcnqf9oWNPyE1V1l1cj2RpCQTdYT2Yq3vMF3k_xCKP6eMlSnHYFl";
const base = process.env.PAYPAL_BASE_URL || "sandbox";

// PayPal API base URL
const PAYPAL_API =
  base === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

// Utility function to read vault data
async function readVaultData() {
  try {
    const data = await fs.readFile(
      path.join(__dirname, "vault-data.json"),
      "utf8"
    );

    // Check if data is empty or just whitespace
    if (!data.trim()) {
      console.log("Vault data file is empty, creating default structure");
      return { customers: {}, metadata: { lastCustomerId: 0 } };
    }

    const parsedData = JSON.parse(data);

    // Validate the structure
    if (!parsedData.customers) {
      parsedData.customers = {};
    }
    if (!parsedData.metadata) {
      parsedData.metadata = { lastCustomerId: 0 };
    }

    return parsedData;
  } catch (error) {
    console.error("Error reading vault data:", error);

    // Create default data structure
    const defaultData = {
      customers: {},
      metadata: {
        lastCustomerId: 0,
        created: new Date().toISOString().split("T")[0],
        description: "PayPal Vault Demo Data Storage",
      },
    };

    // Try to write the default data
    try {
      await writeVaultData(defaultData);
      console.log("Created new vault data file with default structure");
    } catch (writeError) {
      console.error("Failed to create default vault data file:", writeError);
    }

    return defaultData;
  }
}

// Utility function to write vault data
async function writeVaultData(data) {
  try {
    await fs.writeFile(
      path.join(__dirname, "vault-data.json"),
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Error writing vault data:", error);
    throw error;
  }
}

// Generate PayPal access token
async function generateAccessToken() {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }

    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");

    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
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
    throw error;
  }
}

// Generate PayPal user ID token for vaulting
async function generateUserIdToken() {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }

    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");

    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials&response_type=id_token",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to generate User ID Token:", error);
    throw error;
  }
}

// Route: Generate user ID token for vault
router.post("/generate-user-token", async (req, res) => {
  try {
    const tokenData = await generateUserIdToken();

    if (!tokenData.id_token) {
      throw new Error("Failed to generate user ID token");
    }

    res.json({
      success: true,
      id_token: tokenData.id_token,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    });
  } catch (error) {
    console.error("Error generating user token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate user token",
    });
  }
});

// Route: Create customer
router.post("/create-customer", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: "Name and email are required",
      });
    }

    const vaultData = await readVaultData();
    const customerId = `customer_${String(
      vaultData.metadata.lastCustomerId + 1
    ).padStart(3, "0")}`;

    vaultData.customers[customerId] = {
      id: customerId,
      name,
      email,
      created: new Date().toISOString(),
      paypal_customer_id: null,
      payment_tokens: [],
    };

    vaultData.metadata.lastCustomerId += 1;

    await writeVaultData(vaultData);

    res.json({
      success: true,
      customer: vaultData.customers[customerId],
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create customer",
    });
  }
});

// Route: Get customers
router.get("/customers", async (req, res) => {
  try {
    console.log("Loading customers from vault data...");
    const vaultData = await readVaultData();
    console.log(
      "Vault data loaded successfully:",
      Object.keys(vaultData.customers).length,
      "customers found"
    );

    res.json({
      success: true,
      customers: vaultData.customers,
    });
  } catch (error) {
    console.error("Error getting customers:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get customers",
    });
  }
});

// Route: Create vault-enabled order
router.post("/create-vault-order", async (req, res) => {
  try {
    const {
      customerId,
      amount = "100.00",
      currency = "USD",
      vaultType = "PAYPAL",
      card, // Card specific configuration from client
    } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    const accessToken = await generateAccessToken();

    // Build payment source based on vault type
    let paymentSource = {};

    if (vaultType === "PAYPAL") {
      paymentSource = {
        paypal: {
          attributes: {
            vault: {
              store_in_vault: "ON_SUCCESS",
              usage_type: "MERCHANT",
              customer_type: "CONSUMER",
            },
          },
          experience_context: {
            return_url: `http://localhost:8888/vault-during-purchase?success=true&customer=${customerId}`,
            cancel_url: `http://localhost:8888/vault-during-purchase?cancelled=true&customer=${customerId}`,
          },
        },
      };
    } else if (vaultType === "CARD") {
      // Use card configuration from client or defaults
      const cardAttributes = card?.attributes || {
        verification: {
          method: "SCA_WHEN_REQUIRED",
        },
        vault: {
          store_in_vault: "ON_SUCCESS",
        },
      };

      const experienceContext = card?.experience_context || {
        shipping_preference: "NO_SHIPPING",
        return_url: `http://localhost:8888/vault-during-purchase?success=true&customer=${customerId}`,
        cancel_url: `http://localhost:8888/vault-during-purchase?cancelled=true&customer=${customerId}`,
      };

      paymentSource = {
        card: {
          attributes: cardAttributes,
          experience_context: experienceContext,
        },
      };
    }

    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
          description: "PayPal Vault Demo Purchase",
        },
      ],
      payment_source: paymentSource,
    };

    console.log(
      `Creating ${vaultType} vault order for customer ${customerId}:`,
      JSON.stringify(orderData, null, 2)
    );

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": `vault-order-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      },
      body: JSON.stringify(orderData),
    });

    const order = await response.json();

    if (!response.ok) {
      console.error("PayPal API Error:", JSON.stringify(order, null, 2));
      throw new Error(order.message || "Failed to create order");
    }

    console.log(`Order created successfully: ${order.id}`);

    res.json({
      success: true,
      order: order,
      id: order.id,
    });
  } catch (error) {
    console.error("Error creating vault order:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create vault order",
    });
  }
});

// Route: Capture vault-enabled order
router.post("/capture-vault-order/:orderID", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { customerId } = req.body;

    console.log(`Capturing order ${orderID} for customer ${customerId}`);

    if (!orderID) {
      return res.status(400).json({
        success: false,
        error: "Order ID is required",
      });
    }

    const accessToken = await generateAccessToken();

    const response = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const captureData = await response.json();
    console.log("Capture response:", JSON.stringify(captureData, null, 2));

    if (!response.ok) {
      console.error("Capture failed:", captureData);
      throw new Error(captureData.message || "Failed to capture order");
    }

    // Check if vault information is available
    const vaultInfo =
      captureData.payment_source?.paypal?.attributes?.vault ||
      captureData.payment_source?.card?.attributes?.vault;

    console.log("Vault info found:", vaultInfo);

    // Get card details if it's a card payment
    let cardDetails = null;
    if (captureData.payment_source?.card) {
      cardDetails = {
        last_digits: captureData.payment_source.card.last_digits,
        brand: captureData.payment_source.card.brand,
        type: captureData.payment_source.card.type,
      };
      console.log("Card details:", cardDetails);
    }

    if (vaultInfo && customerId) {
      try {
        // Update customer data with vault information
        const vaultData = await readVaultData();

        if (vaultData.customers[customerId]) {
          // Update PayPal customer ID if available
          if (vaultInfo.customer?.id) {
            vaultData.customers[customerId].paypal_customer_id =
              vaultInfo.customer.id;
          }

          // Add payment token if vaulted
          if (vaultInfo.id && vaultInfo.status === "VAULTED") {
            const tokenExists = vaultData.customers[
              customerId
            ].payment_tokens.some((token) => token.id === vaultInfo.id);

            if (!tokenExists) {
              const tokenData = {
                id: vaultInfo.id,
                type: captureData.payment_source?.paypal ? "PAYPAL" : "CARD",
                status: vaultInfo.status,
                created: new Date().toISOString(),
                last_used: new Date().toISOString(),
              };

              // Add card details if available
              if (cardDetails) {
                tokenData.card_details = cardDetails;
              }

              vaultData.customers[customerId].payment_tokens.push(tokenData);
              console.log("Added new payment token:", tokenData);
            } else {
              // Update last used time for existing token
              const existingToken = vaultData.customers[
                customerId
              ].payment_tokens.find((token) => token.id === vaultInfo.id);
              if (existingToken) {
                existingToken.last_used = new Date().toISOString();
                console.log("Updated existing token last used time");
              }
            }
          }

          await writeVaultData(vaultData);
          console.log("Vault data updated successfully");
        }
      } catch (vaultUpdateError) {
        console.error("Error updating vault data:", vaultUpdateError);
        // Continue with successful capture response even if vault update fails
      }
    }

    res.json({
      success: true,
      capture: captureData,
      vault_info: vaultInfo || null,
      card_details: cardDetails,
    });
  } catch (error) {
    console.error("Error capturing vault order:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to capture vault order",
    });
  }
});

// Route: Get customer vault info
router.get("/customer/:customerId/vault-info", async (req, res) => {
  try {
    const { customerId } = req.params;
    const vaultData = await readVaultData();

    const customer = vaultData.customers[customerId];
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    res.json({
      success: true,
      customer: customer,
      vault_tokens: customer.payment_tokens || [],
    });
  } catch (error) {
    console.error("Error getting customer vault info:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get customer vault info",
    });
  }
});

// Route: Create order using existing payment token
router.post("/create-token-order", async (req, res) => {
  try {
    const { customerId, paymentTokenId, amount, currency } = req.body;

    if (!customerId || !paymentTokenId || !amount) {
      return res.status(400).json({
        success: false,
        error: "Customer ID, payment token ID, and amount are required",
      });
    }

    // Verify customer and token exist
    const vaultData = await readVaultData();
    const customer = vaultData.customers[customerId];

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    const paymentToken = customer.payment_tokens.find(
      (token) => token.id === paymentTokenId
    );
    if (!paymentToken) {
      return res.status(404).json({
        success: false,
        error: "Payment token not found",
      });
    }

    console.log(
      `Processing REAL payment with saved ${paymentToken.type} method for customer ${customerId}`
    );
    console.log("Creating NEW order for saved payment method");

    const accessToken = await generateAccessToken();
    console.log("Access token generated successfully");

    // Create order using REAL PayPal Orders API with vault reference
    let paymentSource = {};

    if (paymentToken.type === "PAYPAL") {
      paymentSource = {
        paypal: {
          vault_id: paymentTokenId,
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            user_action: "PAY_NOW",
          },
        },
      };
    } else if (paymentToken.type === "CARD") {
      paymentSource = {
        card: {
          vault_id: paymentTokenId,
        },
      };
    }

    // Generate unique request ID to ensure new order creation
    const uniqueRequestId = `vault-order-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log("Unique request ID:", uniqueRequestId);

    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
          description: `New Payment with Saved ${
            paymentToken.type
          } Method - ${new Date().toISOString()}`,
        },
      ],
      payment_source: paymentSource,
    };

    console.log("Creating NEW order with vault_id:", paymentTokenId);
    console.log("Order data:", JSON.stringify(orderData, null, 2));

    const orderResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": uniqueRequestId,
      },
      body: JSON.stringify(orderData),
    });

    const orderResult = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error("PayPal Orders API error:", orderResult);
      throw new Error(
        orderResult.message || `PayPal API error: ${orderResponse.status}`
      );
    }

    console.log("NEW order created successfully!");
    console.log("Order ID:", orderResult.id);
    console.log("Order Status:", orderResult.status);
    console.log("Order Intent:", orderResult.intent);

    // Check if order is already captured (common with vault payments)
    let finalResult = orderResult;

    if (orderResult.status === "COMPLETED") {
      console.log("Order already completed/captured automatically");
      finalResult = orderResult;
    } else if (orderResult.status === "APPROVED") {
      console.log("Order approved, attempting capture...");

      // Attempt to capture the order
      const captureResponse = await fetch(
        `${PAYPAL_API}/v2/checkout/orders/${orderResult.id}/capture`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const captureResult = await captureResponse.json();

      if (!captureResponse.ok) {
        if (captureResult.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED") {
          console.log(
            "Order was already captured, retrieving order details..."
          );

          // Get the order details to return the capture information
          const orderDetailsResponse = await fetch(
            `${PAYPAL_API}/v2/checkout/orders/${orderResult.id}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (orderDetailsResponse.ok) {
            finalResult = await orderDetailsResponse.json();
            console.log("Retrieved order details successfully");
          } else {
            // Use original order result if details fetch fails
            finalResult = orderResult;
          }
        } else {
          console.error("PayPal Capture API error:", captureResult);
          throw new Error(
            captureResult.message ||
              `PayPal Capture error: ${captureResponse.status}`
          );
        }
      } else {
        console.log("Payment captured successfully:", captureResult.id);
        finalResult = captureResult;
      }
    } else {
      console.log(
        "Order status:",
        orderResult.status,
        "- proceeding without capture"
      );
      finalResult = orderResult;
    }

    // Update last used date for the payment token
    try {
      paymentToken.last_used = new Date().toISOString();
      await writeVaultData(vaultData);
      console.log("Updated payment token last used date");
    } catch (updateError) {
      console.error(
        "Error updating payment token last used date:",
        updateError
      );
    }

    res.json({
      success: true,
      capture: finalResult,
      payment_token: paymentToken,
      vault_payment: true,
      note: "Real PayPal payment processed using saved payment method",
    });
  } catch (error) {
    console.error("Error processing REAL payment with token:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process payment with saved method",
    });
  }
});

// Route: Demo card vault (for demonstration purposes)
router.post("/demo-card-vault", async (req, res) => {
  try {
    const { customerId, amount, currency } = req.body;

    if (!customerId || !amount) {
      return res.status(400).json({
        success: false,
        error: "Customer ID and amount are required",
      });
    }

    // Verify customer exists
    const vaultData = await readVaultData();
    const customer = vaultData.customers[customerId];

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Create a demo card vault token
    const demoCardToken = {
      id: `DEMO_CARD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "CARD",
      status: "VAULTED",
      created: new Date().toISOString(),
      last_used: new Date().toISOString(),
      demo: true,
    };

    // Add to customer's payment tokens
    customer.payment_tokens.push(demoCardToken);

    // Save the updated data
    await writeVaultData(vaultData);

    // Return demo payment result
    res.json({
      success: true,
      capture: {
        id: `DEMO_PAYMENT_${Date.now()}`,
        status: "COMPLETED",
        amount: {
          currency_code: currency,
          value: amount,
        },
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
      },
      vault_info: {
        id: demoCardToken.id,
        status: "VAULTED",
        customer: {
          id: customer.paypal_customer_id || customerId,
        },
      },
      note: "Demo card payment and vault simulation",
    });
  } catch (error) {
    console.error("Error processing demo card vault:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process demo card vault",
    });
  }
});

// Route: Delete payment token
router.delete(
  "/customer/:customerId/payment-token/:tokenId",
  async (req, res) => {
    try {
      const { customerId, tokenId } = req.params;
      const { deleteFromPayPal = false } = req.body;

      console.log(
        `Deleting payment token ${tokenId} for customer ${customerId}`
      );

      if (!customerId || !tokenId) {
        return res.status(400).json({
          success: false,
          error: "Customer ID and Token ID are required",
        });
      }

      // Load vault data
      const vaultData = await readVaultData();
      const customer = vaultData.customers[customerId];

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: "Customer not found",
        });
      }

      // Find the token to delete
      const tokenIndex = customer.payment_tokens.findIndex(
        (token) => token.id === tokenId
      );

      if (tokenIndex === -1) {
        return res.status(404).json({
          success: false,
          error: "Payment token not found",
        });
      }

      const token = customer.payment_tokens[tokenIndex];

      // If requested, delete from PayPal vault as well
      let paypalDeletionResult = null;
      if (deleteFromPayPal && !token.demo) {
        try {
          const accessToken = await generateAccessToken();

          const response = await fetch(
            `${PAYPAL_API}/v3/vault/payment-tokens/${tokenId}`,
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (response.ok) {
            paypalDeletionResult = "success";
            console.log(
              `Successfully deleted token ${tokenId} from PayPal vault`
            );
          } else {
            const errorData = await response.json();
            console.warn(
              `Failed to delete token from PayPal: ${
                errorData.message || "Unknown error"
              }`
            );
            paypalDeletionResult = "failed";
          }
        } catch (error) {
          console.error("Error deleting token from PayPal:", error);
          paypalDeletionResult = "error";
        }
      }

      // Remove from local storage
      customer.payment_tokens.splice(tokenIndex, 1);
      await writeVaultData(vaultData);

      console.log(
        `Successfully deleted payment token ${tokenId} from local storage`
      );

      res.json({
        success: true,
        message: "Payment token deleted successfully",
        deletedToken: token,
        paypalDeletion: paypalDeletionResult,
      });
    } catch (error) {
      console.error("Error deleting payment token:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete payment token",
      });
    }
  }
);

export default router;
