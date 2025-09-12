// UI helper functions
function showLoading(show = true) {
  const spinner = document.getElementById("loading-spinner");
  if (spinner) {
    spinner.style.display = show ? "block" : "none";
  }
}

let lastBatchId = null;

// Enhanced add recipient function that works with the new UI
function addRecipientFallback() {
  // This is a fallback if the global function isn't available
  const recipientsDiv = document.getElementById("recipients");
  const recipientCount = recipientsDiv.children.length + 1;

  const newRecipient = document.createElement("div");
  newRecipient.className = "recipient-row";
  newRecipient.innerHTML = `
    <div class="recipient-number">${recipientCount}</div>
    <input 
      type="email" 
      name="recipientEmail" 
      placeholder="recipient@example.com"
      class="recipient-input"
      required 
    />
    <input 
      type="number" 
      name="recipientAmount" 
      placeholder="0.00"
      min="0.01" 
      step="0.01" 
      class="recipient-input"
      required 
      onchange="updateAmountDisplay(this)"
    />
    <div class="amount-display">£0.00</div>
    <button type="button" class="remove-recipient" onclick="removeRecipient(this)">
      <i class="fas fa-times"></i>
    </button>
  `;
  recipientsDiv.appendChild(newRecipient);

  // Update totals if function exists
  if (window.updateTotals) {
    window.updateTotals();
  }
}

// Payout form submission handler
document.addEventListener("DOMContentLoaded", () => {
  const payoutForm = document.getElementById("payout-form");

  if (payoutForm) {
    payoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        showLoading(true);
        if (window.showStatus) {
          window.showStatus("Processing payout requests...", "info");
        }

        // Collect recipients from the form
        const recipientRows = document.querySelectorAll(".recipient-row");
        const recipients = Array.from(recipientRows).map((row) => {
          const email = row.querySelector("[name='recipientEmail']").value;
          const amount = row.querySelector("[name='recipientAmount']").value;

          if (!email || !amount || parseFloat(amount) <= 0) {
            throw new Error(
              "All recipients must have valid email addresses and amounts greater than 0"
            );
          }

          return {
            email: email.trim(),
            amount: parseFloat(amount).toFixed(2),
          };
        });

        if (recipients.length === 0) {
          throw new Error("Please add at least one recipient");
        }

        // Validate recipients
        const totalAmount = recipients.reduce(
          (sum, recipient) => sum + parseFloat(recipient.amount),
          0
        );

        if (window.showStatus) {
          window.showStatus(
            `Sending £${totalAmount.toFixed(2)} to ${
              recipients.length
            } recipient(s)...`,
            "info"
          );
        }

        const response = await fetch("/create-payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipients }),
        });

        const result = await response.json();
        showLoading(false);

        if (response.ok) {
          // Check for successful payout response
          if (
            result.details &&
            result.details.batch_header &&
            result.details.batch_header.payout_batch_id
          ) {
            lastBatchId = result.details.batch_header.payout_batch_id;

            // Enable the view details button
            const showPayoutButton =
              document.getElementById("showPayoutButton");
            if (showPayoutButton) {
              showPayoutButton.disabled = false;
            }

            if (window.showStatus) {
              window.showStatus(
                `
                <div style="text-align: center;">
                  <div style="font-size: 2rem; margin-bottom: 0.5rem;">💸</div>
                  <strong>Payout Sent Successfully!</strong><br>
                  <small>Batch ID: ${lastBatchId}</small><br>
                  <small>£${totalAmount.toFixed(2)} sent to ${
                  recipients.length
                } recipient(s)</small>
                </div>
              `,
                "success"
              );
            }

            // Show success details
            setTimeout(() => {
              showPayoutSuccess(result, recipients, totalAmount);
            }, 2000);
          } else {
            throw new Error(result.error || "Failed to process payout");
          }
        } else {
          throw new Error(result.error || `Server error: ${response.status}`);
        }
      } catch (error) {
        console.error("Payout error:", error);
        showLoading(false);

        if (window.showStatus) {
          window.showStatus(
            `Error processing payout: ${error.message}`,
            "error"
          );
        } else {
          alert(`Error: ${error.message}`);
        }
      }
    });
  }
});

