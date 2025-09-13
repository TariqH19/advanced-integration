/* eslint-disable consistent-return, new-cap, no-alert, no-console */

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

function updatePaymentOptions() {
  document.querySelectorAll(".payment-option").forEach((option) => {
    option.addEventListener("click", () => {
      const method = option.dataset.method;
      const radio = document.getElementById(`${method}-radio`);
      radio.checked = true;
      radio.dispatchEvent(new Event("change"));

      // Update visual selection
      document.querySelectorAll(".payment-option").forEach((opt) => {
        opt.classList.remove("selected");
      });
      option.classList.add("selected");

      showNotification(
        "success",
        `${method === "paypal" ? "PayPal" : "iDEAL"} payment method selected`
      );
    });
  });
}

function updateButtonContainers() {
  const paypalContainer = document.getElementById("paypal-btn-container");
  const idealContainer = document.getElementById("ideal-btn-container");

  // Show PayPal button content
  setTimeout(() => {
    if (document.getElementById("paypal-btn").children.length > 0) {
      paypalContainer.innerHTML = "";
      document.getElementById("paypal-btn").style.display = "block";
      paypalContainer.appendChild(
        document.getElementById("paypal-btn").firstChild
      );
    }
  }, 1000);

  // Show iDEAL button content when loaded
  setTimeout(() => {
    if (document.getElementById("ideal-btn").children.length > 0) {
      idealContainer.innerHTML = "";
      document.getElementById("ideal-btn").style.display = "block";
      idealContainer.appendChild(
        document.getElementById("ideal-btn").firstChild
      );
    }
  }, 1000);
}

/* Paypal */
paypal
  .Marks({
    fundingSource: paypal.FUNDING.PAYPAL,
  })
  .render("#paypal-mark")
  .then(() => {
    console.log("PayPal mark loaded");
  });

paypal
  .Buttons({
    fundingSource: paypal.FUNDING.PAYPAL,
    style: {
      label: "pay",
      color: "blue",
      shape: "rect",
      height: 50,
    },
    createOrder(data, actions) {
      showNotification("success", "Creating PayPal order...");
      return fetch("/ideal/api/orders", {
        method: "post",
        // use the "body" param to optionally pass additional order information
        // like product skus and quantities
        body: JSON.stringify({
          cart: [
            {
              sku: "<YOUR_PRODUCT_STOCK_KEEPING_UNIT>",
              quantity: "<YOUR_PRODUCT_QUANTITY>",
            },
          ],
        }),
      })
        .then((response) => response.json())
        .then((order) => {
          showNotification("success", "PayPal order created successfully");
          return order.id;
        });
    },
    onApprove(data, actions) {
      showNotification("success", "Processing PayPal payment...");
      fetch(`/api/orders/${data.orderID}/capture`, {
        method: "post",
      })
        .then((res) => res.json())
        .then((data) => {
          swal(
            "Payment Successful!",
            `Order ID: ${data.id}\nPayment Method: ${
              Object.keys(data.payment_source)[0]
            }\nAmount: ${
              data.purchase_units[0].payments.captures[0].amount.currency_code
            } ${data.purchase_units[0].payments.captures[0].amount.value}`,
            "success"
          );
        })
        .catch((error) => {
          console.error(error);
          showNotification("error", "Payment processing failed");
        });
    },
    onCancel(data, actions) {
      console.log("PayPal payment cancelled");
      showNotification("error", "PayPal payment was cancelled");
    },
    onError(err) {
      console.error(err);
      showNotification("error", "PayPal payment error occurred");
    },
  })
  .render("#paypal-btn")
  .then(() => {
    updateButtonContainers();
  });

/* iDEAL  */
paypal
  .Marks({
    fundingSource: paypal.FUNDING.IDEAL,
  })
  .render("#ideal-mark")
  .then(() => {
    console.log("iDEAL mark loaded");
  });

