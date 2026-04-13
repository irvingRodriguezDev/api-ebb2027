import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sesClient = new SESClient({});
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
        `EBB27-${Math.random().toString(36).toUpperCase().substring(2, 10)}`,
      );
    }

    // Guardamos en DynamoDB (Podrías usar BatchWrite para que sea 1 sola petición, pero PutCommand está bien)
    for (const code of generatedTickets) {
      await docClient.send(
        new PutCommand({
          TableName: process.env.TABLE_NAME,
          Item: {
            ticketCode: code,
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

    // --- CORRECCIÓN 2: Usar generatedTickets.map() en el HTML ---
    const emailParams = {
      Source: "boletos@expobellezaybarberias.com",
      Destination: { ToAddresses: [customer_email] },
      Message: {
        Subject: {
          Data: `✨ ${ticketCount > 1 ? "Tus pases confirmados" : "Tu pase confirmado"} - Expo Belleza & Barbería 2027`,
        },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: `
          <!DOCTYPE html>
          <html>
          <body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: 'Segoe UI', Arial, sans-serif;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f7f6; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    
                    <tr>
                      <td align="center" style="background-color: #05383F; padding: 30px 20px;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase;">Expo Belleza & Barbería</h1>
                        <p style="color: #a0d1d1; margin-top: 5px; font-size: 14px;">2027 | WTC México</p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding: 30px;">
                        <h2 style="color: #003333; margin: 0; font-size: 20px;">¡Hola, ${fullname}!</h2>
                        <p style="color: #555; font-size: 15px;">Tu pago ha sido procesado con éxito. Aquí tienes tus accesos oficiales:</p>
                        
                        <div style="margin: 20px 0; border-left: 4px solid #05383F; padding: 10px 15px; background-color: #f0fafa;">
                          <p style="margin: 0; font-size: 14px; color: #05383F;"><strong>Tipo de Acceso:</strong> ${labelAccessType}</p>
                          <p style="margin: 5px 0 0; font-size: 14px; color: #05383F;"><strong>Cantidad:</strong> ${ticketCount} boleto(s)</p>
                        </div>

                        <h3 style="color: #003333; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Tus Boletos</h3>
                        
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          ${generatedTickets
                            .map(
                              (code) => `
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td>
                                      <span style="display: block; font-size: 11px; color: #999; text-transform: uppercase;">Código</span>
                                      <span style="font-size: 18px; font-weight: bold; color: #05383F; font-family: 'Courier New', Courier, monospace;">${code}</span>
                                    </td>
                                    <td align="right">
                                      <a href="https://expobellezaybarberias.com/ticket/${code}" 
                                         style="background-color: #05383F; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: bold; display: inline-block;">
                                        Ver QR
                                      </a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          `,
                            )
                            .join("")}
                        </table>

                        <p style="margin-top: 25px; font-size: 13px; color: #05383F; text-align: center; font-weight: bold;">
                          ⚠️ Presenta estos códigos en el área de registro del WTC para recibir tus pulseras.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
          },
        },
      },
    };
    try {
      await sesClient.send(new SendEmailCommand(emailParams));
      console.log("Correo enviado exitosamente a:", customer_email);
    } catch (error) {
      console.error("Error enviando correo a través de SES:", error);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
