// server.js
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

// Health check
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Molecule Mutation backend (chat) is running.",
  });
});

// Main mutation analysis endpoint
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
            "You MUST respond with a single JSON object only, no extra text. " +
            "The JSON must have exactly these fields:\n" +
            "  - summary (string)\n" +
            "  - key_changes (object) with fields:\n" +
            "      reactivity, acidity_basicity, sterics, electronics, intermediate_stability (all strings)\n" +
            "  - mechanisms (object) with fields: before, after, comparison (all strings)\n" +
            "  - example_reactions (array of objects), each with:\n" +
            "      description, before_mutation_outcome, after_mutation_outcome (strings)\n" +
            "  - explanation_levels (object) with fields: simple, detailed (strings)\n" +
            "Do not include any fields other than those listed above.",
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
      // Simpler JSON mode – no schema validator, but guarantees a JSON object
      response_format: {
        type: "json_object",
      },
    });

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("No content returned from OpenAI.");
    }

    let data;
    try {
      data = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error("JSON parse error from model:", parseErr, "Raw:", rawContent);
      throw new Error(
        "Failed to parse JSON from model in json_object mode."
      );
    }

    return res.json(data);
  } catch (err) {
    console.error(
      "Mutation analysis error:",
      err?.response?.data || err.message || err
    );

    return res.status(500).json({
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

