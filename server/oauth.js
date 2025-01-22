import axios from "axios";

const base = "https://api-m.sandbox.paypal.com";

const { PAYPAL_CLIENT_ID_NL, PAYPAL_CLIENT_SECRET_NL } = process.env;

export async function getAccessToken() {
  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID_NL}:${PAYPAL_CLIENT_SECRET_NL}`
  ).toString("base64");

  const { data } = await axios({
    url: `${base}/v1/oauth2/token`,
    method: "post",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: "grant_type=client_credentials",
  });

  return data;
}
