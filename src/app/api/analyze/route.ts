import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert medical aesthetics photography analyst. You analyze before & after patient photos for medical spas, dermatology, and plastic surgery practices.

When analyzing photos, evaluate:

1. **PHOTO QUALITY ASSESSMENT**
   - Lighting consistency between both photos (score 1-10)
   - Camera angle/position consistency (score 1-10)
   - Face framing and centering (score 1-10)
   - Background consistency (score 1-10)
   - Overall photo quality (score 1-10)

2. **LIGHTING ANALYSIS**
   - Direction of primary light source in each photo
   - Presence of shadows on the face
   - Color temperature consistency
   - Recommendations for better lighting next time

3. **POSITIONING ANALYSIS**
   - Face angle comparison between photos
   - Head tilt comparison
   - Distance from camera consistency
   - Tips for better alignment

4. **VISIBLE CHANGES** (describe objectively, never diagnose)
   - Skin texture differences
   - Skin tone/color changes
   - Visible contour or volume changes
   - Any observable differences between the two photos

5. **RECOMMENDATIONS**
   - How to improve photo consistency for better comparisons
   - Suggested camera settings or positioning adjustments
   - Lighting setup recommendations

Format with clear sections and scores. Be professional, objective, and helpful.
Important: Never make medical claims or diagnoses. Only describe visual observations.`;

export async function POST(req: NextRequest) {
  try {
    const { beforePhoto, afterPhoto } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI analysis is not configured. Please set the GEMINI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    if (!beforePhoto || !afterPhoto) {
      return NextResponse.json(
        { error: "Both photos required" },
        { status: 400 }
      );
    }

    // Extract base64 data from data URLs
    const beforeBase64 = beforePhoto.split(",")[1];
    const afterBase64 = afterPhoto.split(",")[1];

    const analysis = await analyzeWithGemini(apiKey, beforeBase64, afterBase64);

    return NextResponse.json({ analysis });
  } catch (err: any) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: err.message || "Analysis failed" },
      { status: 500 }
    );
  }
}

async function analyzeWithGemini(
  apiKey: string,
  beforeBase64: string,
  afterBase64: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts: [
            {
              text: "Please analyze these two patient photos. The first image is the BEFORE photo, and the second is the AFTER photo. Provide a comprehensive analysis covering photo quality, lighting, positioning, and any visible changes.",
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: beforeBase64,
              },
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: afterBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 429) {
      throw new Error("AI analysis quota exceeded. Please wait a minute and try again, or enable billing on your Google AI project for unlimited access.");
    }
    if (response.status === 403) {
      throw new Error("API key is invalid or does not have access to Gemini. Please check your GEMINI_API_KEY in Railway.");
    }
    throw new Error(`AI analysis failed (error ${response.status}). Please try again.`);
  }

  const data = await response.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "No analysis generated."
  );
}
