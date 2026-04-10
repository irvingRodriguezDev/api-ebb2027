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

    const ticketCount =
      accessType === "GROUP_SINGLE" || accessType === "GROUP_TWO" ? 11 : 1;

    // --- CORRECCIÓN 1: Crear un array para guardar los códigos ---
    const generatedTickets = [];

    for (let i = 0; i < ticketCount; i++) {
      const uniqueCode = `EBB27-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;

      // Guardamos el código en nuestro array
      generatedTickets.push(uniqueCode);

      await docClient.send(
        new PutCommand({
          TableName: process.env.TABLE_NAME,
          Item: {
            ticketCode: uniqueCode,
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
      Source: process.env.SOURCE_EMAIL,
      Destination: { ToAddresses: [customer_email] },
      Message: {
        Subject: { Data: "✨ Tu pase confirmado - Expo Belleza & Barber 2027" },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: `
          <!DOCTYPE html>
          <html>
          <body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f7f6; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    
                    <tr>
                      <td align="center" style="background-color: #05383F; padding: 40px 20px;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 2px; text-transform: uppercase;">Expo Belleza & Barber</h1>
                        <p style="color: #a0d1d1; margin-top: 10px; font-size: 16px;">2027 | WTC México</p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding: 40px 30px;">
                        <h2 style="color: #003333; margin: 0; font-size: 22px;">¡Hola, ${fullname}!</h2>
                        <p style="color: #555; line-height: 1.6; font-size: 16px;">
                          Tu pago ha sido procesado con éxito. Prepárate para vivir la experiencia más importante de la industria de la belleza en México.
                        </p>
                        
                        <div style="margin: 30px 0; border-left: 4px solid #05383F; padding-left: 20px; background-color: #f0fafa;">
                          <p style="margin: 5px 0; font-size: 14px; color: #05383F;"><strong>Tipo de Acceso:</strong> ${accessType}</p>
                          <p style="margin: 5px 0; font-size: 14px; color: #05383F;"><strong>Estatus:</strong> Confirmado (PAGADO)</p>
                        </div>

                        <h3 style="color: #003333; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 10px;">Tus Boletos Digitales</h3>
                        
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          ${generatedTickets
                            .map(
                              (code) => `
                            <tr>
                              <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td>
                                      <span style="display: block; font-size: 12px; color: #999; text-transform: uppercase;">Código Único</span>
                                      <span style="font-size: 20px; font-weight: bold; color: #05383F; font-family: monospace;">${code}</span>
                                    </td>
                                    <td align="right">
                                      <a href="https://excogitable-mavis-sulfureous.ngrok-free.dev/ticket/${code}" 
                                         style="background-color: #05383F; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold; display: inline-block;">
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

                        <p style="margin-top: 30px; font-size: 14px; color: #888; text-align: center;">
                          Presenta estos códigos en la zona de registro para obtener tu pulsera oficial.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td align="center" style="background-color: #f9f9f9; padding: 20px; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #aaa; margin: 0;">
                          &copy; 2026 Expo Belleza & Barber. Todos los derechos reservados.<br>
                          World Trade Center, CDMX.
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
      // Tip: No retornes error aquí para no confundir a Stripe,
      // ya que el pago y la DB sí fueron exitosos.
    }
    // AQUÍ LLAMAREMOS A LA FUNCIÓN DE EMAIL (PRÓXIMO PASO)
    // await sendEmail(customer_email, tickets);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
