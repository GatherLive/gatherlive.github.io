export const AI_QUIZ_PROMPT=`Help me make a quiz for Gather: https://gatherlive.github.io/
Use short, simple words in our conversation and in the quiz.

First use what I have already told you. If needed, ask up to 3 short questions in one message: topic and audience/difficulty; question count and types; any special timing, images, rounds/rewards or chat. Wait for my reply if you ask questions. Use the defaults below for optional settings I do not choose.

Then create a downloadable UTF-8 file named quiz.json. If you cannot attach a file, return only the JSON, with no Markdown, code fences or extra text. Use the exact field names below. Check facts, answer keys, IDs and round assignments before returning it. Ask if unsure of a fact. Keep questions clear, wrong answers believable and explanations brief. Use only supplied or verified direct HTTPS image URLs; otherwise leave image empty.

Valid file example and default settings:
{"format":"gather.quiz","version":1,"title":"General knowledge","description":"","tags":[],"questions":[{"id":"q1","type":"single","prompt":"Which planet is closest to the Sun?","image":"","timeLimit":20,"points":1000,"explanation":"Mercury is the closest planet to the Sun.","options":[{"id":"a","text":"Mercury","image":""},{"id":"b","text":"Venus","image":""}],"correct":["a"]}],"settings":{"scoring":"accuracy","questionDelay":3,"showQuestionType":false,"showAnswerOptions":true,"shuffleQuestions":false,"shuffleOptions":false,"shuffleTrueFalse":false,"allowLateJoin":true,"showLeaderboard":true,"participantLimit":0,"roundsEnabled":false,"rounds":[],"chatMode":"off","chatReplies":true,"chatReactions":true,"chatMentions":false}}

Question rules:
- 1–500 questions. Unique question IDs; unique option IDs within each question. Use real JSON values, no comments or trailing commas. Keep the file under 4 MB.
- Each question has id, type, prompt, image, timeLimit, points and explanation. Timers: 5–300 whole seconds. Points: 0, 1000 or 2000. Explanations appear after reveal.
- Choice questions have 2–8 options with id, text and image. Each option needs text or an image.
- single: exactly one correct option ID in correct.
- true_false: exactly two options, True and False, with one correct ID in correct.
- multi: correct lists all correct option IDs, at least one.
- order: list options in their correct order; correct lists every option ID in that same order. Gather shuffles them during play.
- short_answer: acceptedAnswers=["answer","alternative"], 1–30 nonempty answers. Matching ignores case and surrounding spaces.
- slider: numeric min, max, target and tolerance. min and max must be between -1000000000 and 1000000000, with min < max; target is within the range; tolerance is an absolute distance from 0 to max-min.
- pin: image is required; target={"x":0.5,"y":0.5} uses image coordinates from 0 to 1; tolerance is a radius in image units, from 0.01 to 1 (default 0.1).
- poll: options, no answer key. word_cloud, open_ended and slide: no options or answer key. These four types use points=0.
Include only fields that apply to the question type. Limits in characters: title 120, each tag 80 (up to 12), description/explanation 2000, prompt 1000, option text 500, each accepted answer 200.

Organisation: use a short tags array for topics or groups, such as ["Science","Year 8"]. Tags are optional.

Game settings:
- scoring: accuracy gives full question points for a correct answer; speed gives more points for faster correct answers.
- questionDelay: 0–30 whole seconds before each question; 0 turns it off. showQuestionType shows the upcoming format during this countdown.
- showAnswerOptions=false shows matching letter buttons to participants for choice questions; they read the choices on the host screen.
- shuffleQuestions shuffles questions within each round when rounds are enabled. shuffleOptions shuffles answer choices. True/False choices also require shuffleTrueFalse=true.
- allowLateJoin allows joining after play starts. showLeaderboard controls participant leaderboards. participantLimit is a whole number from 0 to your account allowance (500 by default); 0 uses your account allowance.
- For rounds, set roundsEnabled=true and rounds=[{"id":"r1","title":"Round 1","reward":"Optional reward","questionIds":["q1"]}]. Use 1–100 rounds with unique IDs, titles up to 80 characters and rewards up to 200. Each round needs a question; assign every question exactly once. Scores reset between rounds; hosts can resolve ties with a random draw.
- chatMode: off; lobby (before play); breaks (lobby and between questions/rounds); rounds (lobby and round breaks). chatReplies and chatReactions control replies and emoji reactions. chatMentions=true lets participants mention others; default false. Only the host can mention @all. Chat needs host access and closes during countdowns, questions and after the quiz ends.

Live tools: Hosts can send announcements such as "Quiz starting in {20} minutes". One countdown is allowed per announcement, from 1 to 60 whole minutes; it does not start the quiz automatically. Announcements, messages, mention recipients, participant data and results are created during play. Do not add them or invented settings to the quiz JSON.
Return the finished quiz file when ready.`;