// Enhanced show payout function
async function showPayout() {
  if (!lastBatchId) {
    if (window.showStatus) {
      window.showStatus(
        "No payout batch ID available. Please complete a payout first.",
        "error"
      );
    } else {
      alert("No payout batch ID available.");
    }
    return;
  }

  try {
    showLoading(true);
    if (window.showStatus) {
      window.showStatus("Retrieving payout details...", "info");
    }

    const response = await fetch(`/payout/${lastBatchId}`);
    const payoutDetails = await response.json();
    showLoading(false);

    if (response.ok) {
      displayPayoutDetails(payoutDetails);

      if (window.showStatus) {
        window.showStatus("Payout details retrieved successfully!", "success");
      }
    } else {
      throw new Error(
        payoutDetails.error || "Failed to retrieve payout details"
      );
    }
  } catch (error) {
    console.error("Error:", error);
    showLoading(false);

    if (window.showStatus) {
      window.showStatus(
        `Error retrieving payout details: ${error.message}`,
        "error"
      );
    } else {
      alert("An error occurred. Check the console for details.");
    }
  }
}

// Function to display payout success details
function showPayoutSuccess(result, recipients, totalAmount) {
  const container = document.querySelector(".payout-container");

  // Remove any existing success display
  const existingSuccess = container.querySelector(".payout-success-container");
  if (existingSuccess) {
    existingSuccess.remove();
  }

  const successContainer = document.createElement("div");
  successContainer.className = "payout-success-container";
  successContainer.style.cssText = `
    margin-top: 2rem;
    padding: 2rem;
    background: linear-gradient(135deg, #d4edda, #c3e6cb);
    border-radius: 12px;
    border: 2px solid #28a745;
    animation: slideIn 0.3s ease;
  `;

  successContainer.innerHTML = `
    <div style="text-align: center;">
      <h3 style="color: #28a745; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
        <i class="fas fa-check-circle"></i>
        Payout Completed Successfully
      </h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 2rem 0;">
        <div style="background: white; padding: 1rem; border-radius: 8px;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #28a745;">${
            recipients.length
          }</div>
          <div style="color: #666; font-size: 0.9rem;">Recipients</div>
        </div>
        <div style="background: white; padding: 1rem; border-radius: 8px;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #28a745;">£${totalAmount.toFixed(
            2
          )}</div>
          <div style="color: #666; font-size: 0.9rem;">Total Amount</div>
        </div>
        <div style="background: white; padding: 1rem; border-radius: 8px;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #28a745;">${lastBatchId.slice(
            -6
          )}</div>
          <div style="color: #666; font-size: 0.9rem;">Batch ID</div>
        </div>
      </div>
      
      <div style="background: white; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; text-align: left;">
        <h4 style="color: #333; margin-bottom: 1rem;">What Happens Next?</h4>
        <div style="display: grid; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 40px; height: 40px; background: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">1</div>
            <span>Recipients receive email notifications about the incoming payment</span>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 40px; height: 40px; background: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">2</div>
            <span>PayPal processes the payments (typically within 1-3 business days)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 40px; height: 40px; background: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">3</div>
            <span>Funds are deposited into recipients' PayPal accounts</span>
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem;">
        <button onclick="window.location.href='/'" style="background: #0070ba; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600;">
          <i class="fas fa-home"></i> Back to Home
        </button>
        <button onclick="window.location.reload()" style="background: #28a745; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600;">
          <i class="fas fa-plus"></i> Send Another Payout
        </button>
      </div>
    </div>
  `;

  container.appendChild(successContainer);
}

// Function to display detailed payout information
function displayPayoutDetails(payoutDetails) {
  const existingDetails = document.getElementById("payoutDetails");
  if (existingDetails) {
    existingDetails.innerHTML = `
      <div style="margin-top: 2rem; padding: 2rem; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;">
        <h3 style="color: #333; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-list-alt"></i>
          Detailed Payout Information
        </h3>
        <pre style="background: white; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; color: #333; border: 1px solid #e9ecef;">${JSON.stringify(
          payoutDetails,
          null,
          2
        )}</pre>
        <button onclick="this.parentElement.style.display='none'" style="background: #6c757d; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-top: 1rem;">
          <i class="fas fa-times"></i> Hide Details
        </button>
      </div>
    `;
  }
}

// Make functions available globally but don't override existing ones
if (!window.addRecipient) {
  window.addRecipient = addRecipientFallback;
}
window.showPayout = showPayout;
