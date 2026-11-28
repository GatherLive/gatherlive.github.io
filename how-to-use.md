# How to Use Gather (Live Quizzes)

Gather is a free live quiz website.
Hosts create quizzes. Participants join with a **6-digit code** and a name.
Participants do not need an account. Hosts need an account.

---

## Website Features

- Live quizzes with a room code.
- 11 question types.
- Images on questions and answers.
- Countdown timer and leaderboard.
- Speed or accuracy scoring.
- Single or multiple rounds with rewards.
- Live host announcements with optional 1–60 minute countdowns.
- A dismissible site news bar.
- Room chat with access applications or invitation codes, replies, emoji reactions and optional participant mentions.
- Save quiz sets, import/export JSON, copy an AI quiz prompt.
- Review detailed host analytics and download PDF, HTML or CSV results.
- Rejoin open rooms, close one room, or close all rooms.

---

## 1. Create an Account

1. Open the website.
2. Click **Host quiz**.
3. Sign in or create an account with your email and password.
4. By signing up, you agree to the **Terms and Conditions** and acknowledge the **Privacy Policy** linked beside the form.
5. After signing in, you will see **My quizzes**.

---

## 2. Create a New Quiz

1. Click **New quiz**.
2. The quiz editor opens.
3. Open **Quiz details** for the title, optional tags and description.
4. Open **Game settings** for scoring, participant limits, countdowns, shuffling, rounds and room chat.
5. Use the question editor below both sections to write questions.
6. Click **Add question** for more, then **Save**.

Each section has its own expand/collapse control. Opening one does not close the other, and the editor keeps your choice while you work.

Tips:

- **Sample quiz** loads an example quiz you can edit.
- **Import quiz** loads a quiz from a JSON file.
- **Export** downloads your quiz as a JSON file.
- **Host quiz prompt** asks an AI to create an editable Gather quiz. **Solo play prompt** asks about your topic or resources and creates a practice file. Import either file with **Import quiz**.
- Solo play files open with questions hidden. Choose **Show questions** if you want to edit them. Both formats support live hosting and private practice.
- Use the **duplicate** icon to copy a quiz.
- Use the **trash** icon to delete a quiz.

---

## 3. Add a Question

For each question, set:

- **Question type**
- **Time (seconds)** – answer time for that question, from `5` to `300`.
- **Points** – `No points`, `1,000`, or `2,000`.
- **Question text**
- **Question image** – optional. Paste an HTTPS image URL or upload a file. JPG, PNG or WebP, max 3 MB.
- **Answer choices** – add 2 to 8 answers.
  - Multiple choice and True/False: mark exactly one correct answer.
  - Multiple answers: mark one or more correct answers.
  - Poll: no correct answer.
  - Put in order: drag answers into the correct order.
- **Explanation** – optional text shown after the answer is revealed.

Turn on **Use these settings for new questions** to copy the current question’s time and points when you add a question. Use **Undo** and **Redo** in the editor toolbar to restore changes to questions, settings and rounds.

Special question settings:

- **Type an answer** – add accepted answers, one per line. Capital letters and extra spaces are ignored.
- **Number slider** – set Minimum, Maximum, Correct number and Accepted range (±).
- **Pin on image** – tap the image to place the correct dot. Choose **Circle** or **Box** for the accepted area. Drag its handles, use **Area size**, or press **+ / −** to resize it. Pins inside the area count as correct. The dot and area appear in the answer reveal and PDF/HTML reports.
- **Information slide** – shows text or an image, no answer needed.

Question types:

1. Multiple choice
2. Multiple answers
3. True or false
4. Type an answer
5. Poll
6. Put in order
7. Number slider
8. Word cloud
9. Open response
10. Pin on image
11. Information slide

Questions can be reordered, duplicated or deleted.

---

## 4. Quiz Details and Game Settings

Open either section independently in the editor.

### Quiz details

- **Title** – required.
- **Tags** – optional. Add up to 12 tags, then use the tag filters in My quizzes. Existing collections appear as tags.
- **Description** – optional.

### Game settings

**Participant limit** is a whole number; `0` uses your account limit (500 participants by default). Collapsing this section keeps your selected settings.

### Scoring

Choose one:

- **Speed + accuracy** – correct answers earn more points when answered faster. Points go down to 50% as time runs out.
- **Accuracy only (equal points)** – every correct answer earns the full question points.

