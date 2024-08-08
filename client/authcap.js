let authorizationId; // Store the authorization ID globally

window.paypal
  .Buttons({
    style: {
      shape: "pill",
      layout: "vertical",
      color: "black",
      label: "pay",
    },
    async createOrder() {
      try {
        const response = await fetch("/authcap/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cart: [
              {
                id: "1",
                quantity: "1",
              },
            ],
          }),
        });

        const orderData = await response.json();

        if (orderData.orderID) {
          orderId = orderData.orderID; // Store the order ID
          return orderData.orderID;
        }

        throw new Error("Order creation failed.");
      } catch (error) {
        console.error("Failed to create order:", error);
        resultMessage(`Failed to create order. ${error.message}`);
      }
    },
    async onApprove(data, actions) {
      try {
        const response = await fetch(
          `/authcap/api/orders/${data.orderID}/authorize`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const orderData = await response.json();

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        if (orderData.details?.[0]?.issue === "INSTRUMENT_DECLINED") {
          return actions.restart();
        }

        if (orderData.details?.[0]) {
          throw new Error(
            `${orderData.details[0].description} (${orderData.debug_id})`
          );
        }

        // Store the authorization ID
        const authorization =
          orderData.purchase_units[0]?.payments?.authorizations?.[0];
        if (authorization) {
          authorizationId = authorization.id;
        }

        // Show the capture button after successful authorization
        document.getElementById("capture-button").style.display = "block";
        resultMessage(`Order authorized. Authorization ID: ${authorizationId}`);
      } catch (error) {
        console.error("Failed to authorize order:", error);
        resultMessage(
          `Sorry, your transaction could not be processed...<br><br>${error.message}`
        );
      }
    },
    onError: (err) => {
      console.error("PayPal error:", err);
      resultMessage("An error occurred with PayPal.");
    },
    onCancel: (data) => {
      console.log("PayPal payment canceled:", data);
      resultMessage("Payment was canceled.");
    },
  })
  .render("#paypal-button-container");

document
  .getElementById("capture-button")
  .addEventListener("click", async () => {
    try {
      if (!authorizationId) {
        throw new Error("Authorization ID is not available.");
      }

      const response = await fetch(
        `/authcap/api/orders/${authorizationId}/capture`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${
            errorData.details?.[0]?.description || "Unknown error"
          }`
        );
      }

      const orderData = await response.json();

      if (orderData.details?.[0]) {
        throw new Error(
          `${orderData.details[0].description} (${orderData.debug_id})`
        );
      }

      const transaction =
        orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
        orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];

      resultMessage(
        `Transaction COMPLETED <br><br>See console for all available details`
      );
      console.log(
        "Capture result",
        orderData,
        JSON.stringify(orderData, null, 2)
      );
    } catch (error) {
      console.error("Failed to capture payment:", error);
      resultMessage(
        `Sorry, your transaction could not be processed...<br><br>${error.message}`
      );
    }
  });

function resultMessage(message) {
  document.getElementById("result-message").innerHTML = message;
}
