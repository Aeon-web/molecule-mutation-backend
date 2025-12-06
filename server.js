import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.json({ ok: true, message: "Molecule Mutation backend is running." });
});

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
        "Given a base molecule and a structural mutation, explain how the change affects reactivity, acidity/basicity, steric effects, electronics, and intermediate stability. Compare mechanisms before/after. Respond ONLY in JSON matching the schema.",

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

      // ✅ CORRECT NEW SYNTAX
      text: {
        format: "json_schema",
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
            },
            mechanisms: {
              type: "object",
              properties: {
                before: { type: "string" },
                after: { type: "string" },
                comparison: { type: "string" },
              },
              required: ["before", "after", "comparison"],
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
              },
            },
            explanation_levels: {
              type: "object",
              properties: {
                simple: { type: "string" },
                detailed: { type: "string" },
              },
              required: ["simple", "detailed"],
            },
          },
          required: [
            "summary",
            "key_changes",
            "mechanisms",
            "example_reactions",
            "explanation_levels",
          ],
        },
        strict: true,
      },
    });

    const data = JSON.parse(response.output_text);
    res.json(data);

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

