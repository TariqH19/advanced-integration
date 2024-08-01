import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import {
  getOrderDetails,
  createOrder,
  capturePayment,
  generateAccessToken,
} from "./paypal-api.js"; // Import your PayPal helper functions
const baseUrl = {
  sandbox: "https://api.sandbox.paypal.com",
};
// Convert file URL to file path
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", "./views");

// Host static files
const clientPath = path.join(__dirname, "../client");
app.use(express.static(clientPath));
app.set("view engine", "ejs");
app.set("views", "./views");

// Middleware to parse JSON requests
app.use(express.json());

// Render checkout page with client ID
app.get("/", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const tokenId = await generateAccessToken();

  res.render("checkout", {
    clientId,
    tokenId,
  });
});

app.post("/api/orders", async (req, res) => {
  try {
    const { task, saveCard } = req.body;
    const order = await createOrder(task, saveCard);
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

app.post("/webhook", async (req, res) => {
  console.log("Webhook received", JSON.stringify(req.body, null, 2));
  const eventType = req.body.event_type || req.body.eventType;
  const resource = req.body.resource;

  if (eventType === "VAULT.PAYMENT-TOKEN.CREATED") {
    if (resource && resource.id) {
      const vaultID = resource.id;
      console.log("Vault ID received", vaultID);

      // Optionally save vault ID or perform additional processing
    } else {
      console.log("Vault data not found in the response");
    }
  } else {
    console.log("Received webhook event is not related to vault creation");
  }

  res.sendStatus(200).send("Webhook processed");
});

async function fetchAllPaymentTokens(customerId) {
  const accessToken = await generateAccessToken();
  let allTokens = [];
  let page = 1;
  let pageSize = 5;
  let totalPages;

  do {
    const response = await fetch(
      `${baseUrl.sandbox}/v3/vault/payment-tokens?customer_id=${customerId}&page=${page}&page_size=${pageSize}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error fetching payment tokens: ${errorText}`);
    }

    const data = await response.json();
    allTokens = allTokens.concat(data.payment_tokens);
    totalPages = data.total_pages;
    page++;
  } while (page <= totalPages);

  return allTokens;
}

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
    console.error("Error retrieving payment tokens:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pay-with-saved-method", async (req, res) => {
  const paymentToken = req.body.paymentToken;
  const paymentAmount = req.body.amount || "50.00";

  if (!paymentToken) {
    return res.status(400).json({ error: "Payment token is required" });
  }

  try {
    const data = {
      intent: "CAPTURE",
      payment_source: {
        token: {
          type: "PAYMENT_METHOD_TOKEN",
          id: paymentToken,
        },
      },
      purchase_units: [
        {
          amount: {
            currency_code: "GBP",
            value: paymentAmount,
          },
          shipping: {
            name: {
              full_name: "Walter White",
            },
            address: {
              address_line_1: "308 Negra Arroyo Lane",
              admin_area_2: "Roma",
              admin_area_1: "RM",
              postal_code: "00100",
              country_code: "IT",
            },
            shipping_type: "SHIPPING",
          },
        },
      ],
    };

    const requestId = `order-${Date.now()}`;

    const response = await fetch(
      "https://api.sandbox.paypal.com/v2/checkout/orders/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await generateAccessToken()}`,
          "PayPal-Request-Id": requestId,
          Prefer: "return=representation",
        },
        body: JSON.stringify(data),
      }
    );

    const orderData = await response.json();
    res.json(orderData);
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(8888, () => {
  console.log("Listening on http://localhost:8888/");
});
