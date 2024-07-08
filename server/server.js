import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import {
  generateAccessToken,
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

// Create order
app.post("/api/orders", async (req, res) => {
  try {
    const order = await createOrder(req.body.task); // Ensure you're passing the correct parameter
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

app.listen(8888, () => {
  console.log("Listening on http://localhost:8888/");
});
