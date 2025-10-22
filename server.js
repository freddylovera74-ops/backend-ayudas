const express = require('express');
const cors = require('cors');
// ¡Lee la clave secreta desde las variables de entorno de Render!
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------
// LÓGICA DEL SIMULADOR GRATUITO: BONO ALQUILER JOVEN (MADRID)
// -----------------------------------------------------------------
const REQUISITOS_ALQUILER = {
    EDAD_MAX: 35,
    EDAD_MIN: 18,
    INGRESOS_MAX_ANUAL: 25200, // 3 veces el IPREM (8400€ * 3)
    ALQUILER_MAX_MADRID: 900,  // Límite para Madrid
    PROPIETARIO: 'no'
};

app.post('/api/diagnostico/alquiler', (req, res) => {
    console.log('RECIBIDA PETICIÓN ALQUILER:', req.body);
    const { edad, ingresos, precioAlquiler, propietario } = req.body;

    const numEdad = parseInt(edad);
    const numIngresos = parseFloat(ingresos);
    const numAlquiler = parseFloat(precioAlquiler);

    const documentos = [
        "DNI o NIE (residencia legal en España).",
        "Contrato de alquiler (debes ser el titular).",
        "Justificante de empadronamiento en la vivienda.",
        "Justificante de ingresos (nóminas, declaración de renta).",
        "Nota simple del registro (para acreditar que no tienes propiedades)."
    ];

    if (numEdad > REQUISITOS_ALQUILER.EDAD_MAX || numEdad < REQUISITOS_ALQUILER.EDAD_MIN) {
        return res.json({ elegible: false, motivo: `La ayuda es para jóvenes entre ${REQUISITOS_ALQUILER.EDAD_MIN} y ${REQUISITOS_ALQUILER.EDAD_MAX} años.` });
    }
    if (numIngresos > REQUISITOS_ALQUILER.INGRESOS_MAX_ANUAL) {
        return res.json({ elegible: false, motivo: `Tus ingresos anuales (${numIngresos}€) superan el límite de ${REQUISITOS_ALQUILER.INGRESOS_MAX_ANUAL}€ (3 veces el IPREM).` });
    }
    if (numAlquiler > REQUISITOS_ALQUILER.ALQUILER_MAX_MADRID) {
        return res.json({ elegible: false, motivo: `El precio de tu alquiler (${numAlquiler}€) supera el límite de ${REQUISITOS_ALQUILER.ALQUILER_MAX_MADRID}€ permitido en Madrid.` });
    }
    if (propietario !== REQUISITOS_ALQUILER.PROPIETARIO) {
        return res.json({ elegible: false, motivo: `No puedes ser propietario de otra vivienda en España.` });
    }

    // ¡ÉXITO!
    return res.json({
        elegible: true,
        motivo: `¡Cumples los requisitos principales! Tienes menos de 35, tus ingresos y el precio del alquiler están dentro de los límites.`,
        documentos: documentos
    });
});


