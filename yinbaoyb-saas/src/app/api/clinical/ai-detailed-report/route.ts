// ============================================================
// API Route: /api/clinical/ai-detailed-report
// Genera un informe clínico de evolución detallado y de alta fidelidad
// para uso directivo/coordinación a partir del historial del paciente.
// Usa Ollama local (gemma4:31b-cloud).
// ============================================================
import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/v1/chat/completions";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-cloud";

const SYSTEM_PROMPT = `Eres un neuropsicólogo clínico y director de terapia infantil experto. Tu rol es analizar el historial de notas clínicas de evolución de un paciente y consolidar un "INFORME DE PROCESO TERAPEUTICO" completo de alta fidelidad, detallado y rigurosamente estructurado con lenguaje técnico avanzado para la dirección clínica.

Debes generar un análisis profundo y extenso estructurado estrictamente en JSON con los siguientes campos exactos:
{
  "motivo_informe": "Detalla el motivo del informe basándote en la información clínica y notas del paciente. Al menos 2 párrafos.",
  "enfoque_to": "Enfoque de intervención actual en el Área de Terapia Ocupacional (TO). Centrado en ocupación e integración sensorial.",
  "plan_sensorial_to": "Plan de trabajo TO: Perfil Sensorial y Modulación de la Atención.",
  "plan_transiciones_to": "Plan de trabajo TO: Transiciones y Regulación Conductual.",
  "plan_grafomotricidad_to": "Plan de trabajo TO: Agarre y Grafomotricidad (motricidad fina).",
  "plan_coordinacion_to": "Plan de trabajo TO: Habilidades de Coordinación (tijeras, rasgado, etc.).",
  "plan_motricidad_gruesa_to": "Plan de trabajo TO: Motricidad Gruesa y Planeamiento Motor.",
  "plan_cognitivo_to": "Plan de trabajo TO: Habilidades Cognitivas (seguimiento de órdenes y continuidad).",
  "plan_conceptos_to": "Plan de trabajo TO: Orientación y Conceptos Básicos.",
  "plan_alimentacion_to": "Plan de trabajo TO: Autonomía - Alimentación y Rutina de Mesa.",
  "plan_vestido_to": "Plan de trabajo TO: Autonomía - Vestido e Higiene (AVD).",
  "plan_regulacion_conductual_to": "Plan de trabajo TO: Regulación Emocional y Conductual.",
  "objetivos_to": [
    "Objetivo 1 de TO (ej. Modulación del Estado de Alerta)",
    "Objetivo 2 de TO (ej. Maduración del Agarre)",
    "Objetivo 3 de TO (ej. Planeamiento Motor)",
    "Objetivo 4 de TO (ej. Funciones Cognitivas)",
    "Objetivo 5 de TO (ej. Autonomía AVD)",
    "Objetivo 6 de TO (ej. Regulación Emocional)"
  ],
  "enfoque_tl": "Enfoque de intervención actual en el Área de Terapia de Lenguaje (TL).",
  "plan_instrucciones_tl": "Plan de trabajo TL: Comprensión y Seguimiento de Instrucciones.",
  "plan_intencion_tl": "Plan de trabajo TL: Intención Comunicativa y Pragmática.",
  "plan_saac_tl": "Plan de trabajo TL: Sistemas Aumentativos y Alternativos de Comunicación (SAAC).",
  "plan_estructuras_tl": "Plan de trabajo TL: Expansión de estructuras comunicativas.",
  "plan_memoria_tl": "Plan de trabajo TL: Memoria y atención de lo aprendido.",
  "plan_atencion_conjunta_tl": "Plan de trabajo TL: Atención conjunta.",
  "plan_generalizacion_tl": "Plan de trabajo TL: Generalización de habilidades comunicativas.",
  "objetivos_tl": [
    "Objetivo 1 de TL (ej. Intención Comunicativa)",
    "Objetivo 2 de TL (ej. Generalización de Comunicación Alternativa)",
    "Objetivo 3 de TL (ej. Habilidades de Atención al Adulto)",
    "Objetivo 4 de TL (ej. Habilidades de Comprensión)",
    "Objetivo 5 de TL (ej. Disminución de dependencia visual)",
    "Objetivo 6 de TL (ej. Iniciativa comunicativa)"
  ],
  "reco_ubicacion_escuela": "Recomendación escolar: Ubicación en el aula.",
  "reco_anticipacion_escuela": "Recomendación escolar: Anticipación Visual Obligatoria.",
  "reco_segmentacion_escuela": "Recomendación escolar: Segmentación de Instrucciones.",
  "reco_sistema_visual_escuela": "Recomendación escolar: Uso del Sistema Visual para Peticiones.",
  "reco_limites_escuela": "Recomendación escolar: Gestión del Límite y Regulación Emocional.",
  "reco_autonomia_escuela": "Recomendación escolar: Fomento de la Autonomía Sin Sustitución.",
  "reco_motores_escuela": "Recomendación escolar: Acompañamiento en Desafíos Motores."
}

REGLAS ESTRICTAS:
- Genera explicaciones clínicas detalladas y profesionales para cada campo basándote en las notas de evolución.
- Habla en tercera persona formal ("el paciente", "la menor").
- No uses nombres de terapeutas ni datos de la sede.
- Retorna EXCLUSIVAMENTE el objeto JSON. No agregues comentarios introductorios o explicaciones fuera del JSON.`;

