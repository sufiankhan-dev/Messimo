import { NextResponse } from "next/server";
import { checkOllamaConnection } from "@/lib/ai/ollama";

export async function GET() {
  const status = await checkOllamaConnection();

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
