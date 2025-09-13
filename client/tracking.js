document.addEventListener("DOMContentLoaded", () => {
  initializeTrackingWorkflow();
});

let currentTransactionId = null;
let currentTrackingNumber = null;

function initializeTrackingWorkflow() {
  // Initialize PayPal buttons
  initializePayPalButtons();

  // Step 2: Get tracking info
  document.getElementById("getTrackingButton").addEventListener("click", () => {
    executeStep(2, getTrackingInfo);
  });

  // Step 3: Update tracking info
  document
    .getElementById("updateTrackingButton")
    .addEventListener("click", () => {
      executeStep(3, updateTrackingInfo);
    });
}

function initializePayPalButtons() {
  window.paypal
    .Buttons({
      async createOrder() {
        try {
          updateStepStatus(1, "processing");

          const response = await fetch("/tracking/orders", {
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

          if (orderData.id) {
            return orderData.id;
          } else {
            const errorDetail = orderData?.details?.[0];
            const errorMessage = errorDetail
              ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
              : JSON.stringify(orderData);

            throw new Error(errorMessage);
          }
        } catch (error) {
          console.error(error);
          updateStepStatus(1, "error");
          showStepResult(
            1,
            `Could not initiate PayPal Checkout: ${error.message}`,
            "error"
          );
          throw error;
        }
      },

      async onApprove(data, actions) {
        try {
          updateStepStatus(1, "processing");

          // Capture the order
          const response = await fetch(
            `/tracking/orders/${data.orderID}/capture`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          const orderData = await response.json();
          const errorDetail = orderData?.details?.[0];

          if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
            return actions.restart();
          } else if (errorDetail) {
            throw new Error(
              `${errorDetail.description} (${orderData.debug_id})`
            );
          } else if (!orderData.purchase_units) {
            throw new Error(JSON.stringify(orderData));
          } else {
            // Successful capture
            const transaction =
              orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
              orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];

            currentTransactionId = transaction.id;
            currentTrackingNumber = "11111"; // Default tracking number from automatic tracking

            console.log(
              "Capture result",
              orderData,
              JSON.stringify(orderData, null, 2)
            );

            // Add tracking information automatically
            const trackingInfo = [
              {
                account_id: "J36FP579FJ6NW",
                transaction_id: transaction.id,
                tracking_number: currentTrackingNumber,
                status: "ON_HOLD",
                carrier: "FEDEX",
                shipment_direction: "FORWARD",
                tracking_url: "http://yjcx.chinapost.com.cn/",
              },
            ];

            const trackingResponse = await fetch("/add-tracking", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ trackers: trackingInfo }),
            });

            const trackingResult = await trackingResponse.json();
            console.log("Tracking result:", trackingResult);

            if (trackingResponse.ok) {
              updateStepStatus(1, "completed");
              showStepResult(1, {
                transaction_id: transaction.id,
                status: transaction.status,
                amount: orderData.purchase_units[0].payments.captures[0].amount,
                tracking_added: "Successfully added automatic tracking",
                tracking_number: currentTrackingNumber,
              });

              // Enable step 2 and pre-fill fields
              enableStep(2);
              document.getElementById("transactionId").value =
                currentTransactionId;
              document.getElementById("trackingNumber").value =
                currentTrackingNumber;
            } else {
              updateStepStatus(1, "completed");
              showStepResult(1, {
                transaction_id: transaction.id,
                status: transaction.status,
                amount: orderData.purchase_units[0].payments.captures[0].amount,
                tracking_status:
                  "Payment successful, but tracking could not be added automatically",
              });
              enableStep(2);
            }
          }
        } catch (error) {
          console.error(error);
          updateStepStatus(1, "error");
          showStepResult(
            1,
            `Transaction could not be processed: ${error.message}`,
            "error"
          );
        }
      },

      onError(err) {
        console.error("PayPal error:", err);
        updateStepStatus(1, "error");
        showStepResult(
          1,
          `PayPal error: ${err.message || "Unknown error"}`,
          "error"
        );
      },
    })
    .render("#paypal-button-container");
}

