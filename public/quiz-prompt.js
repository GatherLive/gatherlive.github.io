export const AI_QUIZ_PROMPT=`Create an importable quiz for Gather: https://gatherlive.github.io/
First ask me about topic, audience/difficulty, question count/types, timers, scoring, optional image URLs, rounds/rewards, and chat. Wait for my answers, then create a downloadable UTF-8 .json file (no Markdown inside it). Check facts and answer keys; ask if uncertain. Do not invent image URLs.

Format example:
{"format":"gather.quiz","version":1,"title":"My quiz","description":"","collection":"","questions":[{"id":"q1","type":"single","prompt":"Question?","image":"","timeLimit":20,"points":1000,"explanation":"","options":[{"id":"a","text":"Correct","image":""},{"id":"b","text":"Other","image":""}],"correct":["a"]}],"settings":{"scoring":"accuracy","questionDelay":3,"showQuestionType":false,"showAnswerOptions":true,"shuffleQuestions":false,"shuffleOptions":false,"allowLateJoin":true,"showLeaderboard":true,"participantLimit":0,"roundsEnabled":false,"rounds":[],"chatMode":"off","chatReplies":true,"chatReactions":true}}

Rules: 1–500 questions. Unique question/option IDs. Timers 1–600 seconds; points 0, 1000 or 2000. image is empty or a real HTTPS image URL (questions and options support images). explanation appears after reveal.
Types:
- single / true_false: options and exactly one correct option ID; true_false has two options.
- multi: options, correct contains every correct option ID.
- order: options, correct contains every option ID in the right order.
- short_answer: acceptedAnswers=["answer","alternative"].
- slider: numeric min,max,target,tolerance (absolute units).
- pin: required image; target={"x":0.5,"y":0.5}, tolerance=0.1 (image coordinates 0–1).
- poll: options, no correct; word_cloud / open_ended / slide: no answer key. These four types use points=0.
Only include fields relevant to the type. Scoring: accuracy gives equal correct-answer points; speed rewards faster server-received answers. participantLimit=0 means unlimited; questionDelay=0–30 seconds. showQuestionType=true shows only the upcoming question format during the countdown, never its content. showAnswerOptions defaults to true; false shows only matching letter buttons to participants for choice questions (they read choices on the host’s screen).
For multiple rounds set roundsEnabled=true and rounds=[{"id":"r1","title":"Round 1","reward":"Optional reward","questionIds":["q1"]}]. Assign every question exactly once. Round scores reset; ties can be resolved by the host's random draw.
chatMode: off, lobby, breaks (between questions/rounds), or rounds (lobby/round breaks). Replies and emoji reactions are optional. Chat always closes during countdowns and questions. Hosts can also send live announcements.
Return the finished JSON file for import into Gather.`;
