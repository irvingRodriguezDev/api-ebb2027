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
    const accessLabels = {
      ONE_DAY: "UN DÍA",
      TWO_DAYS: "DOS DÍAS", // Corregido el typo de "TOW"
      GROUP_SINGLE: "GRUPAL UN DÍA",
      GROUP_TWO: "GRUPAL DOS DÍAS",
    };
    const labelAccessType = accessLabels[accessType] || "NO ESPECIFICADO";
    // 1. Mapeo de precios de Stripe (Usa tus IDs reales)
    const priceIds = {
      SINGLE_DAY: "price_1TKPQ3GhlSOTRiSh5YsrtiSL", // 1 día - $150
      TWO_DAYS: "price_1TKPQUGhlSOTRiSh4sne9uR4", // 2 días - $200
      GROUP_SINGLE: "price_1TKPR2GhlSOTRiShVYOyA8Q7", // Grupal 1 día (11 pases) - $1500
      GROUP_TWO: "price_1TKPRVGhlSOTRiSh7ALXkggK", // Grupal 2 días (11 pases) - $2000
    };

    // 3. Crear Sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceIds[accessType], quantity: 1 }],
      mode: "payment",
      locale: "es",
      customer_email: email,
      success_url: `https://expobellezaybarberias.com/payment-success?email=${email}`,
      cancel_url: `https://expobellezaybarberias.com/`,
      metadata: {
        fullname: fullname,
        customer_email: email,
        phone: phone,
        businessName: businessName,
        accessType: labelAccessType,
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
