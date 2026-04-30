import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { validateCaptcha } from "./utils/captcha.mjs";
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  // Obtenemos el email desde los query parameters: /search-tickets?email=...
  const email = event.queryStringParameters?.email;
  const captchaToken = event.queryStringParameters?.captchaToken;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://beautyworldmexico.com.mx",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
  const isHuman = await validateCaptcha(captchaToken);
  if (!isHuman) {
    return {
      statusCode: 403,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "Actividad sospechosa detectada (Captcha Fallido).",
      }),
    };
  }
  if (!email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "El correo electrónico es obligatorio.",
      }),
    };
  }

  const params = {
    TableName: "BWM_Attendees_2027",
    IndexName: "EmailIndex",
    KeyConditionExpression: "email = :e",
    FilterExpression: "used = :u",
    ExpressionAttributeValues: {
      ":e": email.trim().toLowerCase(),
      ":u": false,
    },
  };

  try {
    const data = await docClient.send(new QueryCommand(params));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: data.Items.length,
        tickets: data.Items,
      }),
    };
  } catch (error) {
    console.error("Error en búsqueda:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Error interno al buscar los boletos." }),
    };
  }
};
