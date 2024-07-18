import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import {
  generateAccessToken,
  listPaymentTokens,
  createOrder,
  capturePayment,
  paymentSource,
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
  res.render("checkout", {
    clientId,
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

// Check 3DS response
app.get("/api/payment-source/:orderID", async (req, res) => {
  try {
    const { orderID } = req.params;
    const sourceData = await paymentSource(orderID);
    res.json(sourceData);
  } catch (error) {
    res.status(500).json({ error: "Failed to get payment source" });
  }
});

app.post("/webhook", async (req, res) => {
  const event = req.body;

  if (event.event_type === "VAULT.STORE.CARD") {
    const vaultID = event.resource.id;
    try {
      const tokens = await listPaymentTokens(vaultID);
      console.log(tokens); // Handle the tokens as needed, e.g., save to DB, display to user, etc.
    } catch (error) {
      console.error("Error fetching payment tokens:", error);
    }
  }

  res.sendStatus(200);
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