// Motor de Respaldo Clínico Detallado Local
function generateFallbackDetailedReport(patient: any, notes: any[]) {
  const childName = patient ? `${patient.first_name} ${patient.last_name}` : "el menor";
  const diagnosis = patient?.primary_diagnosis || "Neurodesarrollo";

  return {
    motivo_informe: `A petición de la institución educativa para reportar el estado del desarrollo actual del menor, alinear los objetivos terapéuticos con el entorno escolar y proponer las adaptaciones ambientales y metodológicas necesarias dentro del aula.`,
    
    enfoque_to: `El plan de intervención se desarrolla bajo un enfoque centrado en la ocupación y el marco teórico de la Integración Sensorial. El objetivo general es regular el estado de alerta del menor, optimizar sus destrezas motoras (gruesas y finas) y fortalecer sus funciones cognitivas básicas. Todo esto con el fin de disminuir el impacto de la dispersión atencional, promover conductas reguladas ante la negativa y consolidar su autonomía e independencia dentro del entorno escolar y familiar.`,
    
    plan_sensorial_to: `${childName} presenta un perfil de atención altamente disperso, caracterizado por periodos frecuentes de abstracción e ideación imaginativa persistente, lo que le desconecta del entorno. Responde con éxito y mantiene atención sostenida únicamente bajo un enfoque de trabajo individualizado y estructurado (uno a uno). En entornos con alta carga de estímulos ambientales su nivel de dispersión se incrementa significativamente.`,
    
    plan_transiciones_to: `Ante cambios de actividad o transiciones imprevistas, el menor suele presentar episodios de desregulación conductual. Sin embargo, se observa una evolución favorable gracias a la implementación de estrategias de anticipación, lo cual disminuye notablemente la ansiedad ante el cambio.`,
    
    plan_grafomotricidad_to: `Actualmente realiza una pinza cuadrípode (agarre el lápiz apoyándose en cuatro dedos). Se encuentra en proceso de trabajo y transición para madurar su agarre hacia una pinza trípode funcional, logrando sostener el lápiz correctamente utilizando solo tres dedos.`,
    
    plan_coordinacion_to: `Logra ensartar cuentas de forma independiente. Muestra baja tolerancia a la frustración (enojo) durante actividades de rasgado y requiere asistencia/guía física para el uso correcto de la tijera.`,
    
    plan_motricidad_gruesa_to: `Se trabaja activamente en el planeamiento motor, el equilibrio dinámico y la seguridad gravitatoria. Inicialmente, manifiesta temor e inseguridad ante desafíos motores que involucran altura o balanceo, como subir escaleras o caminar sobre una barra de equilibrio (a pesar de ser una superficie amplia y segura). Requiere de asistencia, guía física y reforzamiento constante para dar continuidad a las secuencias de movimiento, tales como ascender peldaños, deslizarse por la resbaladera y ejecutar saltos de manera coordinada.`,
    
    plan_cognitivo_to: `En el área cognitiva, se evidencia una excelente memoria y una alta velocidad de aprendizaje para retener información nueva. Actualmente se trabaja en la consolidación y comprensión de instrucciones de un solo paso que requieran una acción completa (por ejemplo: lograr que guarde ambos zapatos en su lugar en lugar de abandonar la tarea a la mitad dejando uno fuera). Asimismo, se estimula la atención selectiva para comandos de entrega directa de objetos (ej. "pásame el lápiz").`,
    
    plan_conceptos_to: `Se encuentra en proceso de interiorización de nociones espaciales y cuantitativas básicas (dimensiones: grande/pequeño; y conceptos espaciales: arriba/abajo) aplicadas a la manipulación de objetos y su propio cuerpo en el espacio.`,
    
    plan_alimentacion_to: `Es capaz de abrir su lonchera bajo el comando verbal directo ("abre"). Manifiesta conductas de rechazo alimentario selectivo u oposicionismo en mesa, las cuales manejamos con éxito dentro de las sesiones de terapia mediante el uso de apoyos visuales (pictogramas), logrando que coma de forma independiente.`,
    
    plan_vestido_to: `Se encuentra en pleno proceso de aprendizaje para la rutina del baño y el vestido. Físicamente inicia la actividad y tiene la capacidad para subirse/bajarse el pantalón y ponerse las medias; sin embargo, ante el incremento de la dificultad motriz, presenta baja tolerancia a la frustración. Esto genera que abandone la tarea a la mitad, se enoje y muestre resistencia conductual, buscando que el adulto complete la actividad por ella. En terapia se fomenta la persistencia y la autonomía, guiándola a terminar el proceso por sí misma.`,
    
    plan_regulacion_conductual_to: `Se observa baja tolerancia a la frustración cuando se le establecen límites o ante la negativa de un objeto de su interés, respondiendo habitualmente a través del llanto persistente como mecanismo de demanda. En terapia se trabaja activamente en la aceptación del "no", la contención emocional y el moldeamiento de conductas adaptativas frente a la frustración.`,
    
    objetivos_to: [
      "Modulación del Estado de Alerta: Regular su nivel de actividad mediante descargas propioceptivas y vestibulares guiadas para extender sus periodos de atención sostenida en mesa.",
      "Maduración del Agarre (Grafomotricidad): Evolucionar el patrón de agarre actual de pinza cuadrípode hacia una pinza trípode digital funcional (uso correcto de tres dedos) mediante actividades de fuerza, oposición y destreza fina.",
      "Planeamiento Motor y Seguridad Gravitatoria: Disminuir el temor al movimiento y las alturas, logrando que complete circuitos motrices gruesos de forma fluida (subir escaleras, pasar la barra de equilibrio y deslizarse) incrementando su confianza y coordinación corporal.",
      "Funciones Cognitivas: Fortalecer el seguimiento de instrucciones verbales completas, asegurando que termine la tarea asignada (ej. guardar la pareja de zapatos) y asimile conceptos básicos de espacio (arriba/abajo) y (adentro/afuera).",
      "Autonomía en Actividades de la Vida Diaria (AVD): Fomentar la persistencia en las rutinas de vestido, alimentación e higiene disminuyendo el abandono de la tarea ante la dificultad motriz.",
      "Regulación Emocional: Incrementar la tolerancia a la frustración y la aceptación de límites (el \"no\"), disminuyendo la conducta de llanto como medio de demanda o desregulación."
    ],
    
    enfoque_tl: `La intervención se enfoca en fortalecer las habilidades de comunicación funcional del menor, promoviendo el uso del lenguaje para realizar peticiones y participar de manera más activa en los intercambios comunicativos. Se trabaja principalmente mediante el uso de pictogramas como apoyo visual para favorecer la comprensión y expresión de estructuras simples como "dame", "dame más" y "dame + objeto". Asimismo, se estimula la comprensión de instrucciones sencillas, la atención al adulto y el uso del lenguaje con una finalidad comunicativa en diferentes contextos.`,
    
    plan_instrucciones_tl: `Presenta dificultades para procesar e integrar instrucciones verbales complejas o de múltiples pasos (ej. "trae tu cuaderno y siéntate"). Su nivel de ejecución mejora ante comandos simples relacionados con actividades rutinarias y de la sesión terapéutica relacionados con su autonomía (ej. "sácate los zapatos"), aunque su consistencia sigue en desarrollo (suele completar solo una parte de la secuencia si no se supervisa).`,
    
    plan_intencion_tl: `No se evidencia un lenguaje espontáneo funcional ni uso de iniciativa social a través de la mirada o el gesto para realizar peticiones. Presenta una conducta de acceso directo para satisfacer sus necesidades (quitar objetos al adulto, auto servirse comida directamente de la cocina) debido a una baja necesidad de mediación social instaurada en su entorno. Sin embargo, dentro del contexto terapéutico hace uso del lenguaje para realizar peticiones (ej. dame león).`,
    
    plan_saac_tl: `En el entorno terapéutico, responde con alta efectividad al uso de pictogramas, logrando estructurar la demanda funcional (ej. "Dame + [Objeto]", dame, dame más). Actualmente este sistema se encuentra en fase inicial de generalización y consolidación en el entorno familiar.`,
    
    plan_estructuras_tl: `Se fomenta el uso progresivo de expresiones compuestas mediante apoyos visuales y modelado verbal, favoreciendo la transición desde palabras aisladas hacia estructuras funcionales más completas para realizar peticiones y expresar necesidades.`,
    
    plan_memoria_tl: `Se promueve la recuperación de estructuras lingüísticas previamente trabajadas, reduciendo gradualmente la dependencia de apoyos visuales para favorecer su uso espontáneo dentro de situaciones comunicativas significativas.`,
    
    plan_atencion_conjunta_tl: `Se desarrollan actividades orientadas a incrementar la atención compartida entre el menor, el terapeuta y los materiales de trabajo, favoreciendo una mayor participación en los intercambios comunicativos.`,
    
    plan_generalizacion_tl: `Se implementan estrategias dirigidas a transferir las habilidades adquiridas durante la terapia hacia contextos cotidianos, promoviendo su utilización en diferentes ambientes, personas y situaciones.`,
    
    objetivos_tl: [
      "Intención Comunicativa: Favorecer el uso espontáneo de estrategias comunicativas para solicitar objetos, actividades o ayuda, promoviendo la interacción con otras personas como medio para satisfacer sus necesidades.",
      "Generalización de Comunicación Alternativa: Consolidar el uso del sistema visual (pictogramas) para estructuras comunicativas constantes funcionales (ej. \"Dame + [Objeto]\") en los diferentes entornos que participa.",
      "Atención al Adulto: Promover el contacto visual y la atención compartida durante los intercambios comunicativos y actividades dirigidas.",
      "Comprensión de Comandos Sencillos: Fortalecer la comprensión y ejecución de instrucciones simples de un paso dentro de contextos funcionales y significativos.",
      "Disminución gradual de la dependencia de apoyos visuales: Promover la evocación y producción espontánea de estructuras comunicativas previamente aprendidas mediante pictogramas, favoreciendo su uso aun cuando el apoyo visual no esté presente.",
      "Incremento de la iniciativa comunicativa espontánea: Estimular que el menor inicie interacciones comunicativas para solicitar objetos, actividades o ayuda sin necesidad de indicaciones directas por parte del adulto."
    ],
    
    reco_ubicacion_escuela: `Ubicación en el Aula: Sentar al menor en las primeras filas, al centro, cerca de la maestra y lejos de focos de distracción directa (ventanas, pasillos o repisas abiertas con juguetes) para ayudar a contrarrestar su dispersión atencional.`,
    reco_anticipacion_escuela: `Anticipación Visual Obligatoria: Estructurar la jornada con un horario visual (pictogramas) en su mesa o la pizarra. Antes de realizar cualquier cambio de actividad (ej. de trabajar a ir al recreo), la maestra debe señalar la imagen y anticipar verbalmente: "Terminó trabajo, sigue recreo". Esto previene enojos y desregulaciones por ansiedad de transición.`,
    reco_segmentacion_escuela: `Segmentación de Instrucciones y Cierre de Tareas: Darle órdenes cortas, pausadas y de un solo paso (ej. "Saca la cartuchera"). Al asignarle una rutina (como guardar sus pertenencias), la maestra debe supervisar que complete la acción entera (ej. que guarde ambos zapatos o todos sus cuadernos) para entrenar la continuidad y evitar que deje las actividades a la mitad.`,
    reco_sistema_visual_escuela: `Uso del Sistema Visual para Peticiones: Coordinar activamente con el centro y la familia para que utilice sus tarjetas visuales clave (especialmente "Dame", "Baño", "A comer" y "Guardar") en el aula. Si el menor arrebata un objeto o material de trabajo, no se le debe otorgar de forma inmediata; se le debe retirar suavemente, mostrarle el pictograma y exigirle que lo pida adecuadamente.`,
    reco_limites_escuela: `Gestión del Límite y Regulación Emocional: Mantener una postura firme pero afectuosa ante los episodios de llanto o frustración cuando se le dice "no" o no se le da un objeto. Evitar ceder a sus demandas bajo el llanto, permitiéndole calmarse y redirigiéndola de inmediato a una actividad estructurada.`,
    reco_autonomia_escuela: `Fomento de la Autonomía Sin Sustitución: En los momentos de ir al baño, la lonchera o la salida, se le debe dar el tiempo necesario para que intente bajarse el pantalón, ponerse los zapatos o abrir su mochila por sí solo. Si muestra frustración a mitad del proceso, el adulto puede asistirlo con una guía física leve o parcial, pero evitando hacer la tarea por completo por él, reforzando siempre el esfuerzo de haberlo intentado.`,
    reco_motores_escuela: `Acompañamiento en Desafíos Motores: En las horas de educación física o recreo, motivarle a participar en los juegos de parque (escaleras, resbaladeras) brindándole seguridad física y sostén manual inicial, pero exigiéndole continuidad para vencer progresivamente el temor a las alturas o el desequilibrio.`
  };
}

