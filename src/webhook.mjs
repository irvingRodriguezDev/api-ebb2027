import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import Stripe from "stripe";
import { sendTicketEmail } from "./utils/SendEmail.mjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const handler = async (event) => {
  const sig =
    event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  if (!sig) {
    console.error("Firma de Stripe no encontrada en los headers");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No stripe-signature header" }),
    };
  }
  let stripeEvent;

  try {
    // 2. Validamos el evento (Importante: usamos event.body tal cual)
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Error de validación de firma:", err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const sessionId = session.id;

    const checkExisting = await docClient.send(
      new ScanCommand({
        TableName: "BWM_Attendees_2027",
        FilterExpression: "sessionId = :s",
        ExpressionAttributeValues: { ":s": sessionId },
        Limit: 1, // Solo necesitamos saber si hay al menos uno
      }),
    );

    if (checkExisting.Items && checkExisting.Items.length > 0) {
      console.log(`⚠️ Sesión ${sessionId} ya procesada. Evitando duplicidad.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Compra ya registrada anteriormente" }),
      };
    }
    const {
      customer_email,
      accessType,
      fullname,
      businessName,
      phone,
      profile,
    } = session.metadata;

    // Usamos un objeto de referencia para evitar errores de comparación
    const ticketConfig = {
      "UN DÍA": 1,
      "DOS DÍAS": 1, // Corregido el typo de "TOW"
      "GRUPAL UN DÍA": 11,
      "GRUPAL DOS DÍAS": 11,
    };

    // Si accessType viene vacío o mal escrito, ticketCount será 1 por seguridad
    const ticketCount = ticketConfig[accessType] || 1;

    console.log(
      `Procesando compra para: ${customer_email}. Tipo: ${accessType}. Boletos a generar: ${ticketCount}`,
    );

    const generatedTickets = [];
    const accessLabels = {
      "UN DÍA": "UN DÍA",
      "DOS DÍAS": "DOS DÍAS", // Corregido el typo de "TOW"
      "GRUPAL UN DÍA": "GRUPAL UN DÍA",
      "GRUPAL DOS DÍAS": "GRUPAL DOS DÍAS",
    };
    const labelAccessType = accessLabels[accessType] || "NO ESPECIFICADO";
    // Generamos todos los códigos PRIMERO
    for (let i = 0; i < ticketCount; i++) {
      generatedTickets.push(
        `BWM27-${Math.random().toString(36).toUpperCase().substring(2, 10)}`,
      );
    }

    // Guardamos en DynamoDB (Podrías usar BatchWrite para que sea 1 sola petición, pero PutCommand está bien)
    for (const code of generatedTickets) {
      await docClient.send(
        new PutCommand({
          TableName: process.env.TABLE_NAME,
          Item: {
            ticketCode: code,
            sessionId: session.id,
            email: customer_email,
            fullname: fullname,
            phone: phone,
            businessName: businessName,
            profile: profile,
            accessType: accessType,
            status: "PAID",
            used: false,
            createdAt: new Date().toISOString(),
          },
        }),
      );
    }

    try {
      await sendTicketEmail({
        customer_email,
        fullname,
        accessType: labelAccessType,
        ticketCount,
        generatedTickets,
      });
      console.log("Correo enviado exitosamente a:", customer_email);
    } catch (error) {
      console.error("Error enviando correo a través de SES:", error);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
