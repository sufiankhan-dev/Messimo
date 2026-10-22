/**
 * Small, honest description of the configured Ollama model.
 *
 * Messimo does not read model metadata beyond the installed name, so only
 * known tags get a size or parameter claim. Any other configured model is
 * described generically instead of inheriting `gemma3:4b` details.
 */

export interface OllamaModelInfo {
  /** Human-readable model family. */
  family: string;
  /** Parameter count when it is known for this exact tag. */
  parameters: string | null;
  /** Quantization when it is known for this exact tag. */
  quantization: string | null;
  /** Approximate download size when it is known for this exact tag. */
  approximateSize: string | null;
  /** One line suitable for a settings card. */
  summary: string;
}

interface KnownModelDetails {
  family: string;
  parameters: string;
  quantization: string;
  approximateSize: string;
}

const KNOWN_MODELS: Record<string, KnownModelDetails> = {
  "gemma3:4b": {
    family: "Gemma 3",
    parameters: "4B",
    quantization: "Q4_K_M",
    approximateSize: "about 3.4 GB",
  },
};

function inferFamily(model: string): string {
  if (model.startsWith("gemma3")) return "Gemma 3";
  if (model.startsWith("gemma")) return "Gemma";
  return "Configured local instruction model";
}

export function describeOllamaModel(model: string): OllamaModelInfo {
  const normalized = model.trim().toLowerCase();
  const known = KNOWN_MODELS[normalized];
  const family = inferFamily(normalized);

  if (!known) {
    return {
      family,
      parameters: null,
      quantization: null,
      approximateSize: null,
      summary: `${family} · model details depend on the installed tag`,
    };
  }

  return {
    family: known.family,
    parameters: known.parameters,
    quantization: known.quantization,
    approximateSize: known.approximateSize,
    summary: `${known.family} · ${known.parameters} parameters · ${known.quantization}`,
  };
}
