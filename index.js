'use strict';
const express = require('express');
const clova = require('@line/clova-cek-sdk-nodejs');
const linebot = require('@line/bot-sdk');
const redis = require('redis');

/**
 * Configure Redis
 */
if (process.env.REDISTOGO_URL) {
    const rtg    = require('url').parse(process.env.REDISTOGO_URL);
    var db = redis.createClient(rtg.port, rtg.hostname);
    db.auth(rtg.auth.split(':')[1]);
} else {
    var db = redis.createClient();
}
db.on('error', err => {
    console.log('Error: ' + err);
});

const manzai = {
    0:['Hello,Agent. Nice to meet you.'],
    1:['Oh, really? Thank you.'],
    2:['Hey,Agent?','Shunsuke is a sloppy person.',' When He is working on something, he is unable to care about other things.','And he is a dirty man.'],
    3:[3],
    4:['Because you said me shut up.'],
    5:['Good-bye Agent.'],
};

/**
 * Configure ClovaSkill
 */
var STEP=0;
const rand = (min, max) => ~~(Math.random() * (max - min + 1) + min);

const clovaSkillHandler = clova.Client.configureSkill()
.onLaunchRequest(responseHelper => {
    const wakeup =[
        'Hello!',
        'YahYah!',
        'Hey! What is up?'
    ];
    responseHelper.setSimpleSpeech(
        clova.SpeechBuilder.createSpeechText(wakeup[rand(0,wakeup.length-1)],'en')
    );
    // db.set('step', 0);
})
.onIntentRequest(async responseHelper => {
    await db.get('step', (err, reply)=>{
        STEP = reply|0;
    });
    await db.get('step', (err, reply)=>{
        STEP = reply|0;
    });
    // STEP = await responseHelper.getSessionAttributes.step|0;
    const SpeechList = await manzai[STEP].map(e=> e instanceof Number ? clova.SpeechBuilder.createSpeechUrl('https://raw.githubusercontent.com/snst-lab/hello-clova/master/assets/audio/3sec.mp3') : clova.SpeechBuilder.createSpeechText(e,'en'));
    await responseHelper.setSpeechList(SpeechList);
    // await responseHelper.setSessionAttributes({'step' : 1+STEP});
    await db.set('step', 1+STEP|0);
})
.onSessionEndedRequest(responseHelper => {})
.handle();


/**
 * Configure LineBot
 */
const botConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};
const bot = new linebot.Client(botConfig);

const linebotHandler = (event) => {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  return db.set('message', event.message.text, (err, reply)=>{
       bot.replyMessage(event.replyToken, {
         type: 'text',
         text: reply
      });
  });
}


/**
 * Configure Server
 */
const app = new express();
app.post('/bot', linebot.middleware(botConfig), (req, res) => {
  Promise
    .all(req.body.events.map(linebotHandler))
    .then((result) => res.json(result));
});
app.post('/clova', clova.Middleware({ applicationId: "com.snst.helloclova" }), clovaSkillHandler);
app.get('/', (req, res)=>{
    res.send('Hello Clova!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));