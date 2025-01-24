// Load PayPal SDK script dynamically
document.addEventListener("DOMContentLoaded", () => {
  const script = document.createElement("script");
  script.src =
    "https://www.paypal.com/sdk/js?client-id=AZZcaNxzv0bpXBz0qoto4lBToqSM3M_rS6uVMh3GLno5zvG5-EuIkVLDuY0DUYJXh-7G-Rm4fNcir-y5&components=buttons,card-fields,legal,funding-eligibility&currency=EUR";
  script.onload = initializeFraudNet; // Initialize FraudNet after PayPal SDK loads
  document.head.appendChild(script);
});

// Initialize FraudNet snippet dynamically
function initializeFraudNet() {
  // Generate FraudNet parameters
  const fnparams = {
    f: crypto.randomUUID().replace(/-/g, "").slice(0, 32), // Generate a unique 32-character GUID
    s: "merchant_id_checkout-page", // Replace with actual merchant_id and page context
    sandbox: true, // Set to false for production
  };

  // Create FraudNet parameter script
  const paramsScript = document.createElement("script");
  paramsScript.type = "application/json";
  paramsScript.setAttribute(
    "fncls",
    "fnparams-dede7cc5-15fd-4c75-a9f4-36c430ee3a99"
  );
  paramsScript.textContent = JSON.stringify(fnparams);
  document.head.appendChild(paramsScript);

  // Load FraudNet JavaScript asynchronously
  const fraudNetScript = document.createElement("script");
  fraudNetScript.type = "text/javascript";
  fraudNetScript.src = "https://c.paypal.com/da/r/fb.js";
  fraudNetScript.onload = () => initializePayPalButton(fnparams.f); // Pass FraudNet `f` to PayPal button initialization
  document.head.appendChild(fraudNetScript);
}

// Initialize PayPal Button
function initializePayPalButton(fraudNetSessionId) {
  if (!fraudNetSessionId) {
    console.error(
      "FraudNet session ID not found. Ensure the FraudNet script is loaded."
    );
    return;
  }

  paypal
    .Legal({
      fundingSource: paypal.Legal.FUNDING.PAY_UPON_INVOICE, // Specify Pay Upon Invoice (PUI)
    })
    .render("#paypal-legal-container"); // Render the legal terms container

  paypal
    .Buttons({
      createOrder: function () {
        return fetch("/pui/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "PayPal-Client-Metadata-Id": fraudNetSessionId, // Send FraudNet `f` value
          },
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.id) return data.id; // Return PayPal order ID
            throw new Error("Failed to create order");
          });
      },
      onApprove: function (data) {
        alert(`Order Approved! Order ID: ${data.orderID}`);
      },
      onError: function (err) {
        console.error("An error occurred:", err);
        alert("An error occurred during the transaction.");
      },
    })
    .render("#paypal-button-container");
}
