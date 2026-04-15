export const validateCaptcha = async (token) => {
  // 1. Si no hay token, rechazamos de inmediato
  if (!token) {
    console.error("Captcha error: No token provided");
    return false;
  }

  try {
    // 2. IMPORTANTE: Usar el nombre exacto que pusiste en el YAML
    const secretKey = "6Len0rcsAAAAAO6mu8J-lws1KsEYax3fCv8ADku0";

    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        // Enviamos el cuerpo como string (form-urlencoded)
        body: `secret=${secretKey}&response=${token}`,
      },
    );

    const data = await response.json();

    // 3. Log para debug en CloudWatch (Saber qué dice Google realmente)
    console.log("Google Auth Response:", JSON.stringify(data));

    // Retornamos true solo si success es true
    // En producción, podrías ser más estricto: data.success && data.score >= 0.5
    return data.success;
  } catch (error) {
    console.error("Error crítico validando Captcha:", error);
    return false;
  }
};
