import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import rimraf from 'rimraf'
import compress_images from 'compress-images'
import extractzip from 'extract-zip'
//import unzipper from 'unzipper'

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
app.get('/initial',(req,res)=>{
    const __dirname = path.resolve(path.dirname(''));
    rimraf(path.join(__dirname,'./uploads/*'),()=>{
        console.log("Initial deletes!")
    })
    rimraf(path.join(__dirname,'./output/*'),()=>{
        console.log("Successfully deleted compressed folder!")
    })
    rimraf(path.join(__dirname,'./log/*'),()=>{
        console.log("Successfully deleted Log folder!")
    })
    rimraf(path.join(__dirname,'./FinalZip/*'),()=>{
        console.log("Initial deletes!")
    })
    rimraf(path.join(__dirname,'./compressed/*'),()=>{
        console.log("Initial deletes!")
    })
    console.log('Initial Deletes')
    res.send("ok")
})

app.post('/upload',(req,res)=>{

    const __dirname = path.resolve(path.dirname(''));
    async function Extract(source,target){
        try {
            await extractzip(source,{dir : target},(err,file)=>{
                console.log(file)
            })
        }catch(err){
            console.log("Extracting Zip error!")
        }
    }
    upload(req,res,(err)=>{
        if(err){
            console.log(err)
        }else{
            console.log(req.file)
            //const zip = new admzip(`${req.file.path}`)
            //zip.extractAllTo('./output')
            
                const source = req.file.path
                const target = __dirname+'/output'
                extractzip(source,{dir : target}).then(()=>{
                    console.log('done')
                    rimraf(path.join(__dirname,'./uploads/*'),()=>{
                        console.log("Successfully deleted!")
                    })
    
                    var Name = readAllFolder('./output/')
                    console.log(Name)
                    if(Name.length){
                        res.status(200).send({message:true,name: "/"+Name})
                    }else{
                        res.status(200).send({message:true,name: ""})
                    }
                })
                function readAllFolder(dirMain){
                    const readDirMain = fs.readdirSync(dirMain);
                    console.log(readDirMain);
                    for(let i of readDirMain){
                        var stats = fs.statSync(dirMain+i)
                        if(stats.isFile()){
                            return ""
                        }
                    }
                    return readDirMain[0]
                }
                    /*const readDirMain = fs.readdirSync(dirMain);
                    console.log(readDirMain);
                    for(let i of readDirMain){
                        var stats = fs.statSync(dirMain+i)
                        if(stats.isDirectory()){
                            var read2 = fs.readdirSync(dirMain+i)
                            for(let j of read2){
                                if(j.endsWith('.json')){
                                    return i;
                                }
                            }
                        }
                    }*/
                  
                  }
    })
    
    
})

app.post('/update',(req,res)=>{
    let name = req.body.name
    const __dirname = path.resolve(path.dirname(''));
    let dir = Buffer.from(path.join(`./output${name}`))
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
            compress_images(`./output${name}/images/**/*{jpg,JPG,jpeg,JPEG,png,svg,gif}`, OUTPUT_path, { compress_force: false, statistic: true, autoupdate: true }, false,
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
        var z = ""
        if(imageName.endsWith('.png')){
            z = "data:image/png;base64,"
        }
        if(imageName.endsWith('.jpeg')){
            z="data:image/jpeg;base64,"
        }
        if(imageName.endsWith('.jpg')){
            z="data:image/jpg;base64,"
        }
        return z + fs.readFileSync(`./compressed/${imageName}`,'base64')  //Take care of the name of the folder as images
    }
    function TaskToUpdate(JsonFileName) {
        let JsonData=[]
        console.log(JsonFileName)
        fs.readFile(`./output${name}/${JsonFileName}`,'utf-8',(err,data)=>{
            if(err) console.log(err);
            else{
                JsonData.push(JSON.parse(data))
                JsonData.map(card=>(
                    card.assets.map(res1=>(
                        ('p' in res1)?(
                            res1.u="",res1.e=1,(res1.p.length<80) ?(
                                res1.p = convertImageToBase64(res1.p)
                            ) : ''
                        ):""
                    ))
                ))
               
                fs.writeFile(`./output${name}/${JsonFileName}`,JSON.stringify(JsonData[0]),'utf-8',(err)=>{
                    if(err) console.log(err)
                    else console.log("Updates Done! Check the Json File")
                })
                
                rimraf(path.join(__dirname,'./compressed/*'),()=>{
                    console.log("Successfully deleted compressed folder!")
                })

                res.status(200).send({name:name,JsonFileName:JsonFileName,JsonData: JSON.stringify(JsonData[0])})
                
            }
        })
    }

})

app.post("/compress",(req,res)=>{
    const {name,JsonFileName} = req.body
    const __dirname = path.resolve(path.dirname(''));
    var stats = fs.statSync(`./output${name}/${JsonFileName}`)
        var size = stats['size']
        console.log(stats,size)
        //var outputPath = Date.now()+"-output.zip"
        //const zip = new admzip()
        
        //zip.addLocalFolder(`./output/${name}`)
        //fs.writeFileSync(`./FinalZip/${outputPath}`,zip.toBuffer())

        res.download(`./output${name}/${JsonFileName}`,err=>{
            console.log(err)
        })
})



app.listen(port,()=>console.log(`listening to port ${port}`))