paypal
  .PaymentFields({
    fundingSource: paypal.FUNDING.IDEAL,
    style: {
      variables: {
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        fontSizeBase: "1rem",
        fontSizeSm: "0.95rem",
        fontSizeM: "1rem",
        fontSizeLg: "1.1rem",
        textColor: "#2c2e2f",
        colorTextPlaceholder: "#6c757d",
        colorBackground: "#fff",
        colorInfo: "#0070ba",
        colorDanger: "#dc3545",
        borderRadius: "8px",
        borderColor: "#e9ecef",
        borderWidth: "2px",
        borderFocusColor: "#0070ba",
        spacingUnit: "12px",
      },
      rules: {
        ".Input": {
          padding: "12px",
          fontSize: "1rem",
        },
        ".Input:hover": {
          borderColor: "#0070ba",
        },
        ".Input:focus": {
          borderColor: "#0070ba",
          boxShadow: "0 0 0 3px rgba(0, 112, 186, 0.1)",
        },
        ".Input--invalid": {
          borderColor: "#dc3545",
        },
        ".Label": {
          fontWeight: "600",
          color: "#333",
          marginBottom: "8px",
        },
        ".Error": {
          marginTop: "4px",
          color: "#dc3545",
          fontSize: "0.9rem",
        },
      },
    },
    fields: {
      name: {
        value: "",
        placeholder: "Enter your full name as it appears on your bank account",
      },
    },
  })
  .render("#ideal-fields")
  .then(() => {
    console.log("iDEAL fields loaded");
    document.getElementById("ideal-fields-container").classList.add("show");
  });

paypal
  .Buttons({
    fundingSource: paypal.FUNDING.IDEAL,
    style: {
      label: "pay",
      color: "black",
      shape: "rect",
      height: 50,
    },
    createOrder(data, actions) {
      showNotification("success", "Creating iDEAL order...");
      return fetch("/ideal/api/orders", {
        method: "post",
        // use the "body" param to optionally pass additional order information
        // like product skus and quantities
        body: JSON.stringify({
          cart: [
            {
              sku: "<YOUR_PRODUCT_STOCK_KEEPING_UNIT>",
              quantity: "<YOUR_PRODUCT_QUANTITY>",
            },
          ],
        }),
      })
        .then((response) => response.json())
        .then((order) => {
          showNotification("success", "iDEAL order created successfully");
          return order.id;
        });
    },
    onApprove(data, actions) {
      showNotification("success", "Processing iDEAL payment...");
      fetch(`/ideal/api/orders/${data.orderID}/capture`, {
        method: "post",
      })
        .then((res) => res.json())
        .then((data) => {
          console.log(data);
          swal(
            "Payment Successful!",
            `Order ID: ${data.id}\nPayment Method: ${
              Object.keys(data.payment_source)[0]
            }\nAmount: ${
              data.purchase_units[0].payments.captures[0].amount.currency_code
            } ${data.purchase_units[0].payments.captures[0].amount.value}`,
            "success"
          );
        })
        .catch((error) => {
          console.error(error);
          showNotification("error", "Payment processing failed");
        });
    },
    onCancel(data, actions) {
      console.log(data);
      showNotification("error", "iDEAL payment was cancelled");
      swal("Payment Cancelled", `Order ID: ${data.orderID}`, "warning");
    },
    onError(err) {
      console.error(err);
      showNotification("error", "iDEAL payment error occurred");
    },
  })
  .render("#ideal-btn")
  .then(() => {
    updateButtonContainers();
  });

// Hide iDEAL elements initially
document.getElementById("ideal-btn-container").classList.add("hidden");
document.getElementById("ideal-fields-container").style.display = "none";

/* Enhanced radio button handling */
document.querySelectorAll("input[name=payment-option]").forEach((el) => {
  el.addEventListener("change", (event) => {
    const paypalContainer = document.getElementById("paypal-btn-container");
    const idealContainer = document.getElementById("ideal-btn-container");
    const idealFields = document.getElementById("ideal-fields-container");

    switch (event.target.value) {
      case "paypal":
        idealFields.style.display = "none";
        idealContainer.classList.add("hidden");
        paypalContainer.classList.remove("hidden");
        break;
      case "ideal":
        idealFields.style.display = "block";
        idealContainer.classList.remove("hidden");
        paypalContainer.classList.add("hidden");
        break;
      default:
        break;
    }
  });
});

// Initialize enhanced UI when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  updatePaymentOptions();
});
