import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers, body: "" };

  try {
    const body = JSON.parse(event.body);
    const { fullname, email, phone, businessName, profile, accessType } = body;

    // 1. Mapeo de precios de Stripe (Usa tus IDs reales)
    const priceIds = {
      SINGLE_DAY: process.env.PRICE_SINGLE_DAY, // 1 día - $150
      TWO_DAYS: process.env.PRICE_TWO_DAYS, // 2 días - $200
      GROUP_SINGLE: process.env.PRICE_GROUP_SINGLE, // Grupal 1 día (11 pases) - $1500
      GROUP_TWO: process.env.PRICE_GROUP_TWO, // Grupal 2 días (11 pases) - $2000
    };

    // 3. Crear Sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceIds[accessType], quantity: 1 }],
      mode: "payment",
      customer_email: email,
      success_url: `https://excogitable-mavis-sulfureous.ngrok-free.dev/payment-success?email=${email}`,
      cancel_url: `https://excogitable-mavis-sulfureous.ngrok-free.dev`,
      metadata: {
        fullname: fullname,
        customer_email: email,
        phone: phone,
        businessName: businessName,
        accessType: accessType,
        profile: profile,
      },
    });

    // 4. Devolvemos la URL de pago al Frontend
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message }),
    };
  }
};
