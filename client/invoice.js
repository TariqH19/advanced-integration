// Simple invoice creation for the current form structure
document.addEventListener("DOMContentLoaded", () => {
  const invoiceForm = document.getElementById("invoice-form");
  const sendInvoiceButton = document.getElementById("send-invoice");
  const invoiceList = document.getElementById("invoice-list");
  let createdInvoiceId = "";

  // Creating an invoice
  invoiceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const recipientName = document.getElementById("recipient-name").value;
    const recipientEmail = document.getElementById("recipient-email").value;
    const currency = document.getElementById("currency").value || "GBP";
    const invoiceNotes =
      document.getElementById("invoice-notes").value ||
      "Thank you for your business!";

    // Get the first item from the invoice items (simplified to one item)
    const firstItemRow = document.querySelector(".invoice-item");
    const itemName = firstItemRow.querySelector(".item-description").value;
    const itemQuantity =
      parseInt(firstItemRow.querySelector(".item-quantity").value) || 1;
    const itemPrice =
      parseFloat(firstItemRow.querySelector(".item-rate").value) || 0;

    if (!itemName || !itemPrice) {
      alert("Please fill in item description and price.");
      return;
    }

    const nameParts = recipientName.trim().split(" ");
    const invoiceData = {
      detail: {
        currency_code: currency,
        note: invoiceNotes,
        terms: "No refunds after 30 days.",
      },
      invoicer: {
        name: { given_name: "PayPal", surname: "Demo" },
        email_address: "tariqhuk@business.com",
      },
      primary_recipients: [
        {
          billing_info: {
            name: {
              given_name: nameParts[0] || recipientName,
              surname: nameParts.slice(1).join(" ") || "",
            },
            email_address: recipientEmail,
          },
        },
      ],
      items: [
        {
          name: itemName,
          quantity: itemQuantity,
          unit_amount: { currency_code: currency, value: itemPrice.toFixed(2) },
        },
      ],
    };

    try {
      const response = await fetch("/api/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceData),
      });
      const result = await response.json();

      if (response.ok) {
        createdInvoiceId = result.id;
        document.getElementById("status-message").textContent =
          "Invoice created successfully!";
        sendInvoiceButton.disabled = false;

        // Add to dropdown
        const option = document.createElement("option");
        option.value = result.id;
        option.textContent = `Invoice ${result.id} - DRAFT`;
        invoiceList.appendChild(option);
        invoiceList.value = result.id;
      } else {
        document.getElementById(
          "status-message"
        ).textContent = `Failed to create invoice: ${result.error}`;
      }
    } catch (error) {
      console.error("Error:", error);
      document.getElementById("status-message").textContent =
        "An error occurred while creating the invoice.";
    }
  });

  // Sending an invoice
  sendInvoiceButton.addEventListener("click", async () => {
    const selectedInvoiceId = invoiceList.value || createdInvoiceId;

    if (!selectedInvoiceId) {
      document.getElementById("status-message").textContent =
        "Please select an invoice first.";
      return;
    }

    try {
      const response = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: selectedInvoiceId }),
      });
      const result = await response.json();

      if (response.ok) {
        document.getElementById("status-message").textContent =
          "Invoice sent successfully!";

        // Extract and display the payer view link
        const payerViewLink = result.href;
        if (payerViewLink) {
          displayPaymentLink(payerViewLink);
        } else {
          document.getElementById("status-message").textContent =
            "Invoice sent, but no payment link found.";
        }
      } else {
        document.getElementById(
          "status-message"
        ).textContent = `Failed to send invoice: ${result.error}`;
      }
    } catch (error) {
      console.error("Error:", error);
      document.getElementById("status-message").textContent =
        "An error occurred while sending the invoice.";
    }
  });

  // Function to display the payer view link
  function displayPaymentLink(paymentLink) {
    const linkContainer = document.createElement("div");
    linkContainer.style.marginTop = "20px";
    linkContainer.innerHTML = `
      <p><strong>Payment Link:</strong> <a href="${paymentLink}" target="_blank">${paymentLink}</a></p>
    `;
    document.querySelector(".invoice-container").appendChild(linkContainer);
  }

  // Fetching the list of invoices for selection
  async function fetchInvoices() {
    try {
      const response = await fetch("/api/list-invoices");
      const invoices = await response.json();

      if (response.ok) {
        invoices.forEach((invoice) => {
          const option = document.createElement("option");
          option.value = invoice.id;
          option.textContent = `Invoice ${invoice.id} - ${invoice.status}`;
          invoiceList.appendChild(option);
        });
      } else {
        document.getElementById("status-message").textContent =
          "Failed to fetch invoices.";
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
      document.getElementById("status-message").textContent =
        "An error occurred while fetching invoices.";
    }
  }

  // Call fetchInvoices on page load
  fetchInvoices();
});
