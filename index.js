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


/**
 * Configure ClovaSkill
 */
var MESSAGE;
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
})
.onIntentRequest(async responseHelper => {
    const uh = [
        'Uh..',
        'Umm..',
        'Let me see..'
    ];
    await db.get('message', (err,reply)=>{
        MESSAGE=reply;
    });
    const SpeechList = await Array(5).fill().map(e=>clova.SpeechBuilder.createSpeechUrl('https://raw.githubusercontent.com/snst-lab/hello-clova/master/assets/audio/3sec.mp3'));
    SpeechList[0] = await MESSAGE==='...' ? clova.SpeechBuilder.createSpeechUrl('https://raw.githubusercontent.com/snst-lab/hello-clova/master/assets/audio/3sec.mp3') : clova.SpeechBuilder.createSpeechText(MESSAGE||'Are you crazy?','en');
    SpeechList[rand(2,3)] = clova.SpeechBuilder.createSpeechText(uh[rand(0,uh.length-1)],'en');
    SpeechList[rand(3,4)] = clova.SpeechBuilder.createSpeechText(uh[rand(0,uh.length-1)],'en');
    await responseHelper.setSpeechList(SpeechList);
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