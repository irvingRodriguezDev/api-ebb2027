import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from "stripe";
import { validateCaptcha } from "./utils/captcha.mjs";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const headers = {
  "Access-Control-Allow-Origin": "https://expobellezaybarberias.com",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers, body: "" };

  try {
    const body = JSON.parse(event.body);
    const {
      fullname,
      email,
      phone,
      businessName,
      profile,
      accessType,
      captcha,
    } = body.dataForm;

    const isHuman = await validateCaptcha(captcha);
    if (!isHuman) {
      return {
        statusCode: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          message: "Actividad sospechosa detectada (Captcha Fallido).",
        }),
      };
    }
    // 3. Mapeo de accesos y precios
    const accessLabels = {
      SINGLE_DAY: "UN DÍA",
      TWO_DAYS: "DOS DÍAS",
      GROUP_SINGLE: "GRUPAL UN DÍA",
      GROUP_TWO: "GRUPAL DOS DÍAS",
    };

    const priceIds = {
      SINGLE_DAY: "price_1TKPQ3GhlSOTRiSh5YsrtiSL",
      TWO_DAYS: "price_1TKPQUGhlSOTRiSh4sne9uR4",
      GROUP_SINGLE: "price_1TKPR2GhlSOTRiShVYOyA8Q7",
      GROUP_TWO: "price_1TKPRVGhlSOTRiSh7ALXkggK",
    };

    // Validar que el tipo de acceso enviado existe
    if (!priceIds[accessType]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Tipo de acceso no válido." }),
      };
    }

    // 4. Crear Sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceIds[accessType], quantity: 1 }],
      mode: "payment",
      locale: "es",
      customer_email: email.toLowerCase().trim(),
      success_url: `https://expobellezaybarberias.com/payment-success?email=${email}`,
      cancel_url: `https://expobellezaybarberias.com/`,
      metadata: {
        fullname,
        customer_email: email.toLowerCase().trim(),
        phone,
        businessName,
        accessType: accessLabels[accessType],
        profile,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error("Error en Registro:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Error interno al procesar el registro.",
      }),
    };
  }
};
