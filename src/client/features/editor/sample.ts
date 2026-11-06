// Original, locally rendered illustrations keep this sample self-contained.
// Geography references: https://oceanservice.noaa.gov/facts/biggestocean.html
// https://oceanservice.noaa.gov/facts/howmanyoceans.html
// https://www.japan.go.jp/japan/flagandanthem/index.html
export function drawSampleImage(kind) {
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
    for (const y of [152, 328]) {
      ctx.beginPath(); ctx.ellipse(360, y, 152, 22, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = '#d2c6f3'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(360, 240, 176, 34, 0, 0, Math.PI * 2); ctx.stroke();
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

export function geographyQuestions(makeId, image = drawSampleImage) {
  const make = (type, prompt, labels, correct, explanation, extra = {}) => {
    const options = labels.map(text => ({id:makeId(),text,image:''}));
    return {id:makeId(),type,prompt,image:'',timeLimit:25,points:1000,explanation,
      ...(options.length ? {options,correct:correct.map(index => options[index].id)} : {}),...extra};
  };
  const flags = ['france','italy','germany','ireland'].map(image);
  const flagChoice = make('single','Which is the flag of France?',['','','',''],[0],
    'The French flag has blue, white and red vertical stripes, from left to right.');
  flagChoice.options.forEach((option, index) => { option.image = flags[index]; });
  return [
    make('single','Which country does this flag belong to?',['Japan','Canada','Switzerland','Denmark'],[0],
      'Japan’s national flag has a red disc on a white background.',{image:image('japan')}),
    make('single','Which is the largest ocean on Earth?',['Atlantic Ocean','Indian Ocean','Pacific Ocean','Arctic Ocean'],[2],
      'The Pacific is the largest ocean basin.'),
    make('true_false','The Sahara Desert is in South America.',['True','False'],[1],
      'The Sahara is in northern Africa.'),
    flagChoice,
    make('single','What is the capital of Australia?',['Sydney','Melbourne','Canberra','Perth'],[2],
      'Canberra is Australia’s national capital.'),
    make('multi','Which TWO countries are in South America?',['Brazil','Spain','Peru','India'],[0,2],
      'Brazil and Peru are in South America. Spain is in Europe, and India is in Asia.',{timeLimit:30}),
    make('single','Which imaginary line is highlighted?',['Prime Meridian','Equator','Arctic Circle','Tropic of Cancer'],[1],
      'The Equator is at 0° latitude, halfway between the North and South Poles.',{image:image('equator')}),
    make('slider','How many oceans are commonly recognized on Earth?',[],[],
      'Five: Pacific, Atlantic, Indian, Southern and Arctic.',{min:1,max:10,target:5,tolerance:0}),
    make('short_answer','Which continent surrounds the South Pole?',[],[],
      'The South Pole is on Antarctica.',{acceptedAnswers:['Antarctica'],timeLimit:30}),
    make('order','Put these oceans in order, largest to smallest.',
      ['Pacific','Atlantic','Indian','Southern','Arctic'],[0,1,2,3,4],
      'By area: Pacific, Atlantic, Indian, Southern, then Arctic.',{timeLimit:35})
  ];
}
