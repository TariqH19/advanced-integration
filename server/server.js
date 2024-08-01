import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import {
  getOrderDetails,
  createOrder,
  capturePayment,
  generateAccessToken,
  listPaymentTokens,
} from "./paypal-api.js"; // Import your PayPal helper functions

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
      console.log("vault ID received", vaultID);
    } else {
      console.log("Vault data not found in the response");
    }
  } else {
    console.log("Received webhook event is not related to vault creation");
  }

  res.sendStatus(200).send("Webhook processed");
});

app.get("/saved-cards", async (req, res) => {
  const customerId = req.query.customerId;
  try {
    const tokens = await listPaymentTokens(customerId);
    res.render("saved-cards", { tokens });
  } catch (error) {
    res.status(500).json({ error: "Failed to list payment tokens" });
  }
});

app.listen(8888, () => {
  console.log("Listening on http://localhost:8888/");
});
