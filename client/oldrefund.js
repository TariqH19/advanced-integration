paypal
  .Buttons({
    createOrder: function (data, actions) {
      return fetch("/old/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ task: "button" }),
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (orderData) {
          return orderData.id;
        });
    },
    onApprove: function (data, actions) {
      return fetch(`/old/api/orders/${data.orderID}/capture`, {
        method: "POST",
      })
        .then((res) => res.json())
        .then((orderData) => {
          console.log("Payment was successful:", orderData);

          // Store captureId dynamically for later use in refund
          window.captureId =
            orderData.purchase_units[0].payments.captures[0].id;
          window.capturedAmount =
            orderData.purchase_units[0].payments.captures[0].amount.value;

          // Show success message in result-message container
          resultMessage(
            `Payment was successfully captured. Transaction ID: ${window.captureId}`
          );

          // Enable the refund button after capture
          document.getElementById("refund-button").style.display = "block";
        })
        .catch((err) => {
          console.error("Error capturing payment:", err);
          resultMessage("Error capturing payment. Please try again.");
        });
    },
    onError: function (err) {
      console.error("Error with PayPal button:", err);
      resultMessage("Error processing payment. Please try again.");
    },
  })
  .render("#paypal-button-container");

const cardField = paypal.CardFields({
  createOrder: async (data) => {
    const response = await fetch("/old/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        card: {
          attributes: {
            verification: {
              method: "SCA_ALWAYS",
            },
          },
          experience_context: {
            shipping_preference: "NO_SHIPPING",
            return_url: "https://example.com/returnUrl",
            cancel_url: "https://example.com/cancelUrl",
          },
        },
        task: "advancedCC",
      }),
    });
    const orderData = await response.json();
    return orderData.id;
  },
  onApprove: async function (orderData) {
    console.log("Card payment approved for order:", orderData.orderID);

    try {
      const result = await fetch(`/old/api/orders/${orderData.orderID}`, {
        method: "GET",
      });
      const challenge = await result.json();
      console.log("Challenge data:", JSON.stringify(challenge, null, 2));

      const authenticationStatus =
        challenge.payment_source.card.authentication_result.three_d_secure
          .authentication_status;
      const enrollmentStatus =
        challenge.payment_source.card.authentication_result.three_d_secure
          .enrollment_status;

      if (orderData.liabilityShift === "NO") {
        resultMessage(
          `Liability shift issue occurred. Please try again or contact your bank`
        );
      }

      if (
        orderData.liabilityShift === "POSSIBLE" &&
        enrollmentStatus === "Y" &&
        authenticationStatus === "Y"
      ) {
        const captureResult = await fetch(
          `/old/api/orders/${orderData.orderID}/capture`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const captureData = await captureResult.json();
        console.log("Captured payment", captureData);

        // Store captureId dynamically for later use in refund
        window.captureId =
          captureData.purchase_units[0].payments.captures[0].id;
        window.capturedAmount =
          captureData.purchase_units[0].payments.captures[0].amount.value;

        // Show success message in result-message container
        resultMessage(
          `Payment successfully captured. Transaction ID: ${window.captureId}`
        );

        // Enable the refund button after capture
        document.getElementById("refund-button").style.display = "block";
      } else {
        console.log("Capture conditions not met, payment not captured.");
        resultMessage("Capture conditions not met. Payment not captured.");
      }
    } catch (error) {
      console.error("Error during order fetch or capture:", error);
      resultMessage("Error during order capture. Please try again.");
    }
  },
  onError: (error) => {
    console.error("Something went wrong:", error);
    resultMessage("Error with payment method. Please try again.");
  },
});

// Render Card Fields
if (cardField.isEligible()) {
  const nameField = cardField.NameField();
  nameField.render("#card-name-field-container");

  const numberField = cardField.NumberField();
  numberField.render("#card-number-field-container");

  const cvvField = cardField.CVVField();
  cvvField.render("#card-cvv-field-container");

  const expiryField = cardField.ExpiryField();
  expiryField.render("#card-expiry-field-container");

  document
    .getElementById("card-field-submit-button")
    .addEventListener("click", function () {
      cardField
        .submit({})
        .then(function (details) {
          console.log("Credit card form submitted successfully:");
        })
        .catch(function (err) {
          console.error("Error with credit card form submission:", err);
          // Handle error, e.g., show user a generic error message
        });
    });
}

// Refund Button Click Handler
document.getElementById("refund-button").addEventListener("click", async () => {
  if (!window.captureId) {
    resultMessage("No payment captured yet. Please capture a payment first.");
    return;
  }

  const refundButton = document.getElementById("refund-button");
  const originalHTML = refundButton.innerHTML;

  // Show spinner and disable button
  refundButton.innerHTML = '<span class="spinner"></span> Processing Refund...';
  refundButton.disabled = true;

  try {
    const response = await fetch(
      `/old/api/captures/${window.captureId}/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (response.ok) {
      resultMessage(
        `Refund successful: ${result.status} - Refund ID: ${result.id || "N/A"}`
      );
    } else {
      resultMessage(`Refund failed: ${result.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error processing refund:", error);
    resultMessage("An error occurred while processing the refund.");
  } finally {
    // Restore button state
    refundButton.innerHTML = originalHTML;
    refundButton.disabled = false;
  }
});

function resultMessage(message) {
  const container = document.querySelector("#result-message");
  container.innerHTML = message;

  // Style based on message content
  if (
    message.toLowerCase().includes("error") ||
    message.toLowerCase().includes("failed") ||
    message.toLowerCase().includes("could not")
  ) {
    container.style.background = "#f8d7da";
    container.style.borderColor = "#f5c6cb";
    container.style.color = "#721c24";
  } else {
    container.style.background = "#d4edda";
    container.style.borderColor = "#c3e6cb";
    container.style.color = "#155724";
  }
}