// -----------------------------------------------------------------
// LÓGICA DEL SIMULADOR DE PAGO: INGRESO MÍNIMO VITAL (IMV)
// (Todo esto se queda exactamente igual que antes)
// -----------------------------------------------------------------
const RENTAS_GARANTIZADAS_MENSUALES = {
    '1a0m': 604.21, '1a1m': 869.95, '1a2m': 1135.69, '1a3m': 1401.43, '1a4m': 1667.17,
    '2a0m': 785.47, '2a1m': 966.73, '2a2m': 1232.47, '2a3m': 1498.21, '3a0m': 966.73,
    '3a1m': 1147.99, '3a2m': 1413.73, '4a0m': 1147.99, '4a1m': 1329.25, 'mas': 1329.25,
    'mono_1a1m': 918.40, 'mono_1a2m': 1184.14, 'mono_1a3m': 1449.88, 'mono_1a4m': 1715.62,
    'mono_2a0m': 785.47, 'mono_2a1m': 1147.99, 'mono_2a2m': 1413.73, 'mono_3a0m': 966.73,
    'mono_3a1m': 1329.25, 'mono_4a0m': 1147.99, 'mono_4a1m': 1510.51, 'mono_mas': 1510.51,
};
const LIMITES_PATRIMONIO_ANUAL = {
    '1a0m': 20353.62, '1a1m': 32565.79, '1a2m': 44777.96, '1a3m': 56990.13, '1a4m': 69202.30,
    '2a0m': 32565.79, '2a1m': 44777.96, '2a2m': 56990.13, '2a3m': 69202.30,
    '3a0m': 44777.96, '3a1m': 56990.13, '3a2m': 69202.30, '4a0m': 56990.13,
    '4a1m': 69202.30, 'mas': 69202.30,
};
function getClaveHogar(adultos, menores, esMonoparental) {
    const totalMiembros = adultos + menores;
    let claveRenta = esMonoparental === 'si' ? 'mono_' : '';
    if (totalMiembros >= 5) { claveRenta += 'mas'; } else { claveRenta += `${adultos}a${menores}m`; }
    let clavePatrimonio = '';
    if (totalMiembros >= 5) { clavePatrimonio = 'mas'; } else { clavePatrimonio = `${adultos}a${menores}m`; }
    if (esMonoparental === 'si' && menores === 0) { claveRenta = `${adultos}a0m`; }
    return { claveRenta, clavePatrimonio };
}
function calcularDiagnosticoIMV(formData) {
    const { edad, residencia, adultos, menores, monoparental, ingresosHogar, patrimonioHogar } = formData;
    const numAdultos = parseInt(adultos);
    const numMenores = parseInt(menores);
    const numIngresos = parseFloat(ingresosHogar);
    const numPatrimonio = parseFloat(patrimonioHogar);
    const documentos = [
        "DNI o NIE de todas las personas de la unidad de convivencia.",
        "Certificado de empadronamiento colectivo e histórico.",
        "Libro de familia o certificado de nacimiento.",
        "Declaración de la Renta (IRPF) del año anterior.",
        "Certificado de titularidad de la cuenta bancaria.",
        "Sentencia de divorcio o convenio regulador (si aplica)."
    ];
    if (parseInt(residencia) < 1) {
        return { elegible: false, motivo: 'No cumples el requisito de residencia (mínimo 1 año de residencia legal en España).', documentos: [] };
    }
    if (parseInt(edad) < 23 && numMenores === 0) {
        return { elegible: false, motivo: 'Debes ser mayor de 23 años (o mayor de 18 con menores a tu cargo).', documentos: [] };
    }
    const { claveRenta, clavePatrimonio } = getClaveHogar(numAdultos, numMenores, monoparental);
    const rentaGarantizada = RENTAS_GARANTIZADAS_MENSUALES[claveRenta] || RENTAS_GARANTIZADAS_MENSUALES[monoparental === 'si' ? 'mono_mas' : 'mas'];
    const limitePatrimonio = LIMITES_PATRIMONIO_ANUAL[clavePatrimonio] || LIMITES_PATRIMONIO_ANUAL['mas'];
    if (numPatrimonio >= limitePatrimonio) {
        return { elegible: false, motivo: `El patrimonio de tu hogar (${numPatrimonio.toFixed(2)} €) supera el límite para tu tipo de hogar (${limitePatrimonio.toFixed(2)} €).`, documentos: [] };
    }
    if (numIngresos >= rentaGarantizada) {
        return { elegible: false, motivo: `Los ingresos mensuales de tu hogar (${numIngresos.toFixed(2)} €) superan la Renta Garantizada para tu tipo de hogar (${rentaGarantizada.toFixed(2)} €).`, documentos: [] };
    }
    const cuantiaEstimada = rentaGarantizada - numIngresos;
    if (cuantiaEstimada < 10) {
        return { elegible: false, motivo: `La diferencia entre tus ingresos (${numIngresos.toFixed(2)} €) y la Renta Garantizada (${rentaGarantizada.toFixed(2)} €) es menor de 10€, que es el mínimo a percibir.`, documentos: [] };
    }
    return {
        elegible: true,
        motivo: `Tus ingresos (${numIngresos.toFixed(2)} €) son inferiores a la Renta Garantizada (${rentaGarantizada.toFixed(2)} €) y tu patrimonio está dentro del límite.`,
        cuantiaEstimada: cuantiaEstimada,
        documentos: documentos
    };
}

// ---------------------------------------------------
// --- ENDPOINT 1 (PAGO): Crear Sesión de Pago (Stripe) ---
// ---------------------------------------------------
app.post('/api/crear-sesion-de-pago', async (req, res) => {
    try {
        const formData = req.body;
        // ¡¡RECUERDA CAMBIAR ESTO POR TU URL REAL DE NETLIFY!!
        const YOUR_DOMAIN = 'https://zippy-stardust-f6d467.netlify.app';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: 'Diagnóstico Experto IMV',
                            description: 'Cálculo de cuantía, requisitos y documentos necesarios.',
                        },
                        unit_amount: 1000, // 10,00 € (en céntimos)
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            metadata: {
                formData: JSON.stringify(formData)
            },
            success_url: `${YOUR_DOMAIN}/pago-exitoso.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${YOUR_DOMAIN}/pago-cancelado.html`,
        });
        res.json({ id: session.id });
    } catch (error) {
        console.error("Error al crear sesión de Stripe:", error);
        res.status(500).json({ error: 'Error al crear la sesión de pago.' });
    }
});

// ---------------------------------------------------
// --- ENDPOINT 2 (PAGO): Verificar Pago y dar Resultado ---
// ---------------------------------------------------
app.post('/api/verificar-pago-y-obtener-resultado', async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const formData = JSON.parse(session.metadata.formData);
            const resultado = calcularDiagnosticoIMV(formData);
            res.json(resultado);
        } else {
            res.status(400).json({ error: 'El pago no ha sido completado.' });
        }
    } catch (error) {
        console.error("Error al verificar la sesión:", error);
        res.status(500).json({ error: 'Error al verificar el pago.' });
    }
});

// 5. Poner el servidor a escuchar
app.listen(PORT, () => {
    console.log(`🚀 Servidor EXPERTO (con Stripe) escuchando en http://localhost:${PORT}`);
    console.log('Endpoints disponibles:');
    console.log('  POST /api/diagnostico/alquiler (Simulador Alquiler GRATIS)');
    console.log('  POST /api/crear-sesion-de-pago (Simulador IMV PAGO)');
    console.log('  POST /api/verificar-pago-y-obtener-resultado (Simulador IMV PAGO)');
});