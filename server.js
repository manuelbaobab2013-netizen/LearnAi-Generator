import express from "express";

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.json({
    status: "LearnAI Generator backend is running"
  });
});

app.post("/generate", async (req, res) => {
  try {
    const {
      type,
      subject,
      grade,
      topic,
      instructions
    } = req.body || {};

    if (!type || !subject || !grade) {
      return res.status(400).json({
        error: "Type, subject, and grade are required."
      });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!openaiKey && !geminiKey) {
      return res.status(500).json({
        error: "No AI provider is connected."
      });
    }

    const prompt = `
You are LearnAI Generator.

Create high-quality educational material for a school student.

Type: ${type}
Subject: ${subject}
Grade: ${grade}
Topic: ${topic || "General"}
Extra instructions: ${instructions || "None"}

Make the material clear, accurate, age-appropriate and well organized.
Do not invent facts.
`;

    let answer = null;
    let provider = null;

    // OpenAI
    if (openaiKey) {
      try {
        const response = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model: "gpt-5.6-luna",
              instructions: prompt,
              input: `Create the requested ${type}.`,
              max_output_tokens: 1200
            })
          }
        );

        const data = await response.json();

        if (response.ok) {
          answer = data?.output_text || "";

          if (
            !answer &&
            Array.isArray(data?.output)
          ) {
            answer = data.output
              .flatMap(item =>
                Array.isArray(item.content)
                  ? item.content
                  : []
              )
              .filter(item =>
                item.type === "output_text"
              )
              .map(item => item.text || "")
              .join("");
          }

          if (answer) {
            provider = "OpenAI";
          }
        } else {
          console.error("OpenAI error:", data);
        }
      } catch (error) {
        console.error("OpenAI connection error:", error);
      }
    }

    // Gemini backup
    if (!answer && geminiKey) {
      try {
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text:
                        prompt +
                        "\n\nCreate the requested material now."
                    }
                  ]
                }
              ],
              generationConfig: {
                maxOutputTokens: 1200
              }
            })
          }
        );

        const data = await response.json();

        if (response.ok) {
          answer =
            data?.candidates?.[0]?.content?.parts
              ?.map(part => part.text || "")
              .join("") || "";

          if (answer) {
            provider = "Gemini";
          }
        } else {
          console.error("Gemini error:", data);
        }
      } catch (error) {
        console.error("Gemini connection error:", error);
      }
    }

    if (!answer) {
      return res.status(503).json({
        error: "The AI Generator is temporarily unavailable."
      });
    }

    return res.status(200).json({
      answer,
      provider
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      error: "Generator backend error."
    });
  }
});

app.listen(PORT, () => {
  console.log(`LearnAI Generator running on port ${PORT}`);
});
