window.paypal
  .Buttons({
    async createOrder() {
      try {
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
        resultMessage(`Could not initiate PayPal Checkout...<br><br>${error}`);
      }
    },
    async onApprove(data, actions) {
      try {
        // Capturar el pedido
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
          return actions.restart(); // Volver a intentar en caso de error
        } else if (errorDetail) {
          throw new Error(`${errorDetail.description} (${orderData.debug_id})`);
        } else if (!orderData.purchase_units) {
          throw new Error(JSON.stringify(orderData));
        } else {
          // Captura exitosa, manejar el resultado
          const transaction =
            orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
            orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];

          // Mostrar mensaje de éxito
          resultMessage(
            `Transaction ${transaction.status}: ${transaction.id}<br><br><br>See console for all available details`
          );
          console.log(
            "Capture result",
            orderData,
            JSON.stringify(orderData, null, 2)
          );

          // *** Nueva lógica para agregar tracking ***

          // Datos de tracking, puedes adaptarlo según necesites
          const trackingInfo = [
            {
              account_id: "J36FP579FJ6NW", // ID de cuenta PayPal
              transaction_id: transaction.id, // ID de transacción capturada
              tracking_number: "11111", // Número de tracking del envío
              status: "ON_HOLD", // Estado del envío
              carrier: "FEDEX", // Proveedor del envío
              shipment_direction: "FORWARD",
              tracking_url: "http://yjcx.chinapost.com.cn/",
            },
          ];

          // Llamada al servidor para agregar el tracking
          const trackingResponse = await fetch("/add-tracking", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ trackers: trackingInfo }),
          });

          const trackingResult = await trackingResponse.json();

          // Mensaje sobre el estado del tracking
          console.log("Tracking result:", trackingResult);
          if (trackingResponse.ok) {
            resultMessage(
              `Transaction ${transaction.status}: ${transaction.id}<br>Tracking successfully added!`
            );
          } else {
            resultMessage(
              `Transaction ${transaction.status}: ${transaction.id}<br>Tracking could not be added`
            );
          }
        }
      } catch (error) {
        console.error(error);
        resultMessage(
          `Sorry, your transaction could not be processed...<br><br>${error}`
        );
      }
    },
  })
  .render("#paypal-button-container");

function resultMessage(message) {
  const container = document.querySelector("#result-message");
  container.innerHTML = message;
}

// En el archivo app.js (cliente)
document
  .querySelector("#get-tracking-info-button")
  .addEventListener("click", async () => {
    const transactionId = document.querySelector("#transactionId").value;
    const trackingNumber = document.querySelector("#trackingNumber").value;

    if (!transactionId || !trackingNumber) {
      document.querySelector("#tracking-result-message").innerHTML =
        "Por favor, completa todos los campos.";
      return;
    }

    try {
      // Solicitud al servidor, que se encargará de hacer la llamada a PayPal
      const response = await fetch(
        `/get-tracking/${transactionId}/${trackingNumber}`
      );
      const trackingInfo = await response.json();

      if (response.ok) {
        // Mostrar la información de tracking en el front-end
        displayTrackingInfo(trackingInfo);
      } else {
        document.querySelector("#tracking-result-message").innerHTML =
          "Tracking information has been cancelled";
      }
    } catch (error) {
      console.error("Error fetching tracking info:", error);
      document.querySelector("#tracking-result-message").innerHTML =
        "Tracking information has been cancelled";
    }
  });

// Función para mostrar la información de tracking
function displayTrackingInfo(trackingInfo) {
  const message = `
    <p>Status: ${trackingInfo.status}</p>
    <p>Carrier: ${trackingInfo.carrier}</p>
    <p>Tracking number: ${trackingInfo.tracking_number}</p>
    <p>Tracking URL: <a href="${trackingInfo.tracking_url}" target="_blank">${trackingInfo.tracking_url}</a></p>
  `;
  document.querySelector("#tracking-result-message").innerHTML = message;
}

// En el archivo customer.js o el código JavaScript del cliente
document
  .querySelector("#get-tracking-info-button")
  .addEventListener("click", async () => {
    const transactionId = document.querySelector("#transactionId").value;
    const trackingNumber = document.querySelector("#trackingNumber").value;

    if (!transactionId || !trackingNumber) {
      document.querySelector("#tracking-result-message").innerHTML =
        "Por favor, completa todos los campos.";
      return;
    }

    try {
      const response = await fetch(
        `/get-tracking/${transactionId}/${trackingNumber}`
      );
      const trackingInfo = await response.json();

      if (response.ok) {
        // Mostrar información de tracking en el front-end
        displayTrackingInfo(trackingInfo);
      } else {
        document.querySelector("#tracking-result-message").innerHTML =
          "Error al obtener la información de tracking.";
      }
    } catch (error) {
      console.error("Error fetching tracking info:", error);
      document.querySelector("#tracking-result-message").innerHTML =
        "Hubo un error al obtener la información de tracking.";
    }
  });

// Función para actualizar información de tracking
const updateTrackingInfo = async (
  transactionId,
  trackingNumber,
  carrier,
  status
) => {
  try {
    // Datos de tracking a enviar en el cuerpo de la solicitud
    const trackingData = {
      transactionId,
      trackingNumber,
      carrier,
      status,
    };

    // Hacer la solicitud PUT al servidor
    const response = await fetch(`/update-tracking`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(trackingData),
    });

    if (response.ok) {
      document.getElementById("admin-result-message").textContent =
        "Tracking information successfully updated!";
      document.getElementById("admin-result-message").classList.add("success");
    } else {
      const errorData = await response.json();
      throw new Error(
        errorData.error_description || "Failed to update tracking information"
      );
    }
  } catch (error) {
    console.error("Error updating tracking info:", error);
    document.getElementById(
      "admin-result-message"
    ).textContent = `Error updating tracking: ${error.message}`;
    document.getElementById("admin-result-message").classList.add("error");
  }
};

// Event listener para el botón de actualizar tracking
document
  .getElementById("update-tracking-button")
  .addEventListener("click", () => {
    const transactionId = document.getElementById("adminTransactionId").value;
    const trackingNumber = document.getElementById("adminTrackingNumber").value;
    const carrier = document.getElementById("adminCarrier").value;
    const status = document.getElementById("adminStatus").value;

    if (transactionId && trackingNumber && carrier && status) {
      updateTrackingInfo(transactionId, trackingNumber, carrier, status);
    } else {
      document.getElementById("admin-result-message").textContent =
        "All fields must be filled in.";
      document.getElementById("admin-result-message").classList.add("error");
    }
  });
