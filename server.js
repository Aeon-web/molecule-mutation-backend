import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/mutation-analysis", async (req, res) => {
  const { base_molecule, mutation, question } = req.body;

  if (!base_molecule || !mutation) {
    return res.status(400).json({ error: "base_molecule and mutation are required." });
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions:
        "You are an expert organic chemist tutoring students. " +
        "Given a base molecule and a mutation, explain how the mutation changes reactivity, " +
        "stability, acidity/basicity, steric and electronic effects, and likely mechanisms. " +
        "Focus on qualitative trends, not exact numerical values. Respond ONLY in valid JSON.",
      input: [
        {
          role: "user",
          content: JSON.stringify({
            task: "analyze_molecule_mutation",
            base_molecule,
            mutation,
            question: question || ""
          })
        }
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
                  intermediate_stability: { type: "string" }
                },
                required: [
                  "reactivity",
                  "acidity_basicity",
                  "sterics",
                  "electronics",
                  "intermediate_stability"
                ],
                additionalProperties: false
              },
              mechanisms: {
                type: "object",
                properties: {
                  before: { type: "string" },
                  after: { type: "string" },
                  comparison: { type: "string" }
                },
                required: ["before", "after", "comparison"],
                additionalProperties: false
              },
              example_reactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    before_mutation_outcome: { type: "string" },
                    after_mutation_outcome: { type: "string" }
                  },
                  required: ["description", "before_mutation_outcome", "after_mutation_outcome"],
                  additionalProperties: false
                }
              },
              explanation_levels: {
                type: "object",
                properties: {
                  simple: { type: "string" },
                  detailed: { type: "string" }
                },
                required: ["simple", "detailed"],
                additionalProperties: false
              }
            },
            required: ["summary", "key_changes", "mechanisms", "example_reactions", "explanation_levels"],
            additionalProperties: false
          },
          strict: true
        }
      }
    });

    const text = response.output[0].content[0].text;
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    console.error("Mutation analysis error:", err);
    res.status(500).json({ error: "Failed to analyze mutation." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Molecule Mutation backend on port ${PORT}`));
