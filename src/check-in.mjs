import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
  const { code } = JSON.parse(event.body);

  try {
    // 1. Buscamos el ticket
    const { Item } = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { ticketCode: code },
      }),
    );

    if (!Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Ticket no encontrado" }),
      };
    }

    // 2. Verificamos si ya fue usado
    if (Item.used) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "¡ALERTA! Este ticket ya fue utilizado",
          usedAt: Item.usedAt,
        }),
      };
    }

    // 3. Marcamos como usado
    await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { ticketCode: code },
        UpdateExpression: "set used = :u, usedAt = :t",
        ExpressionAttributeValues: {
          ":u": true,
          ":t": new Date().toISOString(),
        },
      }),
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "¡Acceso Concedido!",
        fullname: Item.fullname,
        accessType: Item.accessType,
      }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
