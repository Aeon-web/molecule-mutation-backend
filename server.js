import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";
import axios from "axios"; // ✅ NEW: for calling RDKit API

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ NEW: point this to your live RDKit Render URL
// Example: "https://molecule-rdkit-api.onrender.com"
const RDKIT_API = "https://YOUR-RDKIT-SERVICE.onrender.com";

/**
 * ✅ Helper: validate a SMILES string using your RDKit microservice
 * Returns: { valid: boolean, canonical_smiles?: string, error?: string }
 */
async function validateSmiles(smiles) {
  if (!smiles || typeof smiles !== "string") {
    return { valid: false, error: "No SMILES provided" };
  }

  try {
    const response = await axios.post(`${RDKIT_API}/validate-smiles`, {
      smiles,
    });
    return response.data;
  } catch (err) {
    console.error("RDKit API Error:", err.message);
    return { valid: false, error: "RDKit service error" };
  }
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Molecule Mutation backend (chat) is running.",
  });
});

app.post("/api/mutation-analysis", async (req, res) => {
  const { base_molecule, mutation, question } = req.body || {};

  if (!base_molecule || !mutation) {
    return res
      .status(400)
      .json({ error: "base_molecule and mutation are required." });
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert organic chemistry tutor. " +
            "Given a base molecule and a structural mutation, you MUST:\n" +
            "1) Explain qualitatively how this affects: reactivity, acidity/basicity, steric effects, electronic effects, and stability of intermediates.\n" +
            "2) Compare likely mechanisms before and after the mutation, and give at least one concrete example reaction.\n" +
            "3) Provide IUPAC names for the molecule before and after the mutation (best reasonable guess; if ambiguous, say so in notes).\n" +
            "4) Provide a best-guess SMILES for the main product after the mutation, and if possible a SMILES guess for the starting molecule. " +
            "Return these in a 'structures' object with keys: base_smiles_guess, mutated_smiles_guess, notes.\n" +
            "Assume the user is at undergraduate organic chemistry level. " +
            "Respond ONLY with valid JSON that matches the provided JSON schema.",
        },
        {
          role: "user",
          content: JSON.stringify({
            base_molecule,
            mutation,
            question: question || "",
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mutation_analysis",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },

              key_changes: {
                type: "object",
                properties: {
                  reactivity: { type: "string" },
                  acidity_basicity: { type: "string" },
                  sterics: { type: "string" },
                  electronics: { type: "string" },
                  intermediate_stability: { type: "string" },
                },
                required: [
                  "reactivity",
                  "acidity_basicity",
                  "sterics",
                  "electronics",
                  "intermediate_stability",
                ],
                additionalProperties: false,
              },

              mechanisms: {
                type: "object",
                properties: {
                  before: { type: "string" },
                  after: { type: "string" },
                  comparison: { type: "string" },
                },
                required: ["before", "after", "comparison"],
                additionalProperties: false,
              },

              example_reactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    before_mutation_outcome: { type: "string" },
                    after_mutation_outcome: { type: "string" },
                  },
                  required: [
                    "description",
                    "before_mutation_outcome",
                    "after_mutation_outcome",
                  ],
                  additionalProperties: false,
                },
              },

              explanation_levels: {
                type: "object",
                properties: {
                  simple: { type: "string" },
                  detailed: { type: "string" },
                },
                required: ["simple", "detailed"],
                additionalProperties: false,
              },

              // IUPAC names for before / after mutation
              iupac_names: {
                type: "object",
                properties: {
                  before: { type: "string" },
                  after: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["before", "after", "notes"],
                additionalProperties: false,
              },

              // Predicted structures (SMILES)
              structures: {
                type: "object",
                properties: {
                  base_smiles_guess: { type: "string" },
                  mutated_smiles_guess: { type: "string" },
                  notes: { type: "string" },
                },
                required: [
                  "base_smiles_guess",
                  "mutated_smiles_guess",
                  "notes",
                ],
                additionalProperties: false,
              },
            },
            required: [
              "summary",
              "key_changes",
              "mechanisms",
              "example_reactions",
              "explanation_levels",
              "iupac_names",
              "structures",
            ],
          },
          strict: true,
        },
      },
    });

    const raw = completion.choices[0].message.content;
    const data = JSON.parse(raw);

    // ✅ NEW: pull the AI's mutated SMILES guess
    const mutatedSmilesGuess = data?.structures?.mutated_smiles_guess || null;
    const baseSmilesGuess = data?.structures?.base_smiles_guess || null;

    // ✅ NEW: validate mutated SMILES via RDKit
    const rdkitResult = await validateSmiles(mutatedSmilesGuess);

    // If RDKit says it's invalid, return a 400 with details,
    // but still include the original AI analysis so the user can see it.
    if (!rdkitResult.valid) {
      return res.status(400).json({
        ok: false,
        error: "RDKit rejected the mutated SMILES prediction.",
        rdkit_error: rdkitResult.error,
        ai_structures: data.structures,
        analysis: {
          summary: data.summary,
          key_changes: data.key_changes,
          mechanisms: data.mechanisms,
          example_reactions: data.example_reactions,
          explanation_levels: data.explanation_levels,
          iupac_names: data.iupac_names,
        },
      });
    }

    // ✅ If valid, attach canonical SMILES and return everything
    const responsePayload = {
      ok: true,
      canonical_structures: {
        mutated_smiles_canonical: rdkitResult.canonical_smiles,
        base_smiles_guess: baseSmilesGuess,
      },
      ai_structures: data.structures,
      summary: data.summary,
      key_changes: data.key_changes,
      mechanisms: data.mechanisms,
      example_reactions: data.example_reactions,
      explanation_levels: data.explanation_levels,
      iupac_names: data.iupac_names,
    };

    res.json(responsePayload);
  } catch (err) {
    console.error("Mutation analysis error:", err);

    res.status(500).json({
      error: "Failed to analyze mutation.",
      message:
        err?.response?.data?.error?.message ||
        err.message ||
        "Unknown server error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Molecule Mutation backend listening on port ${PORT}`);
});
