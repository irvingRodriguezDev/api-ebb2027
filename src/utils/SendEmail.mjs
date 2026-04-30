import { Resend } from "resend";

// Recomiendo guardar esta KEY en las variables de entorno de tu template.yaml
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendTicketEmail = async ({
  customer_email,
  fullname,
  accessType,
  ticketCount,
  generatedTickets,
}) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Beauty World Mexico <boletos@beautyworldmexico.com.mx>", // Tu dominio validado
      to: [customer_email],
      subject: `✨ ${ticketCount > 1 ? "Tus pases confirmados" : "Tu pase confirmado"} - Beauty World Mexico 2027`,
      html: `

<body style="margin: 0; padding: 0; background-color: #FFF5F7; font-family: 'Segoe UI', Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FFF5F7; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0"
                    style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(61, 43, 47, 0.05); border: 1px solid #FFB7CE;">

                    <tr>
                        <td align="center" style="background-color: #3D2B2F; padding: 40px 20px;">
                            <h1
                                style="color: #ee6f97; margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 5px; font-weight: 900;">
                                Acceso Oficial</h1>
                            <img src="https://staticsbwm.s3.us-east-2.amazonaws.com/LOGO_BLANCO.png" alt="Logo" style="max-width: 100%; height: auto;" nodownloade  />
                            <p
                                style="color: rgba(255,255,255,0.6); margin-top: 5px; font-size: 12px; font-weight: 700;">
                                2027 | WTC CIUDAD DE MÉXICO</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 40px 30px;">
                            <h3 style="color: #3D2B2F; margin: 0; font-size: 22px; font-weight: 900;">¡Hola,
                                ${fullname}!</h3>
                            <p style="color: #5C464A; font-size: 15px; line-height: 1.6;">Tu registro ha sido confirmado
                                con éxito. Nos entusiasma recibirte en el evento más importante de la industria.</p>

                            <div
                                style="margin: 30px 0; border-radius: 16px; padding: 20px; background-color: #FFF5F7; border: 1px dashed #ee6f97;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td>
                                            <p
                                                style="margin: 0; font-size: 11px; color: #ee6f97; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">
                                                Tipo de Acceso</p>
                                            <p
                                                style="margin: 5px 0 0; font-size: 16px; color: #3D2B2F; font-weight: 700;">
                                                ${accessType}</p>
                                        </td>
                                        <td align="right">
                                            <p
                                                style="margin: 0; font-size: 11px; color: #ee6f97; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">
                                                Cantidad</p>
                                            <p
                                                style="margin: 5px 0 0; font-size: 16px; color: #3D2B2F; font-weight: 700;">
                                                ${ticketCount} Ticket(s)</p>
                                        </td>
                                    </tr>
                                </table>
                            </div>

                            <h4
                                style="color: #3D2B2F; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #FFF5F7; padding-bottom: 10px; margin-bottom: 20px;">
                                Tus Pases Digitales</h4>

                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                ${generatedTickets
                                  .map(
                                    (code) => `
                                <tr>
                                    <td style="padding: 15px 0; border-bottom: 1px solid #FFF5F7;">
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td>
                                                    <span
                                                        style="display: block; font-size: 10px; color: #ee6f97; text-transform: uppercase; font-weight: 900;">ID
                                                        de Entrada</span>
                                                    <span
                                                        style="font-size: 20px; font-weight: 900; color: #3D2B2F; font-family: 'Courier New', Courier, monospace;">${code}</span>
                                                </td>
                                                <td align="right">
                                                    <a href="https://beuatyworldmexico.com.mx/ticket/${code}"
                                                        style="background-color: #ee6f97; color: #3D2B2F; padding: 12px 24px; text-decoration: none; border-radius: 12px; font-size: 12px; font-weight: 900; display: inline-block; text-transform: uppercase; letter-spacing: 1px;">
                                                        VER TICKET
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

                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 40px;">
                                <tr>
                                    <td align="center"
                                        style="background-color: #3D2B2F; border-radius: 12px; padding: 15px;">
                                        <p style="margin: 0; font-size: 12px; color: #ffffff; font-weight: 500;">
                                            Presenta estos códigos en el WTC para recibir tus pulseras oficiales.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 0 30px 40px;">
                            <p style="font-size: 11px; color: #5C464A; opacity: 0.5; margin: 0;">
                                Este es un correo automático. No es necesario responder.<br>
                                © 2026 BEAUTY WORLD MEXICO - Ciudad de México.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

      `,
    });

    if (error) {
      console.error("Error de Resend:", error);
      return null;
    }

    console.log("Correo enviado con éxito:", data.id);
    return data.id;
  } catch (err) {
    console.error("Error crítico en envío:", err);
  }
};