Poll, Word cloud, Open response and Slide questions give **no points**.

### Question Countdown (seconds)

This is a short pause **before each question starts**, from `0` to `30` seconds.

- `0` = no countdown.
- Example: `3` = players see "Get ready" for 3 seconds before the question.
- The answer time is set separately in each question's **Time (seconds)**.

### Other Settings

- **Shuffle questions**
- **Shuffle answers**
- **Shuffle True/False answers** – also enable **Shuffle answers**.
- **Allow late joins**
- **Show leaderboard**
- **Question type hint**
- **Show answer choices on participant screens** – turn off if players should only see choices on the host screen.
- **Multiple rounds**

### Multiple Rounds

1. Turn on **Multiple rounds**.
2. Click **Add round**.
3. Give each round a **title**.
4. Add an optional **reward**.
5. Assign each question to a round.
6. Reorder rounds with the up/down buttons.

Each round has its own winner and leaderboard. In a standard quiz, the host can use **Break tie** when scores are tied.

### Live game

Choose **Live game** under **Game settings › Game type** to give everyone an avatar on the player stage. Edit your avatar from the top-right corner of the lobby. **Credits** opens the artwork sources, and **Back to room** returns to the lobby.

Names and answers appear after submissions close. Choose **All at once**, **One at a time**, or **One at a time · automatic** under **Answer reveal**. Set an interval of 1–30 seconds in quiz or room settings, and use **Pause auto reveal** to resume manual turns. Both players lose a life when their matching answers are revealed.

During play the header shows your remaining hearts. Tap the room code to copy it. Scroll past the active players to see spectator cards in the same list. In elimination games, numbered final standings put survivors first, followed by the players eliminated last. Players eliminated together share a rank. **Detailed results** and downloads include the final ranks.

### Competition

Open **Game settings › Competition** to set starting lives and choose when they reset. Players with zero lives watch until the next reset. When a challenge ends with multiple survivors, they share the win.

- **Don’t Repeat Each Other** flags blank and repeated answers. Use the check and cross controls in **Review answers** to approve or reject all submitted answers. When rejecting an individual answer, tap a quick reply or write a note. **Copy for AI** copies the question and numbered answers. Paste the AI’s JSON code block in **Paste JSON**. You can revise decisions before choosing **Apply results**. Review notes also appear in Detailed results.
- **Don’t Say the Same Thing as Me** uses the secret text or choice saved with the question. The room locks that answer when hosted. Matching or blank answers cost one life.
- In a standard quiz, **Answer reveal** controls named sharing for each question. Autoplay waits for the host when a reveal or review needs their input.
- **Teams** supports different capacities, such as one versus twelve. Choose automatic assignment or let players pick. Team points use the average across each team’s starting roster. Team elimination supports individual or shared lives.

---

## 5. Chat Access

Apply for access or use a **one-time 12-digit invitation code**.

### Apply for access

Open **Settings › Account settings › Room chat access** and click **Apply for chat access** beside **Unlock chat**. The button is also available inside your room. Your signed-in email identifies the request, so there is no extra application form.

**Request pending** means it is waiting for review. Approval enables chat for your account and quizzes. If declined, the page shows when you can apply again; the waiting period is seven days. Repeating an application does not create duplicate requests.

### Add the code to your account

1. Open **Settings › Account settings**.
2. Go to **Room chat**.
3. Enter the **12-digit invitation code**.
4. Click **Unlock chat**.

Inside a room, open **Settings › Chat settings › Unlock chat**.
One code unlocks chat for your account and all your future quizzes.
A code can only be used once.

### Choose when chat opens

In the quiz editor, open **Game settings › Room chat** and choose:

- **Off**
- **Lobby and finish**
- **Lobby, breaks & finish**
- **Lobby & round breaks**

You can also turn **Replies**, **Emoji reactions** and **Participant mentions** on or off. Participant mentions are off by default.

Chat stays closed during countdowns and questions. Choose **Lobby, breaks & finish** to open it during answer reveals. Enabled chat stays open for 15 minutes after the quiz ends.
The host can clear all chat messages or remove a single message.
When chat is open, a hint above the message box shows who is typing.

### Mentions

Type **@** in an open chat to choose a name. The host can also use **@all** to mention everyone. Participants can mention other people only when **Participant mentions** is enabled; they cannot mention **@all**.

