const express = require("express");
const Aki = require("aki-api");
const app = express();
const port = 3000;

app.use(express.json());

const sessions = {};
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 دقائق

function cleanUpSessions() {
  const now = Date.now();
  for (const userId in sessions) {
    if (now - sessions[userId].lastActive > SESSION_TIMEOUT) {
      delete sessions[userId];
    }
  }
}
// تنظيف الجلسات كل 5 دقائق
setInterval(cleanUpSessions, 5 * 60 * 1000);

app.post("/start", async (req, res) => {
  const userId = req.body.userId;
  if (!userId) return res.status(400).send({ error: "userId is required" });

  const aki = new Aki({ region: "ar" });

  try {
    await aki.start();
    sessions[userId] = { aki, lastActive: Date.now() };

    res.send({
      question: aki.question,
      answers: aki.answers,
      step: aki.currentStep
    });
  } catch (error) {
    res.status(500).send({ error: "فشل بدء اللعبة", details: error.message });
  }
});

app.post("/answer", async (req, res) => {
  const { userId, answerIndex } = req.body;
  const session = sessions[userId];
  if (!session) return res.status(404).send({ error: "لا توجد جلسة لهذا المستخدم" });

  const { aki } = session;

  if (typeof answerIndex !== "number" || answerIndex < 0 || answerIndex >= aki.answers.length) {
    return res.status(400).send({ error: "مؤشر إجابة غير صالح" });
  }

  try {
    await aki.step(answerIndex);
    session.lastActive = Date.now();

    if (aki.progress >= 80) {
      await aki.win();
      const topGuess = aki.answers[0];

      delete sessions[userId]; // حذف الجلسة بعد الانتهاء

      return res.send({
        finished: true,
        name: topGuess.name,
        description: topGuess.description,
        image: topGuess.absolute_picture_path,
        attempts: aki.currentStep
      });
    }

    res.send({
      question: aki.question,
      answers: aki.answers,
      step: aki.currentStep
    });
  } catch (error) {
    res.status(500).send({ error: "خطأ في إرسال الإجابة", details: error.message });
  }
});

app.get("/guess", async (req, res) => {
  const userId = req.query.userId;
  const session = sessions[userId];
  if (!session) return res.status(404).send({ error: "لا توجد جلسة لهذا المستخدم" });

  const { aki } = session;

  try {
    await aki.win();
    const topGuess = aki.answers[0];

    delete sessions[userId]; // حذف الجلسة بعد الانتهاء

    res.send({
      name: topGuess.name,
      description: topGuess.description,
      image: topGuess.absolute_picture_path,
      attempts: aki.currentStep
    });
  } catch (error) {
    res.status(500).send({ error: "فشل في جلب التخمين", details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Akinator API is running on port ${port}`);
});
