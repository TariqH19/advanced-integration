let transactionDataButton = document.getElementById("transactionContextData");
let trackingID;

// Enhanced UI functions
function showNotification(type, message) {
  let notification = document.getElementById("notification");
  if (!notification) {
    notification = document.createElement("div");
    notification.id = "notification";
    notification.className = "notification";
    document.body.appendChild(notification);
  }

  notification.className = `notification ${type} show`;
  notification.textContent = message;

  setTimeout(() => {
    notification.classList.remove("show");
  }, 4000);
}

function showStatusMessage(type, message) {
  const statusElement = document.getElementById("title");
  statusElement.className = `status-message ${type} show`;
  statusElement.textContent = message;

  if (type === "success" || type === "info") {
    setTimeout(() => {
      statusElement.classList.remove("show");
    }, 5000);
  }
}

// Fetch Tracking ID with enhanced feedback
fetch("/stc/getTrackingID", { method: "GET" })
  .then((response) => response.text())
  .then((id) => {
    trackingID = id;
    console.log("Tracking ID:", trackingID);
    showNotification(
      "success",
      `Tracking ID initialized: ${trackingID.substring(0, 8)}...`
    );
  })
  .catch((error) => {
    console.error("Error fetching tracking ID:", error);
    showNotification("error", "Failed to initialize tracking ID");
  });

// PayPal Buttons Integration with enhanced feedback
paypal
  .Buttons({
    createOrder: function () {
      showNotification("info", "Creating PayPal order...");

      return fetch("/stc/setTransactionContext", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingID }),
      })
        .then((response) => {
          if (response.ok) {
            showNotification("info", "Transaction context set successfully");
            return fetch("/stc/createOrder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ trackingID }),
            });
          } else {
            throw new Error("Failed to set transaction context");
          }
        })
        .then((response) => response.json())
        .then((orderData) => {
          showNotification("success", "PayPal order created successfully");
          return orderData.id;
        })
        .catch((error) => {
          console.error("Order creation error:", error);
          showNotification("error", "Failed to create PayPal order");
          throw error;
        });
    },

    onApprove: function (data) {
      showNotification("info", "Processing payment...");

      return fetch("/stc/captureOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderID: data.orderID }),
      })
        .then((response) => response.json())
        .then((captureDetails) => {
          let successMessage = "Transaction completed successfully!";
          let failedMessage = "Transaction could not be captured.";

          const status =
            captureDetails.purchase_units[0].payments.captures[0].status;

          if (status === "COMPLETED") {
            console.log(successMessage);
            showStatusMessage("success", successMessage);
            showNotification("success", "Payment completed successfully!");
          } else {
            console.log(failedMessage);
            showStatusMessage("error", failedMessage);
            showNotification("error", "Payment capture failed");
          }
        })
        .catch((error) => {
          console.error("Payment capture error:", error);
          showStatusMessage("error", "Payment processing failed");
          showNotification("error", "Payment processing error occurred");
        });
    },

    onCancel: function (data) {
      showNotification("info", "Payment was cancelled");
      showStatusMessage("info", "Payment was cancelled by user");
    },

    onError: function (err) {
      console.error("PayPal error:", err);
      showNotification("error", "PayPal payment error occurred");
      showStatusMessage("error", "Payment error occurred");
    },
  })
  .render("#paypal-button-container")
  .then(() => {
    console.log("PayPal buttons rendered successfully");
  })
  .catch((error) => {
    console.error("Error rendering PayPal buttons:", error);
    showNotification("error", "Failed to load PayPal buttons");
  });

// Enhanced transaction context data button
transactionDataButton.addEventListener("click", () => {
  if (!trackingID) {
    const errorMessage = "Tracking ID not found!";
    document.getElementById("result-message").innerText = errorMessage;
    showNotification("error", errorMessage);
    return;
  }

  showNotification("info", "Fetching transaction context data...");
  transactionDataButton.disabled = true;
  transactionDataButton.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Loading...';

  fetch("/stc/showTransactionContextData", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingID }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch transaction context data");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Transaction Context Data:", data);

      // Update the frontend to display data
      document.getElementById("api-title").innerHTML =
        '<i class="fas fa-database"></i> Transaction Context Data:';
      document.getElementById("api-json").textContent = JSON.stringify(
        data,
        null,
        2
      ); // Pretty print JSON

      const apiResponse = document.getElementById("api-response");
      apiResponse.classList.add("show");

      showNotification(
        "success",
        "Transaction context data loaded successfully"
      );
    })
    .catch((error) => {
      console.error("Error fetching transaction context data:", error);
      showNotification("error", "Failed to fetch transaction context data");
    })
    .finally(() => {
      // Reset button state
      transactionDataButton.disabled = false;
      transactionDataButton.innerHTML =
        '<i class="fas fa-search"></i> Show Transaction Context';
    });
});
