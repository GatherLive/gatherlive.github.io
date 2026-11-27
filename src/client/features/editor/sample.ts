import type {Question, QuestionType, QuizRound} from '../../../shared/types.js';

// Original, locally rendered illustrations keep this sample self-contained.
// Geography references: https://oceanservice.noaa.gov/facts/biggestocean.html
// https://oceanservice.noaa.gov/facts/howmanyoceans.html
// https://www.japan.go.jp/japan/flagandanthem/index.html
export function drawSampleImage(kind: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the sample images.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 720, 480);
  if (kind === 'japan') {
    ctx.fillStyle = '#bc002d'; ctx.beginPath(); ctx.arc(360, 240, 144, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'equator') {
    ctx.fillStyle = '#202020'; ctx.fillRect(0, 0, 720, 480);
    ctx.fillStyle = '#29363e'; ctx.beginPath(); ctx.arc(360, 240, 176, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b8791'; ctx.lineWidth = 2;
    for (const width of [60, 120, 176]) {
      ctx.beginPath(); ctx.ellipse(360, 240, width, 176, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const y of [152, 240, 328]) {
      const half = Math.sqrt(176 ** 2 - (y - 240) ** 2);
      ctx.beginPath(); ctx.moveTo(360 - half, y); ctx.lineTo(360 + half, y); ctx.stroke();
    }
    ctx.fillStyle = '#f1f0ec'; ctx.font = '500 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', 360, 40); ctx.fillText('S', 360, 458);
  } else {
    const flags = {france:['#000091','#ffffff','#e1000f'],italy:['#009246','#ffffff','#ce2b37'],germany:['#161616','#dd0000','#ffce00'],ireland:['#169b62','#ffffff','#ff883e']};
    const colors = flags[kind];
    if (!colors) throw new Error('Unknown sample illustration.');
    colors.forEach((color, index) => {
      ctx.fillStyle = color;
      if (kind === 'germany') ctx.fillRect(0, index * 160, 720, 160);
      else ctx.fillRect(index * 240, 0, 240, 480);
    });
  }
  return canvas.toDataURL('image/png');
}

export function geographySample(makeId: () => string, image = drawSampleImage) {
  const make = (type: QuestionType, prompt: string, details: Partial<Question> = {}): Question => ({
    id: makeId(), type, prompt, timeLimit: 25, points: 1000, image: '', explanation: '', ...details
  });
  const choice = (type: QuestionType, prompt: string, labels: string[], correct: number[], details: Partial<Question> = {}) => {
    const options = labels.map(text => ({id: makeId(), text, image: ''}));
    return make(type, prompt, {options, correct: correct.map(index => options[index].id), ...details});
  };
  const oceans = ['Pacific', 'Atlantic', 'Indian', 'Southern', 'Arctic'];
  const flagChoice = choice('single', 'Which is the flag of France?', ['', '', '', ''], [0], {
    explanation: 'The French flag has blue, white and red vertical stripes, from left to right.'
  });
  ['france', 'italy', 'germany', 'ireland'].forEach((flag, index) => { flagChoice.options[index].image = image(flag); });

  const avoidOcean = choice('single', 'Pick an ocean. Try to avoid the host’s choice.', oceans, [], {points: 0});
  avoidOcean.competition = {mode: 'avoid-host', secretAnswer: avoidOcean.options[0].id, reveal: 'all', publicAnswers: true};

  // Each round starts with three lives. No round can end before its final question through elimination.
  const sections = [
    {title: 'First stops', questions: [
      choice('single', 'Which country does this flag belong to?', ['Japan', 'Canada', 'Switzerland', 'Denmark'], [0], {
        image: image('japan'), explanation: 'Japan’s national flag has a red disc on a white background.'
      }),
      choice('true_false', 'The Sahara Desert is in South America.', ['True', 'False'], [1], {
        explanation: 'The Sahara is in northern Africa.'
      }),
      choice('poll', 'Where would you rather spend a weekend?', ['At the coast', 'In the mountains', 'In a city', 'In the countryside'], [], {points: 0})
    ]},
    {title: 'Continents', questions: [
      choice('multi', 'Which two countries are in South America?', ['Brazil', 'Spain', 'Peru', 'India'], [0, 2], {
        timeLimit: 30, explanation: 'Brazil and Peru are in South America. Spain is in Europe, and India is in Asia.'
      }),
      make('short_answer', 'Which continent surrounds the South Pole?', {
        acceptedAnswers: ['Antarctica'], timeLimit: 30, explanation: 'The South Pole is on Antarctica.'
      }),
      make('word_cloud', 'Name a country you’d like to visit.', {points: 0})
    ]},
    {title: 'Oceans', questions: [
      make('slider', 'How many oceans are commonly recognized on Earth?', {
        min: 1, max: 10, target: 5, tolerance: 0, explanation: 'Five oceans are commonly recognized.'
      }),
      choice('order', 'Put these oceans in order from largest to smallest.', oceans, [0, 1, 2, 3, 4], {
        timeLimit: 35, explanation: 'By area, the order is Pacific, Atlantic, Indian, Southern, then Arctic.'
      }),
      make('open_ended', 'What would you like to explore beneath the ocean surface?', {points: 0, timeLimit: 35})
    ]},
    {title: 'Maps and flags', questions: [
      make('slide', 'The lines that run around a globe from east to west show latitude. Latitude measures how far north or south a place is.', {points: 0}),
      make('pin', 'Place a pin anywhere along the Equator.', {
        image: image('equator'), timeLimit: 30, answerRegion: {shape: 'box', x: .5, y: .5, width: .5, height: .1},
        explanation: 'The Equator sits at 0° latitude, halfway between the North and South Poles.'
      }),
      flagChoice
    ]},
    {title: 'Live challenges', questions: [
      make('short_answer', 'Name an island nobody else will choose.', {
        points: 0, competition: {mode: 'unique', reveal: 'all', publicAnswers: true}
      }),
      avoidOcean,
      make('short_answer', 'Name a country in Africa. Try to avoid the host’s answer.', {
        points: 0, competition: {mode: 'avoid-host', secretAnswer: 'Kenya', reveal: 'all', publicAnswers: true}
      })
    ]}
  ];
  const questions = sections.flatMap(section => section.questions);
  const rounds: QuizRound[] = sections.map(section => ({
    id: makeId(), title: section.title, reward: '', questionIds: section.questions.map(question => question.id)
  }));
  return {questions, rounds};
}
