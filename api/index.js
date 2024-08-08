import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import {
  getOrderDetails,
  createOrder,
  capturePayment,
  generateAccessToken,
  deletePaymentToken,
  fetchAllPaymentTokens,
} from "../server/paypal-api.js"; // Import your PayPal helper functions
import * as googlepay from "../server/googlepay-api.js";
import * as applepay from "../server/apple-api.js";
import * as subs from "../server/subs-api.js";
const { PAYPAL_CLIENT_ID, PAYPAL_MERCHANT_ID } = process.env;

const base = "https://api-m.sandbox.paypal.com";
// Convert file URL to file path
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Host static files
const clientPath = path.join(__dirname, "../client");
app.use(express.static(clientPath));
app.set("view engine", "ejs");
const viewsPath = path.join(__dirname, "../server/views");
app.set("views", viewsPath);

// Middleware to parse JSON requests
app.use(express.json());

// Render checkout page with client ID
app.get("/", async (req, res) => {
  const clientId = PAYPAL_CLIENT_ID;

  res.render("checkout", {
    clientId,
  });
});

app.post("/api/orders", async (req, res) => {
  try {
    const { task, saveCard, vaultID } = req.body;
    const order = await createOrder(task, saveCard, vaultID);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.get("/api/orders/:orderID", async (req, res) => {
  const { orderID } = req.params; // Ensure orderID is defined here
  try {
    const orderDetails = await getOrderDetails(orderID);
    res.json(orderDetails);
  } catch (error) {
    console.error(
      `Error fetching order details for ${orderID}:`,
      error.message
    );
    res
      .status(500)
      .json({ error: `Failed to get order details: ${error.message}` });
  }
});

// Capture payment
app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const captureData = await capturePayment(orderID);
    res.json(captureData);
  } catch (error) {
    res.status(500).json({ error: "Failed to capture payment" });
  }
});

// Endpoint to get payment tokens
app.get("/api/payment-tokens", async (req, res) => {
  const customerId = req.query.customerId;
  if (!customerId) {
    return res.status(400).json({ error: "Customer ID is required" });
  }

  try {
    const paymentTokens = await fetchAllPaymentTokens(customerId);
    res.json(paymentTokens);
  } catch (error) {
    console.error("Tokens Check:", error);
    // res.status(500).json({ error: error.message });
  }
});

app.get("/api/getTokens", async (req, res) => {
  try {
    const { accessToken, idToken } = await generateAccessToken();
    // console.log("Tokens:", { accessToken, idToken });
    res.json({
      accessToken: accessToken,
      tokenId: idToken,
    });
  } catch (error) {
    console.error("Error fetching payment tokens:", error);
    res.status(500).json({ error: "Failed to fetch payment tokens" });
  }
});

app.delete("/api/payment-tokens/:tokenId", async (req, res) => {
  const { tokenId } = req.params;

  if (!tokenId) {
    return res.status(400).json({ error: "Payment token ID is required" });
  }

  try {
    await deletePaymentToken(tokenId);
    res.status(204).send(); // Successfully deleted
  } catch (error) {
    console.error("Error handling delete request:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/applepay", async (req, res) => {
  const clientId = PAYPAL_CLIENT_ID,
    merchantId = PAYPAL_MERCHANT_ID;
  try {
    const clientToken = await applepay.generateClientToken();
    res.render("applepay", { clientId, clientToken, merchantId });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// create order
app.post("/applepay/api/orders", async (req, res) => {
  try {
    const order = await applepay.createOrder();
    console.log("order", order);
    res.json(order);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// capture payment
app.post("/applepay/api/orders/:orderID/capture", async (req, res) => {
  const { orderID } = req.params;
  try {
    const captureData = await applepay.capturePayment(orderID);
    res.json(captureData);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/googlepay", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID,
    merchantId = process.env.PAYPAL_MERCHANT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  try {
    if (!clientId || !merchantId || !clientSecret) {
      throw new Error("Client Id or App Secret or Merchant Id is missing.");
    }
    const clientToken = await googlepay.generateClientToken();
    res.render("checkout", { clientId, clientToken, merchantId });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// create order
app.post("/googlepay/api/orders", async (req, res) => {
  try {
    const order = await googlepay.createOrder();
    res.json(order);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get order
app.post("/googlepay/api/orders/:orderID", async (req, res) => {
  const { orderID } = req.params;
  try {
    const order = await googlepay.getOrder(orderID);
    res.json(order);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// capture payment
app.post("/googlepay/api/orders/:orderID/capture", async (req, res) => {
  const { orderID } = req.params;
  try {
    const captureData = await googlepay.capturePayment(orderID);
    res.json(captureData);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/subs/api/create-product-plan", async (req, res) => {
  try {
    const accessToken = await subs.generateAccessToken();
    const productResponse = await fetch(`${base}/v1/catalogs/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Gym Membership",
        description: "A monthly membership for the gym",
        type: "SERVICE",
        category: "EXERCISE_AND_FITNESS",
        image_url: "https://example.com/image.jpg",
        home_url: "https://example.com",
      }),
    });

    if (!productResponse.ok) {
      const error = await productResponse.text();
      console.error("Product creation error:", error);
      return res.status(productResponse.status).send("Error creating product");
    }

    const productData = await productResponse.json();
    const productId = productData.id;

    const planResponse = await fetch(`${base}/v1/billing/plans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
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
      }),
    });

    if (!planResponse.ok) {
      const error = await planResponse.text();
      console.error("Plan creation error:", error);
      return res.status(planResponse.status).send("Error creating plan");
    }

    const planData = await planResponse.json();
    res.json({ productId, planId: planData.id });
  } catch (error) {
    console.error("Error creating product or plan:", error);
    res.status(500).send("Error creating product or plan");
  }
});

app.get("/subs", async (req, res) => {
  res.render("subs");
});

app.listen(8888, () => {
  console.log("Listening on http://localhost:8888/");
});
