import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = "EBB_Attendees_2027";

export const handler = async (event) => {
  try {
    for (const record of event.Records) {
      const snsMessage = JSON.parse(record.Sns.Message);
      const notificationType = snsMessage.notificationType;

      if (notificationType === "Bounce" || notificationType === "Complaint") {
        const recipients = snsMessage.mail.destination;

        for (const email of recipients) {
          const cleanEmail = email.toLowerCase().trim();
          console.log(`Procesando ${notificationType} para: ${cleanEmail}`);

          // 1. Buscar el ticketCode asociado a este email usando el GSI
          const searchResult = await docClient.send(
            new QueryCommand({
              TableName: TABLE_NAME,
              IndexName: "EmailIndex",
              KeyConditionExpression: "email = :e",
              ExpressionAttributeValues: { ":e": cleanEmail },
            }),
          );

          // 2. Si encontramos registros, los marcamos como inválidos
          if (searchResult.Items && searchResult.Items.length > 0) {
            for (const item of searchResult.Items) {
              await docClient.send(
                new UpdateCommand({
                  TableName: TABLE_NAME,
                  Key: { ticketCode: item.ticketCode },
                  UpdateExpression: "set emailStatus = :s, lastError = :e",
                  ExpressionAttributeValues: {
                    ":s":
                      notificationType === "Bounce" ? "BOUNCED" : "COMPLAINT",
                    ":e":
                      notificationType === "Bounce"
                        ? `Rebote: ${snsMessage.bounce.bounceType}`
                        : "Queja del usuario",
                  },
                }),
              );
              console.log(
                `Ticket ${item.ticketCode} marcado como ${notificationType}`,
              );
            }
          } else {
            console.log(
              `No se encontró ningún ticket para el correo: ${cleanEmail}`,
            );
          }
        }
      }
    }
    return { statusCode: 200, body: "Procesado correctamente" };
  } catch (error) {
    console.error("Error en Bounce Handler:", error);
    return { statusCode: 500, body: "Error interno" };
  }
};
