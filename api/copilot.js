export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const c = req.body;
  const prompt = `Analiza esta empresa objetivo para Kintai y responde SOLO con JSON válido sin markdown ni explicaciones:

{
  "resumen_negocio": "máximo 80 palabras: qué hace la empresa, a quién vende y cómo genera ingresos",
  "signals": [
    {"nivel": "high|mid|low", "titulo": "string corto", "descripcion": "1-2 frases explicando por qué es relevante para Kintai"}
  ],
  "apertura": "2-3 frases para abrir la llamada de forma natural y personalizada, sin sonar a vendedor"
}

DATOS DE LA EMPRESA:
- Nombre: ${c.name}
- Sector: ${c.cnae}
- Web: ${c.web || 'no disponible'}
- Empleados: ${c.employees || 'no disponible'}
- Ubicación: ${c.city}, ${c.ccaa}

FINANCIERO (en miles €):
- Ventas: ${c.ventas}k€ (año anterior: ${c.ventas_y1}k€)
- EBITDA: ${c.ebitda}k€
- Margen neto: ${c.margen}%
- Tesorería: ${c.tesoreria}k€
- Deuda financiera: ${c.deuda}k€

CIRCULANTE:
- PMC (días cobro): ${c.pmc} días
- PMP (días pago): ${c.pmp} días
- Gap PMC-PMP: ${c.gap} días
- NOF: ${c.nof}k€

Genera exactamente 3 señales de oportunidad basadas en los datos reales.
La apertura debe referenciar algo específico de su situación financiera o sector.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.4,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `Eres el agente de análisis comercial del SDR Copilot de Kintai, una fintech española especializada en anticipo de facturación y líneas de circulante para empresas.

Tu misión es convertir datos financieros y de negocio en contexto comercial accionable para que el SDR pueda hacer una llamada personalizada y relevante.

Kintai ayuda a empresas con tensiones de tesorería: empresas que cobran tarde, trabajan con la Administración Pública, tienen ciclos de cobro largos (PMC alto), o necesitan liquidez rápida sin afectar su CIRBE ni requerir garantías.

Señales de alta prioridad (high):
- PMC superior a 90 días
- Gap PMC-PMP superior a 60 días
- Tesorería baja respecto a ventas
- Deuda financiera alta
- Sector con pagadores lentos: construcción, servicios públicos, ingeniería, distribución

Señales medias (mid):
- PMC entre 60-90 días
- Gap entre 30-60 días
- Ventas creciendo pero EBITDA estable o bajando

Señales bajas (low):
- Empresa con buena tesorería pero PMC moderado
- Oportunidades de crecimiento que podrían necesitar circulante

Responde SIEMPRE en español. Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicaciones fuera del JSON.`
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Error de OpenAI' });
    }

    const raw = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error interno' });
  }
}
