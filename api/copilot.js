module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const c = req.body;
  const gap = (c.pmc||0) - (c.pmp||0);

  const prompt = `Eres un experto en prospección comercial para Kintai, una fintech española de financiación de circulante (anticipo de facturas y pagarés).

Analiza esta empresa y responde en JSON con exactamente estos campos:

- "actividad": 1-2 frases sobre A QUÉ SE DEDICA la empresa (su negocio principal)
- "tipo_cliente": 1-2 frases sobre QUIÉN SON SUS CLIENTES y cómo les pagan (B2B, B2C, Administración Pública, grandes corporaciones, plazos habituales de cobro)
- "caso_exito": Si conoces algún caso de éxito, cliente destacado o proyecto relevante de esta empresa, mencionarlo brevemente. Si no, pon null.
- "nota_comercial": 1-2 frases sobre por qué Kintai puede ayudarles específicamente, basándote en su PMC (${c.pmc} días), gap financiero (${gap} días), sector y modelo de negocio.
- "signals": array de 3-4 señales de oportunidad, cada una con: {"nivel":"high|mid|low","titulo":"título corto","descripcion":"explicación breve"}
- "apertura": texto de apertura de llamada personalizado para esta empresa (2-3 frases, tono profesional y directo)

Datos de la empresa:
- Nombre: ${c.name}
- Actividad: ${c.cnae}
- Sector: ${c.sector}
- Web: ${c.web||'no disponible'}
- Ciudad: ${c.city}, ${c.ccaa}
- Empleados: ${c.employees}
- Ventas: ${c.ventas}k€ (año ant: ${c.ventas_y1}k€)
- EBITDA: ${c.ebitda}k€
- Margen: ${c.margen}%
- PMC (días de cobro): ${c.pmc} días
- PMP (días de pago): ${c.pmp} días
- Gap PMC-PMP: ${gap} días
- Tesorería: ${c.tesoreria}k€
- NOF: ${c.nof}k€
- Deuda financiera: ${c.deuda}k€

Responde SOLO con el JSON, sin texto adicional.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'OpenAI error', detail: err });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '';
    text = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    
    try {
      const parsed = JSON.parse(text);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ resumen_negocio: text, signals: [], apertura: '' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
