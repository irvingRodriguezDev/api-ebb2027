import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  // Capturamos el código que viene en la ruta /ticket/{code}
  const { code } = event.pathParameters;

  const params = {
    TableName: process.env.TABLE_NAME,
    Key: {
      ticketCode: code,
    },
  };

  try {
    const { Item } = await docClient.send(new GetCommand(params));

    if (!Item) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*", // Importante para el Front
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "Boleto no encontrado" }),
      };
    }

    // Devolvemos solo lo necesario para el front
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullname: Item.fullname,
        accessType: Item.accessType,
        status: Item.status,
        email: Item.email,
      }),
    };
  } catch (error) {
    console.error("Error consultando DynamoDB:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Error interno del servidor" }),
    };
  }
};