async function executeStep(stepNumber, stepFunction) {
  const buttonSelectors = {
    2: "#getTrackingButton",
    3: "#updateTrackingButton",
  };

  const button = document.querySelector(buttonSelectors[stepNumber]);
  const originalHTML = button.innerHTML;

  // Show loading state
  button.innerHTML = '<span class="spinner"></span> Processing...';
  button.disabled = true;
  updateStepStatus(stepNumber, "processing");

  try {
    await stepFunction();
    updateStepStatus(stepNumber, "completed");

    // Enable next step if available
    if (stepNumber < 3) {
      enableStep(stepNumber + 1);
    }
  } catch (error) {
    console.error(`Step ${stepNumber} error:`, error);
    updateStepStatus(stepNumber, "error");
    showStepResult(stepNumber, error.message, "error");
  } finally {
    // Restore button
    button.innerHTML = originalHTML;
    button.disabled = false;
  }
}

function updateStepStatus(stepNumber, status) {
  const statusElement = document.getElementById(`step${stepNumber}-status`);
  const statusText = {
    pending: "Pending",
    processing: "Processing...",
    completed: "Completed",
    error: "Error",
  };

  statusElement.textContent = statusText[status];
  statusElement.className = `step-status ${status}`;

  // Update step visual state
  const stepElement = document.getElementById(`step${stepNumber}`);
  if (status === "processing" || status === "completed") {
    stepElement.classList.add("active");
  }
}

function enableStep(stepNumber) {
  const buttonSelectors = {
    2: "#getTrackingButton",
    3: "#updateTrackingButton",
  };

  const button = document.querySelector(buttonSelectors[stepNumber]);
  if (button) {
    button.disabled = false;
  }

  // Activate step visually
  const stepElement = document.getElementById(`step${stepNumber}`);
  stepElement.classList.add("active");
}

function showStepResult(stepNumber, content, type = "success") {
  const resultContainer = document.getElementById(`step${stepNumber}-result`);

  let resultTitle = resultContainer.querySelector(".result-title");
  let resultContent = resultContainer.querySelector(".result-content");

  if (!resultTitle) {
    resultTitle = document.createElement("div");
    resultTitle.className = "result-title";
    resultContainer.appendChild(resultTitle);
  }

  if (!resultContent) {
    resultContent = document.createElement("pre");
    resultContent.className = "result-content";
    resultContainer.appendChild(resultContent);
  }

  resultTitle.textContent = type === "error" ? "Error:" : "Response:";
  resultContent.textContent =
    typeof content === "object" ? JSON.stringify(content, null, 2) : content;

  resultContainer.className = `result-container show ${type}`;
}

async function getTrackingInfo() {
  const transactionId = document.getElementById("transactionId").value;
  const trackingNumber = document.getElementById("trackingNumber").value;

  if (!transactionId || !trackingNumber) {
    throw new Error("Please complete all fields");
  }

  const response = await fetch(
    `/get-tracking/${transactionId}/${trackingNumber}`
  );

  if (!response.ok) {
    throw new Error("Tracking information could not be retrieved");
  }

  const trackingInfo = await response.json();

  showStepResult(2, {
    status: trackingInfo.status,
    carrier: trackingInfo.carrier,
    tracking_number: trackingInfo.tracking_number,
    tracking_url: trackingInfo.tracking_url,
  });

  // Pre-fill step 3 with current info
  document.getElementById("updateTransactionId").value = transactionId;
  document.getElementById("updateTrackingNumber").value = trackingNumber;
  document.getElementById("updateCarrier").value =
    trackingInfo.carrier || "FEDEX";

  return trackingInfo;
}

async function updateTrackingInfo() {
  const transactionId = document.getElementById("updateTransactionId").value;
  const trackingNumber = document.getElementById("updateTrackingNumber").value;
  const carrier = document.getElementById("updateCarrier").value;
  const status = document.getElementById("updateStatus").value;

  if (!transactionId || !trackingNumber || !carrier || !status) {
    throw new Error("All fields must be completed");
  }

  const trackingData = {
    transactionId,
    trackingNumber,
    carrier,
    status,
  };

  const response = await fetch("/update-tracking", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(trackingData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error_description || "Failed to update tracking information"
    );
  }

  showStepResult(3, {
    message: "Tracking information successfully updated!",
    transaction_id: transactionId,
    tracking_number: trackingNumber,
    carrier: carrier,
    new_status: status,
  });

  return { success: true };
}
