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

          // Extract order ID and capture ID from PayPal's response
          const orderId = orderData.id;
          const captureId = orderData.purchase_units[0].payments.captures[0].id;

          // Show a form to input tracking info once the order is captured
          displayTrackingForm(orderId, captureId); // Function to display the form
        })
        .catch((err) => {
          console.error("Error capturing payment:", err);
        });
    },
    onError: function (err) {
      console.error("Error with PayPal button:", err);
    },
  })
  .render("#paypal-button-container");

// Function to display the tracking form once payment is captured
function displayTrackingForm(orderId, captureId) {
  const trackingFormContainer = document.getElementById(
    "tracking-form-container"
  );
  trackingFormContainer.innerHTML = `
    <h3>Update Tracking Info</h3>
    <form id="tracking-form">
      <label for="carrier">Carrier:</label>
      <input type="text" id="carrier" name="carrier" required><br>

      <label for="tracking-number">Tracking Number:</label>
      <input type="text" id="tracking-number" name="tracking-number" required><br>

      <label for="tracking-url">Tracking URL (Optional):</label>
      <input type="text" id="tracking-url" name="tracking-url"><br>

      <input type="hidden" id="order-id" value="${orderId}">
      <input type="hidden" id="capture-id" value="${captureId}">

      <button type="submit">Submit Tracking Info</button>
    </form>
    <div id="tracking-result-message"></div>
  `;

  // Attach event listener to the form
  const trackingForm = document.getElementById("tracking-form");
  trackingForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const carrier = document.getElementById("carrier").value;
    const trackingNumber = document.getElementById("tracking-number").value;
    const trackingUrl = document.getElementById("tracking-url").value;
    const orderId = document.getElementById("order-id").value;
    const captureId = document.getElementById("capture-id").value;

    // Collect tracking data
    const trackingData = {
      carrier,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl, // Tracking URL is optional
    };

    // Send tracking info to the backend to update PayPal
    fetch(`/api/orders/${orderId}/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracking_data: trackingData,
        capture_id: captureId, // Send capture ID with the request
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        document.getElementById("tracking-result-message").innerText =
          "Tracking information updated successfully!";
      })
      .catch((error) => {
        document.getElementById("tracking-result-message").innerText =
          "Error updating tracking information.";
      });
  });
}
