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

// Simple health check
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
            "Given a base molecule and a structural mutation, explain qualitatively how this affects: " +
            "reactivity, acidity/basicity, steric effects, electronic effects, and stability of intermediates. " +
            "Compare likely mechanisms before and after the mutation, and give at least one concrete example reaction. " +
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
      },
    });

    const rawContent = completion.choices[0]?.message?.content;

    // content should already be valid JSON (string) because of response_format
    const data = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;

    return res.json(data);
  } catch (err) {
    console.error("Mutation analysis error:", err?.response?.data || err);

    return res.status(500).json({
      error: "Failed to analyze mutation.",
      message:
        err?.response?.data?.error?.message ||
        err?.message ||
        "Unknown server error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Molecule Mutation backend listening on port ${PORT}`);
});

