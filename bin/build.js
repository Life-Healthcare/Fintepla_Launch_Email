const { execSync } = require("child_process");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const fs = require("fs");
const Minio = require("minio");
const mime = require("mime-types");

const buildPath = path.resolve(__dirname, "..", "build");
const srcPath = path.resolve(__dirname, "..", "src");
const imagesPath = path.join(srcPath, "img");
const htmlSrcFile = path.join(srcPath, "index.html");
const htmlBuildFile = path.join(buildPath, "index.html");
const images = fs.readdirSync(imagesPath);

if (!fs.existsSync(buildPath)) {
  fs.mkdirSync(buildPath);
}

if (fs.existsSync(htmlBuildFile)) {
  fs.unlinkSync(htmlBuildFile);
}

execSync(`npx css-inline ${htmlSrcFile} ${htmlBuildFile}`, {
  stdio: "inherit",
});

let html = fs.readFileSync(htmlBuildFile, "utf8");
function replaceAll(string, search, replace) {
  return string.split(search).join(replace);
}
images.forEach((image) => {
  // Skip over dotfiles
  if (image.startsWith(".")) {
    return;
  }

  html = replaceAll(
    html,
    `img/${image}`,
    `https://${process.env.ENDPOINT}/${process.env.BUCKET}/${process.env.BUCKET_PATH}/${image}`
  );
});

fs.writeFileSync(htmlBuildFile, html, "utf8");

const client = new Minio.Client({
  endPoint: process.env.ENDPOINT,
  useSSL: true,
  accessKey: process.env.ACCESS_KEY,
  secretKey: process.env.SECRET_KEY,
});

images.forEach((file) => {
  // Skip over dotfiles
  if (file.startsWith(".")) {
    return;
  }

  const image = path.join(imagesPath, file);
  const remoteFilePath = `${process.env.BUCKET_PATH}/${file}`;
  const stat = fs.statSync(image);
  const mimeType = mime.contentType(path.extname(image));
  const meta = {
    "Content-Type": mimeType,
    "Content-Size": stat.size,
  };

  client.fPutObject(process.env.BUCKET, remoteFilePath, image, meta, (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log(
      `Uploaded ${path.basename(image)} to https://${process.env.ENDPOINT}/${
        process.env.BUCKET
      }/${remoteFilePath}`
    );
  });
});
