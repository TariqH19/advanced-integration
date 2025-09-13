const paypalButtons = window.paypal.Buttons({
  style: {
    shape: "pill",
    layout: "vertical",
    color: "blue",
    label: "paypal",
  },
  message: {
    amount: 100,
  },
  async createOrder() {
    try {
      const response = await fetch("/serversdk/api/neworders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // use the "body" param to optionally pass additional order information
        // like product ids and quantities
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

      if (orderData.id) {
        return orderData.id;
      }
      const errorDetail = orderData?.details?.[0];
      const errorMessage = errorDetail
        ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
        : JSON.stringify(orderData);

      throw new Error(errorMessage);
    } catch (error) {
      console.error(error);
      // resultMessage(`Could not initiate PayPal Checkout...<br><br>${error}`);
    }
  },
  async onApprove(data, actions) {
    try {
      // Call backend to capture the order
      const response = await fetch(`/serversdk/api/${data.orderID}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const wrapper = await response.json();
      const orderData = wrapper.jsonResponse; // <-- extract PayPal order from wrapper

      if (!orderData) {
        throw new Error("No order data returned from server");
      }

      // Check for recoverable errors
      const errorDetail = orderData?.details?.[0];
      if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
        return actions.restart();
      }

      // Check for other errors
      if (errorDetail) {
        throw new Error(`${errorDetail.description} (${orderData.debug_id})`);
      }

      // Successful transaction
      const transaction =
        orderData.purchaseUnits[0]?.payments?.captures?.[0] ||
        orderData.purchaseUnits[0]?.payments?.authorizations?.[0];

      resultMessage(
        `Transaction ${transaction.status}: ${transaction.id}<br><br>See console for all available details`
      );

      console.log(
        "Capture result",
        orderData,
        JSON.stringify(orderData, null, 2)
      );
    } catch (error) {
      console.error(error);
      resultMessage(
        `Sorry, your transaction could not be processed...<br><br>${error}`
      );
    }
  },
  appSwitchWhenAvailable: true,
});
if (paypalButtons.hasReturned()) {
  paypalButtons.resume();
} else {
  paypalButtons.render("#paypal-button-container");
}

// Example function to show a result to the user. Your site's UI library can be used instead.
function resultMessage(message) {
  const container = document.querySelector("#result-message");
  container.innerHTML = message;
}
