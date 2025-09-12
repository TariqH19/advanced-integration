let authorizationId; // Store the authorization ID globally
let orderId; // Store the order ID globally

// UI helper functions
function showMessage(message, type = "info") {
  const messageContainer = document.getElementById("message-container");
  const resultMessage = document.getElementById("result-message");

  if (messageContainer && resultMessage) {
    resultMessage.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <i class="fas ${
          type === "success"
            ? "fa-check-circle"
            : type === "error"
            ? "fa-exclamation-circle"
            : "fa-info-circle"
        }"></i>
        ${message}
      </div>
    `;

    messageContainer.className = `message-container message-${type}`;
    messageContainer.style.display = "block";
  } else {
    // Fallback for basic result message
    const fallbackElement = document.getElementById("result-message");
    if (fallbackElement) {
      fallbackElement.innerHTML = message;
    }
  }
}

function updateStepStatus(step, status) {
  const stepElement = document.querySelector(`[data-step="${step}"]`);
  if (stepElement) {
    stepElement.className = `step-item ${status}`;

    const icon = stepElement.querySelector(".step-icon");
    const text = stepElement.querySelector(".step-text");

    if (status === "active") {
      icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      text.innerHTML = text.innerHTML.replace("Click", "Processing");
    } else if (status === "completed") {
      icon.innerHTML = '<i class="fas fa-check"></i>';
    } else if (status === "available") {
      icon.innerHTML = '<i class="fas fa-credit-card"></i>';
    }
  }
}

function showCaptureButton() {
  const captureSection = document.getElementById("capture-section");
  const captureButton = document.getElementById("capture-button");

  if (captureSection) {
    captureSection.style.display = "block";
    captureSection.classList.add("show");
  }

  if (captureButton) {
    captureButton.style.display = "block";
    captureButton.disabled = false;
  }

  // Update step status
  updateStepStatus("capture", "available");
}

window.paypal
  .Buttons({
    style: {
      shape: "rect",
      layout: "vertical",
      color: "blue",
      label: "pay",
      height: 50,
    },
    async createOrder() {
      try {
        updateStepStatus("authorize", "active");
        showMessage("Creating payment order...", "info");

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
          showMessage("Payment order created successfully!", "success");
          return orderData.orderID;
        }

        throw new Error("Order creation failed.");
      } catch (error) {
        console.error("Failed to create order:", error);
        updateStepStatus("authorize", "error");
        showMessage(`Failed to create order: ${error.message}`, "error");
      }
    },
    async onApprove(data, actions) {
      try {
        showMessage("Processing authorization...", "info");

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

          // Update UI to show successful authorization
          updateStepStatus("authorize", "completed");
          showCaptureButton();

          showMessage(
            `
            <strong>Payment Authorized Successfully!</strong><br>
            <small>Authorization ID: ${authorizationId}</small><br>
            <small>You can now capture the funds below.</small>
          `,
            "success"
          );
        } else {
          throw new Error("Authorization ID not found in response");
        }
      } catch (error) {
        console.error("Failed to authorize order:", error);
        updateStepStatus("authorize", "error");
        showMessage(`Authorization failed: ${error.message}`, "error");
      }
    },
    onError: (err) => {
      console.error("PayPal error:", err);
      updateStepStatus("authorize", "error");
      showMessage("An error occurred with PayPal.", "error");
    },
    onCancel: (data) => {
      console.log("PayPal payment canceled:", data);
      showMessage("Payment was canceled.", "info");
    },
  })
  .render("#paypal-button-container");

// Enhanced capture button event listener
document.addEventListener("DOMContentLoaded", function () {
  const captureButton = document.getElementById("capture-button");
  if (captureButton) {
    captureButton.addEventListener("click", async () => {
      try {
        if (!authorizationId) {
          throw new Error(
            "Authorization ID is not available. Please authorize payment first."
          );
        }

        console.log("Attempting to capture authorization:", authorizationId);

        // Update UI to show capture in progress
        updateStepStatus("capture", "active");
        captureButton.disabled = true;
        captureButton.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Capturing Payment...';

        showMessage("Capturing authorized payment...", "info");

        const response = await fetch(
          `/authcap/api/orders/${authorizationId}/capture`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Capture response status:", response.status);
        console.log("Capture response headers:", response.headers);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `HTTP error! Status: ${response.status}, Details: ${
              errorData.details?.[0]?.description || "Unknown error"
            }`
          );
        }

        const orderData = await response.json();
        console.log("Capture response data:", orderData);

        if (orderData.details?.[0]) {
          throw new Error(
            `${orderData.details[0].description} (${orderData.debug_id})`
          );
        }

        // The capture response is the capture object itself
        const transaction = orderData;

        if (
          transaction &&
          transaction.id &&
          transaction.status === "COMPLETED"
        ) {
          // Update UI to show successful capture
          updateStepStatus("capture", "completed");
          captureButton.innerHTML =
            '<i class="fas fa-check"></i> Payment Captured';
          captureButton.style.background = "#28a745";

          showMessage(
            `
            <div style="text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
              <strong>Payment Captured Successfully!</strong><br>
              <small>Capture ID: ${transaction.id}</small><br>
              <small>Status: ${transaction.status}</small>
            </div>
          `,
            "success"
          );

          console.log(
            "Capture result",
            orderData,
            JSON.stringify(orderData, null, 2)
          );

          // Show completion message after a delay
          setTimeout(() => {
            showCompletionScreen(transaction);
          }, 2000);
        } else {
          throw new Error(
            "Capture response indicates failure or incomplete status"
          );
        }
      } catch (error) {
        console.error("Failed to capture payment:", error);
        updateStepStatus("capture", "error");

        // Reset capture button
        captureButton.disabled = false;
        captureButton.innerHTML =
          '<i class="fas fa-hand-holding-usd"></i> Capture Payment';

        showMessage(`Capture failed: ${error.message}`, "error");
      }
    });
  }
});

function showCompletionScreen(transaction) {
  const container = document.querySelector(".payment-container");

  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 2rem;">
        <div style="font-size: 5rem; margin-bottom: 1.5rem;">✅</div>
        <h2 style="color: #28a745; margin-bottom: 1rem; font-size: 2.5rem;">Payment Complete!</h2>
        <p style="color: #666; font-size: 1.2rem; margin-bottom: 2rem; line-height: 1.6;">
          Your authorization and capture process has been completed successfully.
        </p>
        
        <div style="background: #f8f9fa; border-radius: 12px; padding: 2rem; margin-bottom: 2rem; text-align: left; max-width: 500px; margin-left: auto; margin-right: auto;">
          <h3 style="color: #333; margin-bottom: 1rem;">Transaction Summary</h3>
          <div style="margin-bottom: 0.5rem;"><strong>Capture ID:</strong> ${
            transaction.id
          }</div>
          <div style="margin-bottom: 0.5rem;"><strong>Status:</strong> <span style="color: #28a745;">${
            transaction.status
          }</span></div>
          <div style="margin-bottom: 0.5rem;"><strong>Authorization ID:</strong> ${authorizationId}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
        
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.location.href='/'" style="background: #0070ba; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">
            <i class="fas fa-home"></i> Back to Home
          </button>
          <button onclick="window.location.reload()" style="background: #17a2b8; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">
            <i class="fas fa-redo"></i> Test Another Transaction
          </button>
        </div>
      </div>
    `;
  }
}

// Legacy function for compatibility
function resultMessage(message) {
  showMessage(message, "info");
}
