let planId = "";

const createProductAndPlan = async () => {
  try {
    const response = await fetch("/subs/api/create-product-plan", {
      method: "POST",
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${errorText}`);
    }
    const data = await response.json();

    if (data.productId && data.planId) {
      planId = data.planId;
      renderPayPalButton(planId);
      document.getElementById(
        "result-message"
      ).innerText = `Product and Plan Created. Plan ID: ${data.planId}`;
    } else {
      document.getElementById("result-message").innerText =
        "Failed to create product or plan.";
    }
  } catch (error) {
    document.getElementById(
      "result-message"
    ).innerText = `Error: ${error.message}`;
  }
};

const renderPayPalButton = (planId) => {
  if (planId) {
    paypal
      .Buttons({
        createSubscription: function (data, actions) {
          return actions.subscription.create({
            plan_id: planId,
          });
        },
        onApprove: function (data, actions) {
          alert("You have successfully subscribed to " + data.subscriptionID);
          document.getElementById("result-message").innerText =
            "Subscription ID: " + data.subscriptionID;
        },
      })
      .render("#subscription-button-container");
  }
};

document
  .getElementById("create-product-plan")
  .addEventListener("click", createProductAndPlan);

function resultMessage(message) {
  document.getElementById("result-message").innerHTML = message;
}
