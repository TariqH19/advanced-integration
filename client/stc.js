let transactionDataButton = document.getElementById("transactionContextData");
let trackingID;

// Fetch Tracking ID
fetch("/stc/getTrackingID", { method: "GET" })
  .then((response) => response.text())
  .then((id) => {
    trackingID = id;
    console.log("Tracking ID:", trackingID);
  });

// PayPal Buttons Integration
paypal
  .Buttons({
    createOrder: function () {
      return fetch("/stc/setTransactionContext", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingID }),
      })
        .then((response) => {
          if (response.ok) {
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
        .then((orderData) => orderData.id);
    },

    onApprove: function (data) {
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
            document.getElementById("title").innerText = successMessage;
          } else {
            console.log(failedMessage);
            document.getElementById("title").innerText = failedMessage;
          }
        });
    },
  })
  .render("#paypal-button-container");

transactionDataButton.addEventListener("click", () => {
  if (!trackingID) {
    document.getElementById("result-message").innerText =
      "Tracking ID not found!";
    return;
  }

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
      document.getElementById("api-title").innerText =
        "Transaction Context Data:";
      document.getElementById("api-json").innerText = JSON.stringify(
        data,
        null,
        2
      ); // Pretty print JSON
      document.getElementById("api-response").style.display = "block"; // Make the response visible
    })
    .catch((error) => {
      console.error("Error fetching transaction context data:", error);
    });
});
