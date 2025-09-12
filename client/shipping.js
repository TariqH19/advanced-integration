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

    if (type === "success") {
      setTimeout(() => {
        messageContainer.style.display = "none";
      }, 5000);
    }
  }
}

function showLoading(show = true) {
  const spinner = document.getElementById("loading-spinner");
  spinner.style.display = show ? "block" : "none";
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
        showLoading(true);
        showMessage("Creating order with shipping options...", "info");

        const response = await fetch("/api/orders", {
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
        showLoading(false);

        if (orderData.id) {
          showMessage(
            "Order created! PayPal will handle shipping options during checkout.",
            "success"
          );
          return orderData.id;
        }

        const errorDetail = orderData?.details?.[0];
        const errorMessage = errorDetail
          ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
          : JSON.stringify(orderData);

        throw new Error(errorMessage);
      } catch (error) {
        console.error(error);
        showLoading(false);
        showMessage(`Could not create order: ${error.message}`, "error");
      }
    },
    async onApprove(data, actions) {
      try {
        showLoading(true);
        showMessage("Processing payment with selected shipping...", "info");

        const response = await fetch(`/api/orders/${data.orderID}/capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const orderData = await response.json();
        showLoading(false);

        const errorDetail = orderData?.details?.[0];

        if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
          return actions.restart();
        } else if (errorDetail) {
          throw new Error(`${errorDetail.description} (${orderData.debug_id})`);
        } else if (!orderData.purchase_units) {
          throw new Error(JSON.stringify(orderData));
        } else {
          const transaction =
            orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
            orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];

          const shippingInfo = orderData?.purchase_units?.[0]?.shipping;

          showMessage(
            `
            <div style="text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">🚚</div>
              <strong>Order Completed Successfully!</strong><br>
              <small>Transaction ID: ${transaction.id}</small><br>
              ${
                shippingInfo
                  ? `<small>Shipping to: ${shippingInfo.name?.full_name}</small>`
                  : ""
              }
            </div>
          `,
            "success"
          );

          console.log(
            "Capture result",
            orderData,
            JSON.stringify(orderData, null, 2)
          );

          // Show success screen after delay
          setTimeout(() => {
            showSuccessScreen(transaction, shippingInfo);
          }, 2000);
        }
      } catch (error) {
        console.error(error);
        showLoading(false);
        showMessage(`Payment processing failed: ${error.message}`, "error");
      }
    },
    onShippingOptionsChange(data, actions) {
      showMessage("Updating shipping costs...", "info");

      return fetch("/api/orders/update-shipping", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderID: data.orderID,
          selectedShippingOption: data.selectedShippingOption,
        }),
      })
        .then((response) => response.json())
        .then((result) => {
          showMessage("Shipping option updated successfully!", "success");
          return result;
        })
        .catch((error) => {
          showMessage("Failed to update shipping option", "error");
          console.error("Shipping update error:", error);
        });
    },
    onShippingAddressChange(data, actions) {
      showMessage("Validating shipping address...", "info");

      return fetch("/api/orders/update-address", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderID: data.orderID,
          shippingAddress: data.shippingAddress,
        }),
      })
        .then((response) => {
          showMessage("Address validated and shipping updated!", "success");
          return response.json();
        })
        .catch((error) => {
          showMessage("Address validation failed", "error");
          console.error("Address update error:", error);
        });
    },
    onError: (err) => {
      console.error("PayPal error:", err);
      showLoading(false);
      showMessage("An error occurred with PayPal checkout.", "error");
    },
    onCancel: (data) => {
      console.log("PayPal payment canceled:", data);
      showLoading(false);
      showMessage("Payment was canceled.", "info");
    },
  })
  .render("#paypal-button-container");

function showSuccessScreen(transaction, shippingInfo) {
  const container = document.querySelector(".checkout-container");

  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 2rem;">
        <div style="font-size: 5rem; margin-bottom: 1.5rem;">🚚</div>
        <h2 style="color: #28a745; margin-bottom: 1rem; font-size: 2.5rem;">Order Shipped!</h2>
        <p style="color: #666; font-size: 1.2rem; margin-bottom: 2rem; line-height: 1.6;">
          Your order has been processed and will be shipped to your selected address.
        </p>
        
        <div style="background: #f8f9fa; border-radius: 12px; padding: 2rem; margin-bottom: 2rem; text-align: left; max-width: 500px; margin-left: auto; margin-right: auto;">
          <h3 style="color: #333; margin-bottom: 1rem;">Order Details</h3>
          <div style="margin-bottom: 0.5rem;"><strong>Transaction ID:</strong> ${
            transaction.id
          }</div>
          <div style="margin-bottom: 0.5rem;"><strong>Amount:</strong> ${
            transaction.amount?.value
          } ${transaction.amount?.currency_code}</div>
          <div style="margin-bottom: 0.5rem;"><strong>Status:</strong> <span style="color: #28a745;">Paid</span></div>
          ${
            shippingInfo
              ? `
            <div style="margin-bottom: 0.5rem;"><strong>Ship to:</strong> ${
              shippingInfo.name?.full_name || "Customer"
            }</div>
            ${
              shippingInfo.address
                ? `<div style="margin-bottom: 0.5rem;"><strong>Address:</strong> ${shippingInfo.address.address_line_1}, ${shippingInfo.address.admin_area_2}</div>`
                : ""
            }
          `
              : ""
          }
          <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
        
        <div style="background: #e8f5e8; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
          <h4 style="color: #155724; margin-bottom: 1rem;">What's Next?</h4>
          <div style="text-align: left; max-width: 400px; margin: 0 auto;">
            <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
              <div style="width: 40px; height: 40px; background: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">1</div>
              <span>Order confirmation sent to your email</span>
            </div>
            <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
              <div style="width: 40px; height: 40px; background: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">2</div>
              <span>Item will be packed and shipped</span>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 40px; height: 40px; background: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">3</div>
              <span>Tracking information will be provided</span>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.location.href='/'" style="background: #0070ba; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">
            <i class="fas fa-home"></i> Back to Home
          </button>
          <button onclick="window.location.reload()" style="background: #28a745; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">
            <i class="fas fa-shopping-cart"></i> Shop Again
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
