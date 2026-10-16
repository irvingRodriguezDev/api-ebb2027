import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from "stripe";
import { validateCaptcha } from "./utils/captcha.mjs";
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
      FIRST_DAY: "DIA 13 DE MARZO",
      SECOND_DAY: "DIA 14 DE MARZO",
    };

    const priceIds = {
      FIRST_DAY: "price_1UREe7IzN1aWLa3r474yMmqQ",
      SECOND_DAY: "price_1UREeUIzN1aWLa3rbaFLb416",
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
      success_url: `https://beautybusinessmexico.com/payment-success?email=${email}`,
      cancel_url: `https://beautybusinessmexico.com/`,
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