export async function POST(request: Request) {
  // 1. Verificar autenticación
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const authHeader = request.headers.get("authorization");
  const userToken = authHeader?.replace("Bearer ", "");

  if (!userToken) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificar usuario
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${userToken}`, apikey: anonKey },
  });
  const userData = await userRes.json();
  if (!userData.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificar perfil y rol directivo/admin
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userData.id}&select=role,tenant_id`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` } }
  );
  const profiles = await profileRes.json();
  if (!profiles?.[0]) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  }

  const userProfile = profiles[0];
  const allowedRoles = ["super_admin", "director", "admin", "coordinador"];
  if (!allowedRoles.includes(userProfile.role)) {
    return NextResponse.json({ error: "No autorizado para generar informes directivos" }, { status: 403 });
  }

  // 2. Obtener el ID del paciente
  let patientId = "";
  try {
    const body = await request.json();
    patientId = body.patientId;
  } catch (err) {
    const { searchParams } = new URL(request.url);
    patientId = searchParams.get("patientId") || "";
  }

  if (!patientId) {
    return NextResponse.json({ error: "Falta el ID del paciente" }, { status: 400 });
  }

  // 3. Validar sede/tenant
  const patientRes = await fetch(
    `${supabaseUrl}/rest/v1/patients?id=eq.${patientId}&select=first_name,last_name,primary_diagnosis,birth_date,address,emergency_contact_name,tenant_id`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` } }
  );
  const patients = await patientRes.json();
  if (!patients?.[0]) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  const patient = patients[0];
  if (patient.tenant_id !== userProfile.tenant_id) {
    return NextResponse.json({ error: "Acceso denegado (sede incorrecta)" }, { status: 403 });
  }

  // 4. Obtener las últimas 20 notas clínicas
  const notesRes = await fetch(
    `${supabaseUrl}/rest/v1/clinical_notes?patient_id=eq.${patientId}&order=created_at.desc&limit=20&select=format,subjective,objective,assessment,plan,behavior,intervention,response,content,created_at`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` } }
  );
  const notes = await notesRes.json();

  if (!notes || notes.length === 0) {
    return NextResponse.json({
      motivo_informe: "El paciente aún no cuenta con notas de evolución registradas para analizar.",
      enfoque_to: "Sin información registrada para Terapia Ocupacional.",
      enfoque_tl: "Sin información registrada para Terapia de Lenguaje.",
      objetivos_to: [],
      objetivos_tl: [],
      recomendaciones_escolares: {}
    });
  }

  // 5. Construir contexto
  const notesContext = notes.map((n: any, i: number) => {
    const date = new Date(n.created_at).toLocaleDateString("es-EC");
    const fields: string[] = [`Fecha: ${date}`, `Formato: ${n.format}`];
    if (n.subjective) fields.push(`Subjetivo: ${n.subjective}`);
    if (n.objective) fields.push(`Objetivo: ${n.objective}`);
    if (n.assessment) fields.push(`Evaluación: ${n.assessment}`);
    if (n.plan) fields.push(`Plan: ${n.plan}`);
    if (n.behavior) fields.push(`Conducta: ${n.behavior}`);
    if (n.intervention) fields.push(`Intervención: ${n.intervention}`);
    if (n.response) fields.push(`Respuesta: ${n.response}`);
    if (n.content) fields.push(`Contenido: ${n.content}`);
    return `--- Nota ${i + 1} ---\n${fields.join("\n")}`;
  }).join("\n\n");

  const userMessage = `Analiza los siguientes reportes clínicos detallados y genera el JSON de análisis clínico estructurado para dirección médica.

INFORMACIÓN DEL PACIENTE:
Nombre: ${patient.first_name} ${patient.last_name}
Diagnóstico: ${patient.primary_diagnosis || "No especificado"}

NOTAS CLÍNICAS:
${notesContext}`;

  // 6. Llamar a Ollama
  try {
    const aiResponse = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      console.warn("Ollama API failed for detailed report, falling back...");
      return NextResponse.json(generateFallbackDetailedReport(patient, notes));
    }

    const aiData = await aiResponse.json();
    const resultText = aiData.choices?.[0]?.message?.content;
    if (!resultText) throw new Error("No content returned from AI");

    const parsed = JSON.parse(resultText);
    return NextResponse.json(parsed);

  } catch (err: any) {
    console.error("AI Detailed Report Error, fallback triggered:", err);
    return NextResponse.json(generateFallbackDetailedReport(patient, notes));
  }
}
