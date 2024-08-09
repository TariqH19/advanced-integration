import braintree from "braintree";
const { BRAINTREE_MERCHANT_ID, BRAINTREE_API_KEY, BRAINTREE_API_SECRET } =
  process.env;

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: BRAINTREE_MERCHANT_ID,
  publicKey: BRAINTREE_API_KEY,
  privateKey: BRAINTREE_API_SECRET,
});

export const findCustomer = async (customerID) => {
  try {
    return await gateway.customer.find(customerID);
  } catch (error) {
    console.error("Error while finding customer:", error);

    if (error && error.type === "notFoundError") {
      console.log("NotFoundError occurred");
      return null; // Customer does not exist
    } else {
      console.error("Unknown error type:", error.type);
      throw error;
    }
  }
};
// Function to create a new customer with specified details
export const createCustomer = async () => {
  // Details for the new customer
  const newCustomerDetails = {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    // ... Add other details as needed
  };

  try {
    // Attempt to create a new customer using Braintree gateway
    const result = await gateway.customer.create(newCustomerDetails);
    console.log("result create customer : ", result);

    // If customer creation is successful, return the customer details
    if (result.success) {
      return result.customer;
    } else {
      // Log an error message and throw an error if customer creation fails
      console.error("Failed to create a new customer:", result.message);
      throw new Error("Failed to create a new customer.");
    }
  } catch (error) {
    // Log and rethrow any errors that occur during customer creation
    console.error("Error while creating customer:", error);
    throw error;
  }
};

// Function to generate an access token for the specified customer ID or create a new customer
export const generateAccessToken = async (customerID = null) => {
  try {
    let customer;

    // If a customer ID is provided, attempt to find the existing customer
    if (customerID) {
      customer = await findCustomer(customerID);

      // If the customer is not found, create a new customer
      if (!customer) {
        console.log("Customer not found. Creating a new customer.");
        customer = await createCustomer();
        console.log("New customer created:", customer);
      }
    }

    // Generate a client token with the ID of the customer (whether found or created)
    const response = await gateway.clientToken.generate({
      customerId: customer ? customer.id : null,
    });

    // Send the client token and customer information to the front-end
    const clientToken = response.clientToken;
    const responseData = {
      clientToken,
      customer: customer ? formatCustomerData(customer) : null,
    };

    console.log("customerID :", customer ? customer.id : null);
    console.log("response : ", responseData);
    return responseData;
  } catch (error) {
    // Log an error message if generating the access token fails
    console.error("Fail to generate Access Token :", error);
  }
};

// Function to format customer data according to specific requirements
export const formatCustomerData = (customer) => {
  // Customize the formatting of customer data as needed
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    // Add other properties as needed
  };
};
