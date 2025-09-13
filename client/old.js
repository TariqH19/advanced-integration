// Enhanced PayPal Buttons with better UI integration
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
          const transaction =
            orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
            orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];
          if (transaction) {
            resultMessage(
              `Payment successful! Transaction ID: ${transaction.id}`
            );
            showPaymentModal(orderData);
          } else {
            resultMessage("Payment was successful!");
            showPaymentModal(orderData);
          }
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
    style: {
      layout: "vertical",
      color: "blue",
      shape: "rect",
      label: "paypal",
      height: 50,
    },
  })
  .render("#paypal-button-container");

// Enhanced Card Fields with better styling and error handling
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

    // Reset button after approval
    const button = document.getElementById("card-field-submit-button");
    if (button) {
      button.disabled = false;
      button.innerHTML =
        '<i class="fas fa-lock"></i> <span>Pay Securely</span>';
    }

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
          `Liability shift issue occurred. Please try again or contact your bank.`
        );
        return;
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
        const captureStatus =
          captureData.purchase_units[0].payments.captures[0].status;
        const transactionID = captureData.id;

        resultMessage(
          `Transaction ${captureStatus}: ${transactionID}<br><br>See console for all available details`
        );
        showPaymentModal(captureData);
      } else {
        console.log("Capture conditions not met, payment not captured.");
        resultMessage(
          "Payment authentication completed but capture conditions not met."
        );
      }
    } catch (error) {
      console.error("Error during order fetch or capture:", error);
      resultMessage("Error processing payment. Please try again.");
    }
  },
  onError: (error) => {
    console.error("Something went wrong:", error);
    resultMessage("Error with card payment. Please try again.");

    // Reset button on error
    const button = document.getElementById("card-field-submit-button");
    if (button) {
      button.disabled = false;
      button.innerHTML =
        '<i class="fas fa-lock"></i> <span>Pay Securely</span>';
    }
  },
  style: {
    input: {
      "font-size": "14px",
      "font-family": "Segoe UI, sans-serif",
      color: "#333",
    },
    ":focus": {
      color: "#0070ba",
    },
    ".invalid": {
      color: "#dc3545",
    },
  },
});

// Render Card Fields with enhanced styling
if (cardField.isEligible()) {
  const nameField = cardField.NameField({
    style: {
      input: {
        "font-size": "14px",
        "font-family": "Segoe UI, sans-serif",
        color: "#333",
      },
    },
  });
  nameField.render("#card-name-field-container");

  const numberField = cardField.NumberField({
    style: {
      input: {
        "font-size": "14px",
        "font-family": "Segoe UI, sans-serif",
        color: "#333",
      },
    },
  });
  numberField.render("#card-number-field-container");

  const cvvField = cardField.CVVField({
    style: {
      input: {
        "font-size": "14px",
        "font-family": "Segoe UI, sans-serif",
        color: "#333",
      },
    },
  });
  cvvField.render("#card-cvv-field-container");

  const expiryField = cardField.ExpiryField({
    style: {
      input: {
        "font-size": "14px",
        "font-family": "Segoe UI, sans-serif",
        color: "#333",
      },
    },
  });
  expiryField.render("#card-expiry-field-container");

  document
    .getElementById("card-field-submit-button")
    .addEventListener("click", function () {
      // Add spinner to button
      const button = document.getElementById("card-field-submit-button");
      const originalContent = button.innerHTML;
      button.disabled = true;
      button.innerHTML =
        '<div class="spinner" style="width: 16px; height: 16px; border: 2px solid #ffffff40; border-top: 2px solid #ffffff; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></div> Processing...';

      // Add spinner animation if not already in CSS
      if (!document.querySelector("#spinner-style")) {
        const style = document.createElement("style");
        style.id = "spinner-style";
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spinner {
            display: inline-block;
          }
        `;
        document.head.appendChild(style);
      }

      cardField
        .submit({})
        .then(function (details) {
          console.log("Credit card form submitted successfully:", details);
          // Keep spinner during 3DS authentication - will be reset in onApprove or onError
        })
        .catch(function (err) {
          console.error("Error with credit card form submission:", err);
          resultMessage("Error submitting card details. Please try again.");

          // Reset button on error
          button.disabled = false;
          button.innerHTML = originalContent;
        });
    });
} else {
  console.log("Card fields not eligible");
  // Hide the card form if not eligible
  const cardForm = document.getElementById("checkout-form");
  if (cardForm) {
    cardForm.style.display = "none";
  }
}

// Enhanced result message function with better styling
function resultMessage(message) {
  const container = document.querySelector("#result-message");
  if (container) {
    container.innerHTML = message;

    // Style based on message content
    if (
      message.toLowerCase().includes("error") ||
      message.toLowerCase().includes("issue") ||
      message.toLowerCase().includes("not met")
    ) {
      container.style.background = "#f8d7da";
      container.style.borderColor = "#f5c6cb";
      container.style.color = "#721c24";
      container.style.display = "block";
    } else {
      container.style.background = "#d4edda";
      container.style.borderColor = "#c3e6cb";
      container.style.color = "#155724";
      container.style.display = "block";
    }

    // Auto-hide success messages after 8 seconds
    if (!message.toLowerCase().includes("error")) {
      setTimeout(() => {
        container.style.display = "none";
      }, 8000);
    }
  }
}

// Function to show payment result modal
function showPaymentModal(orderData) {
  const modal = document.getElementById("resultModal");
  const resultElement = document.getElementById("result");

  if (modal && resultElement) {
    // Use pretty print if available, otherwise JSON.stringify
    if (typeof prettyPrintJson !== "undefined" && prettyPrintJson.toHtml) {
      resultElement.innerHTML = prettyPrintJson.toHtml(orderData, {
        indent: 2,
      });
    } else {
      resultElement.textContent = JSON.stringify(orderData, null, 2);
    }

    modal.style.display = "block";
  } else {
    console.log("Payment completed:", orderData);
  }
}
