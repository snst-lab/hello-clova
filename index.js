'use strict';
const express = require('express');
const clova = require('@line/clova-cek-sdk-nodejs');
const linebot = require('@line/bot-sdk');
const redis = require('redis');
const manzai = require('./manzai.js');

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
db.on('connect', ()=> console.log('Redis client connected.'));
db.on('error', err => console.log('Error: ' + err));


/**
 * Configure ClovaSkill
 */
var STEP, NAME;
const rand = (min, max) => ~~(Math.random() * (max - min + 1) + min);

const clovaSkillHandler = clova.Client.configureSkill()
.onLaunchRequest(responseHelper => {
    const wakeup =[
        'Hello! What is up?',
        'Hey! What is up?'
    ];
    responseHelper.setSimpleSpeech(
        clova.SpeechBuilder.createSpeechText(wakeup[rand(0,wakeup.length-1)],'en')
    );
    db.set('step', 0);
    db.get('name', (err, reply)=>{
        NAME = reply||'';
    });
})
.onIntentRequest(async responseHelper => {
    await db.get('step', (err, reply)=>{
        STEP = reply|0;
        db.set('step', 1+STEP);
    });
    const speechList = await manzai[STEP].map(e=> e ? clova.SpeechBuilder.createSpeechText(e.replace(/AGENT/g,NAME||''),'en') : clova.SpeechBuilder.createSpeechUrl('https://raw.githubusercontent.com/snst-lab/hello-clova/master/assets/audio/1sec.mp3'));
    await responseHelper.setSpeechList(speechList);
    if(STEP>=manzai.length-1){
        responseHelper.endSession();
    }
})
.onSessionEndedRequest(responseHelper => {
    db.set('step', 0);
})
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
  return db.set('name', event.message.text, (err, reply)=>{
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