let lastBatchId = null;

function addRecipient() {
  const recipientsDiv = document.getElementById("recipients");
  const newRecipient = document.createElement("div");
  newRecipient.classList.add("recipient");
  newRecipient.innerHTML = `
        <label>Email:</label>
        <input type="email" name="recipientEmail" required>
        <label>Amount (GBP):</label>
        <input type="number" name="recipientAmount" required>
    `;
  recipientsDiv.appendChild(newRecipient);
}

document.getElementById("payout-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const recipients = Array.from(document.querySelectorAll(".recipient")).map(
    (recipient) => ({
      email: recipient.querySelector("[name='recipientEmail']").value,
      amount: recipient.querySelector("[name='recipientAmount']").value,
    })
  );

  try {
    const response = await fetch("/create-payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipients }),
    });
    const result = await response.json();

    if (
      result.details &&
      result.details.batch_header &&
      result.details.batch_header.payout_batch_id
    ) {
      lastBatchId = result.details.batch_header.payout_batch_id;
      document.getElementById("showPayoutButton").disabled = false;
      alert(result.message || "Payout sent successfully!");
    } else {
      alert("Error sending payout");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred. Check the console for details.");
  }
});

async function showPayout() {
  if (!lastBatchId) return alert("No payout batch ID available.");

  try {
    const response = await fetch(`/payout/${lastBatchId}`);
    const payoutDetails = await response.json();

    if (response.ok) {
      document.getElementById("payoutDetails").innerText = JSON.stringify(
        payoutDetails,
        null,
        2
      );
    } else {
      alert("Error retrieving payout details");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred. Check the console for details.");
  }
}
