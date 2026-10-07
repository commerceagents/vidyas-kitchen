import OpenAI from "openai";
import { graphGet } from "./meta-whatsapp";

/**
 * WhatsApp voice notes → text for the same conversational agent path.
 * Uses Meta media download + OpenAI Whisper (English/Tamil mix).
 */
export async function transcribeWhatsAppAudio(mediaId: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !mediaId) return null;

  const meta = await graphGet(mediaId);
  if (!meta.ok) return null;

  const url = (meta.data as { url?: string })?.url;
  if (!url) return null;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;

  try {
    const audioRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!audioRes.ok) return null;
    const buffer = Buffer.from(await audioRes.arrayBuffer());
    if (buffer.length < 100) return null;

    const openai = new OpenAI({ apiKey });
    const file = new File([buffer], "voice.ogg", { type: "audio/ogg" });
    const result = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
    });
    const text = String(result.text || "").trim();
    return text.length >= 2 ? text : null;
  } catch (err) {
    console.error("[WA voice] transcribe failed:", err);
    return null;
  }
}
