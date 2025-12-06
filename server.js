import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple health check
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Molecule Mutation backend is running." });
});

/**
 * POST /api/mutation-analysis
 * Body: {
 *   base_molecule: string,
 *   mutation: string,
 *   question?: string
 * }
 */
app.post("/api/mutation-analysis", async (req, res) => {
  const { base_molecule, mutation, question } = req.body || {};

  if (!base_molecule || !mutation) {
    return res
      .status(400)
      .json({ error: "base_molecule and mutation are required." });
  }

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions:
        "You are an expert organic chemistry tutor. " +
        "Given a base molecule and a structural mutation, you explain qualitatively how this affects: " +
        "reactivity, acidity/basicity, steric effects, electronic effects, and stability of intermediates. " +
        "You also compare likely mechanisms before and after the mutation, and give at least one concrete example reaction. " +
        "Assume the user is at undergraduate organic chemistry level. " +
        "Respond ONLY with valid JSON that matches the provided JSON schema.",
      input: [
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
            },
            required: [
              "summary",
              "key_changes",
              "mechanisms",
              "example_reactions",
              "explanation_levels",
            ],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    // Extract the JSON string from the response and parse it
    const text = response.output[0].content[0].text;
    const data = JSON.parse(text);

    res.json(data);
  } catch (err) {
    console.error("Mutation analysis error:", err?.response?.data || err);
    res.status(500).json({
      error: "Failed to analyze mutation.",
      details: err?.message || "Unknown error",
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Molecule Mutation backend listening on port ${PORT}`);
});

