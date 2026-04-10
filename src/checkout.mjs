import Stripe from "stripe";

// RECUERDA: sk_test_... es tu llave secreta del dashboard de Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey);

const headers = {
  "Access-Control-Allow-Origin": "*", // ¡Vital para evitar el CORS de nuevo!
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  // Manejo de preflight (OPTIONS) automático
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const { email, accessType, fullname } = JSON.parse(event.body);

    // Mapeo de tus productos (IDs de precio de Stripe)
    const priceIds = {
      SINGLE_DAY: process.env.PRICE_SINGLE_DAY, // 1 día - $150
      TWO_DAYS: process.env.PRICE_TWO_DAYS, // 2 días - $200
      GROUP_SINGLE: process.env.PRICE_GROUP_SINGLE, // Grupal 1 día (11 pases) - $1500
      GROUP_TWO: process.env.PRICE_GROUP_TWO, // Grupal 2 días (11 pases) - $2000
    };
    const selectedPrice = priceIds[accessType];

    if (!selectedPrice) {
      throw new Error("Tipo de acceso no válido");
    }

    // Creamos la sesión de Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPrice,
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: email,
      // URLs a donde regresará el usuario después de pagar
      success_url: `https://tu-dominio.com/confirmacion?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://tu-dominio.com/registro`,
      // METADATA: Esto es oro puro. El Webhook usará esto para saber quién pagó.
      metadata: {
        customer_email: email,
        fullname: fullname,
        accessType: accessType,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error("Error en Checkout:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "No se pudo crear la sesión de pago",
        error: error.message,
      }),
    };
  }
};
