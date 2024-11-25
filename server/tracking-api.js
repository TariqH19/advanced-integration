const baseUrl = {
  sandbox: "https://api.sandbox.paypal.com",
};

export async function updateTrackingInfo(orderId, trackingData, captureId) {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const payload = {
    carrier: trackingData.carrier,
    tracking_number: trackingData.tracking_number,
    tracking_url: trackingData.tracking_url, // Optional
    capture_id: captureId,
  };

  try {
    // Log the payload to see what we are sending to PayPal
    console.log("Payload for tracking:", JSON.stringify(payload, null, 2));

    // Send the request to PayPal's tracking endpoint
    const response = await fetch(
      `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}/track`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    // Check for a non-2xx response and log it
    if (!response.ok) {
      const errorDetails = await response.json();
      console.error("Error response from PayPal:", errorDetails);
      throw new Error(
        `Failed to update tracking information: ${
          errorDetails.message || response.statusText
        }`
      );
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error updating tracking info:", error.message);
    throw error;
  }
}
