require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();

// Convert file URL to file path
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

(async () => {
  // Dynamically import the paypal-api module
  const { getOrderDetails, createOrder, capturePayment, generateAccessToken } =
    await import("../server/paypal-api.js");

  app.set("view engine", "ejs");
  app.set("views", "./views");

  // Host static files
  const clientPath = path.join(__dirname, "../client");
  app.use(express.static(clientPath));

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

  app.listen(8888, () => {
    console.log("Listening on http://localhost:8888/");
  });
})();