The list supports tapping a name, arrow keys and Enter or Tab. Press Escape to close it. A badge on **Chat** marks unread mentions. Only the person mentioned sees their name highlighted; other people see normal text. Hiding chat stops its mention badges. The chat button is available only when the host allows chat. Announcements clear at the end. Chat messages are deleted when the room expires.

---

## 6. Host a Quiz

1. Go to **My quizzes**.
2. Click **Host** on a saved quiz.
3. A **6-digit room code** is created.
4. Share the code, or click **Copy link**.
5. Wait for participants to join.
6. Click **Start quiz**.

You can also choose **Host** inside the editor. It saves the quiz first.

### Lobby Controls

- **Start quiz** – begins the quiz.
- **Open / Locked** – lock the room to block new players.
- **Remove (×)** – kick a player.
- **Copy link** – copies the invite link.

### During a Question

- Host sees how many players answered.
- Click **Reveal answer** to show the correct answer and answer counts. The leaderboard also shows when **Show leaderboard** is on.
- Click **Next question** to continue.
- On the last question, the button becomes **Results**.
- Click **End quiz** during the quiz to finish early.

### Round Results

- Shows the round winner and reward.
- **Break tie** if players are tied.
- **Next round** continues the quiz.
- **Finish quiz** ends the quiz.

### Host Announcements

1. In the room, click **Announce**.
2. Type a short message (up to 240 characters).
3. Click **Send to everyone**.

Announcements appear for all players in the lobby and between questions or rounds.
They are hidden during countdowns and questions.
Use **Remove announcement** to delete it.

For a live countdown, write **Quiz starting in {20} minutes**. The number in braces becomes a clock for everyone. Use one whole number from **1 to 60** per announcement. The countdown keeps its original end time after reconnecting, stops at zero, and does not start the quiz automatically.

### After the Quiz

Host can:

- **Save results** – keeps the leaderboard and round summary in **My quizzes › Results**.
- **Detailed results** – opens the host-only question, participant and round analysis.
- **CSV** – downloads the results.
- **Random draw** – draw from the final results list. Choose all eligible players, those with a correct answer, or the top scorers.

### Detailed results

Open **Detailed results** after finishing a quiz. The overview shows accuracy,
response rates, average response times and scores combined across every round.
Select a pie slice to see its count and percentage. Open **Responses** and switch
between **Questions** and **Participants**. Each question card groups the question,
correct answer, **Answer breakdown** and **Explanation**, with participant responses
below. Search for a participant to open their report. **Rounds** shows round points.

**Save report** in Detailed results retains the full report in **My quizzes › Results**.
The completion screen’s **Save results** retains only the summary unless you
have already saved the details. Unsaved details expire after **15 minutes**, even
when you save the summary.

Open **Download results**, choose a quiz report or participant reports, select PDF,
HTML or CSV, and download. **Customize** contains optional sections and details.
PDF and HTML use Gather’s dark appearance. Participant reports contain only that
participant’s results; ZIP downloads keep each report separate.

To delete a saved report, open **My quizzes › Results**, use its delete button,
and confirm **Delete results**.

Unsaved results are deleted **15 minutes** after the quiz ends.
Ended rooms clear after **15 minutes**. Abandoned rooms expire after **24 hours**.

From **My quizzes › Open rooms**, the host can rejoin, close one room, or close all rooms.

---

## 7. Join a Quiz (Participants)

1. Open the website.
2. Click **Join quiz**.
3. Enter the **6-digit code**.
4. Enter your name.
5. Click **Join**.

Participants wait in the lobby until the host starts.

An unknown or expired code shows **Room not available**, with a link to try another code. If the service cannot be reached, the page gives a connection error instead of loading indefinitely. An offline connection stays marked **Offline** until it can retry.

Temporary disconnections reconnect automatically. Returning participants keep their identity, score and submitted answers; missed chat mentions are restored from the room history. Countdown clocks resync when the connection returns. You can rejoin an open room from the same browser. **Terms and Conditions** and **Privacy Policy** are linked at the bottom of the Join quiz page.

During the quiz participants see the question, timer, answer choices and their score.
After the quiz, participants see the leaderboard if the host allows it.

---

## Live room tools

Open **Room Settings › Autoplay** to start now, after a delay, or at a time within 24 hours of opening the room. The start countdown appears to the left of Chat. Under **Timing**, set the wait between questions and rounds and the question countdown. The default wait between questions is five seconds. **Finish when everyone answers** reveals the answer during manual play or Autoplay. Round results stay up for at least five seconds and are available at the end.

