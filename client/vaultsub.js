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
        .then(async (orderData) => {
          console.log("Payment was successful:", orderData);
          // Step 1: Vault the payment method
          const vaultResponse = await fetch("/vault-payment-method", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });
          const vaultData = await vaultResponse.json();
          if (vaultData.success) {
            const vaultedPaymentTokenId = vaultData.vaultedPaymentMethod.id;
            // Step 2: Create a subscription using the vaulted payment method
            const subscriptionResponse = await fetch("/create-subscription", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ vaultedPaymentTokenId }),
            });
            const subscriptionData = await subscriptionResponse.json();
            if (subscriptionData.success) {
              resultMessage("Subscription created successfully!");
            } else {
              resultMessage("Failed to create subscription.");
            }
          } else {
            resultMessage("Failed to vault payment method.");
          }
        })
        .catch((err) => {
          console.error("Error capturing payment:", err);
          resultMessage("An error occurred. Please try again.");
        });
    },
    onError: function (err) {
      console.error("Error with PayPal button:", err);
      resultMessage("An error occurred. Please try again.");
    },
  })
  .render("#paypal-button-container");
function resultMessage(message) {
  const container = document.querySelector("#result-message");
  container.innerHTML = message;
}
