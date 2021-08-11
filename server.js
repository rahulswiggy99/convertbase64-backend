import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import rimraf from 'rimraf'
import compress_images from 'compress-images'
import admzip from 'adm-zip'

const app = express()

app.use((req,res,next)=>{
    res.setHeader("Access-Control-Allow-Origin", "*"),
    res.setHeader("Access-Control-Allow-Headers", "*"),
    next()
})

const port=process.env.PORT||8000

app.use(express.static('../lottie-extractor/build'))
app.use(express.json())


const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req,file,cb){
        cb(null,file.fieldname+'-'+Date.now() + 
        path.extname(file.originalname))
    }
})

const upload = multer({
    storage:storage,
}).single("file")

//var maxSize =30*1024*1024
//var compressfilesupload = multer({storage:storage, limits:{fileSize:maxSize}}).single("file")

app.post('/upload',(req,res)=>{

    const __dirname = path.resolve(path.dirname(''));

    async function doInitialDeletes(){
        await rimraf(path.join(__dirname,'./output/*'),()=>{
            console.log("Successfully deleted compressed folder!")
        })
        await rimraf(path.join(__dirname,'./FinalZip/*'),()=>{
            console.log("Initial deletes!")
        })
        await rimraf(path.join(__dirname,'./compressed/*'),()=>{
            console.log("Initial deletes!")
        })
    }
    
    doInitialDeletes()

    upload(req,res,(err)=>{
        if(err){
            console.log(err)
        }else{
            console.log(req.file)
            const zip = new admzip(`${req.file.path}`)
            zip.extractAllTo('./output')
                
                rimraf(path.join(__dirname,'./uploads/*'),()=>{
                    console.log("Successfully deleted!")
                })
            }
            res.status(200).send({message:true,name: req.file.originalname})
    })
    
    
})

app.post('/update',(req,res)=>{
    let name = req.body.name
    const __dirname = path.resolve(path.dirname(''));
    name = name.substr(0,name.length-4)
    let dir = Buffer.from(path.join(`./output/${name}`))
    let Files = fs.readdirSync(dir)

    let JsonFileName=""
    for(var i of Files) {
        if(i.endsWith('.json')){
            JsonFileName=i;
            break;
        }
    }
    console.log(JsonFileName)
    var OUTPUT_path = "./compressed/";
    const ProcessImages=()=>{          //creates a new compresed folder where all the compressed images are stored
        return new Promise((resolve, reject)=>{
            compress_images(`./output/${name}/images/**/*{jpg,JPG,jpeg,JPEG,png,svg,gif}`, OUTPUT_path, { compress_force: false, statistic: true, autoupdate: true }, false,
            { jpg: { engine: "mozjpeg", command: ["-quality", "60"] } },
            { png: { engine: "pngquant", command: ["--quality=20-50", "-o"] } },
            { svg: { engine: "svgo", command: "--multipass" } },
            { gif: { engine: "gifsicle", command: ["--colors", "64", "--use-col=web"] } },
            function (error, completed, statistic) {
                console.log("-------------");
                console.log(error);
                console.log(completed);
                console.log(statistic);
                console.log("-------------");
                if(completed){                          // when the process is finished then completed = true and triggers TaskToUpdate func
                    console.log("Compression Completed uploads folder")
                    TaskToUpdate(JsonFileName)
                }
            }
        );
    })

    };
    async function dotaskToCompress(){
        console.log("Started Compressing")
        await ProcessImages()
    }

    dotaskToCompress()
    function convertImageToBase64(imageName) {
    
        return fs.readFileSync(`./compressed/${imageName}`,'base64')  //Take care of the name of the folder as images
    }
    function TaskToUpdate(JsonFileName) {
        let JsonData=[]
        console.log(JsonFileName)
        fs.readFile(`./output/${name}/${JsonFileName}`,'utf-8',(err,data)=>{
            if(err) console.log(err);
            else{
                JsonData.push(JSON.parse(data))
                JsonData.map(card=>(
                    card.assets.map(res1=>(
                        ('p' in res1)?(
                            (res1.p.length<80) ? res1.p = convertImageToBase64(res1.p) : ''
                        ):""
                    ))
                ))

                fs.writeFile(`./output/${name}/${JsonFileName}`,JSON.stringify(JsonData[0]),'utf-8',(err)=>{
                    if(err) console.log(err)
                    else console.log("Updates Done! Check the Json File")
                })
                
                rimraf(path.join(__dirname,'./compressed/*'),()=>{
                    console.log("Successfully deleted compressed folder!")
                })
                
            }
        })
        res.status(200).send({name:name,JsonFileName:JsonFileName})
    }

})

app.post("/compress",(req,res)=>{
    const {name,JsonFileName} = req.body
    const __dirname = path.resolve(path.dirname(''));
    var stats = fs.statSync(`./output/${name}/${JsonFileName}`)
        var size = stats['size']
        console.log(stats,size)
        var outputPath = Date.now()+"-output.zip"
        const zip = new admzip()
        
        zip.addLocalFolder(`./output/${name}`)
        fs.writeFileSync(`./FinalZip/${outputPath}`,zip.toBuffer())
        rimraf(path.join(__dirname,'./output/*'),()=>{
            console.log("Output Final deletes!")
        })
        res.download(`./FinalZip/${outputPath}`,err=>{
            console.log(err)
        })
})



app.listen(port,()=>console.log(`listening to port ${port}`))

 //zip.writeZip(__dirname+"/"+outputPath)
        //const data = zip.toBuffer()
        //res.set('Content-Type','application/octet-stream');
        //res.set('Content-Disposition',`attachment; filename=${outputPath}`);
        //res.set('Content-Length',data.length);
        //res.send(data);