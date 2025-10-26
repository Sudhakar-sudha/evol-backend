const express = require('express');
const dotenv =require('dotenv');

dotenv.config();

const app = express();

app.use(express.json());

app.get('/',(req,res)=>{
    res.send("Evol Backend is Running successfully");
})


const PORT =process.env.PORT || 5000
app.listen(PORT,()=>{
    console.log(`Backend is running in ${PORT} `)
})