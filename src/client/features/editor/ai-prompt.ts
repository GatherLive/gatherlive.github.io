const QUIZ_SCHEMA = `Valid file example and default settings:
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
- pin: image is required. Use answerRegion={"shape":"box","x":0.5,"y":0.5,"width":0.2,"height":0.2}; x/y are the area centre and width/height are fractions of the image. Pins inside the area are correct. Use box by default; circle uses a bounding ellipse, sized to look round on the image. The host can draw or adjust the area visually.
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
- chatMode: off; lobby (before play); breaks (lobby and between questions/rounds); rounds (lobby and round breaks). chatReplies and chatReactions control replies and emoji reactions. chatMentions=true lets participants mention others; default false. Only the host can mention @all. Chat needs host access and closes during countdowns, questions and after the quiz ends.`;

const LIVE_GAME_SCHEMA = `Live game options, when I request them:
- Enable the player stage with settings.game={"reveal":"all","revealDelay":3}. Use reveal="all" for a single reveal, "turns" for manual turns, or "auto" for timed turns. revealDelay is 1–30 whole seconds between automatic reveals. The default is 3.
- Optional lives use settings.competition={"lives":3,"livesReset":"game"}. Choose 1–12 lives. Use livesReset="round" to restore lives each round. With lives enabled, games show winners and remaining hearts.
- Don’t Repeat Each Other uses type="short_answer" or "open_ended", points=0, and competition={"mode":"unique","reveal":"all","publicAnswers":true}. Give a prompt with many valid short answers. Omit a fixed answer key.
- Don’t Say the Same Thing as Me uses a text or single-choice question, points=0, and competition={"mode":"avoid-host","reveal":"all","publicAnswers":true,"secretAnswer":"answer"}. Use text for a text question and the option ID for a choice question. The host-only answer stays in the file.
- For teams, put teams inside settings.competition. Example {"a":1,"b":7,"assignment":"pick","scoring":"elimination","sharedLives":false}. Use positive capacities totaling up to 500, assignment "auto" or "pick", and scoring "points" or "elimination". Shared lives apply to elimination teams.
- Review notes and accepted or rejected responses are added by the host during play. Keep them out of the quiz file.`;

export const AI_QUIZ_PROMPT=`Help me make a quiz for Gather: https://gatherlive.github.io/
Use short, simple words in our conversation and in the quiz.

First use what I have already told you. If needed, ask up to 3 short questions together about topic and difficulty, question count and format, and whether I want Quiz or Live game. Wait for my reply if you ask questions. Use the defaults below for optional settings I do not choose.

Then create a downloadable UTF-8 file named quiz.json. If you cannot attach a file, return only the JSON, with no Markdown, code fences or extra text. Use the exact field names below. Check facts, answer keys, IDs and round assignments before returning it. Ask if unsure of a fact. Keep questions clear, wrong answers believable and explanations brief. Use only supplied or verified direct HTTPS image URLs; otherwise leave image empty.

Apply my preferred time and points consistently across scored questions. Use a different value when I request it for a specific question or format.

${QUIZ_SCHEMA}

${LIVE_GAME_SCHEMA}

Live tools: Hosts can send announcements such as "Quiz starting in {20} minutes". One countdown is allowed per announcement, from 1 to 60 whole minutes; it does not start the quiz automatically. Announcements, messages, mention recipients, participant data and results are created during play. Do not add them or invented settings to the quiz JSON.
Return the finished quiz file when ready.`;

export const AI_SELF_STUDY_PROMPT = `Make me a practice quiz for Gather. Keep our conversation short and avoid spoilers.

Use what I have already told you. If anything is missing, ask up to three short questions together:
1. What topic or material am I studying? Ask me to upload or paste the resources if I want you to use them.
2. How many questions and which formats do I want? Suggest suitable formats if I am unsure.
3. What difficulty and time per question should I use? Offer reasonable defaults.

Wait for the answers if you ask. If I provide sources, base the quiz on them and ask about any gaps. Write a brief explanation for each scored answer. Keep the title and description free of spoilers. Do not preview the questions, correct answers or explanations in the conversation.

Build an ordinary Gather quiz object in memory using this schema:

${QUIZ_SCHEMA}

Use the same time and points across scored practice questions unless I request different values. Keep the quiz playable in Solo play with the ordinary question formats above.

Return a downloadable UTF-8 file named solo-quiz.json. When you can run code, encode the quiz object as UTF-8 JSON using unpadded URL-safe Base64, then write it inside this exact wrapper:
{"format":"gather.self-study","version":1,"encoding":"base64url","payload":"<encoded quiz>"}

For example, in Python:
import base64, json
payload = base64.urlsafe_b64encode(json.dumps(quiz, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode("ascii").rstrip("=")
with open("solo-quiz.json", "w", encoding="utf-8") as file:
    json.dump({"format": "gather.self-study", "version": 1, "encoding": "base64url", "payload": payload}, file)

Verify the file decodes to the complete quiz, with valid answer keys, IDs and round assignments. Do not invent Base64 by hand. If you cannot encode the quiz, use {"format":"gather.self-study","version":1,"quiz":<ordinary Gather quiz object>} as the file instead. If you cannot attach a file, give only the complete wrapper JSON so I can save it without reading the contents. Keep the finished file under 4 MB.

Gather hides questions in the editor until I choose to reveal them. I can open a room with Host and choose Solo play or Group play in room Settings.`;
