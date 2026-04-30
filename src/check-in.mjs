import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  // Manejo de preflight para CORS si es necesario
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "https://beautyworldmexico.com.mx",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
    };
  }

  const { code } = JSON.parse(event.body);
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const response = await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { ticketCode: code },
        // Actualizamos used a true y guardamos la fecha
        UpdateExpression: "set used = :u, usedAt = :t",
        // LA CLAVE: Solo procede si 'used' no es true.
        // attribute_not_exists maneja boletos nuevos que nunca han sido tocados.
        ConditionExpression: "attribute_not_exists(used) OR used = :f",
        ExpressionAttributeValues: {
          ":u": true,
          ":f": false,
          ":t": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    const updatedItem = response.Attributes;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "¡Acceso Concedido!",
        fullname: updatedItem.fullname,
        accessType: updatedItem.profile || updatedItem.accessType, // Ajustado a tu modelo de registro
      }),
    };
  } catch (error) {
    console.error("Error capturado:", error.name, error.message);

    // Si el ticket ya fue usado, DynamoDB lanza este error específico
    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "ESTE BOLETO YA FUE UTILIZADO.",
        }),
      };
    }

    // Si el ticket ni siquiera existe (Primary Key no encontrada)
    // Nota: UpdateCommand crea un item si no existe a menos que pongas una condición extra.
    // Para ser estrictos, podrías añadir "attribute_exists(ticketCode)" a la condición.

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Error al procesar el escaneo",
      }),
    };
  }
};
