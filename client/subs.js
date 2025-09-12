let planId = "";

// Enhanced UI utilities
const showMessage = (message, type = "info") => {
  const messageContainer = document.getElementById("message-container");
  const resultMessage = document.getElementById("result-message");

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

  if (type === "success") {
    setTimeout(() => {
      messageContainer.style.display = "none";
    }, 5000);
  }
};

const showLoading = (show = true) => {
  const spinner = document.getElementById("loading-spinner");
  spinner.style.display = show ? "block" : "none";
};

const showSubscribeSection = () => {
  const container = document.getElementById("subscription-button-container");
  const title = document.getElementById("subscribe-section-title");

  container.classList.add("show");
  title.style.display = "flex";

  // Smooth scroll to subscription button
  setTimeout(() => {
    container.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, 300);
};

const createProductAndPlan = async () => {
  const button = document.getElementById("create-product-plan");

  try {
    // Show loading state
    button.disabled = true;
    button.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Creating Plan...';
    showLoading(true);
    showMessage("Creating subscription plan and product...", "info");

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

      // Hide loading and show success
      showLoading(false);
      showMessage(
        `
        <strong>Subscription Plan Created Successfully!</strong><br>
        <small>Plan ID: ${data.planId}</small><br>
        <small>Product ID: ${data.productId}</small>
      `,
        "success"
      );

      // Update button to completed state
      button.innerHTML = '<i class="fas fa-check"></i> Plan Created';
      button.style.background = "#28a745";

      // Render PayPal button and show subscription section
      setTimeout(() => {
        renderPayPalButton(planId);
        showSubscribeSection();
      }, 1000);
    } else {
      throw new Error(
        "Failed to create product or plan - Invalid response data"
      );
    }
  } catch (error) {
    showLoading(false);
    showMessage(`Error creating subscription plan: ${error.message}`, "error");

    // Reset button
    button.disabled = false;
    button.innerHTML =
      '<i class="fas fa-plus-circle"></i> Create Subscription Plan';
  }
};

const renderPayPalButton = (planId) => {
  if (!planId) {
    showMessage("No plan ID available for subscription", "error");
    return;
  }

  // Clear any existing buttons
  const container = document.getElementById("subscription-button-container");
  container.innerHTML = "";

  paypal
    .Buttons({
      style: {
        shape: "rect",
        color: "blue",
        layout: "vertical",
        label: "subscribe",
        height: 50,
      },

      createSubscription: function (data, actions) {
        showMessage("Setting up your subscription...", "info");

        return actions.subscription.create({
          plan_id: planId,
          application_context: {
            brand_name: "PayPal Demo Store",
            locale: "en-GB",
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            payment_method: {
              payer_selected: "PAYPAL",
              payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
            },
            return_url: window.location.href,
            cancel_url: window.location.href,
          },
        });
      },

      onApprove: function (data, actions) {
        // Show success message with animation
        showMessage(
          `
          <div style="text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
            <strong>Subscription Activated Successfully!</strong><br>
            <small>Subscription ID: ${data.subscriptionID}</small><br>
            <small>You will receive a confirmation email from PayPal</small>
          </div>
        `,
          "success"
        );

        // Update the page to show subscription details
        setTimeout(() => {
          updatePageForActiveSubscription(data.subscriptionID);
        }, 2000);
      },

      onCancel: function (data) {
        showMessage(
          "Subscription cancelled. You can try again anytime.",
          "info"
        );
      },

      onError: function (err) {
        console.error("PayPal subscription error:", err);
        showMessage(
          `
          Subscription error occurred. Please try again.<br>
          <small>If the problem persists, please contact support.</small>
        `,
          "error"
        );
      },
    })
    .render("#subscription-button-container")
    .then(() => {
      showMessage(
        "PayPal subscription button is ready! Click to subscribe.",
        "success"
      );
    })
    .catch((err) => {
      console.error("Error rendering PayPal button:", err);
      showMessage(
        "Error loading PayPal button. Please refresh and try again.",
        "error"
      );
    });
};

const updatePageForActiveSubscription = (subscriptionId) => {
  // Update the subscription container to show active subscription
  const container = document.querySelector(".subscription-container");

  container.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
      <h2 style="color: #28a745; margin-bottom: 1rem;">Subscription Active!</h2>
      <p style="color: #666; margin-bottom: 2rem;">
        Your Premium Gym Membership subscription is now active.
      </p>
      
      <div style="background: #f8f9fa; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
        <h3 style="color: #333; margin-bottom: 1rem;">Subscription Details</h3>
        <div style="text-align: left;">
          <div style="margin-bottom: 0.5rem;"><strong>Subscription ID:</strong> ${subscriptionId}</div>
          <div style="margin-bottom: 0.5rem;"><strong>Plan:</strong> Premium Gym Membership</div>
          <div style="margin-bottom: 0.5rem;"><strong>Amount:</strong> £35.00/month</div>
          <div style="margin-bottom: 0.5rem;"><strong>Next Payment:</strong> ${getNextPaymentDate()}</div>
          <div><strong>Status:</strong> <span style="color: #28a745;">Active</span></div>
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <button onclick="window.location.href='/'" style="background: #0070ba; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600;">
          <i class="fas fa-home"></i> Back to Home
        </button>
        <button onclick="window.location.reload()" style="background: #28a745; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600;">
          <i class="fas fa-redo"></i> Test Another Subscription
        </button>
      </div>
    </div>
  `;
};

const getNextPaymentDate = () => {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return nextMonth.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  const createButton = document.getElementById("create-product-plan");
  if (createButton) {
    createButton.addEventListener("click", createProductAndPlan);
  }
});

// Legacy function for compatibility
function resultMessage(message) {
  showMessage(message, "info");
}
