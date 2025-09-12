// Enhanced PayPal integration with improved user experience
class CheckoutManager {
  constructor() {
    this.isProcessing = false;
    this.initializeUI();
  }

  initializeUI() {
    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = "smooth";
  }

  showLoading() {
    this.isProcessing = true;
    const spinner = document.getElementById("loading-spinner");
    const messageContainer = document.getElementById("message-container");

    if (spinner) spinner.style.display = "block";
    if (messageContainer) messageContainer.style.display = "none";
  }

  hideLoading() {
    this.isProcessing = false;
    const spinner = document.getElementById("loading-spinner");
    if (spinner) spinner.style.display = "none";
  }

  showMessage(message, type = "info", duration = null) {
    const messageContainer = document.getElementById("message-container");
    const messageContent = document.getElementById("message-content");

    if (!messageContainer || !messageContent) return;

    // Set message content and style
    messageContent.innerHTML = message;
    messageContainer.className = `message-container message-${type}`;
    messageContainer.style.display = "block";

    // Add icon based on type
    const icon =
      type === "success"
        ? "fas fa-check-circle"
        : type === "error"
        ? "fas fa-exclamation-triangle"
        : "fas fa-info-circle";

    messageContent.innerHTML = `<i class="${icon}" style="margin-right: 0.5rem;"></i>${message}`;

    // Auto-hide info messages after 5 seconds
    if (duration || (type === "info" && duration !== false)) {
      setTimeout(() => {
        messageContainer.style.display = "none";
      }, duration || 5000);
    }

    // Scroll to message
    messageContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  createConfetti() {
    // Create confetti animation for successful payments
    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#96ceb4",
      "#feca57",
      "#ff9ff3",
    ];
    const confettiContainer = document.createElement("div");
    confettiContainer.className = "confetti";
    document.body.appendChild(confettiContainer);

    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement("div");
      confetti.style.cssText = `
        position: absolute;
        width: 10px;
        height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}vw;
        animation: confetti-fall ${Math.random() * 3 + 2}s linear forwards;
        transform: rotate(${Math.random() * 360}deg);
      `;
      confettiContainer.appendChild(confetti);
    }

    // Add CSS animation
    if (!document.getElementById("confetti-styles")) {
      const style = document.createElement("style");
      style.id = "confetti-styles";
      style.textContent = `
        @keyframes confetti-fall {
          to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Remove confetti after animation
    setTimeout(() => {
      confettiContainer.remove();
    }, 5000);
  }

  formatCurrency(amount, currency = "GBP") {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency,
    }).format(amount);
  }

  updateOrderTotal(amount) {
    // Update the order total display based on server response
    const totalElements = document.querySelectorAll(
      ".total-row.final span:last-child"
    );
    totalElements.forEach((el) => {
      el.textContent = this.formatCurrency(amount);
    });
  }
}

const checkoutManager = new CheckoutManager();

window.paypal
  .Buttons({
    style: {
      shape: "pill",
      layout: "vertical",
      color: "blue",
      label: "pay",
      height: 55,
      tagline: false,
    },

    async createOrder() {
      checkoutManager.showLoading();
      checkoutManager.showMessage("Preparing your order...", "info");

      try {
        const response = await fetch("/standard/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cart: [
              {
                id: "premium-headphones",
                quantity: "1",
                name: "Lovely stuff",
                price: "89.99",
              },
            ],
          }),
        });

        const orderData = await response.json();
        checkoutManager.hideLoading();

        if (orderData.id) {
          checkoutManager.showMessage(
            "Order created successfully! Please complete your payment.",
            "success",
            3000
          );
          return orderData.id;
        }

        const errorDetail = orderData?.details?.[0];
        const errorMessage = errorDetail
          ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
          : JSON.stringify(orderData);

        throw new Error(errorMessage);
      } catch (error) {
        console.error("Create order error:", error);
        checkoutManager.hideLoading();
        checkoutManager.showMessage(
          `Unable to create order. Please try again. ${error.message}`,
          "error"
        );
        throw error;
      }
    },

    async onApprove(data, actions) {
      checkoutManager.showLoading();
      checkoutManager.showMessage("Processing your payment...", "info");

      try {
        const response = await fetch(
          `/standard/api/orders/${data.orderID}/capture`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const orderData = await response.json();
        checkoutManager.hideLoading();

        const errorDetail = orderData?.details?.[0];

        if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
          checkoutManager.showMessage(
            "Your payment method was declined. Please try a different payment method.",
            "error"
          );
          return actions.restart();
        } else if (errorDetail) {
          throw new Error(`${errorDetail.description} (${orderData.debug_id})`);
        } else if (!orderData.purchase_units) {
          throw new Error("Invalid order response received");
        } else {
          // Successful transaction
          const transaction =
            orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
            orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];

          if (transaction) {
            checkoutManager.createConfetti();

            const successMessage = `
              <div style="text-align: center;">
                <h3 style="color: #28a745; margin-bottom: 1rem;">🎉 Payment Successful!</h3>
                <p><strong>Transaction ID:</strong> ${transaction.id}</p>
                <p><strong>Status:</strong> ${transaction.status}</p>
                <p><strong>Amount:</strong> ${checkoutManager.formatCurrency(
                  transaction.amount?.value || 89.99
                )}</p>
                <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; font-size: 0.9rem;">
                  <p>Thank you for your purchase! You will receive a confirmation email shortly.</p>
                </div>
              </div>
            `;

            checkoutManager.showMessage(successMessage, "success", false);

            // Log detailed information for debugging
            console.log("Payment completed successfully:", {
              orderData,
              transaction,
              orderID: data.orderID,
            });

            // Add a success overlay instead of disabling the button
            const buttonContainer = document.getElementById(
              "paypal-button-container"
            );
            if (buttonContainer) {
              const successOverlay = document.createElement("div");
              successOverlay.innerHTML = `
                <div style="
                  background: rgba(40, 167, 69, 0.1);
                  border: 2px solid #28a745;
                  border-radius: 12px;
                  padding: 1rem;
                  text-align: center;
                  color: #155724;
                  font-weight: 500;
                ">
                  <i class="fas fa-check-circle" style="color: #28a745; margin-right: 0.5rem;"></i>
                  Payment Complete
                </div>
              `;
              buttonContainer.appendChild(successOverlay);
            }
          }
        }
      } catch (error) {
        console.error("Payment capture error:", error);
        checkoutManager.hideLoading();
        checkoutManager.showMessage(
          `Payment processing failed: ${error.message}. Please try again or contact support.`,
          "error"
        );
      }
    },

    onError(err) {
      console.error("PayPal error:", err);
      checkoutManager.hideLoading();
      checkoutManager.showMessage(
        "An unexpected error occurred. Please refresh the page and try again.",
        "error"
      );
    },

    onCancel(data) {
      console.log("Payment cancelled:", data);
      checkoutManager.hideLoading();
      checkoutManager.showMessage(
        "Payment was cancelled. You can try again whenever you're ready.",
        "info",
        4000
      );
    },

    onClick(data, actions) {
      console.log("PayPal button clicked:", data);

      // Optional: Add any pre-payment validation here
      return actions.resolve();
    },
  })
  .render("#paypal-button-container")
  .catch((err) => {
    console.error("Failed to render PayPal buttons:", err);
    checkoutManager.showMessage(
      "Failed to load payment options. Please refresh the page.",
      "error"
    );
  });

// Legacy function for backward compatibility
function resultMessage(message) {
  checkoutManager.showMessage(message, "info");
}
