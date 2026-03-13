const OpenAI = require("openai")

const openai = new OpenAI({
 apiKey:process.env.OPENAI_KEY
})

async function summarize(text){

 const response = await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[
   {
    role:"user",
    content:`Summarize meeting:\n${text}`
   }
  ]
 })

 return response.choices[0].message.content
}

module.exports = summarize