Autoplay pauses when everyone disconnects or after five minutes without an answer once the quiz starts. Reopen the room and choose **Resume Autoplay** or take over with manual controls.

Pause or resume Autoplay in room Settings. **Use manual controls** turns automatic progression off. **Remember timing on this device** reuses your choices in future rooms.

Open a room with **Host**, then choose **Settings › Play mode** before starting. **Host only** runs the quiz for others. **Group play** lets you answer too. Share the room code to invite friends.

In a multiplayer room, open **Settings › Just for fun** and check the players who are playing for fun. They answer and play as usual. Standings, reports and prize draws exclude them. Uncheck a player to include them again. Changes save automatically and lock when final results appear.

Choose **Solo play** for private practice. **Save and leave** pauses your timer and keeps your answers. Reopen the practice from **My quizzes › Open rooms** within 24 hours of opening the room and select **Resume practice**. Use **Review answers** when you finish.

Open **Settings › Chat settings** to change chat permissions, or use **Announce** to send a room announcement. Announcement countdowns use `{20}` for 1–60 minutes and do not start the quiz. Start and advance questions with the usual host controls.

## Find and organise quizzes

**Search** opens the search field when needed. **Filter** opens a compact menu for tags, hosting status and sorting by newest, oldest, recent edits, recent hosting or name. Close it with **×**, Escape or a click outside. **Clear filters** restores the default view while keeping your search. **Sample quiz**, **Import quiz**, **Host quiz prompt** and **Solo play prompt** are in the page footer. Hosted quizzes have a subtle green treatment and can be hosted again. Available saved results and room history identify earlier sessions; old sessions without retained history cannot be recovered.

## Site News and Settings

When site news is available, a thin bar appears below the header. Its badge and headline link to the update. Use **×** to dismiss that publication on your device. A new publication can appear again. Removal and expiry hide the bar; connected visitors receive changes without refreshing.

Open **Settings** from the header:

- **Account settings**: change your password, manage room chat access, sign out or delete your account.
- **Usage**: see uploaded images, saved quizzes and detailed results. Default limits are **200 images**, **100 quizzes**, **200 detailed results** and **500 participants per quiz**. Delete old data to reduce usage. Each **Delete all** action requires typing `DELETE`. Deleting all images also removes them from quizzes and results that use them; close your open rooms first. Saved summaries do not use the detailed results allowance.
- **Request higher limits**: choose Teacher, Professor or Other, briefly explain why you need more room. You do not need to choose limits. Your request status and any custom reply appear in Usage. New applications may be temporarily paused. Approved limits apply to future saves and new rooms. Existing rooms keep their original participant limit.
- **About Gather**: version, changelog, repository, contact and policies. Policy links return to About Gather.

Existing content is kept if an account is above a new default limit; remove data or request higher limits before saving more. Saved results load in pages, and full answers load when opened. Deleting a quiz keeps its saved results and open room. Deleting your account removes saved data, usage requests and chat applications. Clearing browser site data removes session details and remembered dismissals.

---

## Quick Start

1. Sign in.
2. **My quizzes › New quiz**.
3. Add title and questions.
4. Set countdown, scoring and chat.
5. **Save**.
6. **Host**.
7. Share the 6-digit code.
8. **Start quiz**.
9. Reveal answers, use **Announce**, then finish and save results.

To support Gather, open **Settings › Buy me a coffee**. This opens the Gather support page in a new tab.

## Support Gather

Open **Settings › How to use Gather** for the quiz guide, then use **Share Gather** to send a short invitation with the site link. **Buy me a coffee** opens the [support page](https://buymeacoffee.com/gatherlive).

## Join verification

In the waiting room, open **Settings › Two-step verification** and enable **Require a second code**. Open **Verification code** from the lobby when you want to show it. Participants enter the room code and this second code from your screen. The second code changes every 30 seconds. Verification is off by default, and returning participants can reconnect with their existing session.

Room-code guessing, failed verification and rapid messages are rate limited. On the hosted site, current questions travel over secure connections; answers and future question content remain on the server until needed. Copy and image-drag controls discourage casual copying during a question. Anything visible on a screen can still be captured.

Large photo uploads are optimized when a smaller image preserves clarity. Small images, diagrams and animation are kept unchanged when compression would reduce quality.
